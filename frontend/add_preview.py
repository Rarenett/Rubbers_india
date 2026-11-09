import os

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrderModal.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add step state
state_search = "const [inputs, setInputs] = useState({});"
state_replace = "const [inputs, setInputs] = useState({});\n    const [step, setStep] = useState(1);"
content = content.replace(state_search, state_replace)

# Modify submitOrder to handle step transition
submit_search = """    const submitOrder = async () => {
        if (cart.length === 0) {
            alert("Your wishlist is empty.");
            return;
        }"""
submit_replace = """    const submitOrder = async () => {
        if (cart.length === 0) {
            alert("Your wishlist is empty.");
            return;
        }
        
        if (step === 1) {
            setStep(2);
            return;
        }"""
content = content.replace(submit_search, submit_replace)

# Reset step on success
reset_search = "onSuccess();"
reset_replace = "setStep(1);\n            onSuccess();"
content = content.replace(reset_search, reset_replace)

# Reset step on hide
hide_search = "<Modal show={show} onHide={onHide} size=\"xl\">"
hide_replace = """<Modal show={show} onHide={() => { setStep(1); onHide(); }} size="xl">"""
content = content.replace(hide_search, hide_replace)

# Modify the Row to be conditionally rendered
row_search = """                <Row>
                    <Col lg="7" className="mb-4">"""

row_replace = """                {step === 1 ? (
                <Row>
                    <Col lg="7" className="mb-4">"""
content = content.replace(row_search, row_replace)

old_footer = """                            <Card.Footer>
                                <Button variant="primary" className="w-100" onClick={submitOrder} disabled={cart.length === 0}>
                                    Submit for Approval
                                </Button>
                            </Card.Footer>
                        </Card>
                    </Col>
                </Row>
            </Modal.Body>
        </Modal>"""

footer_replace = """                            <Card.Footer>
                                <Button variant="primary" className="w-100" onClick={submitOrder} disabled={cart.length === 0}>
                                    Preview Wishlist
                                </Button>
                            </Card.Footer>
                        </Card>
                    </Col>
                </Row>
                ) : (
                <div className="preview-container p-2">
                    <h5 className="mb-4 font-w600 text-black">Review Your Wishlist</h5>
                    <div className="table-responsive shadow-sm rounded mb-4">
                        <table className="table table-bordered mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Company Price</th>
                                    <th>Shop Owner Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="text-black">{item.product.name}</td>
                                        <td>{item.qty}</td>
                                        <td>₹{item.product.ss_rate}</td>
                                        <td className="fw-bold text-primary">₹{item.negotiatedPrice || item.product.ss_rate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="d-flex justify-content-end gap-3 mt-4 pb-2">
                        <Button variant="secondary" onClick={() => setStep(1)}>
                            Back
                        </Button>
                        <Button variant="success" onClick={submitOrder}>
                            Confirm & Submit Approval
                        </Button>
                    </div>
                </div>
                )}
            </Modal.Body>
        </Modal>"""

content = content.replace(old_footer, footer_replace)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated OrderModal.jsx with preview step.")
