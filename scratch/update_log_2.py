import os
from datetime import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'
now = datetime.now().strftime('%Y-%m-%d')
time_now = datetime.now().strftime('%Y-%m-%d %H:%M IST')

entry = f"""
---

## {now}

### 🐛 Fix: Remove all direct frontend geocoding calls
**Files:** `frontend/src/jsx/components/CommonMaster/AreaCreation.jsx`, `backend/area_app/views.py`, `backend/area_app/urls.py`

- Removed the reverse geocoding direct Nominatim API call (from map clicking/events) and proxied it through the new `/api/area/geocode_reverse/` Django backend endpoint.
- Updated error messaging to clarify when the backend geocoding service is unreachable, removing the confusing generic "Failed to fetch location" message.
- Double-checked the entire AreaCreation flow to ensure ZERO frontend requests are being made directly to nominatim.openstreetmap.org.

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
    with open(worklog_path, 'r', encoding='utf-16') as f:
        content = f.read()
        
    if '*Last updated:' in content:
        lines = content.split('\n')
        new_lines = [line for line in lines if not line.startswith('*Last updated:')]
        content = '\n'.join(new_lines)
        
    with open(worklog_path, 'w', encoding='utf-16') as f:
        f.write(content.strip() + '\n' + entry)
    print('Successfully appended to WORKLOG.md (utf-16)')
