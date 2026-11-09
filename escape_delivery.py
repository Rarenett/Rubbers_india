import io

with io.open('frontend/src/jsx/components/Sales/SalesDeliveryReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any lingering literal currency symbols with the javascript unicode escape sequence
text = text.replace('â‚¹', '\\u20B9').replace('₹', '\\u20B9')

# I will also replace the "formatter" string concatenations to use the safe Arial fallback if needed, 
# but for chart formatters, the plain string \u20B9 works perfectly fine because apexcharts renders it correctly on canvas/SVG.

with io.open('frontend/src/jsx/components/Sales/SalesDeliveryReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
