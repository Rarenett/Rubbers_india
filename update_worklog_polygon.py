import datetime

try:
    with open('c:/Archana/glenda_vite/WORKLOG.md', 'r', encoding='utf-8') as f:
        lines = f.readlines()
except FileNotFoundError:
    lines = []

new_content = []
timestamp_line = None
for line in lines:
    if line.startswith('*Last updated:'):
        timestamp_line = line
        continue
    new_content.append(line)

new_content.append('\n## ' + datetime.datetime.now().strftime('%Y-%m-%d') + '\n\n')
new_content.append('### 🐛 Fix: Fix polygon distance location names in Common Master Area Creation\n')
new_content.append('**Files:** `AreaCreation.jsx`\n\n')
new_content.append('- Fixed issue where polygon distance labels showed "Unnamed Location -> Unnamed Location" by correctly extracting the most meaningful locality name (locality, town, city, etc.) from reverse geocoding response.\n')
new_content.append('- Maintained distance calculation logic and preserved the exact UI formatting.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open('c:/Archana/glenda_vite/WORKLOG.md', 'w', encoding='utf-8') as f:
    f.writelines(new_content)
