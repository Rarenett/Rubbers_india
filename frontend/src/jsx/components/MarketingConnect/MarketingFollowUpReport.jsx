import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Form, Modal } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

const MarketingFollowUpReport = () => {
    usePageTitle("Follow-Up Report - Marketing Connect");

    const [loading, setLoading] = useState(false);
    const [followups, setFollowups] = useState([]);
    const [filterDate, setFilterDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPurpose, setSelectedPurpose] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [previewPhoto, setPreviewPhoto] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterDate, selectedPurpose, selectedStatus, selectedEmployee]);

    useEffect(() => {
        fetchFollowups();
    }, [filterDate]);

    const fetchFollowups = async () => {
        setLoading(true);
        try {
            let url = `/api/project/marketing/followup_report/`;
            if (filterDate) {
                url += `?date=${filterDate}`;
            }
            let res;
            try {
                res = await axiosInstance.get(url);
            } catch {
                res = await axiosInstance.get(`/api/crm_new/followups/report/${filterDate ? `?date=${filterDate}` : ''}`);
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setFollowups(data);
        } catch (error) {
            console.error('Error fetching follow-up report:', error);
            setFollowups([]);
        } finally {
            setLoading(false);
        }
    };

    // Extract dynamic unique filter values from loaded follow-ups
    const availablePurposes = Array.from(new Set(followups.map(f => f.purpose).filter(p => p && p !== '-'))).sort();
    const availableStatuses = Array.from(new Set(followups.map(f => f.status).filter(s => s && s !== '-'))).sort();
    const availableEmployees = Array.from(new Set(followups.map(f => f.assigned_employee).filter(e => e && e !== '-'))).sort();

    const filteredFollowups = followups.filter(item => {
        if (selectedPurpose && item.purpose !== selectedPurpose) return false;
        if (selectedStatus && item.status !== selectedStatus) return false;
        if (selectedEmployee && item.assigned_employee !== selectedEmployee) return false;

        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (item.lead_id && item.lead_id.toLowerCase().includes(q)) ||
            (item.customer_name && item.customer_name.toLowerCase().includes(q)) ||
            (item.contact_number && item.contact_number.toLowerCase().includes(q)) ||
            (item.city && item.city.toLowerCase().includes(q)) ||
            (item.location && item.location.toLowerCase().includes(q)) ||
            (item.assigned_employee && item.assigned_employee.toLowerCase().includes(q)) ||
            (item.purpose && item.purpose.toLowerCase().includes(q)) ||
            (item.status && item.status.toLowerCase().includes(q)) ||
            (item.remarks && item.remarks.toLowerCase().includes(q)) ||
            (item.narration && item.narration.toLowerCase().includes(q))
        );
    });

    const totalPages = Math.ceil(filteredFollowups.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredFollowups.slice(indexOfFirstItem, indexOfLastItem);

    const handleResetFilters = () => {
        setFilterDate('');
        setSearchQuery('');
        setSelectedPurpose('');
        setSelectedStatus('');
        setSelectedEmployee('');
        setCurrentPage(1);
    };

    const getExportData = () => {
        return filteredFollowups.map((item, index) => {
            const dateParts = item.followup_date ? item.followup_date.split('-') : [];
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (item.followup_date || '-');
            const nextParts = item.next_followup_date && item.next_followup_date !== '-' ? item.next_followup_date.split('-') : [];
            const formattedNext = nextParts.length === 3 ? `${nextParts[2]}/${nextParts[1]}/${nextParts[0]}` : (item.next_followup_date || '-');

            return {
                sl_no: index + 1,
                lead_id: item.lead_id || '-',
                customer_name: item.customer_name || '-',
                contact_number: item.contact_number || '-',
                location: item.location || item.city || '-',
                assigned_employee: item.assigned_employee || '-',
                followup_date: formattedDate,
                followup_time: item.followup_time || '-',
                purpose: item.purpose || '-',
                status: item.status || 'Active',
                remarks: item.remarks || '-',
                next_followup_date: formattedNext,
                escalated: item.is_escalated ? 'Yes' : 'No'
            };
        });
    };

    const columns = [
        { header: 'Sl No.', dataKey: 'sl_no' },
        { header: 'Lead ID', dataKey: 'lead_id' },
        { header: 'Customer / Shop', dataKey: 'customer_name' },
        { header: 'Contact No', dataKey: 'contact_number' },
        { header: 'Location', dataKey: 'location' },
        { header: 'Assigned Staff', dataKey: 'assigned_employee' },
        { header: 'Date', dataKey: 'followup_date' },
        { header: 'Time', dataKey: 'followup_time' },
        { header: 'Purpose', dataKey: 'purpose' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Remarks', dataKey: 'remarks' },
        { header: 'Next Visit', dataKey: 'next_followup_date' },
        { header: 'Escalated', dataKey: 'escalated' }
    ];

    const handleExportExcel = () => {
        exportToExcel(getExportData(), columns, `FollowUp_Report_${filterDate || 'All'}.xlsx`);
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), columns, `FollowUp_Report_${filterDate || 'All'}.pdf`, `Follow-Up Report - ${filterDate || 'All'}`);
    };

    const handlePrint = () => {
        printData(getExportData(), columns, `Follow-Up Report - ${filterDate || 'All'}`);
    };

    const getStatusBadge = (status) => {
        if (!status) return null;
        const s = status.toLowerCase();
        let bg = '#e8fdf4';
        let color = '#16a34a';
        let border = '#bbf7d0';

        if (s.includes('escalat')) {
            bg = '#ffe4e6';
            color = '#e11d48';
            border = '#fecdd3';
        } else if (s.includes('work') || s.includes('deal')) {
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
                        <h4>Follow-Up Report</h4>
                        <p className="mb-0">View all marketing follow-up activities, notes, and engagement history.</p>
                    </div>
                </div>
            </div>

            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <Card.Title>Follow-Up Records</Card.Title>
                            
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

                                {/* Date */}
                                <Form.Group className="mb-0">
                                    <Form.Control
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        style={{ maxWidth: '160px' }}
                                        title="Filter by Date"
                                    />
                                </Form.Group>

                                {/* Purpose filter */}
                                <Form.Group className="mb-0">
                                    <Form.Select
                                        value={selectedPurpose}
                                        onChange={(e) => setSelectedPurpose(e.target.value)}
                                        style={{ maxWidth: '160px' }}
                                    >
                                        <option value="">All Purposes</option>
                                        {availablePurposes.map((p, idx) => (
                                            <option key={idx} value={p}>{p}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                {/* Status filter */}
                                <Form.Group className="mb-0">
                                    <Form.Select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        style={{ maxWidth: '150px' }}
                                    >
                                        <option value="">All Statuses</option>
                                        {availableStatuses.map((s, idx) => (
                                            <option key={idx} value={s}>{s}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                {/* Employee filter */}
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

                                {/* Reset Filter Button */}
                                {(filterDate || searchQuery || selectedPurpose || selectedStatus || selectedEmployee) && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={handleResetFilters}
                                        title="Reset Filters"
                                    >
                                        Reset
                                    </button>
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
                                                    <th><strong>Location</strong></th>
                                                    <th><strong>Assigned Staff</strong></th>
                                                    <th><strong>Follow-Up Date</strong></th>
                                                    <th><strong>Purpose</strong></th>
                                                    <th><strong>Status</strong></th>
                                                    <th><strong>Remarks</strong></th>
                                                    <th><strong>Next Visit</strong></th>
                                                    <th className="no-print" style={{ width: '55px', textAlign: 'center' }}><strong>Photo</strong></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentItems.length > 0 ? (
                                                    currentItems.map((item, index) => {
                                                        const dateParts = item.followup_date ? item.followup_date.split('-') : [];
                                                        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.followup_date;
                                                        const nextParts = item.next_followup_date && item.next_followup_date !== '-' ? item.next_followup_date.split('-') : [];
                                                        const formattedNext = nextParts.length === 3 ? `${nextParts[2]}/${nextParts[1]}/${nextParts[0]}` : (item.next_followup_date || '-');

                                                        return (
                                                            <tr key={item.id || index}>
                                                                <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                                <td>
                                                                    <span className="fw-semibold text-primary">{item.lead_id}</span>
                                                                </td>
                                                                <td>
                                                                    <div className="fw-bold text-dark">{item.customer_name}</div>
                                                                    {item.shop_type && item.shop_type !== '-' && (
                                                                        <small className="text-muted">{item.shop_type}</small>
                                                                    )}
                                                                </td>
                                                                <td>{item.contact_number}</td>
                                                                <td style={{ maxWidth: '180px', fontSize: '12px' }}>
                                                                    {item.location || item.city || '-'}
                                                                </td>
                                                                <td>{item.assigned_employee}</td>
                                                                <td>
                                                                    <div>{formattedDate}</div>
                                                                    {item.followup_time && item.followup_time !== '-' && (
                                                                        <small className="text-muted">{item.followup_time}</small>
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
                                                                <td className="no-print text-center">
                                                                    {item.photo ? (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-xs btn-outline-primary p-1"
                                                                            style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                                                                            onClick={() => setPreviewPhoto(item.photo)}
                                                                            title="View Live Shop Photo"
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
                                                        <td colSpan="12" className="text-center py-4 text-muted">
                                                            No follow-up records found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap no-print">
                                            <div className="mb-2">
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredFollowups.length)} of {filteredFollowups.length} entries
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
                    <Modal.Title>Live Shop Photo</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-3">
                    {previewPhoto && (
                        <img
                            src={previewPhoto}
                            alt="Live Shop Photo"
                            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '10px' }}
                        />
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default MarketingFollowUpReport;
