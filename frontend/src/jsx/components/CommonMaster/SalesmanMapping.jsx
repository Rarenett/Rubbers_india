import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import swal from 'sweetalert';
import { Card, Button, Form, Modal } from 'react-bootstrap';
import { AreaService } from '../../../services/AreaService';
import { getDepartments, getEmployees } from '../../../services/HRManagementService';
import { usePageTitle } from '../../../context/TitleContext';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';

const SalesmanMapping = () => {
    usePageTitle("Salesman Mapping");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);
    const prevWidthRef = useRef(window.innerWidth);
    
    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        const handleResize = () => {
            const currentWidth = window.innerWidth;
            if (prevWidthRef.current > 1199 && currentWidth <= 1199) {
                if (sideMenuRef.current) {
                    dispatch(navtoggle());
                }
            }
            prevWidthRef.current = currentWidth;
        };

        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [dispatch]);
    const [mappings, setMappings] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [areas, setAreas] = useState([]);
    const [areasLoading, setAreasLoading] = useState(false);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [reportingEmployees, setReportingEmployees] = useState([]);
    const [reportingEmployeesLoading, setReportingEmployeesLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [formData, setFormData] = useState({ area: '', department: '', employee: '', reporting_person_department: '', reporting_person: '' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchMappings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AreaService.getSalesmanMappings();
            let rawData = res.results ?? res;
            setMappings(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error('Error fetching salesman mappings:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await getDepartments();
            setDepartments(Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    }, []);

    const fetchAreas = useCallback(async () => {
        setAreasLoading(true);
        try {
            const res = await AreaService.getAreas();
            let rawData = res.results ?? res;
            setAreas(Array.isArray(rawData) ? rawData : []);
        } catch (err) {
            console.error('Error fetching areas:', err);
        } finally {
            setAreasLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMappings();
        fetchDepartments();
        fetchAreas();
    }, [fetchMappings, fetchDepartments, fetchAreas]);

    // Fetch employees when department changes
    useEffect(() => {
        const fetchEmployees = async () => {
            if (!formData.department) {
                setEmployees([]);
                return;
            }
            setEmployeesLoading(true);
            try {
                const res = await getEmployees(formData.department);
                setEmployees(Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Error fetching employees:', err);
                setEmployees([]);
            } finally {
                setEmployeesLoading(false);
            }
        };
        fetchEmployees();
    }, [formData.department]);

    // Fetch reporting employees when reporting person department changes
    useEffect(() => {
        const fetchReportingEmployees = async () => {
            if (!formData.reporting_person_department) {
                setReportingEmployees([]);
                return;
            }
            setReportingEmployeesLoading(true);
            try {
                const res = await getEmployees(formData.reporting_person_department);
                setReportingEmployees(Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error('Error fetching reporting employees:', err);
                setReportingEmployees([]);
            } finally {
                setReportingEmployeesLoading(false);
            }
        };
        fetchReportingEmployees();
    }, [formData.reporting_person_department]);

    // Clear reporting person if the selected salesman becomes the reporting person
    useEffect(() => {
        if (formData.employee && formData.reporting_person && String(formData.employee) === String(formData.reporting_person)) {
            setFormData(prev => ({ ...prev, reporting_person: '' }));
        }
    }, [formData.employee]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const filteredMappings = mappings.filter(m =>
        (m.department_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMappings = filteredMappings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);

    const handleEdit = (mapping) => {
        setIsEditing(true);
        setSelectedId(mapping.id);
        setFormData({ area: mapping.area || '', department: mapping.department, employee: mapping.employee, reporting_person_department: mapping.reporting_person_department || '', reporting_person: mapping.reporting_person || '' });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.area) {
            swal('Error', 'Please select an area.', 'error');
            return;
        }
        if (!formData.department) {
            swal('Error', 'Please select a department.', 'error');
            return;
        }
        if (!formData.employee) {
            swal('Error', 'Please select a salesman.', 'error');
            return;
        }

        try {
            if (isEditing) {
                await AreaService.updateSalesmanMapping(selectedId, formData);
                swal('Success!', 'Salesman mapping updated successfully.', 'success');
            } else {
                await AreaService.createSalesmanMapping(formData);
                swal('Success!', 'Salesman mapping created successfully.', 'success');
            }
            setShowModal(false);
            setFormData({ area: '', department: '', employee: '', reporting_person_department: '', reporting_person: '' });
            setSelectedId(null);
            fetchMappings();
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving salesman mapping.';
            if (errData) {
                if (typeof errData === 'string') errorMsg = errData;
                else if (errData.detail) errorMsg = errData.detail;
                else if (errData.message) errorMsg = errData.message;
                else if (errData.employee) errorMsg = errData.employee[0];
                else if (errData.department) errorMsg = errData.department[0];
                else if (errData.non_field_errors) errorMsg = errData.non_field_errors[0];
                else errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
            console.error('API Error:', err.response);
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Mapping?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await AreaService.deleteSalesmanMapping(id);
            swal('Deleted!', 'Mapping has been removed.', 'success');
            fetchMappings();
        } catch (err) {
            swal('Error', 'Could not delete this mapping.', 'error');
            console.error('API Error:', err.response);
        }
    };

    return (
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

            <Card className="w-100 overflow-hidden">
                <Card.Header className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 flex-wrap">
                    <Card.Title className="mb-0 text-nowrap">Salesman Mapping</Card.Title>
                    <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 flex-grow-1 justify-content-md-end">
                        <div className="search-bar-container w-100" style={{ margin: 0, maxWidth: '250px' }}>
                            <span className="search-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search mappings..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                            <CreateButton 
                                module="salesman_mapping" 
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({ area: '', department: '', employee: '', reporting_person_department: '', reporting_person: '' });
                                    setShowModal(true);
                                }}
                                className="d-flex align-items-center justify-content-center btn btn-primary"
                                style={{ height: '38px', borderRadius: '6px', padding: '0 16px', whiteSpace: 'nowrap' }}
                            >
                                Add Mapping
                            </CreateButton>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body style={{ minWidth: 0 }}>
                    <div className="table-responsive w-100">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th><strong>AREA</strong></th>
                                    <th><strong>DEPARTMENT</strong></th>
                                    <th><strong>SALESMAN</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" className="text-center py-4">Loading...</td></tr>
                                ) : filteredMappings.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-4 text-muted">No mappings found.</td></tr>
                                ) : (
                                    currentMappings.map((m) => (
                                        <tr key={m.id}>
                                            <td className="fw-bold">{m.area_name || 'No Area'}</td>
                                            <td className="fw-bold">{m.department_name}</td>
                                            <td className="text-muted">{m.employee_name}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <EditButton
                                                        module="salesman_mapping"
                                                        onClick={() => handleEdit(m)}
                                                        className="sharp btn-xs"
                                                    />
                                                    <DeleteButton
                                                        module="salesman_mapping"
                                                        onClick={() => handleDelete(m.id)}
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
                    {filteredMappings.length > 0 && (
                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredMappings.length)} of {filteredMappings.length} entries
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

            <Modal show={showModal} onHide={() => setShowModal(false)} centered dialogClassName="pkg-custom-modal" backdrop="static">
                <style>{`
                    .pkg-custom-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important; overflow: hidden; }
                    .pkg-custom-modal .modal-header-custom { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 16px 28px; border-bottom: 1px solid #f1f5f9; }
                    .pkg-custom-modal .modal-icon-circle { width: 48px; height: 48px; background-color: #0a500f; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2); }
                    .pkg-custom-modal .modal-close-x { border: none; background: transparent; font-size: 24px; color: #aaa; cursor: pointer; transition: color 0.2s; display: flex; align-items: center; justify-content: center; padding: 4px; }
                    .pkg-custom-modal .modal-close-x:hover { color: #555; }
                    .pkg-custom-modal .modal-body-custom { padding: 24px 28px; max-height: 70vh; overflow-y: auto; }
                    .pkg-custom-modal .modal-footer-custom { display: flex; align-items: center; justify-content: flex-end; padding: 20px 28px 24px 28px; border-top: 1px solid #f1f5f9; background-color: #fafbfc; gap: 12px; }
                    .pkg-custom-modal .form-label-custom { font-size: 13px; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
                    .pkg-custom-modal .form-control-custom { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #334155; background-color: #fff; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; }
                    .pkg-custom-modal .form-control-custom:focus { outline: none; border-color: #0a500f; box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15); }
                    .pkg-custom-modal .btn-close-custom { background-color: #dc3545 !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                    .pkg-custom-modal .btn-save-custom { background-color: #0a500f !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s, transform 0.1s; }
                    .pkg-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                `}</style>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {isEditing ? 'Edit Salesman Mapping' : 'Add Salesman Mapping'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {isEditing ? 'Update mapping details' : 'Enter details to add a new mapping'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <div className="mb-3">
                            <label className="form-label-custom">Area <span className="text-danger">*</span></label>
                            <Form.Select
                                value={formData.area}
                                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                disabled={areasLoading}
                                className="form-control-custom"
                            >
                                <option value="">
                                    {areasLoading ? 'Loading areas...' : (areas.length === 0 ? 'No areas available' : 'Select Area')}
                                </option>
                                {areas.map((area) => (
                                    <option key={area.id} value={area.id}>
                                        {area.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label-custom">Department <span className="text-danger">*</span></label>
                            <Form.Select
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value, employee: '' })}
                                className="form-control-custom"
                            >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label-custom">Salesman <span className="text-danger">*</span></label>
                            <Form.Select
                                value={formData.employee}
                                onChange={(e) => setFormData({ ...formData, employee: e.target.value })}
                                disabled={!formData.department || employeesLoading}
                                className="form-control-custom"
                            >
                                <option value="">
                                    {!formData.department ? 'Select Department First' : (employeesLoading ? 'Loading salesmen...' : 'Select Salesman')}
                                </option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.full_name || emp.user_name || 'Unknown Salesman'}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label-custom">Reporting Person Department <span className="text-danger">*</span></label>
                            <Form.Select
                                value={formData.reporting_person_department}
                                onChange={(e) => setFormData({ ...formData, reporting_person_department: e.target.value, reporting_person: '' })}
                                className="form-control-custom"
                            >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>

                        <div className="mb-3">
                            <label className="form-label-custom">Salesman Reporting Person <span className="text-danger">*</span></label>
                            <Form.Select
                                value={formData.reporting_person}
                                onChange={(e) => setFormData({ ...formData, reporting_person: e.target.value })}
                                disabled={!formData.reporting_person_department || reportingEmployeesLoading}
                                className="form-control-custom"
                            >
                                <option value="">
                                    {!formData.reporting_person_department ? 'Select Department First' : (reportingEmployeesLoading ? 'Loading employees...' : (reportingEmployees.filter(emp => String(emp.id) !== String(formData.employee)).length === 0 ? 'No employees available' : 'Select Reporting Person'))}
                                </option>
                                {reportingEmployees
                                    .filter(emp => String(emp.id) !== String(formData.employee))
                                    .map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.full_name || emp.user_name || 'Unknown Employee'}
                                    </option>
                                ))}
                            </Form.Select>
                        </div>
                    </div>
                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={() => setShowModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom">
                            Save
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SalesmanMapping;
