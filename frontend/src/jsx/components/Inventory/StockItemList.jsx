import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getStockItems,
    deleteStockItem,
    getStockGroups,
    getStockCategories,
    getUnits,
    getWarehouses,
    importTallyStockItems,
    importStockItemsExcel,
    downloadStockItemTemplate,
} from '../../../services/InventoryService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import StockItemFormModal from './StockItemFormModal';

const resolveImageUrl = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('data:')) {
        return value;
    }
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    const base = (envUrl ? envUrl.replace(':8001', ':8000') : 'http://127.0.0.1:8000').replace(/\/$/, '');
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${base}${path}`;
};

const getItemInitials = (name) => {
    if (!name) return 'IT';
    const clean = name.trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
};

const ItemAvatar = ({ item }) => {
    const [imgError, setImgError] = useState(false);
    const imageUrl = resolveImageUrl(item.image_url || item.image);
    const initials = getItemInitials(item.name);

    useEffect(() => {
        setImgError(false);
    }, [item.image_url, item.image]);

    if (imageUrl && !imgError) {
        return (
            <img
                src={imageUrl}
                alt={item.name}
                className="rounded"
                style={{ width: '40px', height: '40px', minWidth: '40px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div
            className="d-flex align-items-center justify-content-center text-white fw-bold"
            style={{
                width: '40px',
                height: '40px',
                minWidth: '40px',
                fontSize: '13px',
                background: '#9aa0ac',
                borderRadius: '50%',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                letterSpacing: '0.5px'
            }}
            title={item.name}
        >
            {initials}
        </div>
    );
};

const formatStockQuantity = (item) => {
    const qty = parseFloat(item.closing_balance || 0).toFixed(2);
    const unit = (item.base_unit_name || '').trim();
    const isNotApplicable = !unit || 
        unit.toLowerCase() === 'not applicable' || 
        unit.toLowerCase() === 'not_applicable' || 
        unit.toLowerCase() === 'n/a' || 
        unit.toLowerCase() === 'na' || 
        unit.toLowerCase() === 'none' || 
        unit.toLowerCase() === '-';
    return isNotApplicable ? qty : `${qty} ${unit}`;
};

const StockItemList = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [categories, setCategories] = useState([]);
    const [units, setUnits] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();
    
    const fileInputRef = React.useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await downloadStockItemTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'StockItem_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download template' });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            const data = await importStockItemsExcel(formData);
            if (data.errors && data.errors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Import Completed with Errors',
                    html: `Added: <strong>${data.added}</strong><br>Updated: <strong>${data.updated}</strong><br><br><div style="max-height: 150px; overflow-y: auto; text-align: left; font-size: 13px; color: #d33; background: #fff3f3; padding: 10px; border-radius: 5px; border: 1px solid #ffcaca;">${data.errors.join('<br>')}</div>`,
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Import Successful',
                    text: `Added: ${data.added}, Updated: ${data.updated}`,
                });
            }
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to import stock items';
            if (error.response && error.response.data && error.response.data.detail) {
                errorMsg = error.response.data.detail;
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const [showModal, setShowModal] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
        fetchDropdownData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getStockItems();
            setItems(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch stock items',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        fetchData();
        const searchParams = new URLSearchParams(location.search);
        const returnUrl = searchParams.get('returnUrl') || location.state?.returnUrl;
        if (returnUrl) {
            navigate(decodeURIComponent(returnUrl));
        }
    };

    const handleShowModal = useCallback((item = null) => {
        setItemToEdit(item);
        setShowModal(true);
    }, []);

    useEffect(() => {
        if (!loading && items.length > 0) {
            const searchParams = new URLSearchParams(location.search);
            const editId = searchParams.get('edit');
            if (editId) {
                const cleanTarget = String(editId).toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetItem = items.find(r => {
                    const rId = String(r.id);
                    const rName = String(r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return rId === String(editId) || rName === cleanTarget;
                });
                if (targetItem) {
                    handleShowModal(targetItem);
                }
            }
        }
    }, [loading, items, location.search, handleShowModal]);

    const handleImportTally = async () => {
        try {
            setImporting(true);
            Swal.fire({
                title: 'Importing from Tally...',
                text: 'Communicating with Tally Agent and fetching stock items. Please wait...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            const response = await importTallyStockItems((status) => {
                if (status.status === 'processing') {
                    Swal.update({
                        text: 'Tally Agent is fetching stock items from Tally Prime...'
                    });
                }
            });

            Swal.fire({
                icon: 'success',
                title: 'Import Successful',
                text: response.message || 'Stock items imported from Tally successfully!',
            });

            fetchData();
        } catch (error) {
            console.error('Import Tally error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Import Failed',
                text: error.message || error.response?.data?.error || 'Failed to import stock items from Tally',
            });
        } finally {
            setImporting(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [groupData, categoryData, unitData, warehouseData] = await Promise.all([
                getStockGroups(),
                getStockCategories(),
                getUnits(),
                getWarehouses(),
            ]);
            setGroups(groupData);
            setCategories(categoryData);
            setUnits(unitData);
            setWarehouses(warehouseData);
        } catch (error) {
            console.error('Failed to load form settings:', error);
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Stock Item?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteStockItem(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Stock item deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete stock item';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const filteredItems = items.filter(item =>
        (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.stock_group_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.stock_category_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    return (
        <Fragment>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Stock Items Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Items..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2">
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={handleDownloadTemplate} 
                                        title="Download Template"
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                    >
                                        <i className="fa fa-download me-1"></i> Template
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        className="btn btn-info" 
                                        onClick={() => fileInputRef.current.click()} 
                                        title="Import Excel"
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px', color: 'white' }}
                                    >
                                        <i className="fa fa-upload me-1"></i> Import
                                    </button>
                                    <Button 
                                        variant="outline-info" 
                                        onClick={handleImportTally} 
                                        disabled={importing}
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                    >
                                        {importing ? (
                                            <><i className="fa fa-spinner fa-spin me-2"></i>Importing...</>
                                        ) : (
                                            <><i className="fa fa-download me-2"></i>Import from Tally</>
                                        )}
                                    </Button>
                                    <CreateButton module="stock_item" onClick={() => handleShowModal()}>
                                        Stock Item
                                    </CreateButton>
                                </div>
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
                                                <th style={{ width: '60px' }}><strong>SL NO</strong></th>
                                                <th><strong>IMAGE</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>GROUP</strong></th>
                                                <th><strong>CATEGORY</strong></th>
                                                <th><strong>STOCK</strong></th>
                                                <th><strong>MRP</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="text-center py-4 text-muted">No stock items found</td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <ItemAvatar item={item} />
                                                            </div>
                                                        </td>
                                                        <td><strong>{item.name}</strong></td>
                                                        <td>{item.item_code || '-'}</td>
                                                        <td>{item.stock_group_name || '-'}</td>
                                                        <td>{item.stock_category_name || '-'}</td>
                                                        <td>
                                                            {formatStockQuantity(item)}
                                                        </td>
                                                        <td>{parseFloat(item.mrp || 0).toFixed(2)}</td>
                                                        <td className="text-end">
                                                            {can('inventory', 'edit') || can('inventory', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton module="stock_item" onClick={() => handleShowModal(item)} className="me-1" />
                                                                    <DeleteButton module="stock_item" onClick={() => handleDelete(item.id, item.name)} />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                    
                                    {filteredItems.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
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

            <StockItemFormModal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                itemToEdit={itemToEdit}
                existingItems={items}
                groups={groups}
                categories={categories}
                units={units}
                warehouses={warehouses}
                onSave={handleSave}
                refreshDropdowns={fetchDropdownData}
            />
        </Fragment>
    );
};

export default StockItemList;
