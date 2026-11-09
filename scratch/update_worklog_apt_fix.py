import os
import datetime

worklog_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\WORKLOG.md"

with open(worklog_path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split('\n')
last_updated_indices = [i for i, line in enumerate(lines) if line.strip().startswith('*Last updated:')]

now = datetime.datetime.now()
timestamp = now.strftime("%Y-%m-%d %H:%M IST")

new_entry = """
### 🐛 Fix: Uncaught Event Object in handleShowAppointments
**Files:** `frontend/src/jsx/components/AccessPoint/GateEntryForm.jsx`

- **Root Cause:** The `onClick` handler of the Appointments button passed the React synthetic click event object directly into `handleShowAppointments`, causing `appointmentFilterNumber` to receive the event object instead of a string or null. This triggered `toUpperCase is not a function` at render time.
- Wrapped button click handler in an arrow function `() => handleShowAppointments()` and enforced strict type-checking in `handleShowAppointments` so only string values are accepted as query filters.
- Added defensive `String(appointmentFilterNumber || '')` conversion around filter badge display.
"""

if last_updated_indices:
    idx = last_updated_indices[0]
    lines = [l for l in lines if not l.strip().startswith('*Last updated:')]
    content = '\n'.join(lines).rstrip() + "\n\n" + new_entry.strip() + f"\n\n*Last updated: {timestamp}*\n"
else:
    content = content.rstrip() + "\n\n" + new_entry.strip() + f"\n\n*Last updated: {timestamp}*\n"

with open(worklog_path, "w", encoding="utf-8") as f:
    f.write(content)

print("WORKLOG.md updated successfully")
