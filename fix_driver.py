import io
import re

with io.open('frontend/src/jsx/components/Sales/SalesDriverReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Wrap in Card layout and remove Hero card
layout_start = """        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>"""
                        
layout_end = """                    </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>"""

if '<div className="fd-dashboard-container">' in text:
    start_pattern = r'<div className="fd-dashboard-container">\s*\{\/\*.*?Hero Card.*?\*\/\}\s*<div className="fd-hero-card"[\s\S]*?<\/div>\s*<\/div>\s*<div className="fd-management-content">\s*<div className="fd-section-container">'
    text = re.sub(start_pattern, layout_start, text)
    
    text = text.replace(
        '                    </div>\n                </div>\n            </div>\n        </div>',
        layout_end
    )
    text = text.replace(
        '                </div>\n            </div>\n        </div>\n    );\n};',
        layout_end + '\n    );\n};'
    )

# 2. Add formatCurrency if missing, and Card import
if "import { Card } from 'react-bootstrap'" not in text:
    if "import ReactApexChart" in text:
        text = text.replace("import ReactApexChart from 'react-apexcharts';", "import ReactApexChart from 'react-apexcharts';\nimport { Card } from 'react-bootstrap';")

new_currency = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);
"""

if "const formatCurrency = " not in text:
    text = text.replace('const SalesDriverReportList = () => {', new_currency + '\nconst SalesDriverReportList = () => {')

# 3. Fix the Total Revenue to use formatCurrency
total_rev_pattern = re.compile(r'(?:\\u20B9|₹|â‚¹)\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern.sub('{formatCurrency(totalSalesAmount)}', text)

text = re.sub(r'(?:\\u20B9|₹|â‚¹)\s*\{totalSalesAmount\}', '{formatCurrency(totalSalesAmount)}', text)
text = re.sub(r'(?:\\u20B9|₹|â‚¹)\s*([0-9\.\,]+)', '{formatCurrency(\\1)}', text)

# 4. Remove padding from tab-content
text = text.replace('tab-content mt-4 px-4 pb-4', 'tab-content mt-4')
text = text.replace('tab-content mt-4 px-3 pb-3', 'tab-content mt-4')

# 5. Remove the Filter button completely
filter_btn_pattern = re.compile(r'<\s*button\s+className="btn btn-sm"[^>]*onClick=\{[^}]*fetchData[^}]*\}[^>]*>\s*Filter\s*<\s*/button\s*>', re.MULTILINE)
text = filter_btn_pattern.sub('', text)

filter_btn_str = """                            <button
                                className="btn btn-sm"
                                style={{ background: 'var(--fd-accent, #007bff)', color: '#fff', fontWeight: '600', borderRadius: '6px' }}
                                onClick={() => fetchData()}
                            >
                                Filter
                            </button>"""
text = text.replace(filter_btn_str, "")

# Ensure chart strings are fine
text = text.replace("return '₹ ' + val", "return '\\u20B9 ' + val")
text = text.replace('const formattedVal = "₹ " + Number', 'const formattedVal = "\\u20B9 " + Number')
text = text.replace('return "₹ " + Number', 'return "\\u20B9 " + Number')
text = text.replace('return "₹ " + val', 'return "\\u20B9 " + val')

with io.open('frontend/src/jsx/components/Sales/SalesDriverReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
