import requests
import xml.etree.ElementTree as ET
import logging
import re
from decimal import Decimal, InvalidOperation
from django.conf import settings
from finance_app.models import Ledger

logger = logging.getLogger('tally_sync')

# ─── XML template for fetching all ledger balances & credit limits ─────────────
# Uses the Tally Collection export API — supported by both ERP 9 and Tally Prime.
# No custom TDL report definition needed; just fetches the built-in Ledger master.
# ─── XML template for fetching all ledger balances & credit limits ─────────────
# Uses the standard 'List of Accounts' export which works natively in Tally ERP 9
# and Tally Prime without custom TDL. Tally returns this as an IMPORTDATA envelope.
LEDGER_FETCH_XML = """<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>"""


def _parse_tally_amount(raw_value: str) -> Decimal:
    """
    Parse a Tally amount string into a Decimal.
    Tally returns amounts like '1,23,456.78 Dr' or '-5000.00 Cr'.
    We return positive value for Dr (debit = money owed TO company = positive outstanding).
    We return negative value for Cr (credit = overpayment).
    """
    if not raw_value:
        return Decimal('0.00')
    
    raw = str(raw_value).strip()
    is_dr = raw.upper().endswith('DR')
    is_cr = raw.upper().endswith('CR')
    
    # Remove suffix and commas
    raw = re.sub(r'\s*(Dr|Cr)\s*$', '', raw, flags=re.IGNORECASE)
    raw = raw.replace(',', '').strip()
    
    try:
        value = Decimal(raw)
    except InvalidOperation:
        return Decimal('0.00')
    
    # In Tally: Dr means the party OWES money (positive outstanding for us)
    # Cr means they have credit / overpaid (negative outstanding)
    if is_cr:
        value = -abs(value)
    else:
        value = abs(value)
    
    return value


class TallyXMLService:
    """
    Fetches ledger data from Tally via its HTTP XML API (no ODBC needed).
    Works with Tally Prime and Tally ERP 9 running on the same machine.
    """

    def __init__(self):
        self.url = (
            f"http://{getattr(settings, 'TALLY_ODBC_SERVER', 'localhost')}"
            f":{getattr(settings, 'TALLY_ODBC_PORT', '9000')}"
        )
        self.timeout = 45  # 'List of Accounts' can take time for large companies

    def _post(self, xml: str) -> str | None:
        """Send XML to Tally and return the response text, or None on error."""
        try:
            response = requests.post(
                self.url,
                data=xml.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=self.timeout
            )
            response.raise_for_status()
            text = response.text.strip()
            if not text:
                logger.warning(
                    f"Tally returned an empty response (HTTP {response.status_code}). "
                    "Is a company open in Tally?"
                )
                return None
            logger.debug(f"Tally raw response ({len(text)} chars): {text[:500]}")
            return text
        except requests.exceptions.ConnectionError:
            logger.error(
                f"Cannot connect to Tally at {self.url}. "
                "Is Tally running with HTTP server enabled on port 9000?"
            )
        except requests.exceptions.Timeout:
            logger.error(
                f"Tally request timed out after {self.timeout}s. "
                "Tally may be busy or the company may not be open."
            )
        except requests.exceptions.HTTPError as e:
            logger.error(f"Tally returned HTTP error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error communicating with Tally: {e}")
        return None

    def fetch_ledger_data(self) -> list[dict]:
        """
        Fetch all ledger names, closing balances and credit limits from Tally.
        Returns a list of dicts: [{'name': ..., 'closing_balance': ..., 'credit_limit': ...}, ...]
        """
        raw = self._post(LEDGER_FETCH_XML)
        if not raw:
            return []

        import re
        # Aggressively remove all XML numeric character references (e.g. &#11; or &#x0B;)
        # because Tally frequently exports invalid low-ASCII control characters that crash ElementTree.
        clean_xml = re.sub(r'&#[0-9]+;', '', raw)
        clean_xml = re.sub(r'&#x[0-9a-fA-F]+;', '', clean_xml)
        # Also remove literal control characters just in case
        clean_xml = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', clean_xml)

        try:
            root = ET.fromstring(clean_xml)
        except ET.ParseError as e:
            logger.error(f"Failed to parse Tally XML response: {e}")
            logger.error(f"Raw response (first 500 chars): {raw[:500]}")
            return []

        # Check for Tally error response first
        line_error = root.find('.//LINEERROR')
        if line_error is not None and line_error.text:
            logger.error(f"Tally returned an error: {line_error.text.strip()}")
            return []

        ledger_data = []

        # 'List of Accounts' returns an IMPORTDATA envelope containing all masters.
        # We find all <LEDGER> tags.
        for ledger_el in root.findall('.//LEDGER'):
            name = ledger_el.get('NAME') or ledger_el.get('Name')
            if not name:
                name_el = ledger_el.find('NAME')
                if name_el is not None:
                    name = name_el.text

            if not name or not name.strip():
                continue

            closing_el = ledger_el.find('CLOSINGBALANCE')
            credit_el = ledger_el.find('CREDITLIMIT')

            closing_balance = _parse_tally_amount(
                closing_el.text if closing_el is not None else ''
            )
            credit_limit = abs(_parse_tally_amount(
                credit_el.text if credit_el is not None else ''
            ))

            ledger_data.append({
                'name': name.strip(),
                'closing_balance': closing_balance,
                'credit_limit': credit_limit,
            })

        if not ledger_data:
            logger.warning(
                f"Tally responded but returned 0 ledgers. "
                f"Response (first 800 chars):\n{raw[:800]}"
            )

        return ledger_data

    def sync_ledgers(self):
        """
        Synchronise closing balances and credit limits from Tally into Django Ledger records.
        Uses bulk_update for performance. Only updates records that actually changed.
        """
        logger.info("Starting Tally Ledger sync...")

        tally_data = self.fetch_ledger_data()

        if not tally_data:
            logger.warning("No data fetched from Tally or connection failed.")
            return

        tally_dict = {item['name']: item for item in tally_data}

        # --- ODBC Override for Closing Balance ---
        # The user requested to use the ODBC $_ClosingBalance field.
        # ODBC Credit = Positive, Debit = Negative. We invert it to match DB convention (Dr=Positive).
        import pyodbc
        try:
            conn = None
            for dsn in ['TallyODBC64_9000', 'TallyODBC_9000']:
                try:
                    conn = pyodbc.connect(f'DSN={dsn}', timeout=5)
                    break
                except Exception:
                    continue
            
            if conn:
                cursor = conn.cursor()
                cursor.execute('SELECT $Name, $_ClosingBalance FROM Ledger')
                for row in cursor.fetchall():
                    name = row[0]
                    cb = row[1]
                    if name and name.strip() in tally_dict:
                        if cb is not None:
                            # Invert sign: ODBC has Cr as positive, we want Dr as positive
                            tally_dict[name.strip()]['closing_balance'] = Decimal(str(-cb))
                cursor.close()
                conn.close()
                logger.info("Successfully merged $_ClosingBalance from Tally ODBC.")
            else:
                logger.error("Could not connect to any Tally ODBC DSN.")
        except Exception as e:
            logger.error(f"Failed to fetch closing balances via ODBC: {e}")
            logger.warning("Falling back to XML closing balances.")
        # -----------------------------------------

        # Only touch ledgers that exist in both Tally and Django
        existing_ledgers = Ledger.objects.filter(name__in=tally_dict.keys())

        ledgers_to_update = []
        for ledger in existing_ledgers:
            tally_info = tally_dict.get(ledger.name)
            if not tally_info:
                continue

            updated = False
            new_cb = tally_info['closing_balance']
            new_cl = tally_info['credit_limit']

            if Decimal(str(ledger.closing_balance)) != new_cb:
                ledger.closing_balance = new_cb
                updated = True

            if Decimal(str(ledger.credit_limit)) != new_cl:
                ledger.credit_limit = new_cl
                updated = True

            if updated:
                ledgers_to_update.append(ledger)

        if ledgers_to_update:
            try:
                Ledger.objects.bulk_update(
                    ledgers_to_update, ['closing_balance', 'credit_limit']
                )
                logger.info(
                    f"Sync complete. Updated {len(ledgers_to_update)} of "
                    f"{existing_ledgers.count()} matched ledgers."
                )
            except Exception as e:
                logger.error(f"Failed to bulk update ledgers: {e}")
        else:
            logger.info(
                f"Sync complete. No changes detected across "
                f"{existing_ledgers.count()} matched ledgers."
            )


# ── Backwards-compatible alias so scheduler.py doesn't need changes ────────────
TallyODBCService = TallyXMLService
