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
### 🟢 Feature: Number-Connected Appointments & Filtered Popup View
**Files:** `backend/appointment_app/views.py`, `frontend/src/services/AppointmentService.js`, `frontend/src/jsx/components/AccessPoint/GateEntryForm.jsx`, `frontend/src/jsx/components/AccessPoint/SpotAppointmentView.jsx`

- Connected visitor mobile numbers and vehicle numbers directly with appointments: automatically associates `Vehicle` / `Visitor` models in `perform_create` and `perform_update`.
- Added `number` query parameter filtering to `today_appointments` backend action, matching both with/without spaces and hyphens across `visitor_phone`, `visitor.mobile_no`, `vehicle_number`, and `vehicle.vehicle_number`.
- Updated `GateEntryForm.jsx` to pass the entered search number (`searchMobile`) into the Appointments popup, filtering the list to display only appointments associated with that specific number.
- Added active filter bar in Appointments modal with quick option to "View All Today's Appointments".
- In empty state when filtered, displays tailored message ("No appointments found for [number]") with a direct button to "Create Spot Appointment for [number]".
- Synchronized `SpotAppointmentView.jsx` with the searched number, automatically defaulting and linking the vehicle number or mobile number.
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
