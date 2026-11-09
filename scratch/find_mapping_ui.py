import os

for root, dirs, files in os.walk('frontend/src'):
    for f in files:
        if 'mapping' in f.lower() or 'folder' in f.lower():
            print(os.path.join(root, f))

