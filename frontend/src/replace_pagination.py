import os
import re

pattern = r'\{totalPages\s*>\s*1\s*&&\s*\(\s*(<div[^>]*className=[\'"][^\'"]*justify-content-between.*?[\'"].*?>)\s*(<div[^>]*className=[\'"]text-muted[\'"][^>]*>.*?Math\.min\(indexOfLastItem,\s*([a-zA-Z0-9_]+)\.length\).*?</div>)\s*(<nav>.*?</nav>)\s*</div>\s*\)'

def repl(m):
    return f'{{{m.group(3)}.length > 0 && (\n                                        {m.group(1)}\n                                            {m.group(2)}\n                                            {{totalPages > 1 && (\n                                                {m.group(4)}\n                                            )}}\n                                        </div>\n                                    )}}'

frontend_dir = r"E:\glenda_vite\glenda_vite\frontend\src\jsx"
matched_files = []

for root, _, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith('.jsx'):
            file_path = os.path.join(root, f)
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            new_content, count = re.subn(pattern, repl, content, flags=re.DOTALL)
            
            if count > 0:
                with open(file_path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                matched_files.append((f, count))

print(f"Replaced in {len(matched_files)} files:")
for f, c in matched_files:
    print(f" - {f}: {c} replacements")
