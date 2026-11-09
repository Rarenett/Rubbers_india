import os
import time
import requests

# ---------------------------------------------------------
# Cloud Mode - Tally Sync Agent
# Runs on a remote office PC, polling the cloud server
# Config via environment variables:
# - SERVER_BASE_URL (e.g., https://api.mycloud.com)
# - TALLY_AGENT_API_KEY (must match backend settings)
# - TALLY_URL (default: http://localhost:9000)
# - POLL_INTERVAL (default: 15s)
# ---------------------------------------------------------

def main():
    server_url = os.environ.get('SERVER_BASE_URL', '').rstrip('/')
    api_key = os.environ.get('TALLY_AGENT_API_KEY', '')
    tally_url = os.environ.get('TALLY_URL', 'http://localhost:9000')
    interval = int(os.environ.get('POLL_INTERVAL', '15'))
    
    if not server_url or not api_key:
        print("Error: SERVER_BASE_URL and TALLY_AGENT_API_KEY environment variables are required.")
        return

    pending_url = f"{server_url}/api/tally/purchase-returns/pending/"
    report_url = f"{server_url}/api/tally/purchase-returns/report/"
    
    headers = {"X-API-Key": api_key}
    
    print(f"Starting Cloud Tally Agent...")
    print(f"Polling: {server_url}")
    print(f"Pushing to: {tally_url}")
    
    while True:
        try:
            # 1. Poll for pending
            resp = requests.get(pending_url, headers=headers, timeout=15)
            resp.raise_for_status()
            
            pending_items = resp.json()
            if pending_items:
                print(f"Found {len(pending_items)} pending items.")
                
                for item in pending_items:
                    pr_id = item.get('id')
                    return_no = item.get('return_no')
                    xml_data = item.get('xml')
                    
                    print(f"Pushing PR {return_no} (ID: {pr_id}) to Tally...")
                    
                    # 2. Push to Tally
                    tally_resp_text = ""
                    status = "failed"
                    error_msg = None
                    
                    try:
                        tresp = requests.post(tally_url, data=xml_data.encode('utf-8'), headers={'Content-Type': 'text/xml'}, timeout=10)
                        tally_resp_text = tresp.text
                        if tresp.status_code == 200 and ('Created' in tally_resp_text or 'Altered' in tally_resp_text):
                            status = "synced"
                        else:
                            error_msg = "Tally rejected the XML or did not return Created/Altered."
                    except Exception as e:
                        error_msg = f"Failed to reach Tally: {str(e)}"
                    
                    print(f"Result for {return_no}: {status}")
                    
                    # 3. Report back
                    report_data = {
                        "id": pr_id,
                        "status": status,
                        "tally_response": tally_resp_text,
                        "error_message": error_msg
                    }
                    try:
                        rresp = requests.post(report_url, json=report_data, headers=headers, timeout=10)
                        rresp.raise_for_status()
                    except Exception as e:
                        print(f"Failed to report status back to server: {str(e)}")
                        
        except Exception as e:
            print(f"Loop error: {str(e)}")
            
        time.sleep(interval)

if __name__ == '__main__':
    main()
