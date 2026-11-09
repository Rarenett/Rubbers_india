import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form, Row, Col, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getPriceLists,
    createPriceList,
    updatePriceList,
    deletePriceList,
    getStockGroups,
    getStockItems
} from '../../../services/InventoryService';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/dateUtils';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const PriceList = () => {
    const { can } = usePermission();
    const nameInputRef = useRef(null);
    const [priceLists, setPriceLists] = useState([]);
    const [stockGroups, setStockGroups] = useState([]);
    const [allStockItems, setAllStockItems] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const defaultForm = {
        name: '',
        applicable_date: new Date().toISOString().split('T')[0],
        items: [] // Will store { stock_item: id, stock_item_name: name, stock_group: group_id, actual_price: value, rate: value }
    };

    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    useEffect(() => {
        fetchData();
        fetchStockGroups();
        fetchStockItemsData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getPriceLists();
            setPriceLists(data);
        } catch (error) {
            console.error("Error fetching price lists:", error);
            Swal.fire('Error', 'Failed to load price lists', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStockGroups = async () => {
        try {
            const data = await getStockGroups();
            setStockGroups(data);
        } catch (error) {
            console.error("Error fetching stock groups:", error);
        }
    };

    const fetchStockItemsData = async () => {
        try {
            const data = await getStockItems();
            setAllStockItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching stock items:", error);
        }
    };

    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value);
    };

    const buildFormItems = (savedItems = []) => {
        const savedItemMap = {};
        if (savedItems) {
            savedItems.forEach(item => {
                savedItemMap[item.stock_item] = item;
            });
        }
        return allStockItems.map(item => {
            const saved = savedItemMap[item.id];
            return {
                stock_item: item.id,
                stock_item_name: item.name,
                stock_group: item.stock_group,
                actual_price: saved ? saved.actual_price : (item.ss_rate || item.mrp || 0),
                rate: saved ? saved.rate : 0,
                unit: item.base_unit_name || item.primary_unit_name || ''
            };
        });
    };

    const handleShowModal = async () => {
        setEditingId(null);
        setSelectedGroup('');
        setItemSearchTerm('');
        let itemsList = allStockItems;
        if (itemsList.length === 0) {
            try {
                itemsList = await getStockItems();
                setAllStockItems(itemsList);
            } catch (err) {
                console.error(err);
            }
        }
        const initialItems = itemsList.map(item => ({
            stock_item: item.id,
            stock_item_name: item.name,
            stock_group: item.stock_group,
            actual_price: item.ss_rate || item.mrp || 0,
            rate: 0,
            unit: item.base_unit_name || item.primary_unit_name || ''
        }));
        setFormData({ ...defaultForm, items: initialItems });
        setShowModal(true);
    };

    const handleEdit = async (pl) => {
        setEditingId(pl.id);
        setSelectedGroup('');
        setItemSearchTerm('');
        let itemsList = allStockItems;
        if (itemsList.length === 0) {
            try {
                itemsList = await getStockItems();
                setAllStockItems(itemsList);
            } catch (err) {
                console.error(err);
            }
        }
        const savedItemMap = {};
        if (pl.items) {
            pl.items.forEach(item => {
                savedItemMap[item.stock_item] = item;
            });
        }
        const combinedItems = itemsList.map(item => {
            const saved = savedItemMap[item.id];
            return {
                stock_item: item.id,
                stock_item_name: item.name,
                stock_group: item.stock_group,
                actual_price: saved ? saved.actual_price : (item.ss_rate || item.mrp || 0),
                rate: saved ? saved.rate : 0,
                unit: item.base_unit_name || item.primary_unit_name || ''
            };
        });
        setFormData({
            name: pl.name,
            applicable_date: pl.applicable_date,
            items: combinedItems
        });
        setShowModal(true);
    };

    const handleCopy = async (pl) => {
        setEditingId(null);
        setSelectedGroup('');
        setItemSearchTerm('');
        let itemsList = allStockItems;
        if (itemsList.length === 0) {
            try {
                itemsList = await getStockItems();
                setAllStockItems(itemsList);
            } catch (err) {
                console.error(err);
            }
        }
        const savedItemMap = {};
        if (pl.items) {
            pl.items.forEach(item => {
                savedItemMap[item.stock_item] = item;
            });
        }
        const combinedItems = itemsList.map(item => {
            const saved = savedItemMap[item.id];
            return {
                stock_item: item.id,
                stock_item_name: item.name,
                stock_group: item.stock_group,
                actual_price: saved ? saved.actual_price : (item.ss_rate || item.mrp || 0),
                rate: saved ? saved.rate : 0,
                unit: item.base_unit_name || item.primary_unit_name || ''
            };
        });
        setFormData({
            name: `${pl.name} (Copy)`,
            applicable_date: '',
            items: combinedItems
        });
        setShowModal(true);
    };

    const handleItemRateChange = (index, newRate) => {
        const updatedItems = [...formData.items];
        updatedItems[index].rate = newRate;
        setFormData({ ...formData, items: updatedItems });
    };

    const handleKeyDown = (e) => {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const type = target.type ? target.type.toLowerCase() : '';

        if (e.key !== 'Enter') {
            if (tagName === 'select') {
                delete target.dataset.pickerOpen;
            }
            return;
        }
        
        // Allow default behavior for textareas and submit buttons
        if (tagName === 'textarea' || type === 'submit') {
            return;
        }
        
        e.preventDefault();
        
        // Check if the current element is a select dropdown and is NOT marked as open
        if (tagName === 'select' && target.dataset.pickerOpen !== 'true') {
            if (typeof target.showPicker === 'function') {
                target.showPicker();
                target.dataset.pickerOpen = 'true';
                return;
            }
        }
        
        // If it was open, or it's a regular input, delete flag and go to next
        if (tagName === 'select') {
            delete target.dataset.pickerOpen;
        }

        const form = e.currentTarget;
        const focusableElements = Array.from(
            form.querySelectorAll('input, select, textarea, button')
        ).filter(el => {
            return !el.disabled && 
                   el.tabIndex !== -1 && 
                   el.offsetParent !== null && 
                   !(el.tagName.toLowerCase() === 'button' && el.classList.contains('btn-secondary'));
        });
        
        const index = focusableElements.indexOf(target);
        if (index > -1 && index < focusableElements.length - 1) {
            focusableElements[index + 1].focus();
        }
    };

    const handleFormBlur = (e) => {
        if (e.target.tagName.toLowerCase() === 'select') {
            delete e.target.dataset.pickerOpen;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updatePriceList(editingId, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Price List updated successfully', timer: 2000 });
            } else {
                await createPriceList(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Price List created successfully', timer: 2000 });
            }
            setShowModal(false);
            setEditingId(null);
            fetchData();
        } catch (error) {
            console.error(error.response?.data);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save Price List' });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Price List?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deletePriceList(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Price List deleted successfully', timer: 2000 });
                fetchData();
            } catch (error) {
                console.error("Error deleting price list:", error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete Price List' });
            }
        }
    };

    const filteredPriceLists = priceLists.filter(pl =>
        (pl.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredPriceLists.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentPriceLists = filteredPriceLists.slice(startIndex, startIndex + itemsPerPage);

    const filteredItems = formData.items.filter(item => {
        const matchesGroup = !selectedGroup || String(item.stock_group) === String(selectedGroup);
        const matchesSearch = (item.stock_item_name || '').toLowerCase().includes(itemSearchTerm.toLowerCase());
        return matchesGroup && matchesSearch;
    });

    return (
        <Fragment>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Price Lists</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Price List..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        style={{ height: '17px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="inventory" onClick={handleShowModal}>
                                    Price List
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>

                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px' }}><strong>SL NO</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>APPLICABLE DATE</strong></th>
                                                <th><strong>ITEMS COUNT</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPriceLists.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">No price lists found</td>
                                                </tr>
                                            ) : (
                                                currentPriceLists.map((pl, index) => (
                                                    <tr key={pl.id}>
                                                        <td><strong>{startIndex + index + 1}</strong></td>
                                                        <td><strong>{pl.name}{pl.applicable_date ? ` (${formatDate(pl.applicable_date)})` : ''}</strong></td>
                                                        <td>{pl.applicable_date ? formatDate(pl.applicable_date) : '-'}</td>
                                                        <td>{pl.items?.length || 0}</td>
                                                        <td className="text-end">
                                                            {can('inventory', 'edit') || can('inventory', 'delete') || can('inventory', 'create') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    {can('inventory', 'create') && (
                                                                        <Button
                                                                            variant="warning"
                                                                            size="sm"
                                                                            className="shadow btn-xs sharp me-1 text-white"
                                                                            onClick={() => handleCopy(pl)}
                                                                            title="Copy Price List"
                                                                        >
                                                                            <i className="fa fa-copy"></i>
                                                                        </Button>
                                                                    )}
                                                                    <EditButton module="inventory" onClick={() => handleEdit(pl)} className="me-1" title="Edit" />
                                                                    <DeleteButton module="inventory" onClick={() => handleDelete(pl.id, pl.name)} title="Delete" />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )))}
                                        </tbody>
                                    </table>

                                    {filteredPriceLists.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredPriceLists.length)} of {filteredPriceLists.length} entries
                                            </div>
                                            {totalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-left" />
                                                            </button>
                                                        </li>
                                                        {Array.from({ length: totalPages }, (_, index) => {
                                                            const pageNumber = index + 1;
                                                            if (
                                                                pageNumber === 1 ||
                                                                pageNumber === totalPages ||
                                                                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                            {pageNumber}
                                                                        </button>
                                                                    </li>
                                                                );
                                                            } else if (
                                                                pageNumber === currentPage - 2 ||
                                                                pageNumber === currentPage + 2
                                                            ) {
                                                                return (
                                                                    <li key={pageNumber} className="page-item disabled">
                                                                        <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                                    </li>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Price List Modal */}
            <Modal show={showModal} onHide={() => { setShowModal(false); setEditingId(null); }} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-tags text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editingId ? 'Edit Price List' : 'Create Price List'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {editingId
                                        ? 'Update rates and dates for your existing price list'
                                        : 'Enter details and set rates to create a new price list'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onBlur={handleFormBlur}>
                    <Modal.Body>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Price List Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        ref={nameInputRef}
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Applicable Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        value={formData.applicable_date}
                                        onChange={(e) => setFormData({ ...formData, applicable_date: e.target.value })}
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Filter by Stock Group</Form.Label>
                                    <Form.Select value={selectedGroup} onChange={handleGroupChange}>
                                        <option value="">All Stock Items</option>
                                        {stockGroups.map(group => (
                                            <option key={group.id} value={group.id}>{group.name}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>Search Items</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by item name..."
                                        value={itemSearchTerm}
                                        onChange={(e) => setItemSearchTerm(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <h5 className="mt-4 mb-3">Set Rates for Items</h5>
                        <style>{`
                            .custom-price-list-scrollbar {
                                scrollbar-width: auto !important;
                            }
                            .custom-price-list-scrollbar::-webkit-scrollbar {
                                width: 10px !important;
                                height: 10px !important;
                            }
                            .custom-price-list-scrollbar::-webkit-scrollbar-button {
                                display: none !important;
                                width: 0 !important;
                                height: 0 !important;
                            }
                            .custom-price-list-scrollbar::-webkit-scrollbar-track {
                                background: #f1f5f9 !important;
                                border-radius: 6px !important;
                            }
                            .custom-price-list-scrollbar::-webkit-scrollbar-thumb {
                                background: #6c5ce7 !important;
                                border-radius: 6px !important;
                                min-height: 120px !important;
                            }
                            .custom-price-list-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: #5b4bc4 !important;
                            }
                        `}</style>
                        <div className="table-responsive custom-price-list-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <Table bordered hover>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
                                    <tr>
                                        <th>Item Name</th>
                                        <th>MRP</th>
                                        <th>Base Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="text-center text-muted">No items found.</td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item) => {
                                            // Find the original index in formData.items to update the correct item
                                            const originalIndex = formData.items.findIndex(i => i.stock_item === item.stock_item);
                                            return (
                                                <tr key={item.stock_item}>
                                                    <td>{item.stock_item_name}</td>
                                                    <td>{item.actual_price}</td>
                                                    <td>
                                                        <div style={{ position: 'relative' }}>
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                value={item.rate || ''}
                                                                onChange={(e) => handleItemRateChange(originalIndex, parseFloat(e.target.value) || 0)}
                                                                placeholder="0.00"
                                                                style={{ paddingRight: item.unit ? '60px' : '12px' }}
                                                            />
                                                            {item.unit && (
                                                                <span className="badge badge-primary light" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', padding: '0.4em 0.6em' }}>
                                                                    {item.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
                        <Button variant="primary" type="submit">Save</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default PriceList;
