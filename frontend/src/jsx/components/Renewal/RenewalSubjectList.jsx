import React, { useState, useEffect, Fragment } from 'react';
import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getRenewalSubjects, deleteRenewalSubject } from '../../../services/RenewalService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import RenewalSubjectModal from './RenewalSubjectModal';
import { usePageTitle } from '../../../context/TitleContext';


const RenewalSubjectList = () => {
    const { can } = usePermission();
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [editSubject, setEditSubject] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchSubjects();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, subjects.length]);


    const fetchSubjects = async () => {
        try {
            setLoading(true);
            const data = await getRenewalSubjects();
            const arr = Array.isArray(data) ? data : (data.results || []);
            setSubjects(arr);
        } catch (error) {
            console.error("Error fetching renewal subjects", error);
        } finally {
            setLoading(false);
        }
    };

    usePageTitle("Renewal Subjects");

    const handleShowModal = (subject = null) => {
        if (subject && subject.id) {
            setEditMode(true);
            setEditSubject(subject);
        } else {
            setEditMode(false);
            setEditSubject(null);
        }
        setShowModal(true);
    };

    const handleEdit = (subject) => {
        handleShowModal(subject);
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Delete Renewal Subject "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
        });

        if (result.isConfirmed) {
            try {
                await deleteRenewalSubject(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Renewal Subject deleted successfully.',
                    timer: 1500,
                    showConfirmButton: false,
                });
                fetchSubjects();
            } catch (err) {
                console.error('Error deleting subject:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.response?.data?.detail || 'Could not delete subject.',
                });
            }
        }
    };

    const filteredSubjects = subjects.filter(s =>
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredSubjects.slice(indexOfFirstItem, indexOfLastItem);

    return (
        <Fragment>
            <div className="container-fluid">
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
                            <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Renewal Subjects Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Subject..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="renewal_subject"
                                    onClick={() => handleShowModal()}
                                    className="d-flex align-items-center justify-content-center"
                                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                                >
                                    Subject
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
                                <>
                                    <div className="table-responsive">
                                        <table className="table table-responsive-md">
                                            <thead>
                                                <tr>
                                                <th><strong>SUBJECT NAME</strong></th>
                                                <th><strong>DESCRIPTION</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSubjects.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((subject) => (
                                                    <tr key={subject.id}>
                                                        <td><strong>{subject.name || '-'}</strong></td>
                                                        <td>{subject.description || '-'}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end">
                                                                <EditButton
                                                                    module="renewal_subject"
                                                                    onClick={() => handleEdit(subject)}
                                                                    className="me-1"
                                                                />
                                                                <DeleteButton
                                                                    module="renewal_subject"
                                                                    onClick={() => handleDelete(subject.id, subject.name)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {filteredSubjects.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredSubjects.length)} of {filteredSubjects.length} entries
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
                                                        <li className={`page-item page-indicator ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ border: 'none', background: 'none' }}>
                                                                <i className="la la-angle-right" />
                                                            </button>
                                                        </li>
                                                    </ul>
                                                </nav>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
            </div>

            <RenewalSubjectModal
                show={showModal}
                onHide={() => setShowModal(false)}
                onSaved={() => fetchSubjects()}
                editSubject={editSubject}
            />
        </Fragment>
    );
};

export default RenewalSubjectList;
