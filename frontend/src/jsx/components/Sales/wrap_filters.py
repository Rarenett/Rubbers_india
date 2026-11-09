
import glob
import re

files = glob.glob(r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Sales\*ReportList.jsx')
count = 0
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to match:
    # {/* Date Filters */}
    # ... down to the closing div of the search bar
    
    # The search bar structure:
    # <div className="d-flex align-items-center gap-2">
    #     <div className="search-bar-container">
    #         <span className="search-icon">...</span>
    #         <input ... />
    #     </div>
    # </div>
    
    pattern = r'(\{/\*\s*Date Filters\s*\*/\}[\s\S]*?<div className="search-bar-container">[\s\S]*?</svg>\s*</span>\s*<input[^>]+>\s*</div>\s*</div>)'
    
    match = re.search(pattern, content)
    if match:
        original = match.group(1)
        if '<div className="d-flex align-items-center gap-3 flex-wrap report-filters-wrapper">' not in content:
            new_block = f'<div className="d-flex align-items-center gap-3 flex-wrap report-filters-wrapper">\n{original}\n</div>'
            content = content.replace(original, new_block)
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'{file} WRAPPED')
            count += 1
    else:
        print(f'{file} NO MATCH')
print(f'Total wrapped: {count}')
