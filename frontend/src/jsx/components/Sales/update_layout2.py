import glob
import re

files = glob.glob(r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Sales\*ReportList.jsx')
files = [f for f in files if 'DistributorSalesInvoice' not in f and 'CustomerSalesInvoice' not in f and 'CustomerSalesReturn' not in f and 'SalesInvoiceReportList' not in f and 'SalesReturnReportList' not in f]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add d-xl-none to the one next to the tabs
    # It looks like: {activeTab === 'list' && (\n<div className="d-flex gap-2">
    target_str = "{activeTab === 'list' && (\n<div className=\"d-flex gap-2\">"
    if target_str in content:
        # Extract the inner buttons JSX from this block
        # We know it ends with \n)}
        block_pattern = r"{activeTab === 'list' && \(\n<div className=\"d-flex gap-2\">([\s\S]*?)\n\)}"
        block_match = re.search(block_pattern, content)
        
        if block_match:
            inner_buttons = block_match.group(1)
            
            # Replace the tabs one with d-xl-none
            content = content.replace(target_str, "{activeTab === 'list' && (\n<div className=\"d-flex gap-2 d-xl-none\">")
            
            # 2. Inject the d-none d-xl-flex one next to the Title
            # Find the title: <h4 className="mb-0">.*?</h4>
            title_pattern = r'(<h4 className=\"mb-0\">.*?</h4>\s*)'
            title_match = re.search(title_pattern, content)
            
            if title_match:
                title_str = title_match.group(1)
                
                # Check if we already injected it (to be safe)
                if 'd-none d-xl-flex' not in content:
                    new_desktop_export = f'<div className="d-flex gap-2 d-none d-xl-flex">{inner_buttons}</div>\n'
                    content = content.replace(title_str, title_str + new_desktop_export)
                    
                    with open(file, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f'{file}: RESTORED DESKTOP EXPORT successfully')
                else:
                    print(f'{file}: ALREADY RESTORED')
            else:
                print(f'{file}: COULD NOT FIND TITLE')
        else:
            print(f'{file}: COULD NOT MATCH TABS EXPORT BLOCK')
    else:
        print(f'{file}: TABS EXPORT NOT FOUND (maybe already updated with d-xl-none?)')
