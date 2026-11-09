import re

path = r"c:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\Finance\BillSettlementPopup.jsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Header
old_header = r'''<Modal.Header closeButton className="px-4 py-3 border-bottom">
                <Modal.Title className="w-100">
                    <div className="d-flex align-items-center gap-3">
                        <div className="form-icon-wrapper rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px', backgroundColor: '#e2eff9', color: '#3b6fd4' }}>
                            <i className="fa fa-file-invoice-dollar fs-4"></i>
                        </div>
                        <div>
                            <h5 className="mb-1 fw-bold">Bill-Wise Settlement</h5>
                            <p className="mb-0 text-muted fs-13">\{ledgerName\} — \{voucherType\} \{parseFloat\(totalAmount \|\| 0\).toFixed\(2\)\}</p>
                        </div>
                    </div>
                </Modal.Title>
            </Modal.Header>'''
new_header = '''<div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-file-invoice-dollar text-white fs-4"></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Bill-Wise Settlement
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {ledgerName} — {voucherType} {parseFloat(totalAmount || 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>'''
content = re.sub(old_header, new_header, content)

# Replace table and table wrapper
old_table_wrap = r'''<Modal.Body className="p-0" style={{ backgroundColor: isDark \? '#1a222c' : '#fff' }}>
                <div className="table-responsive p-3" style={{ maxHeight: '350px' }}>
                    <Table bordered hover responsive className="align-middle table-sm text-center form-table">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: '6%' }}>Select</th>
                                <th style={{ width: '16%' }}>Type of Ref</th>
                                <th style={{ width: '18%' }}>Invoice No / Name</th>
                                <th style={{ width: '10%' }}>Date</th>
                                <th style={{ width: '11%' }}>Invoice Total \(\)</th>
                                <th style={{ width: '11%', color: '#dc3545' }}>Allocated \(\)</th>
                                <th style={{ width: '11%', color: '#27ae60' }}>Balance \(\)</th>
                                <th style={{ width: '12%' }}>Settle Amount \(\)</th>
                                <th style={{ width: '5%' }}>Full</th>
                            </tr>
                        </thead>'''
new_table_wrap = '''<div className="modal-body-custom p-0">
                <div className="table-responsive p-3" style={{ maxHeight: '350px' }}>
                    <Table bordered className="align-middle journal-entry-table border-secondary border-opacity-10 mb-0">
                        <thead>
                            <tr className="table-light">
                                <th className="text-center font-w600" style={{ width: '6%', fontSize: '13px', color: '#4a5568' }}>Select</th>
                                <th className="text-center font-w600" style={{ width: '16%', fontSize: '13px', color: '#4a5568' }}>Type of Ref</th>
                                <th className="text-center font-w600" style={{ width: '18%', fontSize: '13px', color: '#4a5568' }}>Invoice No / Name</th>
                                <th className="text-center font-w600" style={{ width: '10%', fontSize: '13px', color: '#4a5568' }}>Date</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#4a5568' }}>Invoice Total ()</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#dc3545' }}>Allocated ()</th>
                                <th className="text-center font-w600" style={{ width: '11%', fontSize: '13px', color: '#27ae60' }}>Balance ()</th>
                                <th className="text-center font-w600" style={{ width: '12%', fontSize: '13px', color: '#4a5568' }}>Settle Amount ()</th>
                                <th className="text-center font-w600" style={{ width: '5%', fontSize: '13px', color: '#4a5568' }}>Full</th>
                            </tr>
                        </thead>'''
content = re.sub(old_table_wrap, new_table_wrap, content)

# Replace Modal.Body close with div close
content = content.replace('</Modal.Body>', '</div>')

# Replace Footer
old_footer = r'''<Modal.Footer className="px-4 py-3 border-top bg-light">
                <Button variant="outline-danger" size="sm" onClick={\(\) => onApply\(\[\]\)} className="shadow px-3 fw-bold" style={{ borderRadius: '8px' }}><i className="fa fa-times me-1"></i> Clear / On Account</Button>
                <div className="d-flex gap-2 ms-auto">
                    <Button variant="secondary" onClick={onHide} className="modal-btn-cancel">Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSaveDisabled} className="btn-save-custom"><i className="fa fa-check me-1"></i> Apply \{billCount > 0 \? `\(\{billCount\} Bill\$\{billCount > 1 \? 's' : ''\}\)` : ''\}</Button>
                </div>
            </Modal.Footer>'''
new_footer = '''<div className="modal-footer-custom">
                <Button variant="outline-danger" size="sm" onClick={() => onApply([])} className="shadow px-3 fw-bold" style={{ borderRadius: '8px' }}><i className="fa fa-times me-1"></i> Clear / On Account</Button>
                <div className="d-flex gap-2 ms-auto">
                    <Button variant="secondary" onClick={onHide} className="btn-close-custom">Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isSaveDisabled} className="btn-save-custom"><i className="fa fa-check me-1"></i> Apply {billCount > 0 ? `(${billCount} Bill${billCount > 1 ? 's' : ''})` : ''}</Button>
                </div>
            </div>'''
content = re.sub(old_footer, new_footer, content)

# Also update the Add button to exactly match the one in ReceiptForm (same classes minus mt-2 since it's alone)
content = content.replace('''<Button variant="outline-primary" size="sm" onClick={addCustomRow} className="shadow d-flex align-items-center gap-1" style={{ borderRadius: '6px' }}><i className="fa fa-plus"></i> Add Row</Button>''',
                          '''<Button variant="outline-primary" className="shadow d-flex align-items-center gap-1" style={{ borderRadius: '6px' }} onClick={addCustomRow}><i className="fa fa-plus"></i> Add Row</Button>''')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Success")
