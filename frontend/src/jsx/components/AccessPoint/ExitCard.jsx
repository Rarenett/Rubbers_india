import React, { useState, useEffect, Fragment, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';
import { downloadExitCardPDF, printExitCard } from '../../../utils/gateCardPdfGenerator';

const GATE_API_BASE = '/api/gate';

const ExitCard = () => {
    usePageTitle("Exit Card Management");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);
    
    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }
    }, [dispatch]);

    const [loading, setLoading] = useState(false);
    const [exitCards, setExitCards] = useState([]);
    const [entryCards, setEntryCards] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [showModal, setShowModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewCard, setPreviewCard] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [editId, setEditId] = useState(null);
    
    const cachedCompany = localStorage.getItem('companyData');
    const companyLogoUrl = cachedCompany ? JSON.parse(cachedCompany).logo : '/assets/glenda-banner-x9g2BJ3d.jpg';

    const [formData, setFormData] = useState({
        entry_card: '',
        exit_time: ''
    });

    useEffect(() => {
        fetchExitCards();
    }, []);


    const fetchEntryCards = async () => {
        try {
            const response = await axiosInstance.get(`${GATE_API_BASE}/entry-cards/`);
            if (response.data && response.data.results) {
                setEntryCards(response.data.results);
            } else if (Array.isArray(response.data)) {
                setEntryCards(response.data);
            }
        } catch (error) {
            console.error("Error fetching entry cards:", error);
        }
    };

    useEffect(() => {
        fetchEntryCards();
    }, []);

    const fetchExitCards = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`${GATE_API_BASE}/exit-cards/`);
            const data = response.data;
            let arr = Array.isArray(data) ? data : (data.results || []);
            setExitCards(arr);
        } catch (error) {
            console.error("Error fetching entry cards", error);
        } finally {
            setLoading(false);
        }
    };


    const entryCardOptions = entryCards
        .filter(ec => !exitCards.some(exitCard => exitCard.entry_card === ec.id))
        .map(ec => ({
            value: ec.id,
            label: `${ec.vehicle_number} — ${new Date(ec.entry_time).toLocaleString('en-IN', { 
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true 
            }).replace(',', '')}`,
            data: ec
        }));

    const selectedEC = formData.entry_card 
        ? entryCards.find(ec => ec.id === formData.entry_card) 
        : null;

    const handleShowModal = (card = null) => {
        if (card && card.id) {
            setEditMode(true);
            setEditId(card.id);
            
            // Format datetime for datetime-local input
            let formattedTime = '';
            if (card.exit_time) {
                const date = new Date(card.exit_time);
                // adjust for local timezone offset
                const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                formattedTime = new Date(date - tzoffset).toISOString().slice(0, 16);
            }
            
            setFormData({
                entry_card: card.entry_card || '',
                exit_time: formattedTime
            });
        } else {
            setEditMode(false);
            setEditId(null);
            
            const now = new Date();
            const tzoffset = now.getTimezoneOffset() * 60000;
            const formattedNow = new Date(now - tzoffset).toISOString().slice(0, 16);
            
            setFormData({ entry_card: '', exit_time: formattedNow });
        }
        setShowModal(true);
    };

    const handlePreview = (card) => {
        setPreviewCard(card);
        setShowPreviewModal(true);
    };

    const resetForm = () => {
        setEditMode(false);
        setEditId(null);
        setFormData({ entry_card: '', exit_time: '' });
        setShowModal(false);
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const getExpectedFee = () => {
        if (!formData.entry_card || !formData.exit_time) return '₹ 0.00';
        const ec = entryCards.find(c => c.id === formData.entry_card);
        if (!ec || !ec.entry_time) return '₹ 0.00';
        
        const entryD = new Date(ec.entry_time);
        const exitD = new Date(formData.exit_time);
        
        if (exitD < entryD) return 'Invalid Time';
        
        const diffSecs = (exitD - entryD) / 1000;
        
        if (diffSecs <= 3600) return '₹ 0.00';
        if (diffSecs <= 7200) return '₹ 30.00';
        if (diffSecs <= 10800) return '₹ 45.00';
        if (diffSecs <= 14400) return '₹ 60.00';
        return '₹ 100.00';
    };

    const handleSaveExitCard = async (e) => {
        e.preventDefault();
        
        if (!formData.entry_card || !formData.exit_time) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please fill all required fields.' });
            return;
        }

        try {
            const payload = {
                entry_card: formData.entry_card,
                exit_time: formData.exit_time
            };

            if (editMode) {
                await axiosInstance.put(`${GATE_API_BASE}/exit-cards/${editId}/`, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Exit Card updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await axiosInstance.post(`${GATE_API_BASE}/exit-cards/`, payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Exit Card created successfully', timer: 2000, showConfirmButton: false });
            }
            resetForm();
            fetchExitCards();
        } catch (error) {
            console.error("Exit Card Save Error:", error.response?.data || error);
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || `Failed to ${editMode ? 'update' : 'create'} exit card.`;
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        }
    };

    const handlePrint = () => {
        if (!previewCard) return;
        printExitCard(previewCard);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    };

    const filteredCards = exitCards.filter(card =>
        (card.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCards.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentCards = filteredCards.slice(indexOfFirst, indexOfLast);

    const renderCard = (card) => (
        <div className="exit-card-print" style={{ 
            width: '5cm', 
            height: '8cm', 
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '0.35cm',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            color: '#000',
            overflow: 'hidden'
        }}>
            <div style={{ textAlign: 'left', fontWeight: '700', fontSize: '14px', marginBottom: '0.15cm', color: '#1F2937' }}>
                RubbersIndia
            </div>
            {/* Header */}
            <div className="exit-card-header" style={{ width: '100%', textAlign: 'center', marginBottom: '0.15cm' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', letterSpacing: '0.5px' }}>
                    EXIT CARD
                </div>
            </div>

            {/* Divider */}
            <div className="exit-card-divider" style={{ width: '100%', borderBottom: '1px solid #eaeaea', margin: '0 0 0.15cm 0' }}></div>

            {/* Details */}
            <div className="exit-card-body" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                    <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                        Vehicle Number
                    </div>
                    <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#000' }}>
                        {card.vehicle_number}
                    </div>
                </div>
                <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                    <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                        Entry Time
                    </div>
                    <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#000' }}>
                        {card.entry_time ? formatDate(card.entry_time) : '-'}
                    </div>
                </div>
                <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                    <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                        Exit Time
                    </div>
                    <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#000' }}>
                        {formatDate(card.exit_time)}
                    </div>
                </div>
                {(card.park_area_name || card.parking_slot_number) && (
                    <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                        <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                            Parking Location
                        </div>
                        <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#000' }}>
                            {card.park_area_name || ''} {card.parking_slot_number ? `(Slot ${card.parking_slot_number})` : ''}
                        </div>
                    </div>
                )}
                {card.duration_formatted && (
                    <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                        <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                            Duration
                        </div>
                        <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#000' }}>
                            {card.duration_formatted}
                        </div>
                    </div>
                )}
                <div className="entry-field" style={{ width: '100%', textAlign: 'left', marginBottom: '0.15cm' }}>
                    <div className="entry-label" style={{ display: 'block', textAlign: 'left', fontSize: '9px', fontWeight: '600', color: '#666', marginBottom: '0.04cm', textTransform: 'uppercase' }}>
                        Parking Fee
                    </div>
                    <div className="entry-value" style={{ display: 'block', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#000' }}>
                        {card.parking_fee !== undefined && card.parking_fee !== null ? `₹ ${Number(card.parking_fee).toFixed(2)}` : '-'}
                    </div>
                </div>
            </div>

            {/* Signature Area */}
            <div className="exit-card-signature-wrapper" style={{ 
                marginTop: 'auto',
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '0.15cm'
            }}>
                <div style={{ width: '2.5cm', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                        SIGNATURE
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ 
                width: '100%', 
                textAlign: 'center', 
                fontSize: '11px', 
                fontWeight: 'bold', 
                color: '#333',
                borderTop: '1px solid #1f2937',
                paddingTop: '0.1cm'
            }}>
                Thank You
            </div>
        </div>
    );

    return (
        <Fragment>
            <div className="container-fluid print-hide exit-card-page">
                <div className="page-titles">
                    <button 
                        onClick={() => window.history.back()} 
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        style={{ gap: '6px', borderRadius: '6px' }}
                    >
                        <i className="fa fa-arrow-left"></i> Back
                    </button>
                </div>

                <div className="row">
                    <div className="col-lg-12">
                        <Card>
                            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                <Card.Title className="mb-0 text-nowrap">Exit Card Management</Card.Title>
                                <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1 justify-content-end header-actions-wrapper">
                                    <div className="search-bar-container m-0 search-bar-wrapper" style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: '350px' }}>
                                        <span className="search-icon">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        </span>
                                        <input
                                            type="text"
                                            className="search-input"
                                            placeholder="Search Vehicle Number..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                        <CreateButton 
                                            module="exit_card" 
                                            onClick={() => handleShowModal()}
                                        >
                                            Exit Card
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
                                    <div className="table-responsive exit-card-table-wrapper">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                    <th><strong>SL NO</strong></th>
                                                    <th><strong>VEHICLE NUMBER</strong></th>
                                                    <th><strong>ENTRY TIME</strong></th>
                                                    <th><strong>EXIT TIME</strong></th>
                                                    <th><strong>PARKING LOCATION</strong></th>
                                                    <th><strong>DURATION</strong></th>
                                                    <th><strong>PARKING FEE</strong></th>
                                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCards.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-4 text-muted">
                                                            No exit cards found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    currentCards.map((card, index) => (
                                                        <tr key={card.id}>
                                                            <td>{indexOfFirst + index + 1}</td>
                                                            <td><strong>{card.vehicle_number}</strong></td>
                                                            <td>{formatDate(card.entry_time)}</td>
                                                            <td>{formatDate(card.exit_time)}</td>
                                                            <td>
                                                                {card.park_area_name ? (
                                                                    <span className="badge light badge-info" style={{ fontSize: '11.5px', padding: '4px 8px' }}>
                                                                        <i className="fa fa-square-parking me-1"></i>
                                                                        {card.park_area_name}{card.parking_slot_number ? ` (Slot ${card.parking_slot_number})` : ''}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td>
                                                                <span className="badge light badge-dark" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                                    {card.duration_formatted || '-'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="badge light badge-success font-w600" style={{ fontSize: '12px', padding: '4px 8px' }}>
                                                                    ₹ {Number(card.parking_fee || 0).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end align-items-center gap-2">
                                                                    <button 
                                                                        className="btn btn-outline-info shadow" 
                                                                        onClick={() => handlePreview(card)}
                                                                        title="Preview & Print"
                                                                        style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                    >
                                                                        <i className="fa fa-eye"></i>
                                                                    </button>
                                                                    <EditButton 
                                                                        module="exit_card" 
                                                                        onClick={() => handleShowModal(card)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {!loading && filteredCards.length > 0 && (
                                    <Pagination
                                        currentPage={currentPage}
                                        setCurrentPage={setCurrentPage}
                                        totalPages={totalPages}
                                        indexOfFirst={indexOfFirst}
                                        indexOfLast={indexOfLast}
                                        totalRecords={filteredCards.length}
                                        loading={loading}
                                    />
                                )}
                            </Card.Body>
                        </Card>
                    </div>
                </div>

                <Modal
                    show={showModal}
                    onHide={resetForm}
                    dialogClassName="gate-custom-modal"
                    backdrop="static"
                    keyboard={false}
                    restoreFocus={false}
                    size="md"
                    centered
                >
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Exit Card' : 'Add Exit Card'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Enter details to manage exit card
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={resetForm}>
                            &times;
                        </button>
                    </div>

                    <Form onSubmit={handleSaveExitCard}>
                        <div className="modal-body-custom">
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Entry Card <span className="text-danger">*</span></Form.Label>
                                <Select
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    options={entryCardOptions}
                                    value={entryCardOptions.find(opt => opt.value === formData.entry_card) || null}
                                    onChange={(selected) => setFormData({...formData, entry_card: selected ? selected.value : ''})}
                                    placeholder="Select Entry Card"
                                    isClearable
                                    styles={{
                                        control: (base, state) => ({
                                            ...base,
                                            border: state.isFocused ? '1px solid #0a500f' : '1px solid #cbd5e1',
                                            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
                                            borderRadius: '10px',
                                            minHeight: '41px',
                                            fontSize: '13px',
                                            color: '#334155',
                                            '&:hover': {
                                                borderColor: state.isFocused ? '#0a500f' : '#cbd5e1'
                                            }
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            fontSize: '13px',
                                            borderRadius: '10px',
                                            overflow: 'hidden'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#94a3b8'
                                        })
                                    }}
                                />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Vehicle Number</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={selectedEC ? selectedEC.vehicle_number : ''}
                                    readOnly
                                />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Entry Time</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    value={selectedEC && selectedEC.entry_time ? new Date(selectedEC.entry_time).toLocaleString('en-IN', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit', hour12: true
                                    }).replace(',', '') : ''}
                                    readOnly
                                />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Exit Time <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="exit_time"
                                    className="form-control-custom"
                                    value={formData.exit_time}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <Form.Label className="form-label-custom">Parking Fee</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom bg-light"
                                    value={getExpectedFee()}
                                    readOnly
                                />
                                <small className="text-muted" style={{ fontSize: '11px' }}>Auto-calculated by duration.</small>
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-close-custom" onClick={resetForm}>
                                Cancel
                            </button>
                            <button type="submit" className="btn-save-custom" disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Saving...
                                    </>
                                ) : (
                                    editMode ? 'Update' : 'Save'
                                )}
                            </button>
                        </div>
                    </Form>
                </Modal>

                <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered dialogClassName="gate-custom-modal" size="md">
                    <div className="modal-content">
                        <div className="modal-header-custom">
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Preview Exit Card
                            </h4>
                            <button type="button" className="modal-close-x" onClick={() => setShowPreviewModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body-custom" style={{ backgroundColor: '#F1F3F5', padding: '40px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                            <div className="preview-card-wrapper shadow-sm rounded">
                                {previewCard && renderCard(previewCard)}
                            </div>
                        </div>
                        <div className="modal-footer-custom">
                            <button type="button" className="btn-close-custom" onClick={() => setShowPreviewModal(false)}>
                                Close
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-outline-success d-flex align-items-center gap-2"
                                style={{ borderRadius: '8px', padding: '10px 18px', fontWeight: 500 }}
                                onClick={() => previewCard && downloadExitCardPDF(previewCard)}
                            >
                                <i className="fa fa-download"></i> Download PDF
                            </button>
                            <button type="button" className="btn-save-custom d-flex align-items-center gap-2" onClick={handlePrint}>
                                <i className="fa fa-print"></i> Print
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>

            {/* Print Area - ONLY visible during print */}
            {previewCard && typeof document !== 'undefined' && createPortal(
                <div className="exit-card-print-area">
                    {renderCard(previewCard)}
                </div>,
                document.body
            )}

            <style>{`
                .gate-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .gate-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .gate-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .gate-custom-modal .modal-close-x {
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
                .gate-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .gate-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                .gate-custom-modal .modal-body-custom::-webkit-scrollbar {
                    width: 6px;
                }
                .gate-custom-modal .modal-body-custom::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .gate-custom-modal .modal-body-custom::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .gate-custom-modal .modal-body-custom::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .gate-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .gate-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .gate-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .gate-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .gate-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .gate-custom-modal .form-control-custom:disabled,
                .gate-custom-modal .form-control-custom[readonly] {
                    background-color: #f8fafc;
                    color: #64748b;
                }
                .gate-custom-modal .btn-close-custom {
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
                .gate-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .gate-custom-modal .btn-save-custom {
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
                .gate-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }

                .exit-card-print-area {
                    display: none;
                }

                /* Responsive Scoped Styles for Exit Card */
                .exit-card-page .exit-card-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .exit-card-page .search-bar-wrapper {
                    max-width: 250px;
                }
                .gate-custom-modal .preview-card-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    overflow: hidden;
                    width: 100%;
                }
                
                @media screen and (max-width: 768px) {
                    .exit-card-page .header-actions-wrapper {
                        width: 100% !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .exit-card-page .search-bar-wrapper {
                        max-width: 100% !important;
                    }
                    .exit-card-page .header-actions-wrapper > div {
                        width: 100% !important;
                    }
                    .exit-card-page .header-actions-wrapper .btn {
                        width: 100% !important;
                    }
                }
                
                @media screen and (max-width: 576px) {
                    .gate-custom-modal.modal {
                        padding: 0 12px !important;
                    }
                    .gate-custom-modal .modal-dialog {
                        max-width: calc(100vw - 24px) !important;
                        margin: 12px auto !important;
                    }
                    .gate-custom-modal .modal-body-custom {
                        padding: 16px !important;
                    }
                    .gate-custom-modal .modal-header-custom {
                        padding: 16px !important;
                    }
                    .gate-custom-modal .modal-footer-custom {
                        flex-direction: column !important;
                        padding: 16px !important;
                    }
                    .gate-custom-modal .btn-close-custom,
                    .gate-custom-modal .btn-save-custom {
                        width: 100% !important;
                    }
                }
                
                @media print {
                    /* Hide the entire application layout container */
                    body * {
                        visibility: hidden;
                    }
                    
                    #root,
                    .modal,
                    .modal-backdrop,
                    .gate-custom-modal {
                        display: none !important;
                    }
                    
                    body.modal-open {
                        overflow: visible !important;
                        padding: 0 !important;
                    }
                    
                    html, body {
                        width: 8cm !important;
                        height: 5cm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        overflow: hidden !important;
                        box-sizing: border-box;
                    }
                    
                    .print-hide {
                        display: none !important;
                    }

                    .exit-card-print-area {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 8cm !important;
                        height: 5cm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: white !important;
                        box-sizing: border-box !important;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .exit-card-print,
                    .exit-card-print * {
                        visibility: visible !important;
                    }

                    .exit-card-print {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 8cm !important;
                        height: 5cm !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-sizing: border-box !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        background-color: white !important;
                    }
                    
                    @page {
                        size: 8cm 5cm;
                        margin: 0;
                    }
                }
            `}</style>
        </Fragment>
    );
};

export default ExitCard;
