import os
import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'

with open(worklog_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

now = datetime.datetime.now()
date_str = now.strftime('%Y-%m-%d')
timestamp_str = now.strftime('%Y-%m-%d %H:%M IST')

date_heading = f"## {date_str}\n"

new_entry = f"""### 🟢 Feature: Polygon Point Distance Calculation
**Files:** `frontend/src/jsx/components/CommonMaster/AreaCreation.jsx`

- Implemented geographic distance calculation between consecutive polygon points using Haversine formula.
- Segment distances and total polygon distance are now dynamically displayed when Geofence Mode is Polygon and drawing is completed.
- Restricted changes strictly to Common Master scope, without altering any global behaviors, tables or database models.
"""

last_updated_idx = -1
for i, line in enumerate(lines):
    if "*Last updated:" in line:
        last_updated_idx = i
        break

if last_updated_idx != -1:
    lines = lines[:last_updated_idx]

while lines and lines[-1].strip() == '':
    lines.pop()
lines.append('\n\n')

# Check if date heading exists
date_exists = False
for line in lines:
    if line.strip() == date_heading.strip():
        date_exists = True
        break

if not date_exists:
    lines.append(f"---\n\n{date_heading}\n")

lines.append(new_entry)
lines.append(f"\n*Last updated: {timestamp_str}*\n")

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
