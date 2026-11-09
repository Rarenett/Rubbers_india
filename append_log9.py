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
new_content.append('### 🐛 Fix: Ensure sequential fetching for reverse geocoding to prevent rate limiting\n')
new_content.append('**Files:** `AreaCreation.jsx`\n\n')
new_content.append('- Fixed issue where reverse geocoding in AreaCreation triggered `Unnamed Location` due to rate limits imposed by Nominatim by switching from `Promise.all` mapping to sequential iteration (`for...of`) with a 1000ms delay between API requests to satisfy the 1 request/sec policy.\n')
new_content.append('- Changed `setPolygonPointNames` to use functional state updates (`prev => { ... }`) to avoid stale closure state and missed assignments.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open('c:/Archana/glenda_vite/WORKLOG.md', 'w', encoding='utf-8') as f:
    f.writelines(new_content)
