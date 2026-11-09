import React, { useState, useEffect, Fragment } from 'react';
import { Card, Table, Button, Form, Badge, Modal } from 'react-bootstrap';
import Swal from 'sweetalert2';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getAllEmployeeDutyStatuses, endEmployeeDutyResponsibility, endEmployeeDuty } from '../../../../services/HRManagementService';

const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

const RevokeDuty = () => {
    const [dutyStatuses, setDutyStatuses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);
    
    const [revokeModal, setRevokeModal] = useState({
        show: false,
        type: '',
        title: '',
        text: '',
        endDate: new Date(),
        data: null
    });

    useEffect(() => {
        fetchAllDutyStatuses();
    }, []);

    const fetchAllDutyStatuses = async () => {
        setLoading(true);
        try {
            const data = await getAllEmployeeDutyStatuses();
            // Data could be paginated or not
            const statuses = data.results || data;
            // Filter to only active ones if we only want to revoke active ones
            const activeStatuses = statuses.filter(s => s.is_active);
            setDutyStatuses(activeStatuses);
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch duties', 'error');
        }
        setLoading(false);
    };

    const handleEndResponsibility = (statusId, empName, respName) => {
        setRevokeModal({
            show: true,
            type: 'responsibility',
            title: 'End Responsibility',
            text: `Revoke '${respName}' for ${empName}`,
            endDate: new Date(),
            data: { statusId }
        });
    };

    const handleEndWholeDuty = (empId, dutyId, empName, dutyName) => {
        setRevokeModal({
            show: true,
            type: 'duty',
            title: 'End Whole Duty',
            text: `Revoke entirely '${dutyName}' for ${empName}`,
            endDate: new Date(),
            data: { empId, dutyId }
        });
    };

    const confirmRevoke = async () => {
        if (!revokeModal.endDate) {
            Swal.fire('Error', 'Please select an end date!', 'warning');
            return;
        }

        const dateObj = revokeModal.endDate;
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const formattedDate = `${yyyy}-${mm}-${dd}`;

        setRevokeModal({ ...revokeModal, show: false });

        if (revokeModal.type === 'responsibility') {
            try {
                await endEmployeeDutyResponsibility(revokeModal.data.statusId, formattedDate);
                Swal.fire('Success', 'Responsibility ended', 'success');
                fetchAllDutyStatuses();
            } catch (error) {
                Swal.fire('Error', 'Failed to end responsibility', 'error');
            }
        } else if (revokeModal.type === 'duty') {
            try {
                await endEmployeeDuty(revokeModal.data.empId, revokeModal.data.dutyId, formattedDate);
                Swal.fire('Success', 'Duty ended completely', 'success');
                fetchAllDutyStatuses();
            } catch (error) {
                Swal.fire('Error', 'Failed to end duty', 'error');
            }
        }
    };

    const filteredStatuses = dutyStatuses.filter(status => {
        const searchStr = searchQuery.toLowerCase();
        const empName = (status.employee_name || '').toLowerCase();
        const dutyName = (status.duty_name_display || '').toLowerCase();
        const respName = (status.responsibility_name || '').toLowerCase();
        return empName.includes(searchStr) || dutyName.includes(searchStr) || respName.includes(searchStr);
    });

    const groupedStatuses = Object.values(filteredStatuses.reduce((acc, status) => {
        if (!acc[status.employee]) {
            acc[status.employee] = {
                employee_id: status.employee,
                employee_name: status.employee_name,
                duties: []
            };
        }
        acc[status.employee].duties.push(status);
        return acc;
    }, {})).sort((a, b) => (a.employee_name || '').localeCompare(b.employee_name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGroupedStatuses = groupedStatuses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(groupedStatuses.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Revoke Employee Duties</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search employee or duty..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <div className="table-responsive">
                                <table className="table table-responsive-md">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '80px', whiteSpace: 'nowrap' }}><strong>SL NO</strong></th>
                                            <th><strong>EMPLOYEE NAME</strong></th>
                                            <th><strong>DUTY NAME</strong></th>
                                            <th><strong>RESPONSIBILITY</strong></th>
                                            <th><strong>START DATE</strong></th>
                                            <th className="text-end"><strong>ACTION</strong></th>
                                        </tr>
                                    </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : currentGroupedStatuses.length > 0 ? (
                                    currentGroupedStatuses.map((empGroup, gIdx) => (
                                        <Fragment key={empGroup.employee_id}>
                                            {empGroup.duties.map((status, dIdx) => (
                                                <tr key={status.id}>
                                                    {dIdx === 0 && (
                                                        <td rowSpan={empGroup.duties.length} style={{ verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                                                            <strong>{indexOfFirstItem + gIdx + 1}</strong>
                                                        </td>
                                                    )}
                                                    {dIdx === 0 && (
                                                        <td rowSpan={empGroup.duties.length} style={{ verticalAlign: 'middle', borderBottom: '1px solid #e2e8f0' }}>
                                                            <strong>{empGroup.employee_name}</strong>
                                                        </td>
                                                    )}
                                                    <td style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        {status.duty_name_display || '-'}
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        <span className="badge badge-info light">
                                                            {status.responsibility_name}
                                                        </span>
                                                    </td>
                                                    <td style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        {status.start_date ? status.start_date.split('-').reverse().join('/') : '-'}
                                                    </td>
                                                    <td className="text-end" style={{ verticalAlign: 'middle', borderTop: dIdx !== 0 ? '1px solid #e2e8f0' : undefined, borderBottom: dIdx === empGroup.duties.length - 1 ? '1px solid #e2e8f0' : undefined }}>
                                                        <div className="d-flex justify-content-end gap-2">
                                                            <Button 
                                                                variant="warning" 
                                                                className="btn-xs light px-3 rounded-pill font-w600"
                                                                onClick={() => handleEndResponsibility(status.id, status.employee_name, status.responsibility_name)}
                                                            >
                                                                End Resp.
                                                            </Button>
                                                            <Button 
                                                                variant="outline-warning" 
                                                                className="btn-xs px-3 rounded-pill font-w600"
                                                                onClick={() => handleEndWholeDuty(status.employee, status.duty_name, status.employee_name, status.duty_name_display)}
                                                            >
                                                                End Duty
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center text-muted py-4">
                                            {dutyStatuses.length === 0 ? "No active duties found." : "No matches found for your search."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                                    </table>
                                </div>
                                {groupedStatuses.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, groupedStatuses.length)} of {groupedStatuses.length} entries
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

            <Modal show={revokeModal.show} onHide={() => setRevokeModal({ ...revokeModal, show: false })} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{revokeModal.title}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>{revokeModal.text}</p>
                    <Form.Group>
                        <Form.Label>End Date <span className="text-danger">*</span></Form.Label>
                        <div className="custom-react-datepicker-wrapper w-100">
                            <DatePicker
                                className="form-control w-100"
                                wrapperClassName="w-100"
                                selected={revokeModal.endDate}
                                onChange={(date) => setRevokeModal({ ...revokeModal, endDate: date })}
                                dateFormat="dd/MM/yyyy"
                                placeholderText="dd/mm/yyyy"
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderTop: '1px solid #e2e8f0' }}>
                                    <span 
                                        style={{ color: '#06b6d4', cursor: 'pointer', fontWeight: '500', fontSize: '0.9rem' }}
                                        onClick={() => setRevokeModal({ ...revokeModal, endDate: null })}
                                    >
                                        Clear
                                    </span>
                                    <span 
                                        style={{ color: '#06b6d4', cursor: 'pointer', fontWeight: '500', fontSize: '0.9rem' }}
                                        onClick={() => setRevokeModal({ ...revokeModal, endDate: new Date() })}
                                    >
                                        Today
                                    </span>
                                </div>
                            </DatePicker>
                        </div>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setRevokeModal({ ...revokeModal, show: false })}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={confirmRevoke} style={{ backgroundColor: '#6366f1', borderColor: '#6366f1' }}>
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default RevokeDuty;
