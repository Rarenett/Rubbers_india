import io
with io.open('frontend/src/jsx/components/Sales/SalesInvoiceReportList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('â‚¹', '\u20B9').replace('₹', '\u20B9')
with io.open('frontend/src/jsx/components/Sales/SalesInvoiceReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
