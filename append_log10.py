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
new_content.append('### 🐛 Fix: Resolve asynchronous state reading bug preventing polygon point names from updating\n')
new_content.append('**Files:** `AreaCreation.jsx`\n\n')
new_content.append('- Replaced `setState` with `useRef` to safely track resolved polygon point names and avoid stale closure checks when determining if a reverse-geocoding request should be made.\n')
new_content.append('- Fixed state-clearing on polygon deletion/form reset to guarantee stale names are wiped.\n')
new_content.append('- Updated reverse geocoding parsing to use `county` and `state_district` if specific locality is missing (common in large or remote boundaries without a direct village/suburb association) preventing silent failure.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open('c:/Archana/glenda_vite/WORKLOG.md', 'w', encoding='utf-8') as f:
    f.writelines(new_content)
