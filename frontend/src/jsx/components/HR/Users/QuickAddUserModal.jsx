import React, { useState, useEffect } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import axiosInstance from '../../../../services/AxiosInstance';
import {
    getDepartments,
    getDesignations,
    getDepartmentDesignations,
    getRoles,
    createDesignation,
    createDepartmentDesignation
} from '../../../../services/HRManagementService';

const QuickAddUserModal = ({ onSave, onCancel, initialDepartment }) => {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department_id: '',
        designation_id: '',
        role_id: '',
        password: '',
        confirm_password: '',
        is_staff: true,
        is_superuser: false,
    });

    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [departmentDesignations, setDepartmentDesignations] = useState([]);
    const [filteredDesignations, setFilteredDesignations] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showQuickAddDesignationModal, setShowQuickAddDesignationModal] = useState(false);
    const [newDesignationName, setNewDesignationName] = useState('');

    useEffect(() => {
        if (initialDepartment) {
            setFormData(prev => ({ ...prev, department_id: String(initialDepartment) }));
        }
    }, [initialDepartment]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [deptsData, desigData, deptDesigData, rolesData] = await Promise.all([
                    getDepartments(),
                    getDesignations(),
                    getDepartmentDesignations().catch(() => []),
                    getRoles()
                ]);
                setDepartments(deptsData || []);
                setDesignations(desigData || []);
                setDepartmentDesignations(deptDesigData || []);
                setRoles(rolesData || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (formData.department_id) {
            if (departmentDesignations.length > 0) {
                const mappings = departmentDesignations.filter(
                    mapping => mapping.department === parseInt(formData.department_id)
                );
                const mappedDesignationIds = mappings.map(m => m.designation);
                const availableDesignations = designations.filter(d => mappedDesignationIds.includes(d.id));
                setFilteredDesignations(availableDesignations);
            } else {
                const filtered = designations.filter(
                    des => des.department === parseInt(formData.department_id)
                );
                setFilteredDesignations(filtered);
            }
        } else {
            setFilteredDesignations([]);
        }
    }, [formData.department_id, departmentDesignations, designations]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        if (!formData.password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password is required' });
            return false;
        }
        if (formData.password !== formData.confirm_password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Passwords do not match' });
            return false;
        }
        if (formData.password.length < 8) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password must be at least 8 characters long' });
            return false;
        }
        if (!formData.email) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Email is required' });
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);
            const submitData = new FormData();
            if (formData.first_name) submitData.append('first_name', formData.first_name);
            if (formData.last_name) submitData.append('last_name', formData.last_name);
            submitData.append('email', formData.email);
            if (formData.phone) submitData.append('phone', formData.phone);
            if (formData.department_id) submitData.append('department_id', formData.department_id);
            if (formData.designation_id) submitData.append('designation_id', formData.designation_id);
            if (formData.role_id) submitData.append('role_id', formData.role_id);
            if (formData.password) submitData.append('password', formData.password);
            submitData.append('is_staff', formData.is_staff);
            submitData.append('is_superuser', formData.is_superuser);

            const res = await axiosInstance.post('/api/hr/users/', submitData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            onSave(res.data);
        } catch (error) {
            console.error('Error saving user:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.detail || 'Failed to save user',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAddDesignationSubmit = async (e) => {
        e.preventDefault();
        if (!newDesignationName.trim()) return;
        if (!formData.department_id) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a department first before adding a designation.' });
            return;
        }

        try {
            setLoading(true);
            const desigRes = await createDesignation({
                name: newDesignationName,
                title: newDesignationName,
                level: 1,
                company: 1,
                is_active: true
            });
            await createDepartmentDesignation({ department: formData.department_id, designation: desigRes.id });

            const [desigData, deptDesigData] = await Promise.all([
                getDesignations(),
                getDepartmentDesignations().catch(() => [])
            ]);
            setDesignations(desigData || []);
            setDepartmentDesignations(deptDesigData || []);

            setFormData(prev => ({ ...prev, designation_id: String(desigRes.id) }));
            setShowQuickAddDesignationModal(false);
            setNewDesignationName('');
            Swal.fire({ icon: 'success', title: 'Success', text: 'Designation added and mapped to department successfully', timer: 2000 });
        } catch (error) {
            console.error('Error creating designation:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create designation' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Form onSubmit={handleSubmit}>
                <Row>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>First Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required />
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Last Name</Form.Label>
                            <Form.Control type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} />
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="email" name="email" value={formData.email} onChange={handleInputChange} required />
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" name="phone" value={formData.phone} onChange={handleInputChange} required />
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Department <span className="text-danger">*</span></Form.Label>
                            <Form.Select name="department_id" value={formData.department_id} onChange={handleInputChange} required>
                                <option value="">----------</option>
                                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Designation <span className="text-danger">*</span></Form.Label>
                            <div className="d-flex gap-2">
                                <Form.Select name="designation_id" value={formData.designation_id} onChange={handleInputChange} required disabled={!formData.department_id}>
                                    <option value="">----------</option>
                                    {filteredDesignations.map(des => <option key={des.id} value={des.id}>{des.name || des.title}</option>)}
                                </Form.Select>
                                <Button variant="primary" className="px-3 shadow-none" disabled={!formData.department_id} onClick={() => setShowQuickAddDesignationModal(true)} title={!formData.department_id ? "Select Department first" : "Add Designation"}>
                                    <i className="fa fa-plus"></i>
                                </Button>
                            </div>
                        </Form.Group>
                    </Col>
                    <Col md={12} className="mb-3">
                        <Form.Group>
                            <Form.Label>Role <span className="text-danger">*</span></Form.Label>
                            <Form.Select name="role_id" value={formData.role_id} onChange={handleInputChange} required>
                                <option value="">----------</option>
                                {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Password <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="password" name="password" value={formData.password} onChange={handleInputChange} required />
                        </Form.Group>
                    </Col>
                    <Col md={6} className="mb-3">
                        <Form.Group>
                            <Form.Label>Confirm Password <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="password" name="confirm_password" value={formData.confirm_password} onChange={handleInputChange} required />
                        </Form.Group>
                    </Col>
                </Row>
                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save User'}</Button>
                </div>
            </Form>

            {showQuickAddDesignationModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1070 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '400px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <h2 className="m-0" style={{ fontSize: '1.25rem', fontWeight: '700' }}>Quick Add Designation</h2>
                            <button className="btn-close" onClick={() => setShowQuickAddDesignationModal(false)}></button>
                        </div>
                        <Form onSubmit={handleQuickAddDesignationSubmit}>
                            <Form.Group className="mb-3">
                                <Form.Label>Designation Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control type="text" value={newDesignationName} onChange={(e) => setNewDesignationName(e.target.value)} placeholder="Enter designation name" required />
                            </Form.Group>
                            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <Button variant="secondary" onClick={() => setShowQuickAddDesignationModal(false)} disabled={loading}>Cancel</Button>
                                <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
                            </div>
                        </Form>
                    </div>
                </div>
            )}
        </>
    );
};

export default QuickAddUserModal;
