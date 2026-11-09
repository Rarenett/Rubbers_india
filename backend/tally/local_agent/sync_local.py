import os
import sys
import time

# Bootstrap Django
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(base_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from django.conf import settings
from purchase_app.models import PurchaseReturn
from tally.sync_log import get_pending_ids
from tally.services import push_purchase_return_to_tally

def main():
    interval = int(os.environ.get('POLL_INTERVAL', '15'))
    tally_url = os.environ.get('TALLY_URL', getattr(settings, 'TALLY_LOCAL_URL', 'http://localhost:9000'))
    
    print(f"Starting Local Tally Connector on {tally_url} with {interval}s interval.")
    
    while True:
        try:
            all_ids = list(PurchaseReturn.objects.values_list('id', flat=True))
            pending_ids = get_pending_ids(all_ids)
            
            if pending_ids:
                print(f"Found {len(pending_ids)} pending purchase returns. Processing...")
                pending_qs = PurchaseReturn.objects.filter(id__in=pending_ids)
                
                for pr in pending_qs:
                    print(f"Processing PR {pr.return_no} (ID: {pr.id})...")
                    res = push_purchase_return_to_tally(pr, tally_url)
                    status = res.get('status', 'failed')
                    print(f"Result for {pr.return_no}: {status}")
                    if status == "failed":
                        print(f"  Error: {res.get('error_message')}")
                        tally_resp = res.get('tally_response')
                        if tally_resp:
                            # Print the raw Tally response indented
                            for line in tally_resp.strip().split('\n'):
                                print(f"    | {line.strip()}")
                        
        except Exception as e:
            print(f"Loop error: {str(e)}")
            
        time.sleep(interval)

if __name__ == '__main__':
    main()
