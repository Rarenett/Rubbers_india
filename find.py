import io
with io.open('frontend/src/jsx/components/Sales/SalesInvoiceReportList.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if '\u20B9' in l:
        print(f'{i+1}: {l.strip()}')
