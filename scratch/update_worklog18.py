import datetime

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

new_content.append('### 🐛 Fix: Total Km blank when Area Geofence History returns unparsed JSON string\n')
new_content.append('**Files:** `frontend/src/jsx/components/CommonMaster/SalesmanVisitings.jsx`\n\n')
new_content.append('- Fixed an issue where the Total Km field remained blank after an Area was loaded due to `polygon_distances` occasionally being returned as a serialized JSON string from the backend.\n')
new_content.append('- Implemented a robust `JSON.parse` check in the frontend to gracefully handle stringified segment data and compute the total distance seamlessly.\n')
new_content.append('- Ensured Total Km is dynamically derived purely from the complete Area geofence perimeter and decoupled from Delivery Location dropdown selection entirely, matching expected behavior.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_content)
