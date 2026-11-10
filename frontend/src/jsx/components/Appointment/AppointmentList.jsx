import React, { useState, useEffect, Fragment } from 'react';
import { Card, Dropdown } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import AppointmentService from '../../../services/AppointmentService';
import usePermission from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import AppointmentFormModal from './AppointmentFormModal';

const AppointmentList = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        if (year && month && day) {
            return `${day}-${month}-${year}`;
        }
        return dateString;
    };

    const { auth } = useSelector(state => state.auth);
    const userData = auth?.user || {};
    const { can } = usePermission();
    
    const itemsPerPage = 10;

    useEffect(() => {
        fetchAppointments();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, appointments.length]);

    const fetchAppointments = async () => {
        try {
            const data = await AppointmentService.getAppointments();
            setAppointments(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            setLoading(false);
        }
    };

    const deleteAppointment = async (id) => {
        if (window.confirm('Are you sure you want to delete this appointment?')) {
            try {
                await AppointmentService.deleteAppointment(id);
                fetchAppointments();
            } catch (error) {
                console.error('Error deleting appointment:', error);
            }
        }
    };

    const handleAdd = () => {
        setItemToEdit(null);
        setShowModal(true);
    };

    const handleEdit = (appointment) => {
        setItemToEdit(appointment);
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setItemToEdit(null);
    };

    const handleModalSave = () => {
        fetchAppointments();
    };

    const filteredAppointments = appointments.filter(app => {
        const searchStr = searchTerm.toLowerCase();
        return (
            (app.visitor_name && app.visitor_name.toLowerCase().includes(searchStr)) ||
            (app.visitor_phone && app.visitor_phone.toLowerCase().includes(searchStr)) ||
            (app.concerned_staff_name && app.concerned_staff_name.toLowerCase().includes(searchStr))
        );
    });

    const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);

    // Helper to render status badge classes
    const getStatusBadgeClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'approved':
                return 'badge badge-success light';
            case 'pending':
                return 'badge badge-warning light';
            case 'rejected':
                return 'badge badge-danger light';
            case 'completed':
                return 'badge badge-info light';
            case 'cancelled':
                return 'badge badge-secondary light';
            default:
                return 'badge bg-light text-dark';
        }
    };

    return (
        <Fragment>
            <Card>
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <Card.Title className="mb-0 text-nowrap">Appointments</Card.Title>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                            <span className="search-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search visitor, phone, staff..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleAdd}
                            className="btn btn-sm d-flex align-items-center"
                            title="New Appointment"
                            style={{
                                backgroundColor: '#0a500f',
                                borderColor: '#0a500f',
                                color: 'white',
                                height: '34px',
                                fontSize: '13px',
                                borderRadius: '6px'
                            }}
                        >
                            <i className="fa fa-plus me-2"></i>
                            New Appointment
                        </button>
                    </div>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive">
                        <table className="table table-responsive-md">
                            <thead>
                                <tr>
                                    <th style={{ width: '100px' }}><strong>SL NO.</strong></th>
                                    <th><strong>VISITOR / VEHICLE</strong></th>
                                    <th><strong>PHONE</strong></th>
                                    <th><strong>STAFF</strong></th>
                                    <th><strong>DATE & TIME</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center py-4">Loading...</td></tr>
                                ) : filteredAppointments.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center py-4 text-muted">No appointments found.</td></tr>
                                ) : currentItems.map((appointment, idx) => (
                                    <tr key={appointment.id || idx}>
                                        <td>{indexOfFirstItem + idx + 1}</td>
                                        <td>
                                            {appointment.vehicle_number ? (
                                                <>
                                                    <span className="text-primary fw-bold"><i className="fa fa-truck me-1"></i>{appointment.vehicle_number}</span>
                                                    {appointment.company && <><br /><small className="text-muted">{appointment.company}</small></>}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-primary fw-bold"><i className="fa fa-user me-1"></i>{appointment.visitor_name}</span>
                                                </>
                                            )}
                                        </td>
                                        <td className="fw-semibold">
                                            {appointment.vehicle_number ? (appointment.vehicle_type_name || '-') : appointment.visitor_phone}
                                        </td>
                                        <td>{appointment.concerned_staff_name}</td>
                                        <td>
                                            {formatDate(appointment.appointment_date)} {appointment.appointment_time}
                                        </td>
                                        <td>
                                            <span className={getStatusBadgeClass(appointment.status)}>
                                                {appointment.status ? (appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)) : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex justify-content-end align-items-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(appointment)}
                                                    className="btn btn-outline-primary btn-sm shadow"
                                                    title="Edit Appointment"
                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                >
                                                    <i className="fa fa-pencil-alt"></i>
                                                </button>
                                                <button
                                                    onClick={() => deleteAppointment(appointment.id)}
                                                    className="btn btn-outline-danger btn-sm shadow"
                                                    title="Delete Appointment"
                                                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                >
                                                    <i className="fa fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredAppointments.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredAppointments.length)} of {filteredAppointments.length} entries
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
            
            <AppointmentFormModal 
                show={showModal} 
                onHide={handleModalClose} 
                itemToEdit={itemToEdit} 
                onSave={handleModalSave} 
            />
        </Fragment>
    );
};

export default AppointmentList;
