import datetime
import os

filepath = 'c:/Archana/glenda_vite/WORKLOG.md'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
except FileNotFoundError:
    lines = []

new_content = []
for line in lines:
    if line.startswith('*Last updated:'):
        continue
    new_content.append(line)

today = datetime.datetime.now().strftime('%Y-%m-%d')
if f'## {today}\n' not in new_content and f'## {today}\n\n' not in new_content:
    new_content.append(f'\n## {today}\n\n')

new_content.append('### 🐛 Fix: Total Km dynamic calculation in Salesman Visitings\n')
new_content.append('**Files:** `frontend/src/jsx/components/CommonMaster/SalesmanVisitings.jsx`, `backend/area_app/serializers.py`\n\n')
new_content.append('- Fixed stale `Total Km` value in Salesman Visitings that was incorrectly displaying the Area\'s total polygon perimeter.\n')
new_content.append('- Implemented a dynamic `useEffect` to watch the selected `delivery_locations`.\n')
new_content.append('- If exactly two locations are selected, the UI queries the `areaPolygonDistances` state which dynamically pulls the individual polygon segment distance stored in `AreaGeofenceHistory`.\n')
new_content.append('- Exposed `polygon_distances` through `AreaGeofenceHistorySerializer` so the frontend can securely access the database source-of-truth without any new tables or APIs.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_content)
