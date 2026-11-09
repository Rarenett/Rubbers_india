import re

with open(r'c:\Archana\glenda_vite\backend\logistics_app\views.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('queryset = RouteStopMaster.objects.all()', 'queryset = RouteStopMaster.objects.prefetch_related("delivery_locations").all()')

with open(r'c:\Archana\glenda_vite\backend\logistics_app\views.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated views.py")
