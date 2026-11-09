import os
import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'

with open(worklog_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

now = datetime.datetime.now()
date_str = now.strftime('%Y-%m-%d')
timestamp_str = now.strftime('%Y-%m-%d %H:%M IST')

date_heading = f"## {date_str}\n"

new_entry = f"""### 🐛 Fix: 500 Internal Server Error due to conflicting migrations
**Files:** `backend/rarenett_app/migrations/0012_merge_20260930_1217.py`, `backend/purchase_app/migrations/0014_merge_20260930_1217.py`

- Root Cause: Multiple branch conflicts in the migration graph (rarenett_app, purchase_app) caused the backend to crash and return 500 errors for multiple endpoints including notifications, tasks, geocode, and inactivity timeout.
- Fixed by generating merge migrations using `python manage.py makemigrations --merge` and applying them.
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
