import React, { useState, useEffect, Fragment } from 'react';

import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getDepartments,
    deleteDepartment
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import DepartmentFormModal from './DepartmentFormModal';
import DepartmentContactModal from './DepartmentContactModal';

const DepartmentList = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    // Department modal
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editDeptMode, setEditDeptMode] = useState(false);
    const [currentDept, setCurrentDept] = useState({ id: null, name: '', is_active: true });

    // Contact modal
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactDept, setContactDept] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const deptData = await getDepartments();
            setDepartments(deptData);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch data',
            });
        } finally {
            setLoading(false);
        }
    };

    // Department handlers
    const handleShowDeptModal = (dept = null) => {
        if (dept) {
            setCurrentDept(dept);
            setEditDeptMode(true);
        } else {
            setCurrentDept({ id: null, name: '', is_active: true });
            setEditDeptMode(false);
        }
        setShowDeptModal(true);
    };

    const handleShowContactModal = (dept) => {
        setContactDept(dept);
        setShowContactModal(true);
    };

    const handleCloseContactModal = () => {
        setShowContactModal(false);
        setContactDept(null);
    };

    const handleDeleteDept = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Department?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteDepartment(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Department deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete department' });
            }
        }
    };

    // Filter departments by search
    const filteredDepartments = departments
        .filter(dept =>
            (dept.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentDepartments = filteredDepartments.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);

    return (
        <div className="container-fluid">
            <style>{`
                .dept-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .dept-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .dept-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .dept-custom-modal .modal-close-x {
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
                .dept-custom-modal .modal-close-x:hover { color: #555; }
                .dept-custom-modal .modal-body-custom { padding: 28px; }
                .dept-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .dept-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .dept-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .dept-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .dept-custom-modal .form-control-custom::placeholder { color: #94a3b8; }
                .dept-custom-modal .btn-close-custom {
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
                .dept-custom-modal .btn-close-custom:hover { background-color: #6357a7 !important; }
                .dept-custom-modal .btn-save-custom {
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
                .dept-custom-modal .btn-save-custom:hover { background-color: #26b277 !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
            `}</style>

            

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Departments Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Department..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton
                                    module="department"
                                    onClick={() => handleShowDeptModal()}
                                >
                                    Department
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
                                <div>
                                    {filteredDepartments.length === 0 ? (
                                        <div className="text-center py-4 text-muted">No entries</div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>
                                                    <tr>
                                                        <th><strong>SL NO</strong></th>
                                                        <th><strong>NAME</strong></th>
                                                        <th><strong>STATUS</strong></th>
                                                        <th className="text-end"><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentDepartments.map((dept, index) => (
                                                        <tr key={dept.id}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td><strong>{dept.name}</strong></td>
                                                            <td>
                                                                <span className={`badge light badge-${dept.is_active ? 'success' : 'danger'}`}>
                                                                    {dept.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="text-end">
                                                                 {can('departments', 'edit') || can('departments', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        {can('departments', 'edit') && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-info shadow"
                                                                                style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '12px', borderRadius: '6px' }}
                                                                                onClick={() => handleShowContactModal(dept)}
                                                                                title="Department Contact Details"
                                                                            >
                                                                                <i className="fa fa-address-book"></i>
                                                                            </button>
                                                                        )}
                                                                        <EditButton
                                                                            module="department"
                                                                            onClick={() => handleShowDeptModal(dept)}
                                                                        />
                                                                        <DeleteButton
                                                                            module="department"
                                                                            onClick={() => handleDeleteDept(dept.id, dept.name)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {filteredDepartments.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredDepartments.length)} of {filteredDepartments.length} entries
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
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Department Modal */}
            <DepartmentFormModal
                show={showDeptModal}
                onHide={() => setShowDeptModal(false)}
                onSuccess={fetchData}
                editMode={editDeptMode}
                department={currentDept}
            />

            {/* Department Contact Modal */}
            <DepartmentContactModal
                show={showContactModal}
                onHide={handleCloseContactModal}
                department={contactDept}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default DepartmentList;
