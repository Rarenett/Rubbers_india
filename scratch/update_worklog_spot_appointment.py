import os
import datetime

worklog_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\WORKLOG.md"

with open(worklog_path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split('\n')

# Find last line that starts with *Last updated:
last_updated_indices = [i for i, line in enumerate(lines) if line.strip().startswith('*Last updated:')]

now = datetime.datetime.now()
timestamp = now.strftime("%Y-%m-%d %H:%M IST")

new_entry = """
### 🟢 Feature: Spot Appointment Creation in Appointments Popup
**Files:** `frontend/src/jsx/components/AccessPoint/SpotAppointmentView.jsx`, `frontend/src/jsx/components/AccessPoint/GateEntryForm.jsx`

- Added `SpotAppointmentView` component enabling instant walk-in spot appointment creation directly within the Appointments popup modal without launching nested modals.
- Integrated tab switcher (`Today's List` / `+ Spot Appointment`) inside the Appointments modal header and added a primary call-to-action button in the empty state.
- Supports both Visitor and Vehicle walk-in modes with instant verification search, spot registration integration, and manual entry fallback.
- Added cascading Department, Designation, and Concerned Staff dropdowns, Visitor Category selection, purpose of visit, and auto-defaulted date & time.
- Upon creation, the newly created spot appointment is automatically loaded and applied to the active Gate Entry form, seamlessly closing the popup.
"""

if last_updated_indices:
    idx = last_updated_indices[0]
    # remove any existing *Last updated: lines
    lines = [l for l in lines if not l.strip().startswith('*Last updated:')]
    content = '\n'.join(lines).rstrip() + "\n\n" + new_entry.strip() + f"\n\n*Last updated: {timestamp}*\n"
else:
    content = content.rstrip() + "\n\n" + new_entry.strip() + f"\n\n*Last updated: {timestamp}*\n"

with open(worklog_path, "w", encoding="utf-8") as f:
    f.write(content)

print("WORKLOG.md successfully updated!")
