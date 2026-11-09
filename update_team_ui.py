import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Update the Make Team button onClick
old_btn = """                                    <button 
                                        className="btn btn-sm btn-success"
                                        onClick={() => setShowTeamModal(true)}
                                    >"""
new_btn = """                                    <button 
                                        className="btn btn-sm btn-success"
                                        onClick={() => {
                                            if (selectedLeads.length === 0) {
                                                alert("Please select at least one lead to create a team.");
                                            } else {
                                                setShowTeamModal(true);
                                            }
                                        }}
                                    >"""
content = content.replace(old_btn, new_btn)

# 2. Add Selected Leads to the Make Team modal
old_modal_end = """                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end gap-2 mt-4">"""

new_modal_end = """                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={12}>
                                <h6>Selected Leads ({selectedLeads.length})</h6>
                                <div className="p-3 bg-light rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {selectedLeads.length > 0 ? leads.filter(l => selectedLeads.includes(l.id)).map(lead => (
                                        <div key={lead.id} className="d-flex justify-content-between border-bottom py-2">
                                            <span><strong>{lead.company_name}</strong> - {lead.first_name} {lead.last_name}</span>
                                            <span className="badge bg-secondary">{lead.category_detail?.name || 'Unknown Repository'}</span>
                                        </div>
                                    )) : (
                                        <span className="text-muted">No leads selected.</span>
                                    )}
                                </div>
                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end gap-2 mt-4">"""
content = content.replace(old_modal_end, new_modal_end)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Make Team button and modal")
