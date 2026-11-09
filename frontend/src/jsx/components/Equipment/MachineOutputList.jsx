import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getStockItems, getUnits } from '../../../services/InventoryService';
import {
    getMachineOutputs,
    createMachineOutput,
    updateMachineOutput,
    deleteMachineOutput,
    getMachineProductMappings
} from '../../../services/MachineManagementService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import Select from 'react-select';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import { useFormConfig } from '../../../hooks/useFormConfig';

const MachineOutputList = () => {
    const [outputs, setOutputs] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    
    const { can } = usePermission();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [currentOutput, setCurrentOutput] = useState({
        machine: null,
        product: null,
        productunit: null,
        output: '',
        outputunit: 'Per Hour'
    });
    const [editMode, setEditMode] = useState(false);

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown } = useEnterTraversal('.sgfm-modal', setCurrentOutput);
    const { isFieldVisible } = useFormConfig('machine_app_machineoutput', 'MachineOutputList');

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

    const fetchData = async () => {
        try {
            setLoading(true);
            const [outputsData, itemsRes, mappingsData, unitsData] = await Promise.all([
                getMachineOutputs(),
                getStockItems(),
                getMachineProductMappings(),
                getUnits()
            ]);
            setOutputs(outputsData);
            setStockItems(Array.isArray(itemsRes) ? itemsRes : []);
            setMappings(Array.isArray(mappingsData) ? mappingsData : []);
            setUnits(Array.isArray(unitsData) ? unitsData : []);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch data' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            setEditMode(true);
            const mappingObj = mappings.find(m => m.id === item.machine);
            setCurrentOutput({
                id: item.id,
                machine: mappingObj ? mappingObj.machine : null,
                product: mappingObj ? mappingObj.product : null,
                productunit: item.productunit,
                output: item.output,
                outputunit: item.outputunit
            });
        } else {
            setEditMode(false);
            const perHourUnit = units.find(u => u.name === 'Per Hour');
            setCurrentOutput({
                id: null,
                machine: null,
                product: null,
                productunit: null,
                output: '',
                outputunit: perHourUnit ? perHourUnit.id : null
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isFieldVisible('machine') && !currentOutput.machine) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Machine is required' });
            return;
        }

        if (isFieldVisible('product') && !currentOutput.product) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Product is required' });
            return;
        }

        if (isFieldVisible('output') && (!currentOutput.output || Number(currentOutput.output) <= 0)) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Output must be a positive number' });
            return;
        }

        if (isFieldVisible('outputunit') && !currentOutput.outputunit) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Output unit is required' });
            return;
        }

        const matchedMapping = mappings.find(
            m => m.machine === currentOutput.machine && m.product === currentOutput.product
        );

        if (!matchedMapping) {
            Swal.fire({ icon: 'warning', title: 'Error', text: 'Selected machine and product mapping not found' });
            return;
        }

        const data = {
            machine: matchedMapping.id,
            product: matchedMapping.id,
            productunit: currentOutput.productunit,
            output: parseInt(currentOutput.output, 10),
            outputunit: currentOutput.outputunit
        };

        try {
            if (editMode && currentOutput.id) {
                await updateMachineOutput(currentOutput.id, data);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Machine output updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createMachineOutput(data);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Machine output created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: editMode ? 'Failed to update machine output' : 'Failed to create machine output' });
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
                await deleteMachineOutput(id);
                Swal.fire('Deleted!', 'Machine output has been deleted.', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error!', 'Failed to delete machine output.', 'error');
            }
        }
    };

    // Filter and Pagination
    const filteredItems = outputs.filter(item => {
        const machine = (item.machine_details || '').toLowerCase();
        const product = (item.product_details || '').toLowerCase();
        return machine.includes(searchTerm.toLowerCase()) || product.includes(searchTerm.toLowerCase());
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const focusNextField = () => {
        setTimeout(() => {
            const active = document.activeElement;
            const control = active ? active.closest('.react-select__control') : null;
            if (control) {
                const modal = control.closest('.modal-content') || document.querySelector('.sgfm-modal');
                if (!modal) return;
                const all = Array.from(
                    modal.querySelectorAll(
                        'input:not([disabled]):not([readonly]), select, button[type="submit"]:not([disabled]), .react-select__control'
                    )
                ).filter(el => el.offsetParent !== null);
                
                const index = all.indexOf(control);
                if (index > -1 && index < all.length - 1) {
                    const next = all[index + 1];
                    if (next.classList.contains('react-select__control')) {
                        next.querySelector('input')?.focus();
                    } else {
                        next.focus();
                    }
                }
            }
        }, 50);
    };

    // Options for machine selection
    const machineOptions = stockItems
        .filter(item => mappings.some(m => m.machine === item.id))
        .map(item => ({
            value: item.id,
            label: item.name
        }));

    // Filter products based on selected machine
    const productOptions = currentOutput.machine 
        ? mappings
            .filter(m => m.machine === currentOutput.machine)
            .map(m => ({
                value: m.product,
                label: m.product_details
            }))
        : [];

    const unitOptions = [...units]
        .sort((a, b) => {
            if (a.name === 'Per Hour') return -1;
            if (b.name === 'Per Hour') return 1;
            return a.name.localeCompare(b.name);
        })
        .map(u => ({
            value: u.id,
            label: u.name
        }));

    const selectedMachine = machineOptions.find(opt => opt.value === currentOutput.machine) || null;
    const selectedProduct = productOptions.find(opt => opt.value === currentOutput.product) || null;

    // Retrieve product unit name and ID when product changes
    const selectedProductObj = currentOutput.product 
        ? stockItems.find(item => Number(item.id) === Number(currentOutput.product))
        : null;

    const productUnitName = selectedProductObj ? selectedProductObj.base_unit_name : '';

    const handleMachineChange = (opt) => {
        setCurrentOutput(prev => ({
            ...prev,
            machine: opt ? opt.value : null,
            product: null,
            productunit: null
        }));
        focusNextField();
    };

    const handleProductChange = (opt) => {
        if (opt) {
            const prodObj = stockItems.find(item => Number(item.id) === Number(opt.value));
            setCurrentOutput(prev => ({
                ...prev,
                product: opt.value,
                productunit: prodObj ? prodObj.id : null
            }));
            focusNextField();
        } else {
            setCurrentOutput(prev => ({
                ...prev,
                product: null,
                productunit: null
            }));
        }
    };

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
        menuPortal: base => ({ ...base, zIndex: 9999 })
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
                            <Card.Title className="mb-0">Machine Outputs</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search outputs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton
                                    module="machineoutputs"
                                    onClick={handleShowModal}
                                >
                                    Machine Output
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
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>MACHINE</strong></th>
                                                <th><strong>PRODUCT</strong></th>
                                                <th><strong>PRODUCT UNIT</strong></th>
                                                <th><strong>OUTPUT</strong></th>
                                                <th><strong>UNIT</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? (
                                                currentItems.map((item, idx) => (
                                                    <tr key={item.id}>
                                                        <td>{indexOfFirstItem + idx + 1}</td>
                                                        <td><strong>{item.machine_details}</strong></td>
                                                        <td>{item.product_details}</td>
                                                        <td><span className="badge badge-info light">{item.productunit_details}</span></td>
                                                        <td><strong>{item.output}</strong></td>
                                                        <td>{item.outputunit_details}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                {can('machineoutputs', 'update') && (
                                                                    <EditButton
                                                                        module="machineoutputs"
                                                                        onClick={() => handleShowModal(item)}
                                                                    />
                                                                )}
                                                                {can('machineoutputs', 'delete') && (
                                                                    <DeleteButton
                                                                        module="machineoutputs"
                                                                        onClick={() => handleDelete(item.id)}
                                                                    />
                                                                )}
                                                                {!can('machineoutputs', 'update') && !can('machineoutputs', 'delete') && (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">No machine outputs found</td>
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
                                {editMode ? 'Edit Machine Output' : 'Add Machine Output'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {editMode ? 'Modify machine production output details' : 'Record machine production output details'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        <div className="row">
                            {isFieldVisible('machine') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Machine <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        autoFocus
                                        defaultMenuIsOpen={true}
                                        openMenuOnFocus={true}
                                        options={machineOptions}
                                        value={selectedMachine}
                                        onChange={handleMachineChange}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Machine"
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                            )}
                            {isFieldVisible('product') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Product <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        openMenuOnFocus={true}
                                        options={productOptions}
                                        value={selectedProduct}
                                        onChange={handleProductChange}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder={currentOutput.machine ? "Select Product" : "Please select machine first"}
                                        disabled={!currentOutput.machine}
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                            )}
                            {isFieldVisible('productunit') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Product Unit</Form.Label>
                                    <Form.Control
                                        type="text"
                                        readOnly
                                        disabled
                                        placeholder="Product unit will appear automatically"
                                        value={productUnitName}
                                        style={{
                                            height: '44px',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            backgroundColor: '#f1f5f9',
                                            border: '1px solid #cbd5e1'
                                        }}
                                    />
                                </div>
                            )}
                            {isFieldVisible('output') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Output <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="number"
                                        placeholder="Enter output quantity"
                                        value={currentOutput.output}
                                        onChange={(e) => setCurrentOutput(prev => ({ ...prev, output: e.target.value }))}
                                        style={{
                                            height: '44px',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            border: '1px solid #cbd5e1'
                                        }}
                                    />
                                </div>
                            )}
                            {isFieldVisible('outputunit') && (
                                <div className="col-12 mb-3">
                                    <Form.Label className="form-label-custom">Unit <span className="text-danger">*</span></Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        isClearable
                                        openMenuOnFocus={true}
                                        options={unitOptions}
                                        value={unitOptions.find(opt => Number(opt.value) === Number(currentOutput.outputunit)) || null}
                                        onChange={(opt) => {
                                            setCurrentOutput(prev => ({
                                                ...prev,
                                                outputunit: opt ? opt.value : ''
                                            }));
                                            focusNextField();
                                        }}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        placeholder="Select Unit"
                                        styles={selectStyles}
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            {editMode ? 'Save' : 'Submit'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default MachineOutputList;