import React, { useState, useEffect } from 'react';
import swal from 'sweetalert';
import LogisticsService from '../../../services/LogisticsService';
import { Card, Form, Row, Col, Modal } from 'react-bootstrap';
import PageTitle from '../../layouts/PageTitle';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import { usePageTitle } from '../../../context/TitleContext';
import { formatDate } from '../../../utils/dateUtils';


const FinesAndTokensScreen = () => {
    usePageTitle("Fines & Tokens");
    // ── State ──────────────────────────────────────────────────────────────
    const [fines, setFines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    
    // Form State
    const [formData, setFormData] = useState({
        fine_no: 'FIN-1001', // Mock auto-generated number
        fine_date: new Date().toISOString().split('T')[0],
        vehicle_id: '',
        driver_id: '',
        amount: '',
        narration: '',
        attachment: null
    });

    // ── Fetch Master Data (Dropdowns) ──────────────────────────────────────
    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [vehRes, drvRes] = await Promise.all([
                    LogisticsService.getVehicles(),
                    LogisticsService.getDrivers()
                ]);
                setVehicles(Array.isArray(vehRes.data) ? vehRes.data : []);
                setDrivers(Array.isArray(drvRes.data) ? drvRes.data : []);
            } catch (err) {
                console.error("Error fetching vehicles/drivers:", err);
            }
        };
        fetchMasterData();
    }, []);

    // ── Fetch Fines ────────────────────────────────────────────────────────
    const fetchFines = async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getFines();
            setFines(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching fines:", err);
            swal("Error", "Could not fetch fines.", "error");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchFines();
    }, []);

    // ── Keyboard Navigation (Escape to close, Enter to next field) ────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showModal) {
                setShowModal(false);
                setEditingId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            // Allow default Enter behavior for buttons
            if (target.tagName.toLowerCase() === 'button') {
                return;
            }
            
            // Allow Shift+Enter to create a new line in textareas
            if (target.tagName.toLowerCase() === 'textarea' && e.shiftKey) {
                return;
            }
            
            e.preventDefault(); // Prevent accidental form submission
            
            const form = target.closest('form');
            if (!form) return;
            
            // Find all focusable elements in the form
            const focusableElements = Array.from(form.querySelectorAll('input:not([readOnly]), select, textarea, button[type="submit"]'));
            const index = focusableElements.indexOf(target);
            
            if (index > -1 && index < focusableElements.length - 1) {
                const nextEl = focusableElements[index + 1];
                nextEl.focus();
                
                // If the next element is a select dropdown, open it
                if (nextEl.tagName.toLowerCase() === 'select') {
                    // Slight delay to ensure focus is fully settled before opening
                    setTimeout(() => {
                        if (typeof nextEl.showPicker === 'function') {
                            try { nextEl.showPicker(); } catch (e) {}
                        }
                    }, 50);
                }
                
                // If the next element is a file input, open the file picker
                if (nextEl.tagName.toLowerCase() === 'input' && nextEl.type === 'file') {
                    setTimeout(() => {
                        nextEl.click();
                    }, 50);
                }
            }
        }
    };

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleAddClick = () => {
        setEditingId(null);
        setFormData({
            ...formData,
            fine_no: '',
            fine_date: new Date().toISOString().split('T')[0],
            vehicle: '',
            driver: '',
            amount: '',
            narration: '',
            attachment: null
        });
        setShowModal(true);
    };

    const handleEdit = (fine) => {
        setEditingId(fine.id);
        
        // Try to match dropdowns if they exist, else default to empty
        

        setFormData({
            fine_no: fine.fine_no,
            fine_date: fine.fine_date,
            vehicle: fine.vehicle || '',
            driver: fine.driver || '',
            amount: fine.amount,
            narration: fine.narration || '',
            attachment: null
        });
        setShowModal(true);
    };

    const handleFileChange = (e) => {
        setFormData({ ...formData, attachment: e.target.files[0] });
        
        // Move focus to the Save Fine button after file selection
        const form = e.target.closest('form');
        if (form) {
            const saveButton = form.querySelector('button[type="submit"]');
            if (saveButton) {
                setTimeout(() => saveButton.focus(), 50);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validation
        if (!formData.vehicle || !formData.driver || !formData.amount) {
            swal('Missing Fields', 'Please fill all required fields.', 'warning');
            return;
        }
        
        const data = new FormData();
        if (formData.fine_no) data.append('fine_no', formData.fine_no);
        data.append('fine_date', formData.fine_date);
        data.append('vehicle', formData.vehicle);
        data.append('driver', formData.driver);
        data.append('amount', formData.amount);
        data.append('narration', formData.narration);
        if (formData.attachment) {
            data.append('attachment', formData.attachment);
        }

        try {
            if (editingId) {
                await LogisticsService.updateFine(editingId, data);
                swal('Success', 'Fine/Token record updated successfully.', 'success');
            } else {
                await LogisticsService.createFine(data);
                swal('Success', 'Fine/Token record saved successfully.', 'success');
            }
            fetchFines();
            setShowModal(false);
        } catch (err) {
            console.error("Error saving fine:", err);
            swal('Error', 'Could not save record.', 'error');
        }
    };

    const handleDelete = (id) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this record!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    await LogisticsService.deleteFine(id);
                    swal("Deleted!", "Record has been deleted.", "success");
                    fetchFines();
                } catch (err) {
                    swal("Error", "Could not delete record.", "error");
                }
            }
        });
    };

    const handleMarkAsPaid = async (fineId, vehicleId, driverId, amount, fineDate) => {
        swal({
            title: "Mark as Paid?",
            text: "Are you sure you want to mark this fine as paid?",
            icon: "info",
            buttons: ["Cancel", "Yes, Mark Paid"],
            dangerMode: false,
        }).then(async (willMark) => {
            if (willMark) {
                try {
                    const data = new FormData();
                    data.append('status', 'Paid');
                    data.append('vehicle', vehicleId);
                    data.append('driver', driverId);
                    data.append('amount', amount);
                    data.append('fine_date', fineDate);
                    
                    await LogisticsService.updateFine(fineId, data);
                    swal("Success!", "Fine has been marked as paid.", "success");
                    fetchFines();
                } catch (err) {
                    console.error("Error marking as paid:", err);
                    swal("Error", "Could not update record.", "error");
                }
            }
        });
    };

    // Filter List
    const filteredFines = fines.filter(f => {
        const search = searchTerm.toLowerCase();
        return (
            (f.fine_no || '').toLowerCase().includes(search) ||
            (f.fine_date || '').toLowerCase().includes(search) ||
            (formatDate(f.fine_date).replace(/\//g, '-') || '').toLowerCase().includes(search) ||
            (f.vehicle_name || '').toLowerCase().includes(search) ||
            (f.driver_name || '').toLowerCase().includes(search) ||
            (String(f.amount || '')).toLowerCase().includes(search) ||
            (f.status || 'Pending').toLowerCase().includes(search)
        );
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fines.length]);

    const totalPages = Math.ceil(filteredFines.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentFines = filteredFines.slice(indexOfFirstItem, indexOfLastItem);


    const handleExport = (format) => {
        const columns = [
            { header: '#', dataKey: 'index' },
            { header: 'Fine No', dataKey: 'fine_no' },
            { header: 'Date', dataKey: 'fine_date', formatter: (v) => formatDate(v).replace(/\//g, '-') },
            { header: 'Vehicle', dataKey: 'vehicle_name' },
            { header: 'Driver', dataKey: 'driver_name' },
            { header: 'Amount', dataKey: 'amount', formatter: (v) => v },
            { header: 'Status', dataKey: 'status', formatter: (v) => v || 'Pending' },
        ];
        
        const dataWithIndex = filteredFines.map((d, i) => ({ ...d, index: i + 1 }));
        const title = 'Fines & Tokens List';

        if (format === 'pdf') exportToPDF(dataWithIndex, columns, 'fines_and_tokens.pdf', title);
        else if (format === 'excel') exportToExcel(dataWithIndex, columns, 'fines_and_tokens.xlsx');
        else if (format === 'print') printData(dataWithIndex, columns, title);
    };

    return (
        <>
            <PageTitle activeMenu="Fines & Tokens" motherMenu="Logistics" />

            <div className="container-fluid">
            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Fines & Tokens Management</Card.Title>
                            
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search fines, vehicle..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '35px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <div className="d-flex gap-2 ms-2">
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('pdf')} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('excel')} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={() => handleExport('print')} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                                <CreateButton module="fines_tokens" onClick={handleAddClick}>
                                    Add Fine
                                </CreateButton>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                            <thead>
                                <tr>
                                    <th><strong>SL.NO</strong></th>
                                    <th><strong>FINE NO</strong></th>
                                    <th><strong>DATE</strong></th>
                                    <th><strong>VEHICLE</strong></th>
                                    <th><strong>DRIVER</strong></th>
                                    <th><strong>AMOUNT</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="text-center py-4">Loading...</td></tr>
                                ) : filteredFines.length === 0 ? (
                                    <tr><td colSpan="8" className="text-center py-4 text-muted">No fines found.</td></tr>
                                ) : (
                                    currentFines.map((f, i) => (
                                        <tr key={f.id}>
                                            <td>{indexOfFirstItem + i + 1}</td>
                                            <td className="fw-bold">{f.fine_no}</td>
                                            <td>{formatDate(f.fine_date).replace(/\//g, '-')}</td>
                                            <td className="fw-bold">{f.vehicle_name}</td>
                                            <td>{f.driver_name}</td>
                                            <td className="fw-bold" style={{ color: '#10b981' }}>{f.amount}</td>
                                            <td>
                                                <span 
                                                    style={{ 
                                                        background: f.status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 159, 0, 0.1)', 
                                                        color: f.status === 'Paid' ? '#10b981' : '#f59f00', 
                                                        padding: '4px 10px', 
                                                        borderRadius: '6px', 
                                                        fontWeight: '600', 
                                                        fontSize: '0.75rem' 
                                                    }}
                                                >
                                                    {f.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    {(!f.status || f.status === 'Pending') && (
                                                        <button 
                                                            onClick={() => handleMarkAsPaid(f.id, f.vehicle, f.driver, f.amount, f.fine_date)}
                                                            className="btn btn-sm"
                                                            style={{ 
                                                                padding: '4px 8px', fontSize: '0.7rem', fontWeight: '600',
                                                                background: '#10b981', color: 'white', border: 'none', borderRadius: '6px'
                                                            }}
                                                        >
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                    <EditButton 
                                                        module="fines_tokens"
                                                        onClick={() => handleEdit(f)}
                                                        className="sharp btn-xs"
                                                    />
                                                    <DeleteButton 
                                                        module="fines_tokens"
                                                        onClick={() => handleDelete(f.id)}
                                                        className="sharp btn-xs"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                                </table>
                            </div>

                            {filteredFines.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredFines.length)} of {filteredFines.length} entries
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
                </Col>
            </Row>
            </div>

            <Modal 
                show={showModal} 
                onHide={() => {setShowModal(false); setEditingId(null);}}
                backdrop="static"
                keyboard={false}
                centered
                size="lg"
                dialogClassName="custom-modal-fade"
                contentClassName="border-0 shadow-lg"
                style={{ borderRadius: '16px', overflow: 'hidden' }}
            >
                <div style={{ padding: '24px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
                    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                        <style>{`
                            .pkg-close-btn {
                                background-color: var(--cancel-btn-color, #dc3545) !important;
                                border-color: var(--cancel-btn-color, #dc3545) !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-close-btn:hover {
                                background-color: var(--cancel-btn-color, #dc3545) !important;
                                border-color: var(--cancel-btn-color, #dc3545) !important;
                                opacity: 0.9 !important;
                            }
                            .pkg-submit-btn {
                                background-color: var(--save-btn-color, #0a500f) !important;
                                border-color: var(--save-btn-color, #0a500f) !important;
                                color: white !important;
                                border-radius: 8px !important;
                                font-weight: 500 !important;
                                font-size: 14px !important;
                                padding: 10px 24px !important;
                                border: none !important;
                                cursor: pointer;
                                transition: background-color 0.2s, transform 0.1s !important;
                            }
                            .pkg-submit-btn:hover, .pkg-submit-btn:focus {
                                background-color: var(--save-btn-color, #0a500f) !important;
                                border-color: var(--save-btn-color, #0a500f) !important;
                                opacity: 0.9 !important;
                                box-shadow: 0 0 0 4px rgba(10, 80, 15, 0.2) !important;
                                outline: none !important;
                            }
                        `}</style>
                        <div style={{ marginBottom: '0' }}>
                            <div className="d-flex align-items-center justify-content-between gap-3 mb-1" style={{ paddingBottom: '4px' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: 'var(--primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </div>
                                    <div>
                                        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>
                                            {editingId ? 'Edit Fine/Token' : 'Add New Fine/Token'}
                                        </h5>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                                            Enter fine details to add to your records
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr style={{ borderColor: '#e2e8f0', margin: '16px 0 20px 0' }} />

                        <div className="row">
                            <div className="form-group col-md-6 col-12 mb-3">
                                <label className="fw-semibold">Fine Number (Auto-generated)</label>
                                <input type="text" className="form-control bg-light" value={formData.fine_no || 'To be generated'} readOnly />
                            </div>
                            <div className="form-group col-md-6 col-12 mb-3">
                                <label className="fw-semibold">Fine Date <span className="text-danger">*</span></label>
                                <input type="date" className="form-control" autoFocus
                                    value={formData.fine_date} onChange={e => setFormData({...formData, fine_date: e.target.value})} 
                                />
                            </div>

                            <div className="form-group col-md-6 col-12 mb-3">
                                <label className="fw-semibold">Vehicle Number <span className="text-danger">*</span></label>
                                <select className="form-control form-select" value={formData.vehicle} onChange={e => setFormData({...formData, vehicle: e.target.value})}>
                                    <option value="">Select Vehicle</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.vehicle_name} ({v.vehicle_number})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group col-md-6 col-12 mb-3">
                                <label className="fw-semibold">Driver <span className="text-danger">*</span></label>
                                <select className="form-control form-select" value={formData.driver} onChange={e => setFormData({...formData, driver: e.target.value})}>
                                    <option value="">Select Driver</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group col-12 mb-3">
                                <label className="fw-semibold">Fine Amount <span className="text-danger">*</span></label>
                                <input type="number" className="form-control" placeholder="e.g. 500.00" 
                                    value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} 
                                />
                            </div>

                            <div className="form-group col-12 mb-3">
                                <label className="fw-semibold">Narration / Notes</label>
                                <textarea className="form-control" placeholder="Enter any notes..." rows="3"
                                    value={formData.narration} onChange={e => setFormData({...formData, narration: e.target.value})}
                                />
                            </div>

                            <div className="form-group col-12 mb-3">
                                <label className="fw-semibold">Attachment</label>
                                <div style={{ border: '1px dashed #d2dce8', borderRadius: '8px', padding: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                                    <input type="file" className="form-control-file" style={{ fontSize: '0.9rem' }} onChange={handleFileChange} />
                                </div>
                            </div>
                        </div>

                        <div
                            className="modal-actions d-flex justify-content-end gap-2 mt-4 pt-3"
                            style={{ borderTop: '1px solid #f1f5f9' }}
                        >
                            <button
                                type="button"
                                className="pkg-close-btn btn-close-custom btn-universal-close"
                                onClick={() => {setShowModal(false); setEditingId(null);}}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="pkg-submit-btn btn-save-custom btn-universal-save"
                            >
                                {editingId ? 'Save Changes' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

        </>
    );
};

export default FinesAndTokensScreen;
