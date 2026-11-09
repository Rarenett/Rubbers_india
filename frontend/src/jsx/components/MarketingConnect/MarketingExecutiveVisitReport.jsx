import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Form, Modal } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

const MarketingExecutiveVisitReport = () => {
    usePageTitle("Executive Visit Report - Marketing Connect");

    const [loading, setLoading] = useState(false);
    const [shops, setShops] = useState([]);
    const [selectedShop, setSelectedShop] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [visits, setVisits] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedShop, fromDate, toDate, selectedEmployee, searchQuery]);

    useEffect(() => {
        fetchVisits();
    }, [selectedShop, fromDate, toDate]);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedShop) {
                params.append('shop', selectedShop);
                params.append('customer', selectedShop);
            }
            if (fromDate) params.append('from_date', fromDate);
            if (toDate) params.append('to_date', toDate);

            const res = await axiosInstance.get(`/api/project/marketing/executive_visit_report/?${params.toString()}`);
            if (res.data) {
                const dataVisits = Array.isArray(res.data.visits) ? res.data.visits : [];
                setVisits(dataVisits);
                const loadedShops = res.data.shops || res.data.customers;
                if (Array.isArray(loadedShops) && loadedShops.length > 0) {
                    setShops(loadedShops);
                }
            }
        } catch (error) {
            console.error('Error fetching follow-up lead visits:', error);
            setVisits([]);
        } finally {
            setLoading(false);
        }
    };

    // Extract unique executives from loaded visits
    const availableEmployees = Array.from(new Set(visits.map(v => v.employee_name).filter(e => e && e !== '-' && e !== 'Unassigned'))).sort();

    const handleResetFilters = () => {
        setSelectedShop('');
        setFromDate('');
        setToDate('');
        setSelectedEmployee('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    // Filter records
    const filteredVisits = visits.filter(item => {
        if (selectedEmployee && item.employee_name !== selectedEmployee) return false;

        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const shop = (item.shop_name || item.customer_name || '').toLowerCase();
        const lead = (item.lead_id || '').toLowerCase();
        const contact = (item.contact_number || '').toLowerCase();
        return (
            lead.includes(q) ||
            shop.includes(q) ||
            contact.includes(q) ||
            (item.employee_name && item.employee_name.toLowerCase().includes(q)) ||
            (item.employee_id && item.employee_id.toLowerCase().includes(q)) ||
            (item.purpose && item.purpose.toLowerCase().includes(q)) ||
            (item.status && item.status.toLowerCase().includes(q)) ||
            (item.remarks && item.remarks.toLowerCase().includes(q)) ||
            (item.person_met && item.person_met.toLowerCase().includes(q)) ||
            (item.location && item.location.toLowerCase().includes(q))
        );
    });

    const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredVisits.slice(indexOfFirstItem, indexOfLastItem);

    // Status badge style matching other reports
    const getStatusBadge = (status) => {
        if (!status || status === '-') return '-';
        const s = status.toLowerCase();
        let bg = '#e8fdf4';
        let color = '#16a34a';
        let border = '#bbf7d0';

        if (s.includes('escalat')) {
            bg = '#ffe4e6';
            color = '#e11d48';
            border = '#fecdd3';
        } else if (s.includes('work') || s.includes('deal') || s.includes('active')) {
            bg = '#eff6ff';
            color = '#2563eb';
            border = '#bfdbfe';
        }

        return (
            <span
                className="badge"
                style={{
                    backgroundColor: bg,
                    color: color,
                    border: `1px solid ${border}`,
                    fontWeight: 600,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px'
                }}
            >
                {status}
            </span>
        );
    };

    const getExportData = () => {
        return filteredVisits.map((item, index) => {
            const dateParts = item.visit_date ? item.visit_date.split('-') : [];
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (item.visit_date_formatted || item.visit_date || '-');
            const nextParts = item.next_followup_date && item.next_followup_date !== '-' ? item.next_followup_date.split('-') : [];
            const formattedNext = nextParts.length === 3 ? `${nextParts[2]}/${nextParts[1]}/${nextParts[0]}` : (item.next_followup_date || '-');

            return {
                sl_no: index + 1,
                lead_id: item.lead_id || '-',
                shop_name: item.shop_name || item.customer_name || '-',
                contact_number: item.contact_number || '-',
                employee_name: item.employee_name || '-',
                employee_id: item.employee_id || '-',
                visit_date: formattedDate,
                check_in_time: item.check_in_time || '-',
                check_out_time: item.check_out_time || '-',
                duration: item.duration || '-',
                purpose: item.purpose || '-',
                person_met: item.person_met || '-',
                status: item.status || '-',
                remarks: item.remarks || '-',
                next_followup_date: formattedNext,
                location: item.location || '-'
            };
        });
    };

    const columns = [
        { header: 'Sl No', dataKey: 'sl_no' },
        { header: 'Lead ID', dataKey: 'lead_id' },
        { header: 'Shop / Lead Name', dataKey: 'shop_name' },
        { header: 'Contact No', dataKey: 'contact_number' },
        { header: 'Executive / Staff', dataKey: 'employee_name' },
        { header: 'Visit Date', dataKey: 'visit_date' },
        { header: 'Time', dataKey: 'check_in_time' },
        { header: 'Duration', dataKey: 'duration' },
        { header: 'Purpose', dataKey: 'purpose' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Remarks', dataKey: 'remarks' },
        { header: 'Next Visit', dataKey: 'next_followup_date' },
        { header: 'Location', dataKey: 'location' }
    ];

    const handleExportExcel = () => {
        exportToExcel(getExportData(), columns, `Executive_Visit_Report_${selectedShop || 'All'}.xlsx`);
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), columns, `Executive_Visit_Report_${selectedShop || 'All'}.pdf`, `Executive Visit Report - ${selectedShop || 'All'}`);
    };

    const handlePrint = () => {
        printData(getExportData(), columns, `Executive Visit Report - ${selectedShop || 'All'}`);
    };

    return (
        <div className="container-fluid">
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
                `}
            </style>

            <div className="row page-titles mx-0 no-print">
                <div className="col-sm-6 p-md-0">
                    <div className="welcome-text">
                        <h4>Executive Visit Report</h4>
                        <p className="mb-0">View all follow-up lead visits and executive engagement history.</p>
                    </div>
                </div>
            </div>

            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title>Executive Visit Records</Card.Title>

                            <div className="d-flex gap-2 align-items-center flex-wrap no-print">
                                {/* Search */}
                                <Form.Group className="mb-0">
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by Lead ID, shop, staff, remarks..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ minWidth: '220px', maxWidth: '280px' }}
                                    />
                                </Form.Group>

                                {/* From Date */}
                                <Form.Group className="mb-0">
                                    <Form.Control
                                        type="date"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        style={{ maxWidth: '155px' }}
                                        title="From Date"
                                    />
                                </Form.Group>

                                {/* To Date */}
                                <Form.Group className="mb-0">
                                    <Form.Control
                                        type="date"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        style={{ maxWidth: '155px' }}
                                        title="To Date"
                                    />
                                </Form.Group>

                                {/* Lead / Shop Dropdown */}
                                <Form.Group className="mb-0">
                                    <Form.Select
                                        value={selectedShop}
                                        onChange={(e) => setSelectedShop(e.target.value)}
                                        style={{ minWidth: '170px', maxWidth: '210px' }}
                                        title="Filter by Lead / Shop"
                                    >
                                        <option value="">All Follow-Up Leads</option>
                                        {shops.map((s, idx) => (
                                             <option key={idx} value={s}>{s}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                {/* Executive / Staff filter */}
                                {availableEmployees.length > 1 && (
                                    <Form.Group className="mb-0">
                                        <Form.Select
                                            value={selectedEmployee}
                                            onChange={(e) => setSelectedEmployee(e.target.value)}
                                            style={{ maxWidth: '160px' }}
                                        >
                                            <option value="">All Staff</option>
                                            {availableEmployees.map((emp, idx) => (
                                                <option key={idx} value={emp}>{emp}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                )}


                                {/* Export Controls */}
                                <div className="d-flex gap-1 ms-1">
                                    <button className="btn btn-sm btn-light border" onClick={handleExportPDF} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handleExportExcel} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handlePrint} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <>
                                    <div className="table-responsive">
                                        <table className="table w-100 align-middle">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '45px' }}><strong>Sl No</strong></th>
                                                    <th><strong>Lead ID</strong></th>
                                                    <th><strong>Customer / Shop Name</strong></th>
                                                    <th><strong>Mobile</strong></th>
                                                    <th><strong>Assigned Staff / Executive</strong></th>
                                                    <th><strong>Visit Date</strong></th>
                                                    <th><strong>Timing & Duration</strong></th>
                                                    <th><strong>Purpose</strong></th>
                                                    <th><strong>Status</strong></th>
                                                    <th><strong>Remarks</strong></th>
                                                    <th><strong>Next Visit</strong></th>
                                                    <th><strong>Location</strong></th>
                                                    <th className="no-print" style={{ width: '55px', textAlign: 'center' }}><strong>Photo</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentItems.length > 0 ? (
                                                    currentItems.map((item, index) => {
                                                        const dateParts = item.visit_date ? item.visit_date.split('-') : [];
                                                        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (item.visit_date_formatted || item.visit_date || '-');
                                                        const nextParts = item.next_followup_date && item.next_followup_date !== '-' ? item.next_followup_date.split('-') : [];
                                                        const formattedNext = nextParts.length === 3 ? `${nextParts[2]}/${nextParts[1]}/${nextParts[0]}` : (item.next_followup_date || '-');

                                                        return (
                                                            <tr key={item.id || index}>
                                                                <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                                <td>
                                                                    <span className="badge badge-light text-primary">{item.lead_id || '-'}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="fw-bold text-dark">{item.shop_name || item.customer_name}</div>
                                                                    {item.shop_type && item.shop_type !== '-' && (
                                                                        <small className="text-muted d-block">{item.shop_type}</small>
                                                                    )}
                                                                </td>
                                                                <td>{item.contact_number || '-'}</td>
                                                                <td>
                                                                    <div className="fw-semibold text-dark">{item.employee_name}</div>
                                                                    <small className="text-muted d-block">
                                                                        {item.employee_id} {item.employee_designation && item.employee_designation !== 'Executive' ? `• ${item.employee_designation}` : ''}
                                                                    </small>
                                                                </td>
                                                                <td>
                                                                    <div>{formattedDate}</div>
                                                                    {item.check_in_time && item.check_in_time !== '-' && (
                                                                        <small className="text-muted d-block">{item.check_in_time}</small>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    <div>{item.check_in_time || '-'} {item.check_out_time && item.check_out_time !== '-' ? `→ ${item.check_out_time}` : ''}</div>
                                                                    {item.duration && item.duration !== '-' && (
                                                                        <small className="text-info d-block">{item.duration}</small>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {item.purpose && item.purpose !== '-' ? (
                                                                        <span className="badge bg-light text-dark border" style={{ fontSize: '11px' }}>
                                                                            {item.purpose}
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td>{getStatusBadge(item.status)}</td>
                                                                <td style={{ maxWidth: '240px', fontSize: '12.5px' }}>
                                                                    <div title={item.remarks} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                                                        {item.remarks || '-'}
                                                                    </div>
                                                                </td>
                                                                <td>{formattedNext}</td>
                                                                <td style={{ maxWidth: '180px', fontSize: '12px' }}>
                                                                    {item.location || '-'}
                                                                </td>
                                                                <td className="no-print text-center">
                                                                    {item.photos && item.photos.length > 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-xs btn-outline-primary p-1"
                                                                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                                            onClick={() => setPreviewPhoto(item.photos[0])}
                                                                            title="View Photo"
                                                                        >
                                                                            <i className="fa fa-image" style={{ fontSize: '12px' }}></i>
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="13" className="text-center py-4 text-muted">
                                                            No follow-up lead visit records found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap no-print">
                                            <div className="mb-2">
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredVisits.length)} of {filteredVisits.length} entries
                                            </div>
                                            <nav>
                                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                            disabled={currentPage === 1}
                                                        >
                                                            <i className="la la-angle-left"></i>
                                                        </button>
                                                    </li>
                                                    {Array.from({ length: totalPages }, (_, i) => (
                                                        <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                                            <button
                                                                type="button"
                                                                className="page-link"
                                                                onClick={() => setCurrentPage(i + 1)}
                                                            >
                                                                {i + 1}
                                                            </button>
                                                        </li>
                                                    ))}
                                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="page-link"
                                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                            disabled={currentPage === totalPages}
                                                        >
                                                            <i className="la la-angle-right"></i>
                                                        </button>
                                                    </li>
                                                </ul>
                                            </nav>
                                        </div>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Photo Preview Modal */}
            <Modal show={!!previewPhoto} onHide={() => setPreviewPhoto(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>Visit Attachment</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-2">
                    {previewPhoto && (
                        <img
                            src={previewPhoto}
                            alt="Visit Attachment"
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '4px', objectFit: 'contain' }}
                        />
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default MarketingExecutiveVisitReport;
