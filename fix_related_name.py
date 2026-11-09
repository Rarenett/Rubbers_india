import re

with open(r'c:\Archana\glenda_vite\backend\logistics_app\views.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('prefetch_related("delivery_locations")', 'prefetch_related("area_delivery_locations")')

with open(r'c:\Archana\glenda_vite\backend\logistics_app\views.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'c:\Archana\glenda_vite\backend\logistics_app\serializers.py', 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace('obj.delivery_locations', 'obj.area_delivery_locations')
content2 = content2.replace('instance.delivery_locations', 'instance.area_delivery_locations')

with open(r'c:\Archana\glenda_vite\backend\logistics_app\serializers.py', 'w', encoding='utf-8') as f:
    f.write(content2)

print("Updated views and serializers")
