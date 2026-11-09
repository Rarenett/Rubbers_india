import requests
from django.conf import settings
from purchase_app.models import PurchaseReturn
from .sync_log import update_status
from .utils.tally_purchaseReturn_xml import generate_purchase_return_xml

def push_purchase_return_to_tally(purchase_return, tally_url) -> dict:
    try:
        xml_data = generate_purchase_return_xml(purchase_return)
    except Exception as e:
        error_msg = f"XML generation failed: {str(e)}"
        update_status(purchase_return.id, status="failed", error_message=error_msg)
        return {"status": "failed", "error_message": error_msg}
        
    try:
        response = requests.post(
            tally_url, 
            data=xml_data.encode('utf-8'), 
            headers={'Content-Type': 'text/xml'}, 
            timeout=10
        )
        tally_response_text = response.text
        
        if response.status_code == 200 and '<EXCEPTIONS>0</EXCEPTIONS>' in tally_response_text and '<ERRORS>0</ERRORS>' in tally_response_text:
            status = 'synced'
            error_msg = None
        else:
            status = 'failed'
            error_msg = 'Tally rejected the XML or did not return Created/Altered.'
            
        update_status(
            purchase_return.id, 
            status=status, 
            tally_response=tally_response_text, 
            error_message=error_msg
        )
        
        return {
            "status": status,
            "tally_response": tally_response_text,
            "error_message": error_msg
        }
        
    except Exception as e:
        error_msg = str(e)
        update_status(
            purchase_return.id,
            status="failed",
            error_message=error_msg
        )
        return {
            "status": "failed",
            "error_message": error_msg
        }