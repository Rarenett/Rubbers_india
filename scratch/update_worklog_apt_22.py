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
### 🟢 Feature: Multiple Vehicles & New Gate Entry Fields
**Files:** `backend/gate_app/models.py`, `backend/gate_app/serializers.py`, `frontend/src/jsx/components/AccessPoint/GateEntryForm.jsx`, `frontend/src/jsx/components/AccessPoint/GateEntryList.jsx`

- Added `number_of_persons` and `expected_time_of_exit` to both `GateEntry` and `VehicleEntry` models.
- Converted `VehicleEntry.vehicle` to a `ManyToManyField` (`vehicles`) to support registering multiple vehicles in a single gate entry.
- Updated `VehicleEntrySerializer` to include nested `vehicles_data`.
- Updated `GateEntryForm.jsx` UI to collect multiple vehicles into an array (`selectedVehicles`) and display them as a list with remove buttons.
- Updated `GateEntryList.jsx` to correctly map over `vehicles_data` and display "Vehicle (+X more)" in the table.
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
