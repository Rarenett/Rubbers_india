import io
import re

with io.open('frontend/src/jsx/components/Sales/SalesCustomerReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix encoding issues (replace raw rupees with safe unicode)
text = text.replace('â‚¹', '\\u20B9').replace('₹', '\\u20B9')

# Update formatCurrency
old_format = "const formatCurrency = (val) =>\n    '\\\\u20B9' + parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });"
old_format2 = "const formatCurrency = (val) =>\n    '\\u20B9' + parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });"

new_format = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);"""

text = text.replace(old_format, new_format).replace(old_format2, new_format)

# Add space to chart formatters
text = text.replace(
    "formatter: (val) => '\\u20B9' + val.toLocaleString",
    "formatter: (val) => '\\u20B9 ' + val.toLocaleString"
)
text = text.replace(
    "'\\u20B9' + val.toLocaleString",
    "'\\u20B9 ' + val.toLocaleString"
)
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

# Fix Total Revenue Card (if it has hardcoded \u20B9)
total_rev_pattern = re.compile(r'\\u20B9\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern.sub('{formatCurrency(totalSalesAmount)}', text)
total_rev_pattern2 = re.compile(r'\\u20B9\s*\{totalRevenue\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern2.sub('{formatCurrency(totalRevenue)}', text)

# Remove padding from tab-content
text = text.replace('tab-content mt-4 px-4 pb-4', 'tab-content mt-4')

with io.open('frontend/src/jsx/components/Sales/SalesCustomerReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
