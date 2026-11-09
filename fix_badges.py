import os
import io
import re

sales_dir = 'frontend/src/jsx/components/Sales'

def fix_badges_in_file(filepath):
    with io.open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'badge bg-' in content:
        # We replace bg-success text-white -> badge-success light, etc.
        # But wait, we need to ensure the class includes 'badge ' first?
        # Typically it's "badge bg-success text-white" -> we want "badge badge-success light"
        new_content = content.replace("badge bg-success text-white", "badge badge-success light")
        new_content = new_content.replace("badge bg-warning text-dark", "badge badge-warning light")
        new_content = new_content.replace("badge bg-warning text-white", "badge badge-warning light")
        new_content = new_content.replace("badge bg-danger text-white", "badge badge-danger light")
        new_content = new_content.replace("badge bg-info text-white", "badge badge-info light")
        new_content = new_content.replace("badge bg-secondary text-white", "badge badge-secondary light")
        new_content = new_content.replace("badge bg-primary text-white", "badge badge-primary light")
        new_content = new_content.replace("badge bg-dark text-white", "badge badge-dark light")
        
        if new_content != content:
            with io.open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")

for root, _, files in os.walk(sales_dir):
    for file in files:
        if file.endswith('.jsx'):
            fix_badges_in_file(os.path.join(root, file))
