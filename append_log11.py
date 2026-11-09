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
new_content.append('### 🐛 Fix: Ensure API URL and strict coordinate matching for polygon geocoding\n')
new_content.append('**Files:** `AreaCreation.jsx`\n\n')
new_content.append('- Fixed missing backend URL resolution by switching `axios.get` to `axiosInstance.get` for the reverse geocoding API call.\n')
new_content.append('- Implemented `.toFixed(6)` and `Number()` casting on coordinate keys to prevent floating-point mismatches and stringification errors between polygon vertex updates and distance segment rendering.\n')
new_content.append('- Changed fallback text to display `Loading...` instead of `Unnamed Location` while requests are pending to distinguish loading state from failed geocoding.\n\n')
new_content.append('*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M IST') + '*\n')

with open('c:/Archana/glenda_vite/WORKLOG.md', 'w', encoding='utf-8') as f:
    f.writelines(new_content)
