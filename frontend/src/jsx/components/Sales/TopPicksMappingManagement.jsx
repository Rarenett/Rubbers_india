import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import { Modal } from 'react-bootstrap';
import Select from 'react-select';
import { usePermission } from '../../../hooks/usePermission';
import SalesService from '../../../services/SalesService';
import InventoryService from '../../../services/InventoryService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import TopPicksMappingList from './TopPicksMappingList';

const TopPicksMappingManagement = ({ currentUser, embedded }) => {
    const navigate = useNavigate();
    const { can } = usePermission();

    const [managementData, setManagementData] = useState([]);
    const [ledgers, setLedgers]               = useState([]);
    const [stockItems, setStockItems]         = useState([]);
    
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ 
        products: [], 
        customer: ''
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch top picks
            const res = await SalesService.getAllDistributorTopPicks();
            const resData = res.data?.results || res.data;
            setManagementData(Array.isArray(resData) ? resData : []);
            
            // Fetch ledgers for customer dropdown
            const ledgersRes = await SalesService.getLedgers();
            if (ledgersRes.data && ledgersRes.data.results) {
                setLedgers(ledgersRes.data.results);
            } else if (Array.isArray(ledgersRes.data)) {
                setLedgers(ledgersRes.data);
            }

            // Fetch Stock Items for products dropdown
            const stockRes = await SalesService.getStockItems();
            if (stockRes.data && stockRes.data.results) {
                setStockItems(stockRes.data.results);
            } else if (Array.isArray(stockRes.data)) {
                setStockItems(stockRes.data);
            }
        } catch (err) {
            console.error('Error fetching top picks mapping data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = managementData.filter(item => {
        const term = searchTerm.toLowerCase();
        const custName = (item.ledger_name || '').toLowerCase();
        return custName.includes(term);
    });

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            products: (item.products || []).map(p => String(p)),
            customer: String(item.ledger)
        });
        setShowModal(true);
    };

    const handleAdd = () => {
        setIsEditing(false);
        setSelectedId(null);
        setFormData({ products: [], customer: '' });
        setShowModal(true);
    };

    const handleDelete = async (ledgerId) => {
        const confirm = await swal({
            title: "Are you sure?",
            text: "Do you really want to delete this Top Picks mapping?",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        });

        if (confirm) {
            try {
                await SalesService.deleteDistributorTopPicks(ledgerId);
                swal('Success', 'Top picks mapping deleted successfully!', 'success');
                fetchData();
            } catch (err) {
                console.error(err);
                swal('Error', 'Failed to delete top picks mapping.', 'error');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!formData.customer) {
                swal('Warning', 'Please select a customer', 'warning');
                return;
            }

            // Send standard array of product IDs to the update endpoint
            const productIds = formData.products.map(p => Number(p));
            
            await SalesService.updateDistributorTopPicks(formData.customer, productIds);
            
            setShowModal(false);
            setFormData({ products: [], customer: '' });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Top picks mapping ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err?.response?.data;
            let errorMsg = 'Error saving top picks mapping.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index' },
            { header: 'Customer',     dataKey: 'ledger_name' },
            { header: 'Products',     dataKey: 'product_names' },
        ];
        const dataWithIndex = filteredData.map((d, i) => ({ 
            ...d, 
            index: i + 1, 
            product_names: (d.product_names || []).join(', ') 
        }));
        const title = 'Top Picks Mapping';

        if (format === 'pdf')        exportToPDF(dataWithIndex, columns, 'top_picks_mapping.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'top_picks_mapping.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    // React-select options
    const productOptions = stockItems.map(item => ({
        value: String(item.id),
        label: item.name
    }));

    return (
        <div className="container-fluid">
            <div className="page-titles">
                <button
                    onClick={() => window.history.back()}
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                >
                    <i className="la la-arrow-left me-2"></i>
                    Back
                </button>
            </div>
            
            <div className="row">
                <div className="col-12">
                    <TopPicksMappingList
                        data={filteredData}
                        loading={loading}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onAdd={handleAdd}
                    />
                </div>
            </div>

            {/* Form Modal */}
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName="pkg-custom-modal"
                centered 
                size="md"
                backdrop="static"
                keyboard={false}
            >
                <style>{`
                    .pkg-custom-modal .modal-content {
                        border-radius: 16px !important;
                        border: none !important;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                        overflow: hidden;
                    }
                    .pkg-custom-modal .modal-header-custom {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 24px 28px 16px 28px;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .pkg-custom-modal .modal-icon-circle {
                        width: 48px;
                        height: 48px;
                        background-color: #3B5BDB;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 10px rgba(59, 91, 219, 0.2);
                        color: white;
                    }
                    .pkg-custom-modal .modal-close-x {
                        border: none;
                        background: transparent;
                        font-size: 24px;
                        color: #aaa;
                        cursor: pointer;
                        transition: color 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px;
                    }
                    .pkg-custom-modal .modal-close-x:hover {
                        color: #555;
                    }
                    .pkg-custom-modal .modal-body-custom {
                        padding: 24px 28px;
                        max-height: 70vh;
                        overflow-y: auto;
                    }
                    .pkg-custom-modal .modal-footer-custom {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding: 20px 28px 24px 28px;
                        border-top: 1px solid #f1f5f9;
                        background-color: #fafbfc;
                        gap: 12px;
                    }
                    .pkg-custom-modal .form-label-custom {
                        font-size: 13px;
                        font-weight: 500;
                        color: #4a5568;
                        margin-bottom: 6px;
                    }
                    .pkg-custom-modal .btn-close-custom {
                        background-color: #dc3545 !important;
                        color: white !important;
                        border-radius: 8px !important;
                        font-weight: 500 !important;
                        font-size: 14px !important;
                        padding: 10px 24px !important;
                        border: none !important;
                        cursor: pointer;
                        transition: background-color 0.2s, transform 0.1s;
                    }
                    .pkg-custom-modal .btn-close-custom:hover {
                        background-color: #bb2d3b !important;
                    }
                    .pkg-custom-modal .btn-save-custom {
                        background-color: #0a500f !important;
                        color: white !important;
                        border-radius: 8px !important;
                        font-weight: 500 !important;
                        font-size: 14px !important;
                        padding: 10px 24px !important;
                        border: none !important;
                        cursor: pointer;
                        transition: background-color 0.2s, transform 0.1s;
                    }
                    .pkg-custom-modal .btn-save-custom:hover {
                        background-color: #073d0b !important;
                    }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        </div>
                        <div className="d-flex flex-column">
                            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
                                {isEditing ? 'Edit Top Picks' : 'Map Top Picks'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: '400', color: '#64748b', marginTop: '2px' }}>
                                Assign products to a customer's top picks list
                            </span>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="mb-4">
                            <div className="form-label-custom">Customer <span className="text-danger">*</span></div>
                            <Select
                                options={ledgers.map(l => ({ value: l.id, label: l.name }))}
                                className="basic-single"
                                classNamePrefix="select"
                                placeholder="Select Customer..."
                                isDisabled={isEditing}
                                value={ledgers.map(l => ({ value: l.id, label: l.name })).find(opt => String(opt.value) === String(formData.customer)) || null}
                                onChange={(selected) => setFormData({...formData, customer: selected ? selected.value : ''})}
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                styles={{
                                    menuPortal: base => ({ ...base, zIndex: 9999 }),
                                    control: (base) => ({
                                        ...base,
                                        borderColor: '#e2e8f0',
                                        borderRadius: '8px',
                                        padding: '4px',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: '#3B5BDB' }
                                    })
                                }}
                            />
                        </div>
                        <div className="mb-2">
                            <div className="form-label-custom">Top Picks (Products) <span className="text-danger">*</span></div>
                            <Select
                                isMulti
                                options={productOptions}
                                className="basic-multi-select"
                                classNamePrefix="select"
                                placeholder="Select Products..."
                                value={productOptions.filter(opt => formData.products.includes(opt.value))}
                                onChange={(selected) => {
                                    setFormData({
                                        ...formData,
                                        products: selected ? selected.map(s => s.value) : []
                                    });
                                }}
                                menuPosition="fixed"
                                menuPortalTarget={document.body}
                                styles={{
                                    menuPortal: base => ({ ...base, zIndex: 9999 }),
                                    control: (base) => ({
                                        ...base,
                                        borderColor: '#e2e8f0',
                                        borderRadius: '8px',
                                        padding: '4px',
                                        boxShadow: 'none',
                                        '&:hover': { borderColor: '#3B5BDB' }
                                    })
                                }}
                            />
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            Save
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TopPicksMappingManagement;
