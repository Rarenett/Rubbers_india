import React, { useState, useEffect, useRef, Fragment, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import {
    getAccountGroups,
    createAccountGroup,
    updateAccountGroup,
    deleteAccountGroup,
    downloadAccountGroupTemplate,
    importAccountGroupsExcel
} from '../../../services/FinanceService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const AccountGroupList = () => {
    const nameInputRef = useRef(null);
    const [accountGroups, setAccountGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();

    const fileInputRef = useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await downloadAccountGroupTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'AccountGroup_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download template' });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            const data = await importAccountGroupsExcel(formData);
            if (data.errors && data.errors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Import Completed with Errors',
                    html: `Added: <strong>${data.added}</strong><br>Updated: <strong>${data.updated}</strong><br><br><div style="max-height: 150px; overflow-y: auto; text-align: left; font-size: 13px; color: #d33; background: #fff3f3; padding: 10px; border-radius: 5px; border: 1px solid #ffcaca;">${data.errors.join('<br>')}</div>`,
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Import Successful',
                    text: `Added: ${data.added}, Updated: ${data.updated}`,
                });
            }
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to import account groups';
            if (error.response && error.response.data && error.response.data.detail) {
                errorMsg = error.response.data.detail;
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);

    const defaultGroup = { 
        id: null, 
        name: '', 
        parent: '', 
        nature: 'Asset', 
        sort_order: 0, 
        is_main_head: false 
    };
    const [currentGroup, setCurrentGroup] = useState(defaultGroup);

    const natureChoices = ['Asset', 'Liability', 'Income', 'Expense'];

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getAccountGroups();
            setAccountGroups(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch account groups',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (group = null) => {
        if (group) {
            setCurrentGroup({
                id: group.id,
                name: group.name,
                parent: group.parent || '',
                nature: group.nature,
                sort_order: group.sort_order,
                is_main_head: group.is_main_head
            });
            setEditMode(true);
        } else {
            setCurrentGroup(defaultGroup);
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleKeyDown = (e) => {
        const target = e.target;
        const tagName = target.tagName.toLowerCase();
        const type = target.type ? target.type.toLowerCase() : '';

        if (e.key !== 'Enter') {
            if (tagName === 'select') {
                delete target.dataset.pickerOpen;
            }
            return;
        }
        
        // Allow default behavior for textareas and submit buttons
        if (tagName === 'textarea' || type === 'submit') {
            return;
        }
        
        e.preventDefault();
        
        // Check if the current element is a select dropdown and is NOT marked as open
        if (tagName === 'select' && target.dataset.pickerOpen !== 'true') {
            if (typeof target.showPicker === 'function') {
                target.showPicker();
                target.dataset.pickerOpen = 'true';
                return;
            }
        }
        
        // If it was open, or it's a regular input, delete flag and go to next
        if (tagName === 'select') {
            delete target.dataset.pickerOpen;
        }

        const form = e.currentTarget;
        const focusableElements = Array.from(
            form.querySelectorAll('input, select, textarea, button')
        ).filter(el => {
            return !el.disabled && 
                   el.tabIndex !== -1 && 
                   el.offsetParent !== null && 
                   !(el.tagName.toLowerCase() === 'button' && el.classList.contains('btn-secondary'));
        });
        
        const index = focusableElements.indexOf(target);
        if (index > -1 && index < focusableElements.length - 1) {
            focusableElements[index + 1].focus();
        }
    };

    const handleFormBlur = (e) => {
        if (e.target.tagName.toLowerCase() === 'select') {
            delete e.target.dataset.pickerOpen;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentGroup.name.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Group name is required' });
            return;
        }

        const selectedParent = accountGroups.find(g => String(g.id) === String(currentGroup.parent));
        const finalNature = (!currentGroup.is_main_head && selectedParent) ? selectedParent.nature : currentGroup.nature;

        try {
            const payload = {
                name: currentGroup.name,
                parent: currentGroup.is_main_head ? null : (currentGroup.parent || null),
                nature: finalNature,
                sort_order: currentGroup.sort_order,
                is_main_head: currentGroup.is_main_head
            };

            if (editMode) {
                await updateAccountGroup(currentGroup.id, payload);
                Swal.fire({ icon: 'success', title: 'Updated', text: 'Account Group updated successfully', timer: 2000 });
            } else {
                await createAccountGroup(payload);
                Swal.fire({ icon: 'success', title: 'Created', text: 'Account Group created successfully', timer: 2000 });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: `Failed to ${editMode ? 'update' : 'create'} account group. Ensure the name is unique.` });
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Account Group?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteAccountGroup(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Account Group deleted successfully', timer: 2000 });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete account group' });
            }
        }
    };

    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused 
                ? 'var(--cc-primary, #0a500f)' 
                : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '56px',
            height: '56px',
            borderRadius: '0.5rem',
            boxShadow: 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'var(--cc-primary, #0a500f)' : (isDark ? '#636363' : '#ececec'),
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0.3125rem 1.25rem',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
            fontSize: '14px',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? '#888888' : '#7e7e7e',
            fontSize: '14px',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderColor: isDark ? '#636363' : '#ececec',
            zIndex: 9999
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--cc-primary, #0a500f)'
                : state.isFocused
                    ? (isDark ? '#24292D' : '#f8f9fa')
                    : 'transparent',
            color: state.isSelected
                ? '#ffffff'
                : (isDark ? '#ffffff' : '#2f3f50'),
            cursor: 'pointer',
            '&:active': {
                backgroundColor: 'var(--cc-primary, #0a500f)',
                color: '#ffffff'
            }
        }),
        input: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: isDark ? '#636363' : '#ececec',
            '&:hover': {
                color: isDark ? '#ffffff' : '#7e7e7e'
            }
        })
    };

    const filteredGroups = accountGroups.filter(group =>
        (group.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.nature || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination calculations
    const totalPages = Math.ceil(filteredGroups.length / pageSize);
    const paginatedGroups = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const handlePageSizeChange = (e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1);
    };

    // Reset to page 1 when search changes
    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <Fragment>
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
                            <Card.Title className="mb-0">Account Groups Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Account Group..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                        style={{ height: '17px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                    <button 
                                        className="btn btn-secondary" 
                                        onClick={handleDownloadTemplate} 
                                        title="Download Template"
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                    >
                                        <i className="fa fa-download me-1"></i> Template
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        className="btn btn-info" 
                                        onClick={() => fileInputRef.current.click()} 
                                        title="Import Excel"
                                        style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px', color: 'white' }}
                                    >
                                        <i className="fa fa-upload me-1"></i> Import
                                    </button>
                                <CreateButton module="finance" onClick={() => handleShowModal()}>
                                    Group
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
                                                <th><strong>PARENT</strong></th>
                                                <th><strong>NATURE</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedGroups.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-4 text-muted">
                                                        No account groups found
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedGroups.map((group, index) => {
                                                    const systemGroupNames = ['spare parts', 'machinery', 'equipments', 'vehicle'];
                                                    const isSystemGroup = group.is_main_head || Number(group.id) <= 37 || systemGroupNames.includes((group.name || '').toLowerCase());
                                                    return (
                                                        <tr key={group.id}>
                                                            <td>{(currentPage - 1) * pageSize + index + 1}</td>
                                                            <td><strong>{group.name}</strong></td>
                                                            <td>{group.parent_name || '-'}</td>
                                                            <td>{group.nature}</td>
                                                            <td className="text-end">
                                                                {(can('finance', 'edit') || can('finance', 'delete')) ? (
                                                                    <div className="d-flex justify-content-end align-items-center gap-1">
                                                                        {isSystemGroup && (
                                                                            <span className="badge badge-light text-muted border px-2 py-1 font-w500 me-1" style={{ fontSize: '11px' }}>
                                                                                <i className="fa fa-lock me-1 text-secondary"></i>System Group
                                                                            </span>
                                                                        )}
                                                                        {can('finance', 'edit') && (
                                                                            <EditButton
                                                                                module="finance"
                                                                                onClick={() => handleShowModal(group)}
                                                                                className="me-1"
                                                                            />
                                                                        )}
                                                                        {!isSystemGroup && can('finance', 'delete') && (
                                                                            <DeleteButton
                                                                                module="finance"
                                                                                onClick={() => handleDelete(group.id, group.name)}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="badge badge-danger light mt-1">No Access</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Pagination Controls */}
                                    {filteredGroups.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredGroups.length)} to {Math.min(currentPage * pageSize, filteredGroups.length)} of {filteredGroups.length} entries
                                            </div>
                                            {totalPages > 1 && (
                                                <nav>
                                                    <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                        <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => handlePageChange(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
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
                                                                        <button type="button" className="page-link" onClick={() => handlePageChange(pageNumber)} style={{ border: 'none' }}>
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
                                                            <button type="button" className="page-link" onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            {/* Account Group Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-sitemap text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1">{editMode ? 'Edit Account Group' : 'Add Account Group'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {editMode
                                        ? 'Modify the details and hierarchy of your account group'
                                        : 'Enter details to create a new account group'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown} onBlur={handleFormBlur}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                ref={nameInputRef}
                                type="text"
                                value={currentGroup.name}
                                onChange={(e) => setCurrentGroup({ ...currentGroup, name: e.target.value })}
                                placeholder="Enter account group name"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check 
                                type="checkbox"
                                id="is_main_head"
                                label="Is Main Head? (Primary Account Group)"
                                checked={currentGroup.is_main_head}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setCurrentGroup({
                                        ...currentGroup,
                                        is_main_head: checked,
                                        parent: checked ? '' : currentGroup.parent
                                    });
                                }}
                            />
                        </Form.Group>

                        {!currentGroup.is_main_head && (
                            <Form.Group className="mb-3">
                                <Form.Label>Parent Group <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={[
                                        { value: '', label: '-- Select Parent Group --' },
                                        ...accountGroups
                                            .filter(group => group.id !== currentGroup.id)
                                            .map(group => ({
                                                value: group.id,
                                                label: group.name
                                            }))
                                    ]}
                                    value={
                                        currentGroup.parent
                                            ? {
                                                value: currentGroup.parent,
                                                label: accountGroups.find(g => String(g.id) === String(currentGroup.parent))?.name || ''
                                              }
                                            : { value: '', label: '-- Select Parent Group --' }
                                    }
                                    onChange={(selected) => {
                                        const parentId = selected ? selected.value : '';
                                        const parentObj = accountGroups.find(g => String(g.id) === String(parentId));
                                        setCurrentGroup({
                                            ...currentGroup,
                                            parent: parentId,
                                            nature: parentObj ? parentObj.nature : currentGroup.nature
                                        });
                                    }}
                                    placeholder="Select Parent Group..."
                                    isSearchable
                                    openMenuOnFocus={true}
                                    styles={customSelectStyles}
                                />
                            </Form.Group>
                        )}

                        {currentGroup.is_main_head ? (
                            <Form.Group className="mb-3">
                                <Form.Label>Nature <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={natureChoices.map(choice => ({
                                        value: choice,
                                        label: choice
                                    }))}
                                    value={
                                        currentGroup.nature
                                            ? { value: currentGroup.nature, label: currentGroup.nature }
                                            : null
                                    }
                                    onChange={(selected) => {
                                        setCurrentGroup({ ...currentGroup, nature: selected ? selected.value : 'Asset' });
                                    }}
                                    placeholder="Select Nature..."
                                    isSearchable
                                    openMenuOnFocus={true}
                                    styles={customSelectStyles}
                                />
                            </Form.Group>
                        ) : (
                            <Form.Group className="mb-3">
                                <Form.Label>Nature</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={
                                        currentGroup.parent
                                            ? (accountGroups.find(g => String(g.id) === String(currentGroup.parent))?.nature || currentGroup.nature)
                                            : currentGroup.nature
                                    }
                                    disabled
                                    className="bg-light text-muted fw-semibold"
                                />
                                <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                                    (Automatically inherited from selected Parent Group)
                                </Form.Text>
                            </Form.Group>
                        )}

                        <Form.Group className="mb-3">
                            <Form.Label>Sort Order</Form.Label>
                            <Form.Control
                                type="number"
                                value={currentGroup.sort_order}
                                onChange={(e) => setCurrentGroup({ ...currentGroup, sort_order: parseInt(e.target.value) || 0 })}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button 
                            className="btn-universal-close btn-cancel-custom"
                            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#ffffff' }}
                            onClick={() => setShowModal(false)}
                        >
                            Close
                        </Button>
                        <Button 
                            className="btn-universal-save" 
                            type="submit"
                        >
                            {editMode ? 'Update' : 'Save'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Fragment>
    );
};

export default AccountGroupList;
