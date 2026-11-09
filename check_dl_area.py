import json
with open(r'c:\Archana\glenda_vite\frontend\src\jsx\components\CommonMaster\AreaLocationMapping.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re
# check how area is stored in deliveryLocations
matches = re.findall(r'dl\.area', content)
print(matches)
