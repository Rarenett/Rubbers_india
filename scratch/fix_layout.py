file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_layout = """    const hasEngagementsPanel = (visitorData || selectedVehicles.length > 0);

    const layout = (
        <Row>
            <Col lg={hasEngagementsPanel && showHistory ? 8 : 12} style={{ transition: 'all 0.3s ease' }}>
                {formContent}
            </Col>
            {hasEngagementsPanel && showHistory && (
                <Col lg={4} style={{ transition: 'all 0.3s ease' }}>
                    {rightColumn}
                </Col>
            )}
        </Row>
    );
"""

# Replace lines 2097-2111 (0-indexed: 2096-2110) with fixed layout
new_lines = lines[:2096] + [new_layout] + lines[2111:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Done. Lines: {len(new_lines)}')
for i, l in enumerate(new_lines[2093:2118], 2094):
    print(i, l.rstrip())
