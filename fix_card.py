import re
with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

content = content.replace('<Card>', '<Card className="mb-5 pb-4">')

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
