import io
with io.open('frontend/src/jsx/components/Sales/CustomerSalesInvoiceReportList.jsx', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'formatter: (val) =>' in line:
            print(f'{i+1}: {line.strip()}')
