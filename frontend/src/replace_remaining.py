import os
import re

files = [
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\components\HR\Candidates\CandidateList.jsx",
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\components\HR\Employees\EmployeeList.jsx",
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\components\Finance\StockJournalList.jsx",
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\components\Inventory\RecipeList.jsx",
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\pages\ManageCompany.jsx"
]

pattern1 = r'\{!loading\s*&&\s*totalPages\s*>\s*1\s*&&\s*\(\s*(<div[^>]*className=[\'"][^\'"]*justify-content-between.*?[\'"].*?>)\s*(<div[^>]*className=[\'"]text-muted[\'"][^>]*>.*?Math\.min\(indexOfLast[a-zA-Z0-9_]*,\s*([a-zA-Z0-9_]+)\.length\).*?</div>)\s*(<nav>.*?</nav>)\s*</div>\s*\)'

def repl1(m):
    return f'{{!loading && {m.group(3)}.length > 0 && (\n                                  {m.group(1)}\n                                      {m.group(2)}\n                                      {{totalPages > 1 && (\n                                          {m.group(4)}\n                                      )}}\n                                  </div>\n                              )}}'

pattern2 = r'\{!loading\s*&&\s*[a-zA-Z0-9_]+\.length\s*>\s*0\s*&&\s*totalPages\s*<=\s*1\s*&&\s*\(\s*<div[^>]*>.*?</div>\s*\)'

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace the main pagination block
        new_content, c1 = re.subn(pattern1, repl1, content, flags=re.DOTALL)
        
        # Remove the extra text block for totalPages <= 1
        new_content, c2 = re.subn(pattern2, '', new_content, flags=re.DOTALL)
        
        if c1 > 0 or c2 > 0:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Updated {f}: replaced {c1} main blocks, removed {c2} extra blocks")
    else:
        print(f"File not found: {f}")

