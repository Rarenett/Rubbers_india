import io

with io.open('frontend/src/jsx/components/Sales/CustomerSalesInvoiceReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 0. Fix encoding issues
text = text.replace('â‚¹', '\u20B9').replace('₹', '\u20B9')

# 1. Update formatCurrency
old_currency = """const formatCurrency = (val) =>
    '\u20B9' + parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });"""

new_currency = """const formatCurrency = (val) => (
    <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\\u20B9"}</span> {parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
);"""
text = text.replace(old_currency, new_currency)

# 2. Update Total Revenue hero
old_rev = """\u20B9 {totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"""
new_rev = """{formatCurrency(totalSalesAmount)}"""
text = text.replace(old_rev, new_rev)

# 3. Add space to chart formatter
text = text.replace(
    "'\u20B9' + val.toLocaleString",
    "'\\u20B9 ' + val.toLocaleString"
)

# 4. Remove Hero Card and add Card wrap
hero_old = """        <div className="fd-dashboard-container">
            {/* ── Hero Card ────────────────────────────────────────────── */}
            <div className="fd-hero-card" style={{ padding: '1.5rem 2.5rem' }}>
                <div className="fd-hero-content">
                    <div className="d-flex align-items-center mb-2">
                        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
                            Customer Wise Sales Invoices <span>Report</span>
                        </h1>
                    </div>
                    <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                        View and export the list of Sales Invoices categorized by customer.
                    </p>
                </div>
            </div>

            <div className="fd-management-content">
                <div className="fd-section-container">
                    <div className="fd-section-header" style={{ flexWrap: 'wrap', gap: '0.5rem', borderBottom: 'none', paddingBottom: '0', justifyContent: 'flex-start' }}>"""

hero_new = """        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="fd-section-header" style={{ flexWrap: 'wrap', gap: '0.5rem', borderBottom: 'none', paddingBottom: '0', justifyContent: 'flex-start' }}>"""
text = text.replace(hero_old, hero_new)

# 5. Add Card import
text = text.replace(
    "import { Modal, Button } from 'react-bootstrap';",
    "import { Modal, Button, Card } from 'react-bootstrap';"
)

# 6. Close the Card wrap
close_old = """                        )}
                    </div>
                </div>
            </div>

            <InvoiceDetailModal"""
close_new = """                        )}
                    </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <InvoiceDetailModal"""
text = text.replace(close_old, close_new)

with io.open('frontend/src/jsx/components/Sales/CustomerSalesInvoiceReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
