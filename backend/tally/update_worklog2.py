import os

log_entry = """
### 🐛 Fix: Tally Expiry Date Synchronization
**Files:** `Tally/purchase_return.txt`, `tally/purchase.txt`

- Fixed an issue where the Expiry Date was not pushing into Tally Item Allocations.
- Removed a hardcoded `JD="46266"` (Julian Date) attribute from the `<EXPIRYPERIOD>` XML tags.
- Tally will now natively process the formatted string dates (YYYYMMDD) pushed by the Python script.
"""

with open(os.path.join(os.path.dirname(__file__), '..', 'WORKLOG.md'), 'a', encoding='utf-8') as f:
    f.write(log_entry)
