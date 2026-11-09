import os

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrderModal.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

fav_block = """                        <div className="mb-4">
                            <h5 className="font-w600 text-black mb-3">Shop Owner Favourites <span className="badge badge-sm badge-success ms-2">Top Picks</span></h5>
                            <div className="d-flex gap-3 pb-2" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                                {products.slice(0, 4).map(p => {
                                    const pInputs = inputs[p.id] || { qty: 1, negotiatedPrice: '' };
                                    return (
                                        <Card key={'fav-'+p.id} className="shadow-sm border-0 mb-0" style={{ minWidth: '220px', flexShrink: 0 }}>
                                            <Card.Body className="p-3">
                                                <h6 className="text-black mb-1 text-truncate" title={p.name}>{p.name}</h6>
                                                <small className="text-muted d-block mb-3">₹{p.ss_rate || 0}</small>
                                                
                                                <div className="d-flex align-items-center gap-2">
                                                    <Form.Control 
                                                        type="number" size="sm" placeholder="₹" 
                                                        title="Shop Owner Proposed Price"
                                                        value={pInputs.negotiatedPrice} 
                                                        onChange={(e) => handleInput(p.id, 'negotiatedPrice', e.target.value)} 
                                                    />
                                                    <Form.Control 
                                                        type="number" size="sm" min="1" style={{ width: '50px' }}
                                                        value={pInputs.qty} 
                                                        onChange={(e) => handleInput(p.id, 'qty', e.target.value)} 
                                                    />
                                                    <Button variant="primary" size="sm" onClick={() => addToCart(p)}>
                                                        <i className="fa fa-plus"></i>
                                                    </Button>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>"""

content = content.replace(fav_block + '\n', '')
# In case of minor whitespace differences, try removing without trailing newline
content = content.replace(fav_block, '')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Shop Owner Favourites removed from OrderModal.jsx")
