with open('frontend/src/jsx/components/DigiLocker/DigiLockerAccess.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'showOtpModal' in line:
        for j in range(max(0, i-5), min(len(lines), i+60)):
            print(f"{j+1}: {lines[j]}", end='')
        break

