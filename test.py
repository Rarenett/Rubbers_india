import os, re
path = r'c:\Archana\glenda_vite\frontend\src\jsx\components\AccessPoint\ParkingFee.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make replacements
content = content.replace('ParkArea', 'ParkingFee')
content = content.replace('parkArea', 'parkingFee')
content = content.replace('park area', 'parking fee')
content = content.replace('Park Area', 'Parking Fee')
content = content.replace('park_area', 'parking_fee')
content = content.replace('park-area', 'parking-fee')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

