import requests
from django.core.management.base import BaseCommand

TALLY_URL = "http://localhost:9000"
HEADERS = {"Content-Type": "text/xml"}

def post(url, xml):
    return requests.post(url, data=xml.encode("utf-8"), headers=HEADERS, timeout=10)

class Command(BaseCommand):
    help = "Diagnose Tally connection and voucher type availability"

    def add_arguments(self, parser):
        parser.add_argument(
            "--tally-url",
            type=str,
            default=TALLY_URL,
            help="Tally Server URL",
        )

    def handle(self, *args, **options):
        url = options["tally_url"]
        self.stdout.write(self.style.WARNING(f"\nConnecting to Tally at {url} ...\n"))

        # ------------------------------------------------------------------ #
        # 1. Get active companies
        # ------------------------------------------------------------------ #
        self.stdout.write(self.style.SUCCESS("=== 1. Active Companies ==="))
        xml_companies = """<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA>
<REQUESTDESC>
<REPORTNAME>List of Companies</REPORTNAME>
<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
</REQUESTDESC>
</EXPORTDATA></BODY>
</ENVELOPE>"""
        try:
            r = post(url, xml_companies)
            self.stdout.write(r.text[:3000])
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))

        # ------------------------------------------------------------------ #
        # 2. Get voucher types
        # ------------------------------------------------------------------ #
        self.stdout.write(self.style.SUCCESS("\n=== 2. Voucher Types ==="))
        xml_vchtypes = """<ENVELOPE>
<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
<BODY><EXPORTDATA>
<REQUESTDESC>
<REPORTNAME>List of Voucher Types</REPORTNAME>
<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
</REQUESTDESC>
</EXPORTDATA></BODY>
</ENVELOPE>"""
        try:
            r = post(url, xml_vchtypes)
            self.stdout.write(r.text[:3000])
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))

        # ------------------------------------------------------------------ #
        # 3. Bare-minimum Sales Order import (no GST, no batch, no audit IDs)
        # ------------------------------------------------------------------ #
        self.stdout.write(self.style.SUCCESS("\n=== 3. Minimal Sales Order Test ==="))
        xml_minimal = """<ENVELOPE>
<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
<BODY>
<IMPORTDATA>
<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
<REQUESTDATA>
<TALLYMESSAGE xmlns:UDF="TallyUDF">
<VOUCHER VCHTYPE="Sales Order" ACTION="Create" OBJVIEW="Invoice Voucher View">
<DATE>20260701</DATE>
<VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
<VOUCHERNUMBER>DIAG-001</VOUCHERNUMBER>
<PARTYLEDGERNAME>Acme Corp</PARTYLEDGERNAME>
<ISINVOICE>Yes</ISINVOICE>
<ALLINVENTORYENTRIES.LIST>
<STOCKITEMNAME>Bottle Cap (250ml)</STOCKITEMNAME>
<RATE>65.00</RATE>
<AMOUNT>6500.00</AMOUNT>
<ACTUALQTY>100 Pieces</ACTUALQTY>
<BILLEDQTY>100 Pieces</BILLEDQTY>
<ACCOUNTINGALLOCATIONS.LIST>
<LEDGERNAME>Sales Local</LEDGERNAME>
<AMOUNT>6500.00</AMOUNT>
</ACCOUNTINGALLOCATIONS.LIST>
</ALLINVENTORYENTRIES.LIST>
<LEDGERENTRIES.LIST>
<LEDGERNAME>Acme Corp</LEDGERNAME>
<ISPARTYLEDGER>Yes</ISPARTYLEDGER>
<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
<AMOUNT>-6500.00</AMOUNT>
</LEDGERENTRIES.LIST>
</VOUCHER>
</TALLYMESSAGE>
</REQUESTDATA>
</IMPORTDATA>
</BODY>
</ENVELOPE>"""
        self.stdout.write(self.style.WARNING("Sending minimal XML:\n" + xml_minimal))
        try:
            r = post(url, xml_minimal)
            self.stdout.write(self.style.WARNING(f"\nTally Response:\n{r.text}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
