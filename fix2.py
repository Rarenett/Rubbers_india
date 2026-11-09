import io
with io.open('frontend/src/jsx/components/Sales/CustomerSalesInvoiceReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('₹', '\u20B9').replace('?', '\u20B9')
with io.open('frontend/src/jsx/components/Sales/CustomerSalesInvoiceReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
