"""
==============================================================================
TALLY SYNC AGENT — STANDALONE CLIENT FOR SERVER / cPANEL DEPLOYMENT MODE
==============================================================================
This standalone script runs on the office Windows PC (where Tally Prime resides).
It polls your remote Django server (hosted on cPanel or cloud) for pending
Purchase Invoices, posts their XML payloads to local Tally Prime over HTTP (port 9000),
and reports the execution status back to the remote server.

SETUP & RUNNING INSTRUCTIONS:
1. Ensure Python 3.x and `requests` package are installed on the local PC:
   pip install requests
2. Edit the CONFIG section below with your cPanel domain name and API token.
3. Keep this script running on the Tally PC (e.g., via Windows Task Scheduler,
   pythonw.exe background process, or leaving a command prompt open).
==============================================================================
"""

import time
import requests
import sys

# ==============================================================================
# CONFIGURATION
# ==============================================================================
API_BASE_URL = "http://localhost:8000"  # Replace with your cPanel domain e.g. "https://your-domain.com"
API_TOKEN = "your-tally-agent-api-token-here"  # Must match TALLY_AGENT_API_TOKEN in backend settings.py
TALLY_SERVER = "localhost"
TALLY_PORT = "9000"
POLL_INTERVAL = 10  # Seconds between polls


def send_xml_to_local_tally(xml_data: str, tally_url: str) -> tuple[bool, str, str | None]:
    """Posts XML directly to the local Tally Prime HTTP server."""
    try:
        response = requests.post(
            tally_url,
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'text/xml'},
            timeout=15
        )
        response_text = response.text or ""

        is_success_xml = (
            ('<CREATED>' in response_text.upper() or 'CREATED' in response_text.upper() or 'ALTERED' in response_text.upper())
            and '<EXCEPTIONS>0</EXCEPTIONS>' in response_text.upper()
            and 'LINEERROR' not in response_text.upper()
        )
        is_success_text = ('Created' in response_text or 'Altered' in response_text) and 'LINEERROR' not in response_text.upper()

        if response.status_code == 200 and (is_success_xml or is_success_text):
            return True, response_text, None
        else:
            err_msg = f"Tally rejected XML payload (HTTP {response.status_code})."
            if 'LINEERROR' in response_text:
                err_msg += f" Response details: {response_text[:400]}"
            elif response_text:
                err_msg += f" Response: {response_text[:300]}"
            return False, response_text, err_msg

    except requests.exceptions.ConnectionError:
        err = f"Could not connect to Tally on {tally_url}. Is Tally running with HTTP port 9000 enabled?"
        return False, "", err
    except requests.exceptions.Timeout:
        err = f"Request to local Tally on {tally_url} timed out after 15s."
        return False, "", err
    except Exception as e:
        err = f"Error pushing XML to Tally: {str(e)}"
        return False, "", err


def run_agent():
    tally_url = f"http://{TALLY_SERVER}:{TALLY_PORT}"
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "X-Tally-Token": API_TOKEN,
        "Content-Type": "application/json"
    }

    print("=" * 60)
    print("      TALLY PURCHASE INVOICE SYNC AGENT (SERVER MODE)")
    print("=" * 60)
    print(f" Server Endpoint : {API_BASE_URL}")
    print(f" Local Tally URL : {tally_url}")
    print(f" Poll Interval   : {POLL_INTERVAL} seconds")
    print("=" * 60)

    pending_url = f"{API_BASE_URL.rstrip('/')}/api/tally/purchase-invoices/pending/"
    report_url = f"{API_BASE_URL.rstrip('/')}/api/tally/purchase-invoices/report/"

    while True:
        try:
            # 1. Poll remote server for pending purchase invoices
            res = requests.get(pending_url, headers=headers, timeout=15)

            if res.status_code == 401:
                print(f"[ERROR] Unauthorized (401). Check API_TOKEN configuration.")
            elif res.status_code != 200:
                print(f"[WARNING] Server returned HTTP {res.status_code}: {res.text[:200]}")
            else:
                pending_items = res.json()
                if pending_items:
                    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Received {len(pending_items)} pending invoice(s) from server.")

                    for item in pending_items:
                        inv_id = item.get("id")
                        inv_no = item.get("invoice_no", "Unknown")
                        xml_payload = item.get("xml", "")

                        print(f"  -> Processing Invoice #{inv_no} (ID: {inv_id})...")

                        # 2. Send XML to local Tally
                        success, resp_text, err_msg = send_xml_to_local_tally(xml_payload, tally_url)

                        if success:
                            print(f"     [SUCCESS] Invoice #{inv_no} created/altered in Tally.")
                        else:
                            print(f"     [FAILED] Invoice #{inv_no}: {err_msg}")

                        # 3. Report sync result back to server
                        report_payload = {
                            "invoice_id": inv_id,
                            "success": success,
                            "response_text": resp_text,
                            "error_message": err_msg
                        }

                        try:
                            rep_res = requests.post(report_url, json=report_payload, headers=headers, timeout=15)
                            if rep_res.status_code == 200:
                                print(f"     [REPORTED] Status for #{inv_no} successfully reported to server.")
                            else:
                                print(f"     [WARN] Report failed with HTTP {rep_res.status_code}: {rep_res.text[:150]}")
                        except Exception as report_err:
                            print(f"     [ERROR] Could not send report back to server: {report_err}")

        except requests.exceptions.ConnectionError:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Cannot reach server at {API_BASE_URL}. Retrying in {POLL_INTERVAL}s...")
        except Exception as e:
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Unexpected agent error: {e}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_agent()
