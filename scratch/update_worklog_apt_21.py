import os
import datetime

worklog_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\WORKLOG.md"

with open(worklog_path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split('\n')
last_updated_line_index = -1
for i, line in enumerate(lines):
    if line.startswith('*Last updated:'):
        last_updated_line_index = i
        break

now = datetime.datetime.now()
timestamp = now.strftime("%Y-%m-%d %H:%M IST")

new_entry = """
### 🐛 Fix: Vehicle Photo Missing
**Files:** `backend/gate_app/models.py`, `frontend/src/jsx/components/AccessPoint/GateEntryForm.jsx`

- The `Vehicle` model was missing the `vehicle_photo` field, causing uploaded vehicle images to be silently ignored by the backend.
- Added `vehicle_photo` as an `ImageField` to `Vehicle` and ran migrations.
- Updated `GateEntryForm.jsx` to render the `vehicle_photo` instead of the generic truck icon when selecting a registered vehicle.
"""

if last_updated_line_index != -1:
    lines.insert(last_updated_line_index, new_entry.strip() + "\n\n")
    lines[last_updated_line_index + 2] = f"*Last updated: {timestamp}*"
    content = '\n'.join(lines)
else:
    content += "\n\n" + new_entry.strip() + f"\n\n*Last updated: {timestamp}*"

with open(worklog_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Worklog updated")
