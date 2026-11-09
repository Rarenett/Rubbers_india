import glob
import os

files = glob.glob(r'c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Sales\*ReportList.jsx')
count = 0
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    start_idx = content.find('{/* Date Filters */}')
    if start_idx != -1:
        # Find the search-bar-container
        end_idx = content.find('className="search-input"', start_idx)
        if end_idx != -1:
            end_of_div = content.find('</div>', end_idx)
            end_of_div2 = content.find('</div>', end_of_div + 1)
            
            original = content[start_idx:end_of_div2 + 6]
            
            if 'report-filters-wrapper' not in original:
                new_block = '<div className="d-flex align-items-center gap-3 flex-wrap report-filters-wrapper">\n' + original + '\n</div>'
                content = content.replace(original, new_block)
                with open(file, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'{os.path.basename(file)} WRAPPED')
                count += 1
print(f'Total wrapped: {count}')
