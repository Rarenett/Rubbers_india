import io

with io.open('frontend/src/jsx/components/Sales/CustomerSalesReturnReportList.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

hero_old = """        <div className="fd-dashboard-container">
            {/* ── Hero Card ────────────────────────────────────────────── */}
            <div className="fd-hero-card" style={{ padding: '1.5rem 2.5rem' }}>
                <div className="fd-hero-content">
                    <div className="d-flex align-items-center mb-2">
                        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
                            Customer Wise Sales Return <span>Report</span>
                        </h1>
                    </div>
                    <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                        View and export the list of Sales Returns categorized by customer.
                    </p>
                </div>
            </div>

            <div className="fd-management-content">
        <div className="fd-section-container">
                    <div className="fd-section-header d-flex flex-wrap align-items-center gap-3 py-3 px-4 bg-white" style={{ borderBottom: '1px solid #eaebf0' }}>"""

hero_new = """        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Body>
                            <div className="fd-section-header d-flex flex-wrap align-items-center gap-3 py-3 px-4 bg-white" style={{ borderBottom: '1px solid #eaebf0' }}>"""

text = text.replace(hero_old, hero_new)

with io.open('frontend/src/jsx/components/Sales/CustomerSalesReturnReportList.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
