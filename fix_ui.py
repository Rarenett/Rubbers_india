import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Remove PageTitle
content = re.sub(r'<PageTitle[^>]+/>\n*', '', content)

# 2. Replace container-fluid, Row, Col with a simple div that won't cause horizontal overflow
content = content.replace('<div className="container-fluid">\n                <Row>\n                    <Col lg={12}>', '<div className="tele-dashboard w-100" style={{ maxWidth: \'100%\', overflowX: \'hidden\' }}>')
content = content.replace('                    </Col>\n                </Row>\n            </div>', '            </div>')

# 3. Fix Toolbar to wrap properly and align
toolbar_old = '''<Card.Header className="d-flex justify-content-between align-items-center">
                                <Card.Title className="mb-0">Telecalling Management</Card.Title>
                                <div className="d-flex align-items-center gap-2">'''
toolbar_new = '''<Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <Card.Title className="mb-0">Telecalling Management</Card.Title>
                                <div className="d-flex flex-wrap align-items-center gap-2">'''
content = content.replace(toolbar_old, toolbar_new)

# 4. Fix Search field
search_old = '''<div style={{ width: '300px', position: 'relative' }}>'''
search_new = '''<div style={{ flex: '1 1 200px', minWidth: '200px', maxWidth: '300px', position: 'relative' }}>'''
content = content.replace(search_old, search_new)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
