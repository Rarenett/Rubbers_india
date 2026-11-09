import json
import os
from datetime import datetime
from django.conf import settings
from pathlib import Path

def get_log_path() -> str:
    # Use setting if provided, fallback to default in tally/logs/
    default_path = os.path.join(settings.BASE_DIR, 'tally', 'logs', 'purchase_return_sync_log.json')
    return getattr(settings, 'TALLY_SYNC_LOG_PATH', default_path)

def read_log() -> dict:
    path = get_log_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}

def write_log(data: dict) -> None:
    path = get_log_path()
    dir_name = os.path.dirname(path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
        
    temp_path = f"{path}.tmp"
    with open(temp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno()) if hasattr(os, 'fsync') else None
    
    os.replace(temp_path, path)

def update_status(purchase_return_id, *, status, tally_response=None, error_message=None) -> None:
    from purchase_app.models import PurchaseReturn
    log_data = read_log()
    pr_id_str = str(purchase_return_id)
    
    return_no = ""
    try:
        pr = PurchaseReturn.objects.get(id=purchase_return_id)
        return_no = pr.return_no
    except PurchaseReturn.DoesNotExist:
        pass

    log_data[pr_id_str] = {
        "return_no": return_no,
        "status": status,
        "tally_response": tally_response,
        "error_message": error_message,
        "updated_at": datetime.now().astimezone().isoformat()
    }
    
    write_log(log_data)

def get_status(purchase_return_id) -> dict | None:
    log_data = read_log()
    return log_data.get(str(purchase_return_id))

def get_pending_ids(all_ids: list[int]) -> list[int]:
    log_data = read_log()
    pending = []
    for pid in all_ids:
        pid_str = str(pid)
        status_entry = log_data.get(pid_str)
        if not status_entry or status_entry.get("status") == "pending":
            pending.append(pid)
    return pending
