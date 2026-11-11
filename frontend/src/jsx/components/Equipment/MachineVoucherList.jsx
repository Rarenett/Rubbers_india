import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Form, Modal, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import {
    getMachineDataCollections,
    createMachineDataCollection,
    updateMachineDataCollection,
    deleteMachineDataCollection
} from '../../../services/MachineManagementService';
import { getStockItems } from '../../../services/InventoryService';
import { getDepartments } from '../../../services/HRManagementService';
import { getLedgers } from '../../../services/FinanceService';
import axiosInstance from '../../../services/AxiosInstance';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import { useFormConfig } from '../../../hooks/useFormConfig';

const MACHINE_API_BASE = '/api/machine';

const MachineVoucherList = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();
    const { isFieldVisible: isGlobalFieldVisible } = useFormConfig('machine_app_machinedatacollection', 'MachineVoucherList');

    // Form dependencies
    const [stockItems, setStockItems] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [processes, setProcesses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [machineConfig, setMachineConfig] = useState({});
    const [formData, setFormData] = useState({
        id: null,
        code: '',
        machine_name: '',
        department: '',
        process: '',
        supplier: '',
        purchase_date: '',
        hp: '',
        steam: '',
        pressure: '',
        chilled_water: '',
        no_of_operators: '',
        no_of_helpers: '',
        service_contact: '',
        last_maintenance_date: '',
        next_maintenance_date: '',
        service_frequency_days: '',
        service_frequency_hours: '',
        machine_status: true
    });

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown, makeSelectChange } = useEnterTraversal('.sgfm-modal', setFormData);

    useEffect(() => {
        const fetchConfig = async () => {
            if (formData.machine_name) {
                try {
                    const response = await axiosInstance.get(`${MACHINE_API_BASE}/machine-data-configuration/?stock_item_id=${formData.machine_name}`);
                    setMachineConfig(response.data?.settings || {});
                } catch (err) {
                    console.error("Error fetching machine config:", err);
                    setMachineConfig({});
                }
            } else {
                setMachineConfig({});
            }
        };
        fetchConfig();
    }, [formData.machine_name]);

    const isVisible = (field) => {
        if (!isGlobalFieldVisible(field)) return false;
        
        if (!machineConfig || Object.keys(machineConfig).length === 0) return true;
        if (machineConfig[field] && machineConfig[field].show === false) return false;
        return true;
    };

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);
    
    useEffect(() => { 
        fetchData(); 
        fetchDependencies();
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

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getMachineDataCollections();
            setCollections(data);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch Machine Data' });
        } finally {
            setLoading(false);
        }
    };

    const fetchDependencies = async () => {
        try {
            const [itemsData, deptsData, suppliersData, processRes] = await Promise.all([
                getStockItems({ from_stock_definition: 'true' }),
                getDepartments(),
                getLedgers({ group_name: 'Sundry Creditors' }),
                axiosInstance.get(`${MACHINE_API_BASE}/processname/`)
            ]);
            const EXCLUDED_STOCK_GROUPS = ['spare parts'];
            const filteredItems = itemsData.filter(
                item => !EXCLUDED_STOCK_GROUPS.includes((item.stock_group_name || '').trim().toLowerCase())
            );
            setStockItems(filteredItems.map(item => ({ value: item.id, label: item.name })));
            setDepartments(deptsData.map(d => ({ value: d.id, label: d.name })));
            const procData = processRes.data.results || processRes.data;
            setProcesses(procData.map(p => ({ value: p.id, label: p.processname })));
            setSuppliers(suppliersData.map(s => ({ value: s.id, label: s.name })));
        } catch (error) {
            console.error("Error fetching dependencies:", error);
        }
    };

    const handleShowModal = (obj = null) => {
        if (obj) {
            setFormData({ ...obj });
            setEditMode(true);
        } else {
            setFormData({
                id: null, code: '', machine_name: '', department: '', process: '',
                supplier: '', purchase_date: '', hp: '', steam: '', pressure: '',
                chilled_water: '', no_of_operators: '', no_of_helpers: '', service_contact: '',
                last_maintenance_date: '', next_maintenance_date: '', service_frequency_days: '',
                service_frequency_hours: '', machine_status: true
            });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation for required fields only if they are visible
        if (isVisible('machine_name') && !formData.machine_name) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Machine Name is required' });
            return;
        }

        try {
            if (editMode && formData.id) {
                await updateMachineDataCollection(formData.id, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Voucher updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createMachineDataCollection(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Voucher created successfully', timer: 2000, showConfirmButton: false });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to save Machine Data';
            if (error.response?.data) {
                const keys = Object.keys(error.response.data);
                if (keys.length > 0) {
                    errorMsg = `${keys[0].toUpperCase()}: ${error.response.data[keys[0]][0]}`;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handleDelete = async (id, code) => {
        const result = await Swal.fire({
            title: 'Delete Voucher?',
            text: `Are you sure you want to delete Voucher Code "${code}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });
        if (result.isConfirmed) {
            try {
                await deleteMachineDataCollection(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Voucher deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete voucher' });
            }
        }
    };

    const filtered = collections.filter(item =>
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.machine_name_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.department_details || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const selectStyles = { control: (base) => ({ ...base, borderRadius: '10px', minHeight: '40px' }) };

    return (
        <Fragment>
            <style>{`
                .sgfm-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .sgfm-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                .sgfm-modal .modal-icon-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background-color: var(--form-icon-color, #0a500f); box-shadow: 0 4px 10px rgba(10, 80, 15,0.2); }
                .sgfm-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                .sgfm-modal .modal-close-x:hover { color: #555; }
                .sgfm-modal .modal-body-custom { padding: 24px 28px; }
                .sgfm-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                .sgfm-modal .form-label-custom { font-size: 14px; font-weight: 500; color: #4a5568; margin-bottom: 8px; }
                .sgfm-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                .sgfm-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15,0.15); }
                .sgfm-modal .form-control-custom::placeholder { color: #94a3b8; }
                .sgfm-modal .btn-close-custom { background-color: var(--cancel-btn-color, #dc3545) !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .sgfm-modal .btn-save-custom { background-color: var(--save-btn-color, #0a500f) !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                .sgfm-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                @keyframes modalFeedback { 0%, 100% { transform: scale(1); } 20%, 60% { transform: scale(0.99) translateX(-4px); } 40%, 80% { transform: scale(1.01) translateX(4px); } }
                .modal-feedback { animation: modalFeedback 0.25s ease-in-out !important; }
            `}</style>

            {/* <div className="page-titles">
                <button onClick={() => window.history.back()} className="btn btn-outline-primary btn-sm d-flex align-items-center" style={{ gap: '6px', borderRadius: '6px' }}>
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}

            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Machine Vouchers List</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by Code/Name/Dept..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '40px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                
                                <CreateButton module="machine-voucher" onClick={() => handleShowModal()}>
                                    Machine Voucher
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>CODE</strong></th>
                                                <th><strong>MACHINE NAME</strong></th>
                                                <th><strong>DEPARTMENT</strong></th>
                                                <th><strong>PROCESS</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentItems.length > 0 ? currentItems.map((item, idx) => (
                                                <tr key={item.id}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td><strong>{item.code}</strong></td>
                                                    <td>{item.machine_name_details || '—'}</td>
                                                    <td>{item.department_details || '—'}</td>
                                                    <td>{item.process_details || '—'}</td>
                                                    <td>
                                                        <span className={`badge ${item.machine_status ? 'badge-success light' : 'badge-danger light'}`}>
                                                            {item.machine_status ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        {can('spareparts', 'edit') || can('spareparts', 'delete') ? (
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton module="machine-voucher" onClick={() => handleShowModal(item)} className="me-1" />
                                                                <DeleteButton module="machine-voucher" onClick={() => handleDelete(item.id, item.code)} />
                                                            </div>
                                                        ) : (
                                                            <span className="badge badge-danger light mt-1">No Access</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="7" className="text-center py-4 text-muted">No vouchers found</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!loading && filtered.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
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

            {/* VOUCHER MODAL */}
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)} 
                centered 
                dialogClassName={`sgfm-modal ${animateTrigger ? 'modal-feedback' : ''}`}
                size="xl"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-cogs" style={{ color: 'white', fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="mb-0" style={{ fontWeight: '600', color: '#1e293b' }}>
                                {editMode ? 'Edit Machine Voucher' : 'Create Machine Voucher'}
                            </h4>
                            <p className="mb-0 text-muted" style={{ fontSize: '13px' }}>
                                {editMode ? 'Update voucher details' : 'Enter details to manage machine vouchers'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowModal(false)} className="modal-close-x">
                        &times;
                    </button>
                </div>
                
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="modal-body-custom">
                        {/* Row 1: Core Details */}
                        <Row className="mb-3">
                            {isVisible('machine_name') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Machine Name <span className="text-danger">*</span></Form.Label>
                                    <Select classNamePrefix="react-select" autoFocus defaultMenuIsOpen={true} openMenuOnFocus={true} options={stockItems} styles={selectStyles} value={stockItems.find(o => o.value === formData.machine_name) || null} onChange={makeSelectChange('machine_name')} onFocus={handleSelectFocus} onKeyDown={handleSelectKeyDown} placeholder="Select..." isClearable />
                                </Col>
                            )}
                            
                            {isVisible('code') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Machine Code <span className="text-danger">*</span></Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="code" value={formData.code} onChange={handleChange} placeholder="Code" required />
                                </Col>
                            )}
                            
                            {isVisible('purchase_date') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Purchase Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control className="form-control-custom" type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} required />
                                </Col>
                            )}
                        </Row>

                        {/* Row 2: Classification */}
                        <Row className="mb-3">
                            {isVisible('department') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Department <span className="text-danger">*</span></Form.Label>
                                    <Select classNamePrefix="react-select" options={departments} styles={selectStyles} value={departments.find(o => o.value === formData.department) || null} onChange={makeSelectChange('department')} onFocus={handleSelectFocus} onKeyDown={handleSelectKeyDown} placeholder="Select..." isClearable />
                                </Col>
                            )}
                            {isVisible('process') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Process <span className="text-danger">*</span></Form.Label>
                                    <Select classNamePrefix="react-select" options={processes} styles={selectStyles} value={processes.find(o => o.value === formData.process) || null} onChange={makeSelectChange('process')} onFocus={handleSelectFocus} onKeyDown={handleSelectKeyDown} placeholder="Select..." isClearable />
                                </Col>
                            )}
                            {isVisible('supplier') && (
                                <Col md="4">
                                    <Form.Label className="form-label-custom">Supplier Name <span className="text-danger">*</span></Form.Label>
                                    <Select classNamePrefix="react-select" options={suppliers} styles={selectStyles} value={suppliers.find(o => o.value === formData.supplier) || null} onChange={makeSelectChange('supplier')} onFocus={handleSelectFocus} onKeyDown={handleSelectKeyDown} placeholder="Select..." isClearable />
                                </Col>
                            )}
                        </Row>

                        {/* Row 3: Technical Specs */}
                        <Row className="mb-3">
                            {isVisible('hp') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">HP</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="hp" value={formData.hp} onChange={handleChange} placeholder="HP" />
                                </Col>
                            )}
                            {isVisible('steam') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">Steam</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="steam" value={formData.steam} onChange={handleChange} placeholder="Steam" />
                                </Col>
                            )}
                            {isVisible('pressure') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">Pressure</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="pressure" value={formData.pressure} onChange={handleChange} placeholder="Pressure" />
                                </Col>
                            )}
                            {isVisible('chilled_water') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">Chilled Water</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="chilled_water" value={formData.chilled_water} onChange={handleChange} placeholder="Water" />
                                </Col>
                            )}
                            {isVisible('no_of_operators') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">No of Operators</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="no_of_operators" value={formData.no_of_operators} onChange={handleChange} placeholder="Operators" />
                                </Col>
                            )}
                            {isVisible('no_of_helpers') && (
                                <Col md="2">
                                    <Form.Label className="form-label-custom">No of Helpers</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" name="no_of_helpers" value={formData.no_of_helpers} onChange={handleChange} placeholder="Helpers" />
                                </Col>
                            )}
                        </Row>

                        {/* Row 4: Maintenance Schedule */}
                        <Row className="mb-3">
                            {isVisible('last_maintenance_date') && (
                                <Col md="3">
                                    <Form.Label className="form-label-custom">Last Maintenance</Form.Label>
                                    <Form.Control className="form-control-custom" type="date" name="last_maintenance_date" value={formData.last_maintenance_date} onChange={handleChange} />
                                </Col>
                            )}
                            {isVisible('next_maintenance_date') && (
                                <Col md="3">
                                    <Form.Label className="form-label-custom">Next Maintenance</Form.Label>
                                    <Form.Control className="form-control-custom" type="date" name="next_maintenance_date" value={formData.next_maintenance_date} onChange={handleChange} />
                                </Col>
                            )}
                            {isVisible('service_frequency_days') && (
                                <Col md="3">
                                    <Form.Label className="form-label-custom">Freq (Days)</Form.Label>
                                    <Form.Control className="form-control-custom" type="number" name="service_frequency_days" value={formData.service_frequency_days} onChange={handleChange} placeholder="Days" />
                                </Col>
                            )}
                            {isVisible('service_frequency_hours') && (
                                <Col md="3">
                                    <Form.Label className="form-label-custom">Freq (Hours)</Form.Label>
                                    <Form.Control className="form-control-custom" type="number" name="service_frequency_hours" value={formData.service_frequency_hours} onChange={handleChange} placeholder="Hours" />
                                </Col>
                            )}
                        </Row>

                        {/* Row 5: Service Contact & Status */}
                        <Row>
                            {isVisible('service_contact') && (
                                <Col md="3">
                                    <Form.Label className="form-label-custom">Service Contact</Form.Label>
                                    <Form.Control className="form-control-custom" type="text" maxLength={50} name="service_contact" value={formData.service_contact} onChange={handleChange} placeholder="Contact Number" />
                                </Col>
                            )}
                            {isVisible('machine_status') && (
                                <Col md="3" className="d-flex align-items-center mt-3">
                                    <div className="custom-control custom-checkbox ml-2">
                                        <input type="checkbox" className="custom-control-input" id="machineStatusCheck" name="machine_status" checked={formData.machine_status} onChange={handleChange} />
                                        <label className="custom-control-label" htmlFor="machineStatusCheck" style={{ fontSize: '14px', fontWeight: '500', color: '#4a5568', marginLeft: '6px' }}>Active Machine</label>
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            
                            {editMode ? 'Update' : 'Save'}
                        </button>
                    </div>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default MachineVoucherList;