import re
with open('c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/Dashboard/CommonDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'className="col-12 col-md-4 col-xl-2"',
    'className="col-12 col-md-4 col-xl-2 module-tile animate-fade-in-up delay-4"'
)

content = content.replace(
    '<div style={{ \n                    width: "48px", height: "48px"',
    '<div className="module-icon glow-icon-box" style={{ \n                    width: "48px", height: "48px"'
)

# And make sure charts have drop shadow filters in defs
chart_defs = '''                  <defs>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#3b82f6" floodOpacity="0.3"/>
                    </filter>
                    <filter id="shadow-green" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#10b981" floodOpacity="0.3"/>
                    </filter>
                  </defs>'''

content = content.replace(
    '<CartesianGrid strokeDasharray="3 3"',
    chart_defs + '\n                  <CartesianGrid strokeDasharray="3 3"'
)

# Apply the filter to Line and Bar
content = content.replace(
    '<Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />',
    '<Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} filter="url(#shadow)" />'
)
content = content.replace(
    '<Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: cardBg }} activeDot={{ r: 6 }} />',
    '<Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#10b981" strokeWidth={4} filter="url(#shadow-green)" dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: cardBg }} activeDot={{ r: 6 }} />'
)

with open('c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/Dashboard/CommonDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done modules update.')
