import re
html = open(r'C:\Users\ADMIN\.gemini\antigravity-ide\brain\f49d0466-e6bf-4723-87bc-6fd0e31bcf53\.system_generated\tasks\task-471.log', encoding='utf-8').read()
match2 = re.search(r'<textarea id="traceback_area".*?>(.*?)</textarea>', html, re.DOTALL)
print(match2.group(1) if match2 else 'No traceback')
