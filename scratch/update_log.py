import os
from datetime import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'
now = datetime.now().strftime('%Y-%m-%d')
time_now = datetime.now().strftime('%Y-%m-%d %H:%M IST')

entry = f"""
---

## {now}

### 🐛 Fix: Fix Geocoding Location Search Failed To Fetch Error
**Files:** `frontend/src/jsx/components/CommonMaster/AreaCreation.jsx`

- Corrected the backend API endpoint URL for geocoding in the frontend. It now correctly points to `/api/area/geocode/` instead of `/api/geocode/`, aligning with the Django router configuration for the `area_app`. This resolves the "Failed to fetch location." error resulting from 404 responses.

*Last updated: {time_now}*
"""

try:
    with open(worklog_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '*Last updated:' in content:
        lines = content.split('\n')
        new_lines = [line for line in lines if not line.startswith('*Last updated:')]
        content = '\n'.join(new_lines)
    
    with open(worklog_path, 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n' + entry)
    print('Successfully appended to WORKLOG.md (utf-8)')
except UnicodeDecodeError:
    print('Fallback to utf-16')
    with open(worklog_path, 'r', encoding='utf-16') as f:
        content = f.read()
        
    if '*Last updated:' in content:
        lines = content.split('\n')
        new_lines = [line for line in lines if not line.startswith('*Last updated:')]
        content = '\n'.join(new_lines)
        
    with open(worklog_path, 'w', encoding='utf-16') as f:
        f.write(content.strip() + '\n' + entry)
    print('Successfully appended to WORKLOG.md (utf-16)')
