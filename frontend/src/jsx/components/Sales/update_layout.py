import glob
import re

file = r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Sales\DistributorSalesReportList.jsx'
with open(file, 'r', encoding='utf-8') as f:
    content = f.read()

export_pattern = r'(<div className="d-flex gap-2">\s*<button.*?onClick={\(\) => handleExport\(\'pdf\'\)}[\s\S]*?</button>\s*</div>)'
export_match = re.search(export_pattern, content)

if export_match:
    export_jsx = export_match.group(1)
    content = content.replace(export_jsx, '')
    
    wrapper_pattern = r'<div className="d-flex align-items-start">'
    replacement = r'<div className="d-flex align-items-center flex-wrap gap-2">'
    
    if wrapper_pattern in content:
        content = content.replace(wrapper_pattern, replacement, 1)
    
    tabs_div_pattern = r'(<div className="d-flex p-1 bg-light rounded-pill.*?style={{ maxWidth: \'fit-content\', border: \'1px solid #eaebf0\' }}>[\s\S]*?)(</button>\s*</div>)'
    tabs_match = re.search(tabs_div_pattern, content)
    
    if tabs_match:
        tabs_div = tabs_match.group(0)
        new_export = f"{{activeTab === 'list' && (\n{export_jsx}\n)}}"
        content = content.replace(tabs_div, f"{tabs_div}\n{new_export}")
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'{file}: UPDATED successfully')
    else:
        print('TABS DIV NOT FOUND')
else:
    print('EXPORT BUTTONS NOT FOUND')
