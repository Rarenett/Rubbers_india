import re
html = open(r'C:\Users\ADMIN\.gemini\antigravity-ide\brain\f49d0466-e6bf-4723-87bc-6fd0e31bcf53\.system_generated\tasks\task-471.log', encoding='utf-8').read()
match = re.search(r'<div class="exception_value">(.*?)</div>', html, re.DOTALL)
print(match.group(1).strip() if match else 'No div exception_value')
match2 = re.search(r'<th>Exception Value:</th>\s*<td><pre>(.*?)</pre></td>', html, re.DOTALL)
print(match2.group(1).strip() if match2 else 'No th exception value')
