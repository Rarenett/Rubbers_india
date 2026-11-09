import re
log_path = 'c:/Paul@Rarenett/glenda_vite1/WORKLOG.md'
with open(log_path, 'r', encoding='utf-8') as f:
    content = f.read()

entry = """
### 🎨 Improvement: Cute & Friendly Mobile Styles for Marketing Connect
**Files:** `marketing-cute.css`, `MarketingConnectDashboard.jsx`, `AttendanceModule.jsx`, `TransportModule.jsx`, `LeadsModule.jsx`, `ShopVisitModule.jsx`, `OrdersModule.jsx`, `OrderModal.jsx`

- Created a dedicated `marketing-cute.css` stylesheet specifically targeting mobile devices (max-width: 768px).
- Introduced soft, bubbly aesthetics: pill-shaped buttons with gradients, fully rounded corners on cards and inputs, and soft drop shadows to replace harsh borders.
- Increased padding and font sizes slightly on mobile to make touch targets friendly and accessible.
- Enlarged emojis on the dashboard for a more inviting feel.
- Imported the new CSS file globally across all Marketing Connect modules.

"""

content = re.sub(r'(\*Last updated:.*)', entry + r'\1', content)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(content)
