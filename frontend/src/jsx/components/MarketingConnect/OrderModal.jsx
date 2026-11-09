import './marketing-cute.css';
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Card } from 'react-bootstrap';
import { getStockItems } from '../../../services/InventoryService';
import axiosInstance from '../../../services/axiosInstance';
import { useSelector } from 'react-redux';

const OrderModal = ({ show, onHide, visitData, onSuccess }) => {
    const user = useSelector(state => state.auth?.auth?.user);
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [inputs, setInputs] = useState({});
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (show) {
            fetchProducts();
        }
    }, [show]);

    const fetchProducts = async () => {
        try {
            const response = await getStockItems();
            const items = response.data || response.results || response;
            if (Array.isArray(items)) {
                setProducts(items);
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
        }
    };

    const handleInput = (productId, field, value) => {
        setInputs(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: value
            }
        }));

        // If the item is already in the cart, sync the cart automatically
        const existing = cart.find(item => item.product.id === productId);
        if (existing) {
            setCart(prevCart => prevCart.map(item => {
                if (item.product.id === productId) {
                    if (field === 'qty') {
                        return { ...item, qty: parseInt(value) || 1 };
                    }
                    if (field === 'negotiatedPrice') {
                        return { ...item, negotiatedPrice: value };
                    }
                }
                return item;
            }));
        }
    };

    const addToCart = (product) => {
        const negotiatedPrice = inputs[product.id]?.negotiatedPrice || '';
        const existing = cart.find(item => item.product.id === product.id);
        
        if (existing) {
            const newQty = existing.qty + 1;
            setCart(cart.map(item => item.product.id === product.id ? { ...item, qty: newQty, negotiatedPrice } : item));
            
            // Update input field: reflect the new incremented quantity
            setInputs(prev => ({ 
                ...prev, 
                [product.id]: { 
                    ...prev[product.id], 
                    qty: newQty,
                    negotiatedPrice: negotiatedPrice
                } 
            }));
        } else {
            const qty = parseInt(inputs[product.id]?.qty) || 1;
            setCart([...cart, { product, qty, negotiatedPrice }]);
            
            setInputs(prev => ({ 
                ...prev, 
                [product.id]: { 
                    ...prev[product.id], 
                    qty: qty,
                    negotiatedPrice: negotiatedPrice
                } 
            }));
        }
    };

    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item.product.id !== productId));
    };

    const submitOrder = async () => {
        if (cart.length === 0) {
            alert("Your wishlist is empty.");
            return;
        }
        
        if (step === 1) {
            setStep(2);
            return;
        }

        try {
            const employeeId = user?.employee_id || 1;

            const promises = cart.map(item => {
                const payload = {
                    employee: employeeId,
                    stock_item: item.product.id,
                    quantity: item.qty,
                    is_new_customer: true,
                    new_customer_name: visitData?.shop_name || 'Unknown',
                    new_customer_phone: visitData?.mobile_number || '',
                };

                if (item.negotiatedPrice) {
                    payload.negotiated_price = item.negotiatedPrice;
                }

                return axiosInstance.post('/api/project/marketing/wishlist/', payload);
            });

            await Promise.all(promises);
            
            alert("Order/Wishlist submitted for approval!");
            setStep(1);
            onSuccess();
        } catch (error) {
            console.error("Error submitting order:", error);
            alert("Failed to submit order.");
        }
    };

    const filteredProducts = products.filter(p => p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <Modal show={show} onHide={() => { setStep(1); onHide(); }} size="xl">
            <Modal.Header closeButton>
                <Modal.Title>Create Order / Wishlist (Negotiation)</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {step === 1 ? (
                <Row>
                    <Col lg="7" className="mb-4">
                        

                        <h5 className="font-w600 text-black">Product Catalog</h5>
                        <Form.Control type="text" className="mb-3" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        
                        <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="pe-2">
                            {filteredProducts.map(p => {
                                const pInputs = inputs[p.id] || { qty: 1, negotiatedPrice: '' };
                                return (
                                    <div key={p.id} className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center p-3 mb-2 border rounded bg-white shadow-sm gap-2">
                                        <div>
                                            <h6 className="mb-1 text-black">{p.name}</h6>
                                            <small className="text-muted">Company Price: <span className="fw-bold">₹{p.ss_rate || 0}</span></small>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ maxWidth: '130px' }}>
                                                <Form.Control 
                                                    type="number" 
                                                    size="sm" 
                                                    placeholder="Shop Owner ₹" 
                                                    title="Shop Owner Proposed Price"
                                                    value={pInputs.negotiatedPrice} 
                                                    onChange={(e) => handleInput(p.id, 'negotiatedPrice', e.target.value)} 
                                                />
                                            </div>
                                            <div style={{ maxWidth: '70px' }}>
                                                <Form.Control 
                                                    type="number" 
                                                    size="sm" 
                                                    min="1" 
                                                    value={pInputs.qty} 
                                                    onChange={(e) => handleInput(p.id, 'qty', e.target.value)} 
                                                />
                                            </div>
                                            <Button variant="outline-primary" size="sm" onClick={() => addToCart(p)}>
                                                <i className="fa fa-plus"></i>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Col>
                    <Col lg="5">
                        <Card className="shadow-sm">
                            <Card.Header className="bg-light">
                                <h5 className="mb-0">Selected Wishlist</h5>
                            </Card.Header>
                            <Card.Body>
                                {cart.length === 0 ? (
                                    <p className="text-muted mb-0">No items added yet.</p>
                                ) : (
                                    <ul className="list-group list-group-flush">
                                        {cart.map((item, idx) => (
                                            <li key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0">
                                                <div>
                                                    <h6 className="mb-0">{item.product.name}</h6>
                                                    <small className="text-muted d-block mt-1">Qty: {item.qty}</small>
                                                    <small className="text-muted d-block">Company Price: ₹{item.product.ss_rate}</small>
                                                    <small className="text-muted d-block">Shop Owner Price: ₹{item.negotiatedPrice || item.product.ss_rate}</small>
                                                </div>
                                                <Button variant="danger" size="sm" onClick={() => removeFromCart(item.product.id)}>
                                                    <i className="fa fa-trash"></i>
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card.Body>
                            <Card.Footer>
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
        </Modal>
    );
};

export default OrderModal;
