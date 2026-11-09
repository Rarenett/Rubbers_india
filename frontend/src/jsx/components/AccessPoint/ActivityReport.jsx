import React, { useState, useEffect, useContext } from 'react';
import { Row, Col, Card, Table, Badge, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import { ThemeContext } from "../../../context/ThemeContext";
import GateManagementService from '../../../services/GateManagementService';
import AppointmentService from '../../../services/AppointmentService';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

const ActivityReport = () => {
    const { background } = useContext(ThemeContext);
    const isDark = background.value === "dark";

    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState('entries'); // 'entries', 'visitors', 'appointments'
    const [data, setData] = useState([]);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        search: ''
    });

    const formatToDDMMYY = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    useEffect(() => {
        fetchData();
    }, [reportType]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let result = [];
            if (reportType === 'entries') {
                result = await GateManagementService.getGateEntries();
            } else if (reportType === 'visitors') {
                result = await GateManagementService.getVisitors();
            } else if (reportType === 'appointments') {
                result = await AppointmentService.getAppointments();
            }
            setData(result || []);
        } catch (error) {
            console.error("Error fetching report data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const filteredData = data.filter(item => {
        // Date filtering
        if (filters.startDate || filters.endDate) {
            let itemDate;
            if (reportType === 'entries') itemDate = new Date(item.entry_time);
            else if (reportType === 'visitors') itemDate = new Date(item.created_at);
            else if (reportType === 'appointments') itemDate = new Date(item.appointment_date);

            if (filters.startDate && itemDate < new Date(filters.startDate)) return false;
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setHours(23, 59, 59, 999);
                if (itemDate > end) return false;
            }
        }

        // Search filtering
        if (filters.search) {
            const search = filters.search.toLowerCase();
            const name = (item.visitor_name || item.name || '').toLowerCase();
            const phone = (item.visitor_mobile || item.mobile_no || item.visitor_phone || '').toString();
            return name.includes(search) || phone.includes(search);
        }

        return true;
    });

    const exportToCSV = () => {
        if (filteredData.length === 0) return;

        let headers = [];
        let rows = [];

        if (reportType === 'entries') {
            headers = ['Visitor', 'Mobile', 'Gate', 'Official', 'Department', 'Entry Date', 'Entry Time', 'Exit Date', 'Exit Time', 'Status'];
            rows = filteredData.map(row => [
                row.visitor_name,
                row.visitor_mobile,
                row.entry_gate_no,
                row.employee_name,
                row.department_name,
                formatToDDMMYY(row.entry_time),
                new Date(row.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                row.exit_time ? formatToDDMMYY(row.exit_time) : 'N/A',
                row.exit_time ? new Date(row.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A',
                row.exit_time ? 'Exited' : 'Inside'
            ]);
        } else if (reportType === 'visitors') {
            headers = ['Name', 'Mobile', 'Email', 'ID Proof', 'Company', 'Registered Date'];
            rows = filteredData.map(row => [
                row.name,
                row.mobile_no,
                row.email || 'N/A',
                row.id_proof_type || 'N/A',
                row.company_name || 'N/A',
                formatToDDMMYY(row.created_at)
            ]);
        } else if (reportType === 'appointments') {
            headers = ['Visitor', 'Phone', 'Staff', 'Department', 'Date', 'Time', 'Purpose'];
            rows = filteredData.map(row => [
                row.visitor_name,
                row.visitor_phone,
                row.concerned_staff_name,
                row.department_name,
                formatToDDMMYY(row.appointment_date + 'T00:00:00') || row.appointment_date,
                row.appointment_time,
                row.purpose_of_visit
            ]);
        }

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${val}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `AccessPoint_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (filteredData.length === 0) return;

        const doc = new jsPDF();
        const timestamp = new Date().toLocaleDateString();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(0, 150, 255); // Primary Blue
        doc.text("Rarenett ERP", 14, 22);

        doc.setFontSize(14);
        doc.setTextColor(100);
        const reportTitle = reportType === 'entries' ? 'Gate Entry Activity Report' : reportType === 'visitors' ? 'Visitor Directory Report' : 'Appointment Schedule Report';
        doc.text(reportTitle, 14, 30);

        doc.setFontSize(10);
        doc.text(`Generated on: ${timestamp}`, 14, 38);
        if (filters.startDate) {
            doc.text(`Period: ${formatToDDMMYY(filters.startDate)} to ${filters.endDate ? formatToDDMMYY(filters.endDate) : 'Present'}`, 14, 44);
        }

        let headers = [];
        let body = [];

        if (reportType === 'entries') {
            headers = [['Visitor', 'Mobile', 'Gate', 'Official', 'Dept', 'Entry Date', 'Entry Time', 'Exit Date', 'Exit Time', 'Status']];
            body = filteredData.map(item => [
                item.visitor_name,
                item.visitor_mobile,
                item.entry_gate_no,
                item.employee_name,
                item.department_name,
                formatToDDMMYY(item.entry_time),
                new Date(item.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                item.exit_time ? formatToDDMMYY(item.exit_time) : 'N/A',
                item.exit_time ? new Date(item.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
                item.exit_time ? 'Exited' : 'Inside'
            ]);
        } else if (reportType === 'visitors') {
            headers = [['Name', 'Mobile', 'Email', 'ID Proof', 'Company', 'Registered Date']];
            body = filteredData.map(item => [
                item.name,
                item.mobile_no,
                item.email || 'N/A',
                item.id_proof_type || 'N/A',
                item.company_name || 'N/A',
                formatToDDMMYY(item.created_at)
            ]);
        } else if (reportType === 'appointments') {
            headers = [['Visitor', 'Phone', 'Staff', 'Dept', 'Date', 'Time', 'Purpose']];
            body = filteredData.map(item => [
                item.visitor_name,
                item.visitor_phone,
                item.concerned_staff_name,
                item.department_name,
                formatToDDMMYY(item.appointment_date + 'T00:00:00') || item.appointment_date,
                item.appointment_time,
                item.purpose_of_visit
            ]);
        }

        autoTable(doc, {
            head: headers,
            body: body,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [0, 150, 255], textColor: 255, fontSize: 8, fontStyle: 'bold' },
            bodyStyles: { fontSize: 7, textColor: 50 },
            alternateRowStyles: { fillColor: [245, 250, 255] },
            margin: { top: 50 },
        });

        doc.save(`AccessPoint_Report_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={`ap-report-container fade-up`}>
            <Row className="mb-4">
                <Col xl={12}>
                    <Card className="glass-card border-0 overflow-hidden shadow-sm">
                        <Card.Body className="p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 print-hide">
                                <div>
                                    <h4 className={`fw-800 mb-1 ${isDark ? 'text-white' : 'text-dark'}`}>Activity Reports</h4>
                                    <p className="text-muted small mb-0">Generate and export system activity logs</p>
                                </div>
                                <div className="d-flex gap-2">
                                    <Button variant="outline-primary" size="sm" className="rounded-pill px-3 shadow-none border-opacity-25" onClick={handlePrint}>
                                        <i className="fa fa-print me-2"></i> Print
                                    </Button>
                                    <Button variant="outline-info" size="sm" className="rounded-pill px-3 shadow-none border-opacity-25" onClick={exportToPDF} style={{ color: '#00d2ff', borderColor: '#00d2ff44' }}>
                                        <i className="fa fa-file-pdf me-2"></i> PDF
                                    </Button>
                                    <Button variant="primary" size="sm" className="rounded-pill px-3 shadow-sm" onClick={exportToCSV}>
                                        <i className="fa fa-file-excel me-2"></i> Excel
                                    </Button>
                                </div>
                            </div>

                            {/* Print Header */}
                            <div className="d-none d-print-block mb-4 border-bottom pb-3">
                                <div className="d-flex justify-content-between align-items-end">
                                    <div>
                                        <h2 className="mb-1 fw-800 text-dark">Rarenett ERP</h2>
                                        <h4 className="text-primary mb-0">{reportType === 'entries' ? 'Gate Entry Activity Report' : reportType === 'visitors' ? 'Visitor Directory Report' : 'Appointment Schedule Report'}</h4>
                                    </div>
                                    <div className="text-end small text-muted">
                                        <div>Date Generated: {new Date().toLocaleDateString()}</div>
                                        {filters.startDate && <div>From: {filters.startDate} To: {filters.endDate || 'Present'}</div>}
                                    </div>
                                </div>
                            </div>

                            <Row className="mb-4 g-3 print-hide">
                                <Col md={3}>
                                    <Form.Label className="small fw-700 text-muted text-uppercase ls-1">Report Type</Form.Label>
                                    <Form.Select className="glass-select shadow-none" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                                        <option value="entries">Gate Entry Logs</option>
                                        <option value="visitors">Registered Visitors</option>
                                        <option value="appointments">Appointments</option>
                                    </Form.Select>
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-700 text-muted text-uppercase ls-1">Start Date</Form.Label>
                                    <Form.Control type="date" name="startDate" className="glass-input shadow-none" value={filters.startDate} onChange={handleFilterChange} />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-700 text-muted text-uppercase ls-1">End Date</Form.Label>
                                    <Form.Control type="date" name="endDate" className="glass-input shadow-none" value={filters.endDate} onChange={handleFilterChange} />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-700 text-muted text-uppercase ls-1">Quick Search</Form.Label>
                                    <InputGroup className="glass-input-group border-0 bg-transparent">
                                        <InputGroup.Text className="bg-transparent border-0 ps-0 pe-2"><i className="fa fa-search text-primary opacity-50"></i></InputGroup.Text>
                                        <Form.Control type="text" name="search" placeholder="Name or Phone..." className="glass-input shadow-none" value={filters.search} onChange={handleFilterChange} />
                                    </InputGroup>
                                </Col>
                            </Row>

                            <div className="table-responsive report-print-area">
                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-2 text-muted">Gathering data...</p>
                                    </div>
                                ) : (
                                    <Table hover className="theme-table-minimal mb-0">
                                        <thead>
                                            {reportType === 'entries' && (
                                                <tr>
                                                    <th>Visitor</th>
                                                    <th>Gate / Tag</th>
                                                    <th>Meeting With</th>
                                                    <th>Entry Date / Time</th>
                                                    <th>Exit Date / Time</th>
                                                    <th>Status</th>
                                                </tr>
                                            )}
                                            {reportType === 'visitors' && (
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Contact</th>
                                                    <th>Email</th>
                                                    <th>ID Proof</th>
                                                    <th>Company</th>
                                                    <th>Registered</th>
                                                </tr>
                                            )}
                                            {reportType === 'appointments' && (
                                                <tr>
                                                    <th>Visitor</th>
                                                    <th>Date & Time</th>
                                                    <th>Meeting With</th>
                                                    <th>Department</th>
                                                    <th>Purpose</th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {filteredData.length > 0 ? filteredData.map((item, idx) => (
                                                <tr key={idx}>
                                                    {reportType === 'entries' && (
                                                        <>
                                                            <td>
                                                                <div className="fw-700">{item.visitor_name}</div>
                                                                <div className="small text-muted">{item.visitor_mobile}</div>
                                                            </td>
                                                            <td>
                                                                <div className="fw-600">{item.entry_gate_name || item.entry_gate_no}</div>
                                                                <div className="small text-primary">#{item.tag_code || 'N/A'}</div>
                                                            </td>
                                                            <td>{item.employee_name}</td>
                                                            <td>
                                                                <div className="fw-600">{formatToDDMMYY(item.entry_time)}</div>
                                                                <div className="small text-muted">{new Date(item.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                            </td>
                                                            <td>
                                                                {item.exit_time ? (
                                                                    <>
                                                                        <div className="fw-600">{formatToDDMMYY(item.exit_time)}</div>
                                                                        <div className="small text-muted">{new Date(item.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                                    </>
                                                                ) : '---'}
                                                            </td>
                                                            <td>
                                                                <Badge bg={item.exit_time ? 'danger' : 'success'} className="rounded-pill px-3 py-1 bg-opacity-10 text-uppercase ls-1 fw-800" style={{ fontSize: '9px', color: item.exit_time ? '#ff5f7d' : '#10b981', border: `1px solid ${item.exit_time ? '#ff5f7d33' : '#10b98133'}` }}>
                                                                    {item.exit_time ? 'Exited' : 'Inside'}
                                                                </Badge>
                                                            </td>
                                                        </>
                                                    )}
                                                    {reportType === 'visitors' && (
                                                        <>
                                                            <td className="fw-700">{item.name}</td>
                                                            <td>{item.mobile_no}</td>
                                                            <td>{item.email || '-'}</td>
                                                            <td className="text-uppercase small">{item.id_proof_type || '-'}</td>
                                                            <td>{item.company_name || '-'}</td>
                                                            <td>{formatToDDMMYY(item.created_at)}</td>
                                                        </>
                                                    )}
                                                    {reportType === 'appointments' && (
                                                        <>
                                                            <td>
                                                                <div className="fw-700">{item.visitor_name}</div>
                                                                <div className="small text-muted">{item.visitor_phone}</div>
                                                            </td>
                                                            <td>
                                                                <div className="fw-600">{formatToDDMMYY(item.appointment_date + 'T00:00:00') || item.appointment_date}</div>
                                                                <div className="small text-muted">{item.appointment_time}</div>
                                                            </td>
                                                            <td>{item.concerned_staff_name}</td>
                                                            <td>{item.department_name}</td>
                                                            <td className="text-truncate" style={{ maxWidth: '150px' }}>{item.purpose_of_visit}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            )) : (
                                                <tr><td colSpan="6" className="text-center py-5 text-muted">No records found for the selected filters.</td></tr>
                                            )}
                                        </tbody>
                                    </Table>
                                )}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <style dangerouslySetInnerHTML={{
                __html: `
                .ls-1 { letter-spacing: 1px; }
                .fw-800 { font-weight: 800; }
                
                .glass-select, .glass-input {
                    background: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'} !important;
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} !important;
                    border-radius: 10px !important;
                    color: ${isDark ? '#fff' : '#333'} !important;
                    font-size: 0.9rem !important;
                    padding: 0.6rem 1rem !important;
                }

                .theme-table-minimal thead th {
                    border-bottom: 2px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} !important;
                    padding: 1.2rem 1rem !important;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-weight: 700;
                    color: #00d2ff !important;
                    background: transparent !important;
                }

                .theme-table-minimal tbody tr td {
                    padding: 1rem !important;
                    vertical-align: middle !important;
                    color: ${isDark ? 'rgba(255,255,255,0.7)' : '#444'} !important;
                }

                @media print {
                    @page { margin: 1cm; }
                    
                    body {
                        background: #fff !important;
                        color: #000 !important;
                    }

                    #main-wrapper {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide ALL global nav/UI elements */
                    .nav-header, .deznav, .header, .footer, .print-hide, 
                    .ap-combined-header, .ap-globe-canvas, .ap-glow-sphere,
                    .chatbot-widget, .scroll-to-top {
                        display: none !important;
                    }

                    .content-body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }

                    .container-fluid {
                        padding: 0 !important;
                        margin: 0 !important;
                        width: 100% !important;
                    }

                    .glass-card {
                        background: #fff !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                    }

                    .ap-report-container {
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .theme-table-minimal {
                        width: 100% !important;
                        border: 1px solid #eee !important;
                    }

                    .theme-table-minimal thead th {
                        background-color: #f8f9fa !important;
                        color: #000 !important;
                        border: 1px solid #dee2e6 !important;
                        font-size: 10px !important;
                    }

                    .theme-table-minimal tbody td {
                        border: 1px solid #dee2e6 !important;
                        color: #000 !important;
                        font-size: 10px !important;
                    }
                }
            `}} />
        </div>
    );
};

export default ActivityReport;
