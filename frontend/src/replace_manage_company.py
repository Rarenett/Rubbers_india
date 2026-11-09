import os
import re

files = [
    r"E:\glenda_vite\glenda_vite\frontend\src\jsx\pages\ManageCompany.jsx"
]

# We want to change:
# {xxxTotalPages > 1 && (
#     <div className="d-flex justify-content-between align-items-center mt-3">
#         <div className="text-muted" style={{ fontSize: '13px' }}>
#             Showing {xxxIndexOfFirstItem + 1} to {Math.min(xxxIndexOfLastItem, filteredYyy.length)} of {filteredYyy.length} entries
#         </div>
#         <nav> ... </nav>
#     </div>
# )}
#
# To:
# {filteredYyy.length > 0 && (
#     <div className="d-flex justify-content-between align-items-center mt-3">
#         <div className="text-muted" style={{ fontSize: '13px' }}>
#             Showing {xxxIndexOfFirstItem + 1} to {Math.min(xxxIndexOfLastItem, filteredYyy.length)} of {filteredYyy.length} entries
#         </div>
#         {xxxTotalPages > 1 && (
#         <nav> ... </nav>
#         )}
#     </div>
# )}

pattern = r'\{([a-zA-Z0-9_]*TotalPages)\s*>\s*1\s*&&\s*\(\s*(<div[^>]*className=[\'"][^\'"]*justify-content-between.*?[\'"].*?>)\s*(<div[^>]*className=[\'"]text-muted[\'"][^>]*>.*?Math\.min\([a-zA-Z0-9_]*,\s*([a-zA-Z0-9_]+)\.length\).*?</div>)\s*(<nav>.*?</nav>)\s*</div>\s*\)'

def repl(m):
    return f'{{{m.group(4)}.length > 0 && (\n                                        {m.group(2)}\n                                            {m.group(3)}\n                                            {{{m.group(1)} > 1 && (\n                                                {m.group(5)}\n                                            )}}\n                                        </div>\n                                    )}}'

for f in files:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        new_content, c = re.subn(pattern, repl, content, flags=re.DOTALL)
        
        if c > 0:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Updated {f}: replaced {c} blocks")
    else:
        print(f"File not found: {f}")

