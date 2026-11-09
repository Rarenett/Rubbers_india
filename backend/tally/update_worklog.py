import os

log_entry = """
## 2026-09-08

### 🐛 Fix: Tally Extra Charge Ledger Auto-Creation
**Files:** `Tally/purchase_return.txt`, `tally/purchase.txt`

- Fixed the `<LINEERROR>Ledger does not exist!` issue for extra charges.
- The Tally integration now automatically generates a `<LEDGER ACTION="Create">` master block for every extra charge (e.g., Transportation Charges, Round Off) assigned to an invoice or return.
- If the ledger does not exist in Tally, or has a spelling mismatch, Tally will automatically create it under the "Direct Expenses" parent group before importing the voucher, ensuring a seamless sync without manual intervention.
"""

with open(os.path.join(os.path.dirname(__file__), '..', 'WORKLOG.md'), 'a', encoding='utf-8') as f:
    f.write(log_entry)
