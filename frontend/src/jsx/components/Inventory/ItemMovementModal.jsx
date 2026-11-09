import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Form } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';
import Select from 'react-select';

const ItemMovementModal = ({ show, onHide }) => {
    const [stockItems, setStockItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show && stockItems.length === 0) {
            fetchStockItems();
        }
    }, [show]);

    const fetchStockItems = async () => {
        try {
            const response = await axiosInstance.get('/api/inventory/stock-items/simple/');
            setStockItems(response.data);
        } catch (err) {
            console.error('Failed to fetch stock items', err);
        }
    };

    const itemOptions = stockItems.map(item => ({ value: item.id, label: item.name }));

    useEffect(() => {
        if (selectedItem) {
            fetchMovements(selectedItem.value);
        } else {
            setMovements([]);
        }
    }, [selectedItem]);

    const fetchMovements = async (itemId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get(`/api/inventory/item-movement/${itemId}/`);
            if (response.data.status) {
                setMovements(response.data.data);
            } else {
                setError(response.data.message || 'Failed to fetch movements');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    let runningBalance = 0;

    return (
        <Modal show={show} onHide={onHide} size="xl" centered>
            <Modal.Header closeButton>
                <Modal.Title>Item Movement Tracker</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ minHeight: '400px' }}>
                <div className="mb-4" style={{ maxWidth: '400px' }}>
                    <Form.Group>
                        <Form.Label>Select Stock Item</Form.Label>
                        <Select
                            options={itemOptions}
                            value={selectedItem}
                            onChange={setSelectedItem}
                            placeholder="Search and select an item..."
                            isClearable
                        />
                    </Form.Group>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Loading movement data...</p>
                    </div>
                ) : selectedItem ? (
                    movements.length > 0 ? (
                        <div className="table-responsive">
                            <Table striped bordered hover size="sm" className="align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Transaction Type</th>
                                        <th>Voucher/Ref</th>
                                        <th>Warehouse</th>
                                        <th className="text-end">Qty In</th>
                                        <th className="text-end">Qty Out</th>
                                        <th className="text-end">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((mov, idx) => {
                                        const qty = parseFloat(mov.quantity) || 0;
                                        if (mov.movement_type === 'IN') {
                                            runningBalance += qty;
                                        } else if (mov.movement_type === 'OUT') {
                                            runningBalance -= qty;
                                        }
                                        
                                        return (
                                            <tr key={mov.id || idx}>
                                                <td>{mov.date}</td>
                                                <td>{mov.time}</td>
                                                <td>{mov.transaction_type}</td>
                                                <td>{mov.reference_id || '-'}</td>
                                                <td>{mov.warehouse_name || '-'}</td>
                                                <td className="text-end text-success">
                                                    {mov.movement_type === 'IN' ? qty.toFixed(2) : '-'}
                                                </td>
                                                <td className="text-end text-danger">
                                                    {mov.movement_type === 'OUT' ? qty.toFixed(2) : '-'}
                                                </td>
                                                <td className="text-end fw-bold">
                                                    {runningBalance.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-5 text-muted">
                            <i className="fa fa-info-circle fa-2x mb-3 text-secondary"></i>
                            <h5>No movements found</h5>
                            <p>This item has no recorded stock transactions.</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-5 text-muted">
                        <i className="fa fa-hand-pointer fa-2x mb-3 text-secondary"></i>
                        <h5>Select an item</h5>
                        <p>Please select a stock item from the dropdown above to view its movement history.</p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ItemMovementModal;
