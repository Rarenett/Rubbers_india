import io
import re

with io.open('frontend/src/jsx/components/Sales/SalesPendingOrdersReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix encoding issues (replace raw rupees with safe unicode)
text = text.replace('â‚¹', '\\u20B9').replace('₹', '\\u20B9')

# Add formatCurrency after imports if it does not exist
if "const formatCurrency" not in text:
    import_index = text.find('const SalesPendingOrdersReportList')
    new_currency = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

"""
    text = text[:import_index] + new_currency + text[import_index:]

# Update Total Revenue card
total_rev_pattern = re.compile(r'\\u20B9\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern.sub('{formatCurrency(totalSalesAmount)}', text)

# Add space to chart formatter
text = text.replace(
    "formatter: (val) => '\\u20B9' + val.toLocaleString",
    "formatter: (val) => '\\u20B9 ' + val.toLocaleString"
)
text = text.replace(
    "'\\u20B9' + val.toLocaleString",
    "'\\u20B9 ' + val.toLocaleString"
)

# For apex chart formatters that might be using `\\u20B9 `
text = text.replace(
    "return '\\u20B9' + val.toLocaleString",
    "return '\\u20B9 ' + val.toLocaleString"
)

text = text.replace(
    "return \"\\u20B9\" + Number(val)",
    "return \"\\u20B9 \" + Number(val)"
)

text = text.replace(
    "return \"\\u20B9\" + val.toLocaleString",
    "return \"\\u20B9 \" + val.toLocaleString"
)

with io.open('frontend/src/jsx/components/Sales/SalesPendingOrdersReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
