import io
import re

with io.open('frontend/src/jsx/components/Sales/SalesVehicleReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Wrap in Card layout and remove Hero card
layout_start = """        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>"""
                        
layout_end = """                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>"""

if '<div className="fd-dashboard-container">' in text:
    # Replace the starting tags
    start_pattern = r'<div className="fd-dashboard-container">\s*\{\/\*.*?Hero Card.*?\*\/\}\s*<div className="fd-hero-card"[\s\S]*?<\/div>\s*<\/div>\s*<div className="fd-management-content">\s*<div className="fd-section-container">'
    text = re.sub(start_pattern, layout_start, text)
    
    # Replace the ending tags
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
    text = text.replace("import { Modal, Button } from 'react-bootstrap';", "import { Modal, Button, Card } from 'react-bootstrap';")
    text = text.replace("import { Button, Modal } from 'react-bootstrap';", "import { Modal, Button, Card } from 'react-bootstrap';")
    if "import { Card }" not in text:
        text = text.replace("from 'react-bootstrap';", ", Card } from 'react-bootstrap';")

if "const formatCurrency" not in text:
    import_index = text.find('const SalesVehicleReportList')
    new_currency = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);

"""
    text = text[:import_index] + new_currency + text[import_index:]

# 3. Fix the Total Revenue to use formatCurrency
total_rev_pattern = re.compile(r'\\u20B9\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}')
text = total_rev_pattern.sub('{formatCurrency(totalSalesAmount)}', text)

# Just in case the totalSalesAmount is written without toLocaleString in the template
text = re.sub(r'\\u20B9\s*\{totalSalesAmount\}', '{formatCurrency(totalSalesAmount)}', text)

text = re.sub(r'₹\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}', '{formatCurrency(totalSalesAmount)}', text)
text = re.sub(r'â‚¹\s*\{totalSalesAmount\.toLocaleString\([^\)]+\)\}', '{formatCurrency(totalSalesAmount)}', text)
text = re.sub(r'\\u20B9\s*([0-9\.\,]+)', '{formatCurrency(\\1)}', text) # just in case hardcoded, but it's variable

# 4. Remove padding from tab-content
text = text.replace('tab-content mt-4 px-4 pb-4', 'tab-content mt-4')

# 5. Remove the Filter button completely
filter_btn_pattern = re.compile(r'<\s*button\s+className="btn btn-sm"[^>]*onClick=\{[^}]*fetchData[^}]*\}[^>]*>\s*Filter\s*<\s*/button\s*>', re.MULTILINE)
text = filter_btn_pattern.sub('', text)

# If it's written differently, let's also do a generic string replace for the block:
filter_btn_str = """                            <button
                                className="btn btn-sm"
                                style={{ background: 'var(--fd-accent, #007bff)', color: '#fff', fontWeight: '600', borderRadius: '6px' }}
                                onClick={() => fetchData()}
                            >
                                Filter
                            </button>"""
text = text.replace(filter_btn_str, "")

with io.open('frontend/src/jsx/components/Sales/SalesVehicleReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
