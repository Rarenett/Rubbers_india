import React, { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { Card, Form, Button, Modal, Nav, Tab, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import {
    getBODs,
    getBOD,
    createBOD,
    updateBOD,
    deleteBOD,
    getDepartmentDesignations,
    getRoles,
} from '../../../../services/HRManagementService';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';

import { usePageTitle } from '../../../../context/TitleContext';


const EMPTY_USER = {
    id: null,
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
};

// Resolves a profile picture value into a usable <img> src, whether the
// backend returns a relative path (needs VITE_BACKEND_URL prefixed) or an
// already-absolute URL (e.g. S3/cloud storage — must NOT be prefixed).
const resolveProfilePicUrl = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
        return value;
    }
    const base = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${base}${path}`;
};

const getUserInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
};

const UserAvatar = ({ profilePicture, name, size = 36 }) => {
    const [imgError, setImgError] = useState(false);
    const picUrl = resolveProfilePicUrl(profilePicture);

    useEffect(() => {
        setImgError(false);
    }, [profilePicture]);

    if (picUrl && !imgError) {
        return (
            <img
                src={picUrl}
                alt={name || 'Profile'}
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                }}
                onError={() => {
                    setImgError(true);
                }}
            />
        );
    }

    return (
        <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: '#94a3b8',
                fontSize: `${Math.max(11, Math.round(size * 0.38))}px`,
                fontWeight: '600',
                flexShrink: 0,
                letterSpacing: '0.5px',
                userSelect: 'none'
            }}
            title={name}
        >
            {getUserInitials(name)}
        </div>
    );
};

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    usePageTitle(" Core Team");

    // ── Modal / form state ──────────────────────────────────────────────
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateTrigger, setAnimateTrigger] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [currentUser, setCurrentUser] = useState({ ...EMPTY_USER });
    const [designations, setDesignations] = useState([]);
    const [roles, setRoles] = useState([]);
    const [fetchingUser, setFetchingUser] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    const [previewImage, setPreviewImage] = useState(null);
    const [profilePicFile, setProfilePicFile] = useState(null);
    const [idProofFiles, setIdProofFiles] = useState([]);
    const [existingIdProofs, setExistingIdProofs] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const submitButtonRef = useRef(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getBODs();
            setUsers(data || []);
            setFilteredUsers(data || []);
        } catch (error) {
            console.error('Error fetching User:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch User',
            });
        } finally {
            setLoading(false);
        }
    }, []);

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

    const handleSearch = useCallback(() => {
        if (!searchTerm.trim()) {
            setFilteredUsers(users);
            return;
        }

        const filtered = users.filter(user => {
            const fullName = (user.name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const phone = (user.phone || '').toLowerCase();
            const search = searchTerm.toLowerCase();

            return fullName.includes(search) ||
                email.includes(search) ||
                phone.includes(search);
        });
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    useEffect(() => {
        fetchUsers();
        fetchDesignations();
        fetchRolesList();
    }, [fetchUsers, fetchDesignations, fetchRolesList]);

    useEffect(() => {
        handleSearch();
    }, [searchTerm, users, handleSearch]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showModal) {
                setAnimateTrigger(true);
                setTimeout(() => setAnimateTrigger(false), 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showModal]);

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.user-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal, activeTab]);

    const handleDelete = async (id, userName) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to delete user "${userName}"? This will also delete their employee record.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await deleteBOD(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'User has been deleted.',
                    timer: 2000
                });
                fetchUsers();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete User',
                });
            }
        }
    };

    // ── Modal open / close ──────────────────────────────────────────────
    const handleShowModal = async (user = null) => {
        setActiveTab('personal');
        setProfilePicFile(null);
        setIdProofFiles([]);
        setShowPassword(false);
        setShowConfirmPassword(false);

        if (user) {
            setEditMode(true);
            setShowModal(true);
            setFetchingUser(true);
            try {
                const data = await getBOD(user.id);
                setCurrentUser({
                    ...EMPTY_USER,
                    id: data.id,
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
                setPreviewImage(resolveProfilePicUrl(data.profile_picture));
                setExistingIdProofs(data.id_proofs || []);
            } catch (error) {
                console.error('Error fetching user data:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load user data' });
            } finally {
                setFetchingUser(false);
            }
        } else {
            setEditMode(false);
            setCurrentUser({ ...EMPTY_USER });
            setPreviewImage(null);
            setExistingIdProofs([]);
            setShowModal(true);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrentUser({ ...EMPTY_USER });
        setPreviewImage(null);
        setProfilePicFile(null);
        setIdProofFiles([]);
        setExistingIdProofs([]);
        setActiveTab('personal');
        setEditMode(false);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        setCurrentUser(prev => {
            const newData = {
                ...prev,
                [name]: val
            };
            if (name === 'email' && !editMode) {
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
        if (!currentUser.name) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Name is required' });
            setActiveTab('personal');
            return false;
        }
        if (!currentUser.email) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Email is required' });
            setActiveTab('personal');
            return false;
        }
        if (!editMode && !currentUser.username) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Username is required' });
            setActiveTab('login');
            return false;
        }
        if (!currentUser.role && currentUser.username) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Role is required for login credentials' });
            setActiveTab('login');
            return false;
        }
        if (!editMode && !currentUser.password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password is required' });
            setActiveTab('login');
            return false;
        }
        if (currentUser.password && currentUser.password !== currentUser.confirm_password) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Passwords do not match' });
            setActiveTab('login');
            return false;
        }
        if (currentUser.password) {
            const hasLetter = /[a-zA-Z]/.test(currentUser.password);
            const hasNumber = /[0-9]/.test(currentUser.password);
            const hasSpecialChar = /[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(currentUser.password);
            
            if (currentUser.password.length < 8 || !hasLetter || !hasNumber || !hasSpecialChar) {
                Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Password must be at least 8 characters, include an alphabet, a number, and a special character.' });
                setActiveTab('login');
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setFormLoading(true);
        try {
            const submitData = new FormData();
            submitData.append('name', currentUser.name);
            submitData.append('email', currentUser.email);
            submitData.append('phone', currentUser.phone);
            if (currentUser.designation) submitData.append('designation', currentUser.designation);
            if (currentUser.bank_name) submitData.append('bank_name', currentUser.bank_name);
            if (currentUser.account_name) submitData.append('account_name', currentUser.account_name);
            if (currentUser.account_number) submitData.append('account_number', currentUser.account_number);
            if (currentUser.ifsc_code) submitData.append('ifsc_code', currentUser.ifsc_code);
            if (currentUser.branch_name) submitData.append('branch_name', currentUser.branch_name);
            if (currentUser.pan_number) submitData.append('pan_number', currentUser.pan_number);
            if (currentUser.aadhar_number) submitData.append('aadhar_number', currentUser.aadhar_number);
            submitData.append('is_employee', currentUser.is_employee);
            if (currentUser.username) submitData.append('username', currentUser.username);
            if (currentUser.password) submitData.append('password', currentUser.password);
            if (profilePicFile) submitData.append('profile_picture', profilePicFile);
            idProofFiles.forEach(file => submitData.append('id_proofs', file));
            
            if (currentUser.role) submitData.append('role', currentUser.role);

            if (editMode) {
                await updateBOD(currentUser.id, submitData);
                Swal.fire({ icon: 'success', title: 'Success', text: 'User updated successfully', timer: 2000, showConfirmButton: false });
            } else {
                await createBOD(submitData);
                Swal.fire({ icon: 'success', title: 'Success', text: 'User created successfully', timer: 2000, showConfirmButton: false });
            }
            handleCloseModal();
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            const msg = error.response?.data
                ? Object.values(error.response.data).flat().join(' ')
                : 'Failed to save user member';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setFormLoading(false);
        }
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

    const tabOrder = ['personal', 'bank', 'documents', 'login'];
    const isLastTab = activeTab === 'login';

    const goToNextTab = () => {
        const idx = tabOrder.indexOf(activeTab);
        if (idx < tabOrder.length - 1) {
            setActiveTab(tabOrder[idx + 1]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
                // If it is a combobox (react-select) and menu is open, let it handle Enter to select option
                if (e.target.getAttribute('role') === 'combobox' && e.target.getAttribute('aria-expanded') === 'true') {
                    setTimeout(() => {
                        const form = e.target.closest('form');
                        if (!form) return;
                        
                        const focusableElements = Array.from(
                            form.querySelectorAll('input, select, textarea, button[type="submit"]')
                        ).filter(el => !el.disabled && el.tabIndex !== -1 && el.type !== 'hidden');
                        
                        const index = focusableElements.indexOf(e.target);
                        if (index > -1 && index < focusableElements.length - 1) {
                            focusableElements[index + 1].focus();
                        }
                    }, 50);
                    return;
                }

                if (e.target.type === 'file') {
                    const hasFile = e.target.files.length > 0 || e.target.getAttribute('data-has-file') === 'true';
                    if (!hasFile) {
                        e.preventDefault();
                        e.target.click();
                        return;
                    }
                }

                e.preventDefault();
                const container = e.target.closest('.tab-pane') || e.target.closest('form');
                if (!container) return;
                
                const focusableElements = Array.from(
                    container.querySelectorAll('input, select, textarea, button[type="submit"]')
                ).filter(el => !el.disabled && el.tabIndex !== -1 && el.type !== 'hidden');
                
                const index = focusableElements.indexOf(e.target);
                if (index > -1 && index < focusableElements.length - 1) {
                    focusableElements[index + 1].focus();
                } else if (index === focusableElements.length - 1) {
                    if (container.classList.contains('tab-pane')) {
                        const idx = tabOrder.indexOf(activeTab);
                        if (idx < tabOrder.length - 1) {
                            setActiveTab(tabOrder[idx + 1]);
                            setTimeout(() => {
                                const form = e.target.closest('form');
                                if (!form) return;
                                const newActivePane = form.querySelector('.tab-pane.active');
                                if (newActivePane) {
                                    const nextFocusable = Array.from(
                                        newActivePane.querySelectorAll('input, select, textarea')
                                    ).filter(el => !el.disabled && el.tabIndex !== -1 && el.type !== 'hidden')[0];
                                    if (nextFocusable) nextFocusable.focus();
                                }
                            }, 50);
                        } else {
                            const form = e.target.closest('form');
                            if (form) {
                                const saveBtn = form.querySelector('button[type="submit"]');
                                if (saveBtn) saveBtn.focus();
                            }
                        }
                    }
                }
            }
        }
    };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-lg-12">
          <Card>
              <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <Card.Title className="mb-0"> Core Team</Card.Title>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                    <Form.Control
                      type="text"
                      placeholder="Search User..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                    />
                  </div>
                  <CreateButton
                    module="bod_users"
                    onClick={() => handleShowModal()}
                    className="d-flex align-items-center justify-content-center"
                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                  >
                    Create User
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
                  <div className="table-responsive">
                    <table className="table table-responsive-md">
                      <thead>
                        <tr>
                          <th><strong>SL NO</strong></th>
                          <th><strong>NAME</strong></th>
                          <th><strong>EMAIL</strong></th>
                          <th><strong>PHONE</strong></th>
                          <th><strong>DESIGNATION</strong></th>
                          <th className="text-end"><strong>ACTIONS</strong></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-4 text-muted">
                              No entries
                            </td>
                          </tr>
                        ) : (
                          currentUsers.map((user, index) => (
                            <tr key={user.id}>
                              <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <UserAvatar profilePicture={user.profile_picture} name={user.name} size={36} />
                                  <strong>{user.name}</strong>
                                </div>
                              </td>
                              <td>{user.email}</td>
                              <td>{user.phone || '-'}</td>
                              <td>
                                {user.designation_name || '-'}
                              </td>
                              <td className="text-end">
                                <div className="d-flex justify-content-end">
                                  <EditButton
                                    module="bod_users"
                                    onClick={() => handleShowModal(user)}
                                    className="me-1"
                                  />
                                  <DeleteButton
                                    module="bod_users"
                                    onClick={() => handleDelete(user.id, user.name)}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredUsers.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredUsers.length)} of {filteredUsers.length} entries
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

      {/* ── BOD Create / Edit Modal ─────────────────────────────────────── */}
      <Modal
        show={showModal}
        onHide={handleCloseModal}
        dialogClassName={`user-custom-modal ${animateTrigger ? 'modal-feedback' : ''}`}
        backdrop="static"
        keyboard={false}
        size="lg"
        centered
      >
        <div className="modal-header-custom">
          <div className="d-flex align-items-center gap-3">
            <div className="modal-icon-circle">
              {/* Person Icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9z" fill="white" />
              </svg>
            </div>
            <div>
              <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                {editMode ? 'Edit Core Team Member' : 'Add Core Team Member'}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                Enter details to manage core team member
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-x" onClick={handleCloseModal}>
            &times;
          </button>
        </div>

        <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
          <div className="modal-body-custom">
            {fetchingUser ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <Tab.Container activeKey={activeTab} onSelect={(key) => setActiveTab(key)}>
                <Nav className="user-custom-tabs">
                  <Nav.Item><Nav.Link eventKey="personal">Personal Info</Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="bank">Bank Details</Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="documents">Documents</Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="login">Login Credentials</Nav.Link></Nav.Item>
                </Nav>

                <Tab.Content className="user-tab-content">
                  {/* ── Personal Info Tab ── */}
                  <Tab.Pane eventKey="personal">
                    <Row>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Full Name <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="text"
                          className="form-control-custom"
                          name="name"
                          placeholder="Enter Full Name"
                          value={currentUser.name}
                          onChange={handleInputChange}
                          required
                        />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                          type="email"
                          className="form-control-custom"
                          name="email"
                          placeholder="Enter Email"
                          value={currentUser.email}
                          onChange={handleInputChange}
                          required
                        />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Phone</Form.Label>
                        <Form.Control
                          type="text"
                          className="form-control-custom"
                          name="phone"
                          placeholder="Enter Phone Number"
                          value={currentUser.phone}
                          onChange={handleInputChange}
                        />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Designation</Form.Label>
                        <Select
                          options={designations.map(d => ({ value: d.designation, label: d.designation_name }))}
                          value={
                            currentUser.designation 
                            ? { 
                                value: currentUser.designation, 
                                label: designations.find(d => d.designation === currentUser.designation)?.designation_name || '' 
                              } 
                            : null
                          }
                          onChange={(selected) => setCurrentUser(prev => ({ ...prev, designation: selected ? selected.value : '' }))}
                          isClearable
                          openMenuOnFocus
                          placeholder="Search Designation..."
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              border: state.isFocused ? '1px solid #2ece8a' : '1px solid #cbd5e1',
                              borderRadius: '10px',
                              padding: '2px 4px',
                              boxShadow: state.isFocused ? '0 0 0 1px #2ece8a' : 'none',
                              '&:hover': {
                                borderColor: '#2ece8a'
                              }
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              borderRadius: '8px',
                              overflow: 'hidden',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected || state.isFocused ? '#eaf5ea' : 'white',
                              color: '#3e4954',
                              cursor: 'pointer',
                              '&:active': {
                                backgroundColor: '#d1e8d1'
                              }
                            })
                          }}
                        />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Profile Picture</Form.Label>
                        <Form.Control
                          type="file"
                          className="form-control-custom"
                          accept="image/*"
                          onChange={handleProfilePicChange}
                          data-has-file={previewImage ? 'true' : 'false'}
                        />
                        {previewImage && (
                          <div className="mt-2">
                            <img
                              src={previewImage}
                              alt="Preview"
                              style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #e2e8f0' }}
                            />
                          </div>
                        )}
                      </Col>
                      <Col md={6} className="mb-3 d-flex align-items-center">
                        <Form.Group>
                          <Form.Check
                            type="checkbox"
                            name="is_employee"
                            id="is_employee"
                            label="Is Employee"
                            checked={currentUser.is_employee}
                            onChange={handleInputChange}
                            className="font-w600"
                          />
                          <small className="text-muted">Check if this member is also an employee of the company</small>
                        </Form.Group>
                      </Col>
                    </Row>
                  </Tab.Pane>

                  {/* ── Bank Details Tab ── */}
                  <Tab.Pane eventKey="bank">
                    <Row>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Bank Name</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="bank_name" placeholder="Enter Bank Name" value={currentUser.bank_name} onChange={handleInputChange} />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Account Name</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="account_name" placeholder="Account Holder Name" value={currentUser.account_name} onChange={handleInputChange} />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Account Number</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="account_number" placeholder="Enter Account Number" value={currentUser.account_number} onChange={handleInputChange} />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">IFSC Code</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="ifsc_code" placeholder="Enter IFSC Code" value={currentUser.ifsc_code} onChange={handleInputChange} />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Branch Name</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="branch_name" placeholder="Enter Branch Name" value={currentUser.branch_name} onChange={handleInputChange} />
                      </Col>
                    </Row>
                  </Tab.Pane>

                  {/* ── Documents Tab ── */}
                  <Tab.Pane eventKey="documents">
                    <Row>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">PAN Number</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="pan_number" placeholder="Enter PAN Number" value={currentUser.pan_number} onChange={handleInputChange} />
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Aadhar Number</Form.Label>
                        <Form.Control type="text" className="form-control-custom" name="aadhar_number" placeholder="Enter Aadhar Number" value={currentUser.aadhar_number} onChange={handleInputChange} />
                      </Col>
                      <Col md={12} className="mb-3">
                        <Form.Label className="form-label-custom">
                          ID Proofs <small className="text-muted">(multiple files allowed — click "Choose File" again to add more)</small>
                        </Form.Label>
                        <Form.Control
                          type="file"
                          className="form-control-custom"
                          multiple
                          onChange={handleIdProofChange}
                          data-has-file={idProofFiles.length > 0 || existingIdProofs.length > 0 ? 'true' : 'false'}
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
                      </Col>
                    </Row>
                  </Tab.Pane>

                  {/* ── Login Credentials Tab ── */}
                  <Tab.Pane eventKey="login">
                    <Row>
                      <Col md={6} className="mb-3">
                        <Form.Group>
                          <Form.Label className="form-label-custom">Role <span className="text-danger">*</span></Form.Label>
                          <Form.Select
                            name="role"
                            value={currentUser.role}
                            onChange={handleInputChange}
                            required={!editMode}
                            className="form-control-custom"
                            style={{ height: 'auto', padding: '10px 14px' }}
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
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">Username {!editMode && <span className="text-danger">*</span>}</Form.Label>
                        <Form.Control
                          type="text"
                          className="form-control-custom"
                          name="username"
                          placeholder="Enter Username"
                          value={currentUser.username}
                          onChange={handleInputChange}
                          required={!editMode}
                          disabled={editMode}
                        />
                        {editMode && <small className="text-muted">Username cannot be changed after creation</small>}
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">
                          Password <span className="text-danger">*</span>
                          {editMode && <small className="text-muted ms-1">(leave blank to keep current)</small>}
                        </Form.Label>
                        <div style={{ position: 'relative' }}>
                          <Form.Control
                            type={showPassword ? 'text' : 'password'}
                            className="form-control-custom"
                            name="password"
                            placeholder="Enter Password"
                            value={currentUser.password}
                            onChange={handleInputChange}
                            required={!editMode}
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
                        {currentUser.password && (
                          <div className="mt-2 small">
                            <div className={currentUser.password.length >= 8 ? "text-success" : "text-danger"}>
                              <i className={`fa fa-${currentUser.password.length >= 8 ? 'check' : 'times'} me-1`}></i> Minimum 8 characters
                            </div>
                            <div className={/[a-zA-Z]/.test(currentUser.password) ? "text-success" : "text-danger"}>
                              <i className={`fa fa-${/[a-zA-Z]/.test(currentUser.password) ? 'check' : 'times'} me-1`}></i> At least one alphabet
                            </div>
                            <div className={/[0-9]/.test(currentUser.password) ? "text-success" : "text-danger"}>
                              <i className={`fa fa-${/[0-9]/.test(currentUser.password) ? 'check' : 'times'} me-1`}></i> At least one number
                            </div>
                            <div className={/[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(currentUser.password) ? "text-success" : "text-danger"}>
                              <i className={`fa fa-${/[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/.test(currentUser.password) ? 'check' : 'times'} me-1`}></i> At least one special character
                            </div>
                          </div>
                        )}
                      </Col>
                      <Col md={6} className="mb-3">
                        <Form.Label className="form-label-custom">
                          Confirm Password <span className="text-danger">*</span>
                        </Form.Label>
                        <div style={{ position: 'relative' }}>
                          <Form.Control
                            type={showConfirmPassword ? 'text' : 'password'}
                            className="form-control-custom"
                            name="confirm_password"
                            placeholder="Confirm Password"
                            value={currentUser.confirm_password}
                            onChange={handleInputChange}
                            required={!editMode}
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
                        {currentUser.confirm_password && (
                          <div className={`mt-2 small ${currentUser.password === currentUser.confirm_password ? 'text-success' : 'text-danger'}`}>
                            <i className={`fa fa-${currentUser.password === currentUser.confirm_password ? 'check' : 'times'} me-1`}></i> Passwords {currentUser.password === currentUser.confirm_password ? 'match' : 'do not match'}
                          </div>
                        )}
                      </Col>
                    </Row>
                  </Tab.Pane>
                </Tab.Content>
              </Tab.Container>
            )}
          </div>

          <div className="modal-footer-custom">
            <Button type="button" className="btn-close-custom" onClick={handleCloseModal}>
              Close
            </Button>
            {!isLastTab ? (
              <Button
                type="button"
                className="btn-save-custom"
                onClick={goToNextTab}
              >
                Next
              </Button>
            ) : (
              <Button ref={submitButtonRef} type="submit" className="btn-save-custom" disabled={formLoading}>
                {formLoading ? 'Saving...' : editMode ? 'Update Member' : 'Create Member'}
              </Button>
            )}
          </div>
        </Form>
      </Modal>

      <style>{`
          @keyframes modalFeedback {
              0%, 100% { transform: scale(1); }
              20%, 60% { transform: scale(0.99) translateX(-4px); }
              40%, 80% { transform: scale(1.01) translateX(4px); }
          }
          .modal-feedback {
              animation: modalFeedback 0.25s ease-in-out !important;
          }
          .user-custom-modal .modal-content {
              border-radius: 16px !important;
              border: none !important;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
              overflow: hidden;
          }
          .user-custom-modal .modal-header-custom {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 24px 28px 16px 28px;
              border-bottom: 1px solid #f1f5f9;
          }
          .user-custom-modal .modal-icon-circle {
              width: 48px;
              height: 48px;
              background-color: #2ece8a;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
          }
          .user-custom-modal .modal-close-x {
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
          .user-custom-modal .modal-close-x:hover {
              color: #555;
          }
          .user-custom-modal .modal-body-custom {
              padding: 0;
              max-height: 70vh;
              overflow-y: auto;
          }
          .user-custom-tabs {
              border-bottom: 1px solid #e2e8f0;
              padding: 0 28px;
              background: #fff;
          }
          .user-custom-tabs .nav-link {
              color: #64748b;
              font-weight: 500;
              padding: 16px 20px;
              border: none;
              border-bottom: 2px solid transparent;
              margin-bottom: -1px;
              transition: all 0.2s;
          }
          .user-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
          .user-custom-tabs .nav-link.active {
              color: #2ece8a;
              background: transparent;
              border-bottom-color: #2ece8a;
          }
          .user-tab-content { padding: 24px 28px; }
          .user-custom-modal .modal-footer-custom {
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding: 20px 28px 24px 28px;
              border-top: 1px solid #f1f5f9;
              background-color: #fafbfc;
              gap: 12px;
          }
          .user-custom-modal .form-label-custom {
              font-size: 13px;
              font-weight: 500;
              color: #4a5568;
              margin-bottom: 6px;
              display: block;
          }
          .user-custom-modal .form-control-custom {
              border: 1px solid #cbd5e1;
              border-radius: 10px;
              padding: 10px 14px;
              font-size: 13px;
              color: #334155;
              background-color: #fff;
              transition: border-color 0.2s, box-shadow 0.2s;
              width: 100%;
          }
          .user-custom-modal .form-control-custom:focus {
              outline: none;
              border-color: #2ece8a;
              box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
          }
          .user-custom-modal .form-control-custom::placeholder {
              color: #94a3b8;
          }
          .user-custom-modal .form-check-input:checked {
              background-color: #2ece8a;
              border-color: #2ece8a;
          }
          .user-custom-modal .btn-close-custom {
              background-color: #7A70BA !important;
              color: white !important;
              border-radius: 8px !important;
              font-weight: 500 !important;
              font-size: 14px !important;
              padding: 10px 24px !important;
              border: none !important;
              cursor: pointer;
              transition: background-color 0.2s, transform 0.1s;
          }
          .user-custom-modal .btn-close-custom:hover {
              background-color: #6357a7 !important;
          }
          .user-custom-modal .btn-save-custom {
              background-color: #2ece8a !important;
              color: white !important;
              border-radius: 8px !important;
              font-weight: 500 !important;
              font-size: 14px !important;
              padding: 10px 24px !important;
              border: none !important;
              cursor: pointer;
              transition: background-color 0.2s, transform 0.1s;
          }
          .user-custom-modal .btn-save-custom:hover {
              background-color: #26b277 !important;
          }
      `}</style>
    </div>
  );
};

export default UserList;