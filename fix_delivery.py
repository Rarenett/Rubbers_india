import io
import re

with io.open('frontend/src/jsx/components/Sales/SalesDeliveryReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 0. Fix encoding issues
text = text.replace('â‚¹', '\u20B9').replace('₹', '\u20B9')

# 1. Add formatCurrency after imports if it does not exist
if "const formatCurrency" not in text:
    import_index = text.find('const SalesDeliveryReportList')
    new_currency = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

"""
    text = text[:import_index] + new_currency + text[import_index:]

# 2. Update Total Revenue card
old_rev1 = """\\u20B9 {totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"""
old_rev2 = """\\u20B9 {totalSalesAmount.toLocaleString('en-IN', { \nminimumFractionDigits: 2, maximumFractionDigits: 2 })}"""

# Regex match for the exact string, considering newlines and spacing
total_rev_pattern = re.compile(r'\\u20B9\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern.sub('{formatCurrency(totalSalesAmount)}', text)

# 3. Add space to chart formatter
text = text.replace(
    "formatter: (val) => '\\u20B9' + val.toLocaleString",
    "formatter: (val) => '\\u20B9 ' + val.toLocaleString"
)

# Also check for other instances
text = text.replace(
    "'\\u20B9' + val.toLocaleString",
    "'\\u20B9 ' + val.toLocaleString"
)

# 4. In case the symbol is directly used in table headers or anywhere else
# Let's search and replace 'Total Revenue (\\u20B9)' with 'Total Revenue' (handled by formatCurrency usually) but here it's fine.

with io.open('frontend/src/jsx/components/Sales/SalesDeliveryReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
