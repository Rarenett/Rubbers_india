with open("c:/Users/ADMIN/Documents/GitHub/glenda_vite/frontend/src/jsx/components/Purchase/PurchaseOrderReport.jsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "stats" in line:
        safe_line = line.strip().encode('ascii', errors='ignore').decode('ascii')
        print(f"Line {i+1}: {safe_line}")
