import React, { useState, useEffect, useRef } from 'react';
import { Form, Row, Col, Modal, Tab, Nav } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getCandidateById,
    createCandidate,
    updateCandidate,
    getDepartments,
    getDesignations,
} from '../../../../services/HRManagementService';

const EMPTY_FORM = {
    first_name: '',
    last_name: '',
    gender: '',
    blood_group: '',
    date_of_birth: '',
    email: '',
    mobile_number: '',
    address: '',
    photo: null,
    position_applied: '',
    department_applied: '',
    expected_salary: '',
    notice_period: '',
    experience_years: '',
    qualification: '',
    skills: '',
    resume: null,
};

const GENDER_OPTIONS = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = [
    'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'
].map(b => ({ value: b, label: b }));

const QUALIFICATION_OPTIONS = [
    'High School', 'Diploma', 'B.Tech', 'M.Tech', 'B.Sc', 'M.Sc',
    'B.Com', 'M.Com', 'B.A', 'M.A', 'BBA', 'MBA', 'PhD', 'Other'
].map(q => ({ value: q, label: q }));

const CandidateFormModal = ({ show, onHide, onSave, editId }) => {
    const isEdit = Boolean(editId);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [activeTab, setActiveTab] = useState('basic');
    const [errors, setErrors] = useState({});

    const submitBtnRef = useRef(null);
    const currentSelectControlRef = useRef(null);
    const lastEnterRef = useRef(0);
    const fileJustUploadedRef = useRef(false);

    // ── react-select styles ───────────────────────────────────────────────
    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '42px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
            borderRadius: '10px',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#fff',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '13px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? '#f0fdf4' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
        }),
        placeholder: base => ({ ...base, color: '#94a3b8' }),
    };

    // ── Keyboard navigation ────────────────────────────────────────────────
    const getFocusable = () => {
        const modal = document.querySelector('.item-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control, .react-select__control, button[type="button"].btn-save-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1) {
            submitBtnRef.current?.click();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const tag = activeEl.tagName.toLowerCase();

        // react-select fields are handled by handleSelectKeyDown — don't double-navigate
        if (activeEl.closest?.('.react-select__control')) return;

        // Let non-save-custom buttons pass through normally
        if (tag === 'button' && activeEl.type !== 'submit' && !activeEl.classList.contains('btn-save-custom')) return;

        if (tag === 'textarea') {
            // Single Enter = new line; double Enter (within 500ms) = navigate next
            const now = Date.now();
            const timeSinceLast = now - lastEnterRef.current;
            lastEnterRef.current = now;
            if (timeSinceLast > 500) {
                // first press — allow default new-line
                return;
            }
            // second press — prevent new-line and navigate
            e.preventDefault();
        } else if (activeEl.type === 'file') {
            // If a file was just selected, navigate to next
            if (fileJustUploadedRef.current) {
                fileJustUploadedRef.current = false;
                e.preventDefault();
                navigateToNext(activeEl);
            } else {
                // Open file picker on first Enter
                e.preventDefault();
                activeEl.click();
            }
            return;
        }

        e.preventDefault();
        navigateToNext(activeEl);
    };

    const navigateToNext = (fromEl) => {
        const all = getFocusable();
        const index = all.indexOf(fromEl);
        if (index > -1 && index < all.length - 1) {
            const next = all[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        } else if (index === all.length - 1) {
            submitBtnRef.current?.click();
        }
    };

    const handleSelectFocus = (e) => {
        currentSelectControlRef.current = e.target.closest('.react-select__control');
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (!menuOpen) {
                e.preventDefault();
                const control = e.target.closest('.react-select__control');
                if (control) focusNextFromControl(control);
            }
        }
    };

    const handleFocus = (e) => {
        if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) {
            e.target.select();
        }
    };

    // Auto-focus first input when modal opens or tab changes
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.item-custom-modal .form-control')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden' && !el.disabled);
                if (inputs.length > 0) inputs[0].focus();
            }, 120);
            return () => clearTimeout(timer);
        }
    }, [show, activeTab]);

    // ── Fetch dropdown data ──────────────────────────────────────────
    useEffect(() => {
        const loadDepartments = async () => {
            try {
                const deptData = await getDepartments();
                setDepartments(deptData);
            } catch (err) {
                console.error('Failed to load departments', err);
            }
        };
        loadDepartments();
    }, []);

    // Fetch designations when department changes
    useEffect(() => {
        const loadDesignations = async () => {
            try {
                if (formData.department_applied) {
                    const desigData = await getDesignations(formData.department_applied);
                    setDesignations(desigData);
                } else {
                    setDesignations([]);
                }
            } catch (err) {
                console.error('Failed to load designations', err);
            }
        };
        loadDesignations();
    }, [formData.department_applied]);

    // ── Reset / populate form when modal opens ────────────────────────────
    useEffect(() => {
        if (show) {
            setActiveTab('basic');
            if (isEdit) {
                fetchCandidate();
            } else {
                setFormData({ ...EMPTY_FORM });
                setPhotoPreview(null);
            }
        }
    }, [show, editId]);

    const fetchCandidate = async () => {
        try {
            setLoading(true);
            const data = await getCandidateById(editId);
            setFormData({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                gender: data.gender || '',
                date_of_birth: data.date_of_birth || '',
                email: data.email || '',
                mobile_number: data.mobile_number || '',
                address: data.address || '',
                photo: null,
                position_applied: data.position_applied || '',
                department_applied: data.department_applied || '',
                expected_salary: data.expected_salary || '',
                notice_period: data.notice_period || '',
                experience_years: data.experience_years || '',
                qualification: data.qualification || '',
                skills: data.skills || '',
                resume: null,
            });
            setPhotoPreview(data.photo_url || null);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch candidate details' });
            onHide();
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'resume') {
            setFormData(prev => ({ ...prev, resume: files[0] }));
            // Mark that file was uploaded so next Enter navigates
            if (files[0]) fileJustUploadedRef.current = true;
        } else if (name === 'photo') {
            const file = files[0];
            setFormData(prev => ({ ...prev, photo: file }));
            if (file) {
                setPhotoPreview(URL.createObjectURL(file));
                fileJustUploadedRef.current = true;
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            
            // Live validation for email and mobile
            if (name === 'mobile_number') {
                if (value && !/^\d{0,10}$/.test(value)) {
                    // Prevent typing non-digits or more than 10 digits if desired, 
                    // but we'll just show error if not exactly 10 digits.
                }
                if (value && !/^\d{10}$/.test(value)) {
                    setErrors(prev => ({ ...prev, mobile_number: 'Mobile number must be 10 digits' }));
                } else {
                    setErrors(prev => { const e = {...prev}; delete e.mobile_number; return e; });
                }
            } else if (name === 'email') {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    setErrors(prev => ({ ...prev, email: 'Enter a valid email address' }));
                } else {
                    setErrors(prev => { const e = {...prev}; delete e.email; return e; });
                }
            }
        }
    };

    // react-select change handlers
    const handleGenderChange = (opt) => {
        setFormData(prev => ({ ...prev, gender: opt ? opt.value : '' }));
        if (opt) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleBloodGroupChange = (opt) => {
        setFormData(prev => ({ ...prev, blood_group: opt ? opt.value : '' }));
        if (opt) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handlePositionChange = (opt) => {
        setFormData(prev => ({ ...prev, position_applied: opt ? opt.value : '' }));
        if (opt) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleDepartmentChange = (opt) => {
        setFormData(prev => ({ 
            ...prev, 
            department_applied: opt ? opt.value : '',
            position_applied: '' 
        }));
        if (opt) {
            const control = currentSelectControlRef.current;
            setTimeout(() => { if (control) focusNextFromControl(control); }, 50);
        }
    };

    const handleNextTab = () => {
        setActiveTab('recruitment');
        // After tab switch renders, focus first react-select in the active (recruitment) pane
        setTimeout(() => {
            // Target only the visible/active tab pane to avoid focusing hidden elements
            const activePane = document.querySelector(
                '.item-custom-modal .tab-pane.active.show, .item-custom-modal .tab-pane.show'
            );
            const target = activePane || document.querySelector('.item-custom-modal');
            if (!target) return;
            const firstSelect = target.querySelector('.react-select__control');
            if (firstSelect) firstSelect.querySelector('input')?.focus();
        }, 150);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (Object.keys(errors).length > 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please fix the errors before submitting.' });
            return;
        }

        if (activeTab === 'basic') {
            handleNextTab();
            return;
        }

        // Validate all required fields
        const requiredFields = [
            'first_name', 'last_name', 'gender', 'date_of_birth', 'email', 'mobile_number', 'address',
            'department_applied', 'position_applied', 'expected_salary', 'notice_period', 
            'experience_years', 'qualification', 'skills'
        ];
        
        const missingFields = requiredFields.filter(field => !formData[field]);
        if (!isEdit && !formData.photo) missingFields.push('photo');
        if (!isEdit && !formData.resume) missingFields.push('resume');

        if (missingFields.length > 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please fill all required fields.' });
            return;
        }

        try {
            setLoading(true);
            if (isEdit) {
                await updateCandidate(editId, formData);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Candidate updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createCandidate(formData);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Candidate created successfully', timer: 2000, showConfirmButton: false });
            }
            if (onSave) onSave();
            onHide();
        } catch (error) {
            const msg = error.response?.data
                ? Object.values(error.response.data).flat().join(' ')
                : `Failed to ${isEdit ? 'update' : 'create'} candidate`;
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    // ── Derived option lists ──────────────────────────────────────────────
    const designationOptions = designations.map(d => ({ value: d.id, label: d.name }));
    const departmentOptions  = departments.map(d => ({ value: d.id, label: d.name }));

    const genderValue     = GENDER_OPTIONS.find(o => o.value === formData.gender) || null;
    const bloodGroupValue = BLOOD_GROUP_OPTIONS.find(o => o.value === formData.blood_group) || null;
    const positionValue   = designationOptions.find(o => o.value === Number(formData.position_applied)) || null;
    const departmentValue = departmentOptions.find(o => o.value === Number(formData.department_applied)) || null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            size="lg"
            dialogClassName="cfm-modal item-custom-modal"
            backdrop="static"
            keyboard={false}
        >
            <style>{`
                .cfm-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .cfm-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .cfm-modal .modal-close-x {
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
                .cfm-modal .modal-close-x:hover { color: #555; }
                .cfm-modal .modal-body-custom { padding: 0; }
                .cfm-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .cfm-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .cfm-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .cfm-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .cfm-modal .btn-save-custom:hover { background-color: #073d0b !important; }
                .cfm-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 28px;
                    background: #fff;
                }
                .cfm-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    padding: 16px 20px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                }
                .cfm-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .cfm-custom-tabs .nav-link.active {
                    color: #0a500f;
                    background: transparent;
                    border-bottom-color: #0a500f;
                }
                .cfm-tab-content { padding: 24px 28px; }
            `}</style>
            {/* Custom Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <i className="fa fa-user" style={{ fontSize: '20px', color: '#fff' }}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {isEdit ? 'Edit Candidate' : 'Add New Candidate'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {isEdit ? 'Update candidate information below.' : 'Fill in candidate details to create a new profile.'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus} noValidate>
                <div className="modal-body-custom">
                    <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>

                        {/* Tabs Navigation */}
                        <Nav className="cfm-custom-tabs">
                            <Nav.Item>
                                <Nav.Link eventKey="basic">
                                    <i className="fa fa-user me-2"></i>Basic Details
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="recruitment">
                                    <i className="fa fa-briefcase me-2"></i>Recruitment Details
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>

                        <Tab.Content className="cfm-tab-content">

                            {/* ── Tab 1: Basic Details ── */}
                            <Tab.Pane eventKey="basic">
                                <Row>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                First Name <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="first_name"
                                                className="form-control"
                                                value={formData.first_name}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter first name"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Last Name <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="last_name"
                                                className="form-control"
                                                value={formData.last_name}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter last name"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Gender <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isClearable
                                                options={GENDER_OPTIONS}
                                                value={genderValue}
                                                onChange={handleGenderChange}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus
                                                placeholder="Select gender"
                                                styles={selectStyles}
                                            />
                                            {/* Hidden input to enforce HTML validation */}
                                            <input
                                                type="text"
                                                value={formData.gender}
                                                required
                                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                onChange={() => {}}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Date of Birth <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="date_of_birth"
                                                className="form-control"
                                                value={formData.date_of_birth}
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Mobile Number <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="mobile_number"
                                                className={`form-control ${errors.mobile_number ? 'is-invalid' : ''}`}
                                                value={formData.mobile_number}
                                                onChange={handleChange}
                                                placeholder="Enter mobile number"
                                                required
                                                maxLength="10"
                                                pattern="\d{10}"
                                                title="Mobile number must be exactly 10 digits"
                                            />
                                            {errors.mobile_number && <div className="invalid-feedback">{errors.mobile_number}</div>}
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Blood Group
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isClearable
                                                options={BLOOD_GROUP_OPTIONS}
                                                value={bloodGroupValue}
                                                onChange={handleBloodGroupChange}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus
                                                placeholder="Select blood group"
                                                styles={selectStyles}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Email <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                placeholder="Enter email address"
                                            />
                                            {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Photo {!isEdit && <span className="text-danger">*</span>}
                                            </Form.Label>
                                            <div className="d-flex align-items-center gap-3">
                                                {photoPreview && (
                                                    <img
                                                        src={photoPreview}
                                                        alt="Preview"
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 }}
                                                    />
                                                )}
                                                <Form.Control
                                                    type="file"
                                                    name="photo"
                                                    className="form-control"
                                                    onChange={handleChange}
                                                    accept="image/*"
                                                    required={!isEdit}
                                                />
                                            </div>
                                        </Form.Group>
                                    </Col>
                                    <Col lg={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Address <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="address"
                                                className="form-control"
                                                value={formData.address}
                                                onChange={handleChange}
                                                placeholder="Enter address"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Tab.Pane>

                            {/* ── Tab 2: Recruitment Details ── */}
                            <Tab.Pane eventKey="recruitment">
                                <Row>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Department Applied <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isClearable
                                                options={departmentOptions}
                                                value={departmentValue}
                                                onChange={handleDepartmentChange}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus
                                                placeholder="Select department..."
                                                styles={selectStyles}
                                            />
                                            <input
                                                type="text"
                                                value={formData.department_applied}
                                                required
                                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                onChange={() => {}}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Position Applied (Designation) <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isClearable
                                                options={designationOptions}
                                                value={positionValue}
                                                onChange={handlePositionChange}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus
                                                placeholder={formData.department_applied ? "Select designation..." : "Select department first"}
                                                isDisabled={!formData.department_applied}
                                                styles={selectStyles}
                                            />
                                            <input
                                                type="text"
                                                value={formData.position_applied}
                                                required
                                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                onChange={() => {}}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Expected Salary <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="expected_salary"
                                                className="form-control"
                                                value={formData.expected_salary}
                                                onChange={handleChange}
                                                placeholder="e.g. 50000"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Notice Period <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="notice_period"
                                                className="form-control"
                                                value={formData.notice_period}
                                                onChange={handleChange}
                                                placeholder="e.g. 30 days"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Experience (Years) <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.1"
                                                name="experience_years"
                                                className="form-control"
                                                value={formData.experience_years}
                                                onChange={handleChange}
                                                placeholder="e.g. 3.5"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Qualification <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                isClearable
                                                options={QUALIFICATION_OPTIONS}
                                                value={QUALIFICATION_OPTIONS.find(o => o.value === formData.qualification) || null}
                                                onChange={(opt) => setFormData(prev => ({ ...prev, qualification: opt ? opt.value : '' }))}
                                                onFocus={handleSelectFocus}
                                                onKeyDown={handleSelectKeyDown}
                                                openMenuOnFocus
                                                placeholder="Select qualification"
                                                styles={selectStyles}
                                            />
                                            {/* Hidden input to enforce HTML validation */}
                                            <input
                                                type="text"
                                                value={formData.qualification}
                                                required
                                                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                onChange={() => {}}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col lg={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Resume {!isEdit && <span className="text-danger">*</span>}
                                            </Form.Label>
                                            <Form.Control
                                                type="file"
                                                name="resume"
                                                className="form-control"
                                                onChange={handleChange}
                                                accept=".pdf,.doc,.docx"
                                                required={!isEdit}
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                                                Accepted: PDF, DOC, DOCX
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                    <Col lg={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="form-label font-w600">
                                                Skills <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="skills"
                                                className="form-control"
                                                value={formData.skills}
                                                onChange={handleChange}
                                                placeholder="Enter skills (comma-separated)"
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Tab.Pane>

                        </Tab.Content>
                    </Tab.Container>
                </div>

                {/* Modal Footer */}
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={onHide}>
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="btn-save-custom" 
                        disabled={loading} 
                        ref={submitBtnRef}
                    >
                        {loading ? (
                            <><span className="spinner-border spinner-border-sm me-2"></span>{isEdit && activeTab !== 'basic' ? 'Updating...' : 'Saving...'}</>
                        ) : (
                            <>{activeTab === 'basic' ? 'Save & Next' : (isEdit ? 'Update' : 'Save')}</>
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default CandidateFormModal;
