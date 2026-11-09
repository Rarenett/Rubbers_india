import React, { useState, useEffect, Fragment } from 'react';
import { Card, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getStockItems } from '../../../services/InventoryService';
import {
    getMachineProductMappings,
    createMachineProductMapping,
    deleteMachineProductMapping
} from '../../../services/MachineManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Select from 'react-select';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import { useFormConfig } from '../../../hooks/useFormConfig';

const MachineProductMappingList = () => {
    const [mappings, setMappings] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    
    const { can } = usePermission();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [currentMapping, setCurrentMapping] = useState({
        machine: null,
        products: []
    });
    const [productToAdd, setProductToAdd] = useState(null);

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setCurrentMapping);
    const { isFieldVisible } = useFormConfig('machine_app_machineproductmapping', 'MachineProductMappingList');

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showModal) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const input = document.querySelector('.sgfm-modal input:not([disabled]):not([readonly])');
                if (input) {
                    input.focus();
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    const [allStockItems, setAllStockItems] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [mappingsData, machineItemsRes, allItemsRes] = await Promise.all([
                getMachineProductMappings(),
                getStockItems({ from_stock_definition: 'true' }),
                getStockItems()
            ]);
            setMappings(mappingsData);
            setStockItems(Array.isArray(machineItemsRes) ? machineItemsRes : []);
            setAllStockItems(Array.isArray(allItemsRes) ? allItemsRes : []);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch data' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = () => {
        setCurrentMapping({
            machine: null,
            products: []
        });
        setProductToAdd(null);
        setShowModal(true);
    };

    const handleAddProduct = (option) => {
        if (!option) return;
        if (currentMapping.products.includes(option.value)) {
            setProductToAdd(null);
            return;
        }

        setCurrentMapping(prev => ({
            ...prev,
            products: [...prev.products, option.value]
        }));
        setProductToAdd(null);
    };

    const handleRemoveProduct = (productId) => {
        setCurrentMapping(prev => ({
            ...prev,
            products: prev.products.filter(id => id !== productId)
        }));
    };

    const handleProductSearchChange = (option) => {
        setProductToAdd(option);
        if (option) {
            handleAddProduct(option);
        }
    };

    const handleSelectKeyDownInternal = (e) => {
        const menuOpen = !!document.querySelector('.react-select__menu');
        if (e.key === 'Enter' && menuOpen) {
            e.stopPropagation();
        }
        handleSelectKeyDown(e);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isFieldVisible('machine') && !currentMapping.machine) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Machine is required' });
            return;
        }

        if (isFieldVisible('product') && (!currentMapping.products || currentMapping.products.length === 0)) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'At least one product is required' });
            return;
        }

        const data = {
            machine: currentMapping.machine,
            products: currentMapping.products
        };

        try {
            await createMachineProductMapping(data);
            Swal.fire({ icon: 'success', title: 'Mapped', text: 'Machine mapped to products successfully', timer: 2000, showConfirmButton: false });
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create machine product mapping' });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteMachineProductMapping(id);
                Swal.fire('Deleted!', 'Mapping has been deleted.', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete mapping.', 'error');
            }
        }
    };

    // Filter and Pagination
    const filteredItems = mappings.filter(map => {
        const machine = (map.machine_details || '').toLowerCase();
        const product = (map.product_details || '').toLowerCase();
        return machine.includes(searchTerm.toLowerCase()) || product.includes(searchTerm.toLowerCase());
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const EXCLUDED_MACHINE_STOCK_GROUPS = ['spare parts', 'vehicle'];
    const stockOptions = stockItems
    .filter(item => !EXCLUDED_MACHINE_STOCK_GROUPS.includes((item.stock_group_name || '').trim().toLowerCase()))
    .map(item => ({
        value: item.id,
        label: item.name
    }));

    const selectedMachine = stockOptions.find(opt => opt.value === currentMapping.machine) || null;
    
    // Helper to check if item is Finished or Semi-Finished
    const isFinishedOrSemiFinished = (item) => {
        if (!item) return false;
        const groupName = (item.stock_group_name || '').trim().toLowerCase();
        const categoryName = (item.stock_category_name || '').trim().toLowerCase();

        const isGroupMatch = groupName.includes('Finished Products') || groupName.includes('Semi Finished Products') || groupName.includes('wip');
        const isCategoryMatch = categoryName.includes('Finished Products') || categoryName.includes('Semi Finished Products') || categoryName.includes('wip');
        const isBOMMatch = item.has_bom === true;

        return isGroupMatch || isCategoryMatch || isBOMMatch;
    };
    
    // Product options: All stock items EXCEPT machines, filtered to only Finished and Semi-Finished items
    const productOptions = allStockItems
        .filter(item => !stockItems.some(m => m.id === item.id) && isFinishedOrSemiFinished(item))
        .map(item => ({
            value: item.id,
            label: item.name
        }));
    
    // For Multi-Select Products
    const selectedProducts = productOptions.filter(opt => currentMapping.products.includes(opt.value));

    useEffect(() => {
        if (!currentMapping.machine) return;

        if (currentMapping.products.includes(currentMapping.machine)) {
            setCurrentMapping(prev => ({
                ...prev,
                products: prev.products.filter(id => id !== prev.machine)
            }));
        }

        if (productToAdd && productToAdd.value === currentMapping.machine) {
            setProductToAdd(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMapping.machine]);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            border: state.isFocused ? '1px solid #2ece8a' : '1px solid #cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            borderRadius: '10px',
            minHeight: '44px',
            fontSize: '14px',
            backgroundColor: '#fff',
            '&:hover': {
                borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1'
            }
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: 'rgba(46, 206, 138, 0.1)',
            borderRadius: '6px',
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: '#2ece8a',
            fontWeight: 500
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: '#2ece8a',
            ':hover': {
                backgroundColor: 'rgba(46, 206, 138, 0.2)',
                color: '#1b9b65',
            },
        }),
    };

    return (
        <Fragment>
            <style>{`
                .sgfm-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .sgfm-modal .modal-header-custom {
                    background-color: #fff;
                    padding: 24px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .sgfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .sgfm-modal .modal-close-x {
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
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .sgfm-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .sgfm-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sgfm-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .sgfm-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .sgfm-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .sgfm-modal .add-select-row {
                    gap: 12px;
                }
                .sgfm-modal .add-select-row .react-select__control {
                    min-width: 0;
                    width: 100%;
                    min-height: 44px;
                }
                .sgfm-modal .list-selection-table table {
                    width: 100%;
                    border-collapse: collapse;
                    background-color: #ffffff;
                    border-radius: 14px;
                    overflow: hidden;
                }
                .sgfm-modal .list-selection-table th,
                .sgfm-modal .list-selection-table td {
                    padding: 12px 14px;
                    border-top: 1px solid #f1f5f9;
                    vertical-align: middle;
                }
                .sgfm-modal .list-selection-table thead th {
                    font-size: 12px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-top: none;
                    background-color: #f8fafc;
                }
                .sgfm-modal .list-selection-table tbody tr:hover {
                    background-color: #f8fafc;
                }
                .sgfm-modal .list-selection-table .btn-danger {
                    min-width: 34px;
                    min-height: 34px;
                    border-radius: 10px;
                    padding: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                @keyframes modalFeedback {
                    0%, 100% { transform: scale(1); }
                    20%, 60% { transform: scale(0.99) translateX(-4px); }
                    40%, 80% { transform: scale(1.01) translateX(4px); }
                }
                .modal-feedback {
                    animation: modalFeedback 0.25s ease-in-out !important;
                }
            `}</style>

            {/* <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Machine Product Mappings</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Mappings..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton
                                    module="machineproductmappings"
                                    onClick={() => handleShowModal()}
                                >
                                    Machine Mapping
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
                                                <th><strong>MACHINE</strong></th>
                                                <th><strong>PRODUCT</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((item, idx) => {
                                                    const isFirstOfMachine = idx === 0 || currentItems[idx - 1].machine !== item.machine;
                                                    let rowSpan = 1;
                                                    if (isFirstOfMachine) {
                                                        for (let i = idx + 1; i < currentItems.length; i++) {
                                                            if (currentItems[i].machine === item.machine) {
                                                                rowSpan++;
                                                            } else {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    return (
                                                        <tr key={item.id}>
                                                            {isFirstOfMachine && (
                                                                <td rowSpan={rowSpan} style={{ verticalAlign: 'middle' }}>
                                                                    <strong>{item.machine_details}</strong>
                                                                </td>
                                                            )}
                                                            <td style={{ verticalAlign: 'middle' }}>{item.product_details}</td>
                                                            <td className="text-end" style={{ verticalAlign: 'middle' }}>
                                                                {can('machineproductmappings', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-2">
                                                                        <DeleteButton
                                                                            module="machineproductmappings"
                                                                            onClick={() => handleDelete(item.id)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="text-center py-4 text-muted">No machine product mappings found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filteredItems.length > 0 && (
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
                            
                        </Card.Body>
                    </Card>
                    </div>
                </div>
            </div>

            {/* Form Modal */}
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                dialogClassName={`sgfm-modal modal-md ${animateTrigger ? 'modal-feedback' : ''}`}
                backdrop="static"
                keyboard={false}
                centered
            >
                <div className="modal-header-custom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Create Machine Mapping
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Select a machine and its products
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            {isFieldVisible('machine') && (
                                <div className="col-12 mb-4">
                                    <Form.Label className="form-label-custom">Machine <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        autoFocus
                                        defaultMenuIsOpen={true}
                                        openMenuOnFocus={true}
                                        options={stockOptions}
                                        value={selectedMachine}
                                        onChange={makeSelectChange('machine')}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Machine"
                                        styles={selectStyles}
                                    />
                                </div>
                            )}
                            {isFieldVisible('product') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Products <span className="text-danger">*</span></Form.Label>
                                <div className="d-flex flex-column gap-2 mb-3 add-select-row">
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        openMenuOnFocus={true}
                                        options={productOptions}
                                        value={productToAdd}
                                        onChange={handleProductSearchChange}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDownInternal}
                                        placeholder="Search product and press Enter"
                                        styles={selectStyles}
                                    />
                                    <small className="text-muted">Use arrow keys to choose an item, then press Enter to add.</small>
                                </div>
                                <div className="table-responsive list-selection-table">
                                    <table className="table table-borderless mb-0">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '50px' }}>#</th>
                                                <th>PRODUCT NAME</th>
                                                <th className="text-end">ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedProducts.length > 0 ? (
                                                selectedProducts.map((product, index) => (
                                                    <tr key={product.value}>
                                                        <td>{index + 1}</td>
                                                        <td>{product.label}</td>
                                                        <td className="text-end">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => handleRemoveProduct(product.value)}
                                                            >
                                                                <i className="fa fa-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="text-muted">No products selected</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Close
                        </button>
                        <button type="submit" className="btn-save-custom">
                            Create
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default MachineProductMappingList;