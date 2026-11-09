import datetime

file_path = r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\WORKLOG.md'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

while lines and (not lines[-1].strip() or 'Last updated:' in lines[-1]):
    lines.pop()

now = datetime.datetime.now()
timestamp = now.strftime('%Y-%m-%d %H:%M IST')
date_header = now.strftime('%Y-%m-%d')

entry = f'''
---

## {date_header}

### 🟢 Feature: Added Top 5 Delivery Locations Bubble Map Card
**Files:** `CommonDashboard.jsx`, `rarenett_app/dashboard_views.py`

- Created the "Top 5 Delivery Locations" card featuring a stylized high-tech vector region map with pulsing color bubble overlays.
- Integrated horizontal progress bars showing percentage distribution per location matching the Behance design layout.
- Added corresponding backend aggregation query on `SalesInvoice` groupings to return top locations.

*Last updated: {timestamp}*
'''

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
    f.write(entry)
print("WORKLOG updated successfully.")
