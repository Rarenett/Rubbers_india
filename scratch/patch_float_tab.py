file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_tab = (
    '            {/* Floating toggle button */}\n'
    '            {hasEngagementsPanel && !showHistory && (\n'
    '                <div\n'
    '                    onClick={() => setShowHistory(true)}\n'
    '                    title="Show Previous Engagements"\n'
    '                    style={{\n'
    '                        position: \'absolute\',\n'
    '                        top: \'0px\',\n'
    '                        right: \'0px\',\n'
    '                        zIndex: 10,\n'
    '                        display: \'flex\',\n'
    '                        alignItems: \'center\',\n'
    '                        gap: \'6px\',\n'
    '                        background: \'#fff\',\n'
    '                        border: \'1px solid #e2e8f0\',\n'
    '                        borderRadius: \'20px\',\n'
    '                        padding: \'5px 12px 5px 8px\',\n'
    '                        cursor: \'pointer\',\n'
    '                        boxShadow: \'0 2px 8px rgba(0,0,0,0.08)\',\n'
    '                        userSelect: \'none\'\n'
    '                    }}\n'
    '                >\n'
    '                    <div style={{ background: \'#e8fdf4\', borderRadius: \'50%\', width: \'24px\', height: \'24px\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\' }}>\n'
    '                        <i className="fa fa-history" style={{ color: \'#2ece8a\', fontSize: \'0.7rem\' }}></i>\n'
    '                    </div>\n'
    '                    <span style={{ fontSize: \'0.78rem\', fontWeight: 600, color: \'#334155\' }}>History</span>\n'
    '                    {engagementHistory.length > 0 && (\n'
    '                        <span style={{ background: \'#2ece8a\', color: \'#fff\', borderRadius: \'10px\', padding: \'1px 6px\', fontSize: \'0.65rem\', fontWeight: 700 }}>\n'
    '                            {engagementHistory.length}\n'
    '                        </span>\n'
    '                    )}\n'
    '                </div>\n'
    '            )}\n'
)

# Lines 2094-2140 (0-indexed: 2093-2139)
new_lines = lines[:2093] + [new_tab] + lines[2140:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'Done. Lines: {len(new_lines)}')
