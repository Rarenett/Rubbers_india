import os

log_entry = """
### 🐛 Fix: Tally Expiry Date Missing from Batch Allocations
**Files:** `Tally/purchase_return.txt`, `tally/purchase.txt`

- Discovered that Tally silently drops the `<EXPIRYPERIOD>` in voucher Batch Allocations if the underlying `<STOCKITEM>` master does not explicitly have `USEEXPIRYDATES="Yes"` enabled.
- Modified the XML template `<STOCKITEM>` block to forcefully pass `<ISBATCHWISEON>Yes</ISBATCHWISEON>`, `<TRACKDATEOFMFG>Yes</TRACKDATEOFMFG>`, and `<USEEXPIRYDATES>Yes</USEEXPIRYDATES>` and use `ACTION="Alter"`.
- This automatically ensures that Expiry Date tracking is enabled for the item in Tally, preventing the data from being ignored.
"""

with open(os.path.join(os.path.dirname(__file__), '..', 'WORKLOG.md'), 'a', encoding='utf-8') as f:
    f.write(log_entry)
