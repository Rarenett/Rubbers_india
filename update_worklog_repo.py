import datetime
log_entry = '''
### 🎨 Improvement: Fixed Telecalling Lead Repository Filtering and Empty State
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Removed the initial global lead fetch on page load so no leads are displayed by default.
- Prevented the automatic selection of the first lead repository; the dropdown now accurately shows the "Select Lead Repository" placeholder initially.
- Implemented a dedicated `useEffect` hook to fetch leads exclusively when a repository is actively selected, appending the category ID to the API request to prevent loading all leads in memory.
- Ensured that when the dropdown is cleared or changed, the previous repository's leads are immediately wiped from state to prevent data mixing.
- Added a clean, user-friendly empty state ("Select a repository to view leads.") that replaces the table when no repository is selected.
'''
try:
    with open('WORKLOG.md', 'r', encoding='utf-8') as f:
        content = f.read()
    if '*Last updated*' in content:
        content = content[:content.rfind('*Last updated*')]
    with open('WORKLOG.md', 'w', encoding='utf-8') as f:
        f.write(content.strip() + '\n' + log_entry + '\n*Last updated: ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M') + ' IST*\n')
except FileNotFoundError:
    pass
