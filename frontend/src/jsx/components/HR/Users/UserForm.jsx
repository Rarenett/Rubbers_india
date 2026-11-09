import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getDepartmentDesignations,
    createBOD,
    updateBOD,
    getBOD,
    getRoles,
} from '../../../../services/HRManagementService';

const UserForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        designation: '',
        bank_name: '',
        account_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        pan_number: '',
        aadhar_number: '',
        username: '',
        password: '',
        confirm_password: '',
        is_employee: false,
        role: '',
    });

    const [designations, setDesignations] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [profilePicFile, setProfilePicFile] = useState(null);
    const [idProofFiles, setIdProofFiles] = useState([]);
    const [existingIdProofs, setExistingIdProofs] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Fetch designations under BOD department
    const fetchDesignations = useCallback(async () => {
        try {
            const data = await getDepartmentDesignations({ department__name: 'BOD' });
            setDesignations(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Error fetching designations:', error);
        }
    }, []);

    const fetchRolesList = useCallback(async () => {
        try {
            const data = await getRoles();
            setRoles(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    }, []);

    // Fetch existing BOD data in edit mode
    const fetchBODData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getBOD(id);
            setFormData({
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                designation: data.designation || '',
                bank_name: data.bank_name || '',
                account_name: data.account_name || '',
                account_number: data.account_number || '',
                ifsc_code: data.ifsc_code || '',
                branch_name: data.branch_name || '',
                pan_number: data.pan_number || '',
                aadhar_number: data.aadhar_number || '',
                username: data.username || '',
                password: '',
                confirm_password: '',
                is_employee: data.is_employee || false,
                role: data.role || '',
            });
            if (data.profile_picture) {
                setPreviewImage(`${import.meta.env.VITE_BACKEND_URL}${data.profile_picture}`);
            }
            if (data.id_proofs) {
                setExistingIdProofs(data.id_proofs);
            }
        } catch (error) {
            console.error('Error fetching BOD data:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load BOD data' });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDesignations();
        fetchRolesList();
    }, [fetchDesignations, fetchRolesList]);

    useEffect(() => {
        if (id) fetchBODData();
    }, [id, fetchBODData]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: val
            };
            if (name === 'email' && !isEditMode) {
                newData.username = val;
            }
            return newData;
        });
    };

    const handleProfilePicChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfilePicFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleIdProofChange = (e) => {
        const files = Array.from(e.target.files);
        setIdProofFiles(prev => [...prev, ...files]);
        e.target.value = ''; // reset input so same file can be re-added if needed
    };

    const removeNewIdProof = (index) => {
        setIdProofFiles(prev => prev.filter((_, i) => i !== index));
    };

    const validate = () => {
        if (!formData.name) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Name is required' });
            return false;
        }
        if (!formData.email) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Email is required' });
            return false;
        }
        if (!isEditMode && !formData.username) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Username is required' });
            return false;
        }
        if (!isEditMode && !formData.password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password is required' });
            return false;
        }
        if (!formData.role && formData.username) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Role is required for login credentials' });
            return false;
        }
        if (formData.password && formData.password !== formData.confirm_password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Passwords do not match' });
            return false;
        }
        if (formData.password) {
            const hasLetter = /[a-zA-Z]/.test(formData.password);
            const hasNumber = /[0-9]/.test(formData.password);
            const hasSpecialChar = /[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(formData.password);
            
            if (formData.password.length < 8 || !hasLetter || !hasNumber || !hasSpecialChar) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password must be at least 8 characters, include an alphabet, a number, and a special character.' });
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('email', formData.email);
            submitData.append('phone', formData.phone);
            if (formData.designation) submitData.append('designation', formData.designation);
            if (formData.bank_name) submitData.append('bank_name', formData.bank_name);
            if (formData.account_name) submitData.append('account_name', formData.account_name);
            if (formData.account_number) submitData.append('account_number', formData.account_number);
            if (formData.ifsc_code) submitData.append('ifsc_code', formData.ifsc_code);
            if (formData.branch_name) submitData.append('branch_name', formData.branch_name);
            if (formData.pan_number) submitData.append('pan_number', formData.pan_number);
            if (formData.aadhar_number) submitData.append('aadhar_number', formData.aadhar_number);
            submitData.append('is_employee', formData.is_employee);
            if (formData.username) submitData.append('username', formData.username);
            if (formData.password) submitData.append('password', formData.password);
            if (profilePicFile) submitData.append('profile_picture', profilePicFile);
            idProofFiles.forEach(file => submitData.append('id_proofs', file));
            
            if (formData.role) submitData.append('role', formData.role);

            if (isEditMode) {
                await updateBOD(id, submitData);
                Swal.fire({ icon: 'success', title: 'Success', text: 'BOD member updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createBOD(submitData);
                Swal.fire({ icon: 'success', title: 'Success', text: 'BOD member created successfully', timer: 2000, showConfirmButton: false });
            }
            navigate('/hr/users');
        } catch (error) {
            console.error('Error saving BOD:', error);
            const msg = error.response?.data
                ? Object.values(error.response.data).flat().join(' ')
                : 'Failed to save BOD member';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const SectionHeader = ({ icon, title }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', marginTop: '10px', borderBottom: '2px solid #f0f0f0', paddingBottom: '10px' }}>
            <i className={`fa ${icon}`} style={{ color: '#6c63ff', fontSize: '16px' }}></i>
            <h6 style={{ margin: 0, fontWeight: 700, color: '#374151', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h6>
        </div>
    );

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header>
                            <h4 className="card-title">
                                {isEditMode ? 'Edit BOD Member' : 'Add Core Team Member'}
                            </h4>
                        </Card.Header>
                        <Card.Body>
                            {loading && isEditMode ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <Form onSubmit={handleSubmit}>

                                    {/* ─── Personal Info ─── */}
                                    <SectionHeader icon="fa-user" title="Personal Information" />
                                    <Row>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Full Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="name"
                                                    placeholder="Enter Full Name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    name="email"
                                                    placeholder="Enter Email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Phone</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="phone"
                                                    placeholder="Enter Phone Number"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Designation (BOD)</Form.Label>
                                                <Form.Select
                                                    name="designation"
                                                    value={formData.designation}
                                                    onChange={handleInputChange}
                                                >
                                                    <option value="">— Select Designation —</option>
                                                    {designations.map(d => (
                                                        <option key={d.id} value={d.designation}>
                                                            {d.designation_name}
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Profile Picture</Form.Label>
                                                <Form.Control
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleProfilePicChange}
                                                />
                                                {previewImage && (
                                                    <div className="mt-2">
                                                        <img
                                                            src={previewImage}
                                                            alt="Preview"
                                                            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #e2e8f0' }}
                                                        />
                                                    </div>
                                                )}
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3 d-flex align-items-center">
                                            <Form.Group>
                                                <Form.Check
                                                    type="checkbox"
                                                    name="is_employee"
                                                    id="is_employee"
                                                    label="Is Employee"
                                                    checked={formData.is_employee}
                                                    onChange={handleInputChange}
                                                    className="font-w600"
                                                />
                                                <small className="text-muted">Check if this BOD member is also an employee of the company</small>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    {/* ─── Bank Details ─── */}
                                    <SectionHeader icon="fa-university" title="Bank Details" />
                                    <Row>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Bank Name</Form.Label>
                                                <Form.Control type="text" name="bank_name" placeholder="Enter Bank Name" value={formData.bank_name} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Account Name</Form.Label>
                                                <Form.Control type="text" name="account_name" placeholder="Account Holder Name" value={formData.account_name} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Account Number</Form.Label>
                                                <Form.Control type="text" name="account_number" placeholder="Enter Account Number" value={formData.account_number} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>IFSC Code</Form.Label>
                                                <Form.Control type="text" name="ifsc_code" placeholder="Enter IFSC Code" value={formData.ifsc_code} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Branch Name</Form.Label>
                                                <Form.Control type="text" name="branch_name" placeholder="Enter Branch Name" value={formData.branch_name} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    {/* ─── Identity & Documents ─── */}
                                    <SectionHeader icon="fa-id-card" title="Identity & Documents" />
                                    <Row>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>PAN Number</Form.Label>
                                                <Form.Control type="text" name="pan_number" placeholder="Enter PAN Number" value={formData.pan_number} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Aadhar Number</Form.Label>
                                                <Form.Control type="text" name="aadhar_number" placeholder="Enter Aadhar Number" value={formData.aadhar_number} onChange={handleInputChange} />
                                            </Form.Group>
                                        </Col>
                                        <Col md={12} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>ID Proofs <small className="text-muted">(multiple files allowed — click "Choose File" again to add more)</small></Form.Label>
                                                <Form.Control
                                                    type="file"
                                                    multiple
                                                    onChange={handleIdProofChange}
                                                />
                                                {idProofFiles.length > 0 && (
                                                    <div className="mt-2 d-flex flex-wrap gap-2">
                                                        {idProofFiles.map((file, i) => (
                                                            <Badge
                                                                key={i}
                                                                bg="light"
                                                                text="dark"
                                                                style={{ padding: '6px 10px', border: '1px solid #e2e8f0', fontSize: '12px', cursor: 'pointer' }}
                                                                onClick={() => removeNewIdProof(i)}
                                                                title="Click to remove"
                                                            >
                                                                <i className="fa fa-file me-1 text-primary"></i>
                                                                {file.name}
                                                                <i className="fa fa-times ms-2 text-danger"></i>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                {existingIdProofs.length > 0 && (
                                                    <div className="mt-2">
                                                        <small className="text-muted d-block mb-1">Previously uploaded:</small>
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {existingIdProofs.map(proof => (
                                                                <a
                                                                    key={proof.id}
                                                                    href={`${import.meta.env.VITE_BACKEND_URL}${proof.file}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    style={{ fontSize: '12px', textDecoration: 'none' }}
                                                                >
                                                                    <Badge bg="info" style={{ padding: '6px 10px' }}>
                                                                        <i className="fa fa-file me-1"></i>
                                                                        Proof #{proof.id}
                                                                    </Badge>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <SectionHeader icon="fa-lock" title="Login Credentials" />
                                    <Row>
                                        <Col md={12} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Role <span className="text-danger">*</span></Form.Label>
                                                <Form.Select
                                                    name="role"
                                                    value={formData.role}
                                                    onChange={handleInputChange}
                                                    required={!isEditMode}
                                                >
                                                    <option value="">— Select Role —</option>
                                                    {roles.map(r => (
                                                        <option key={r.id} value={r.name}>
                                                            {r.name}
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={12} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>Username {!isEditMode && <span className="text-danger">*</span>}</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="username"
                                                    placeholder="Enter Username"
                                                    value={formData.username}
                                                    onChange={handleInputChange}
                                                    required={!isEditMode}
                                                    disabled={isEditMode}
                                                />
                                                {isEditMode && <small className="text-muted">Username cannot be changed after creation</small>}
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>
                                                    Password <span className="text-danger">*</span>
                                                    {isEditMode && <small className="text-muted ms-1">(leave blank to keep current)</small>}
                                                </Form.Label>
                                                <div style={{ position: 'relative' }}>
                                                    <Form.Control
                                                        type={showPassword ? 'text' : 'password'}
                                                        name="password"
                                                        placeholder="Enter Password"
                                                        value={formData.password}
                                                        onChange={handleInputChange}
                                                        required={!isEditMode}
                                                        style={{ paddingRight: '42px' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer' }}
                                                    >
                                                        <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                    </button>
                                                </div>
                                                {formData.password && (
                                                    <div className="mt-2 small">
                                                        <div className={formData.password.length >= 8 ? "text-success" : "text-danger"}>
                                                            <i className={`fa fa-${formData.password.length >= 8 ? 'check' : 'times'} me-1`}></i> Minimum 8 characters
                                                        </div>
                                                        <div className={/[a-zA-Z]/.test(formData.password) ? "text-success" : "text-danger"}>
                                                            <i className={`fa fa-${/[a-zA-Z]/.test(formData.password) ? 'check' : 'times'} me-1`}></i> At least one alphabet
                                                        </div>
                                                        <div className={/[0-9]/.test(formData.password) ? "text-success" : "text-danger"}>
                                                            <i className={`fa fa-${/[0-9]/.test(formData.password) ? 'check' : 'times'} me-1`}></i> At least one number
                                                        </div>
                                                        <div className={/[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(formData.password) ? "text-success" : "text-danger"}>
                                                            <i className={`fa fa-${/[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(formData.password) ? 'check' : 'times'} me-1`}></i> At least one special character
                                                        </div>
                                                    </div>
                                                )}
                                            </Form.Group>
                                        </Col>
                                        <Col md={6} className="mb-3">
                                            <Form.Group>
                                                <Form.Label>
                                                    Confirm Password <span className="text-danger">*</span>
                                                </Form.Label>
                                                <div style={{ position: 'relative' }}>
                                                    <Form.Control
                                                        type={showConfirmPassword ? 'text' : 'password'}
                                                        name="confirm_password"
                                                        placeholder="Confirm Password"
                                                        value={formData.confirm_password}
                                                        onChange={handleInputChange}
                                                        required={!isEditMode}
                                                        style={{ paddingRight: '42px' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer' }}
                                                    >
                                                        <i className={`fa ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                    </button>
                                                </div>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    {/* ─── Actions ─── */}
                                    <div className="d-flex gap-2 mt-4">
                                        <Button type="submit" variant="primary" disabled={loading}>
                                            <i className="fa fa-save me-2"></i>
                                            {loading ? 'Saving...' : isEditMode ? 'Update BOD Member' : 'Save'}
                                        </Button>
                                        <Button variant="light" onClick={() => navigate('/hr/users')} disabled={loading}>
                                            <i className="fa fa-times me-2"></i>
                                            Cancel
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default UserForm;