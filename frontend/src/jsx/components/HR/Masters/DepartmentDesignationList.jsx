import React, { useState, useEffect, Fragment, useRef } from 'react';

import { Card, Button, Modal, Form } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getDepartments,
    getDesignations,
    getDepartmentDesignations,
    createDepartmentDesignation,
    updateDepartmentDesignation,
    deleteDepartmentDesignation
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import DepartmentFormModal from './DepartmentFormModal';
import DesignationFormModal from './DesignationFormModal';

const DepartmentDesignationList = () => {
    const [assignments, setAssignments] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const { can } = usePermission();
    const currentSelectControlRef = useRef(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedDesignations, setSelectedDesignations] = useState([]);
    const [designationLevels, setDesignationLevels] = useState({});
    const [desigSearchTerm, setDesigSearchTerm] = useState('');
    const [desigFilterMode, setDesigFilterMode] = useState('all'); // 'selected' | 'all'
    const [saving, setSaving] = useState(false);

    const handleLevelChange = (desigId, val) => {
        const numericVal = val.replace(/[^0-9]/g, '');
        setDesignationLevels(prev => ({ ...prev, [desigId]: numericVal ? parseInt(numericVal, 10) : '' }));
    };

    // Quick add modals state
    const [showDeptQuickModal, setShowDeptQuickModal] = useState(false);
    const [showDesigQuickModal, setShowDesigQuickModal] = useState(false);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleDeptQuickSuccess = async (newDept) => {
        try {
            const deptData = await getDepartments();
            setDepartments(deptData);
            if (newDept && newDept.id) {
                handleDeptSelect({ value: newDept.id, label: newDept.name });
            }
        } catch (error) {
            console.error("Failed to refresh departments:", error);
        }
    };

    const handleDesigQuickSuccess = async (newDesig) => {
        try {
            const desigData = await getDesignations();
            setDesignations(desigData);
            if (newDesig && newDesig.id) {
                setDesignationLevels(l => ({ ...l, [newDesig.id]: 1 }));
                setSelectedDesignations(prev => [...prev, newDesig.id]);
            }
        } catch (error) {
            console.error("Failed to refresh designations:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-focus first input when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.assign-custom-modal input:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) inputs[0].focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation
    const getFocusable = () => {
        const modal = document.querySelector('.assign-custom-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.react-select__control, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const focusNextFromControl = (control) => {
        const all = getFocusable();
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                const next = all[index + 1];
                if (next.classList.contains('react-select__control')) {
                    next.querySelector('input')?.focus();
                } else {
                    next.focus();
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const activeEl = document.activeElement;
        const all = getFocusable();
        const index = all.indexOf(activeEl);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            const next = all[index + 1];
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
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

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: "var(--cc-primary, #0a500f)" },
            borderRadius: '10px',
            fontSize: '14px',
            color: '#334155',
        }),
        menu: base => ({ ...base, zIndex: 99999, fontSize: '14px' }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? 'rgba(10, 80, 15, 0.1)' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
        }),
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [assignData, deptData, desigData] = await Promise.all([
                getDepartmentDesignations(),
                getDepartments(),
                getDesignations()
            ]);
            setAssignments(assignData);
            setDepartments(deptData);
            setDesignations(desigData);
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

    const handleShowModal = (assign = null) => {
        setDesigSearchTerm('');
        if (assign) {
            setSelectedDept(assign.department);
            const currentDeptAssigns = assignments.filter(a => String(a.department) === String(assign.department));
            const existingDesigs = currentDeptAssigns.map(a => a.designation);
            const levels = {};
            currentDeptAssigns.forEach(a => {
                levels[a.designation] = a.level || 1;
            });
            setSelectedDesignations(existingDesigs);
            setDesignationLevels(levels);
            setEditMode(true);
            setDesigFilterMode(existingDesigs.length > 0 ? 'selected' : 'all');
        } else {
            setSelectedDept('');
            setSelectedDesignations([]);
            setDesignationLevels({});
            setEditMode(false);
            setDesigFilterMode('all');
        }
        setShowModal(true);
    };

    const handleDeptSelect = (opt) => {
        const deptId = opt ? opt.value : '';
        setSelectedDept(deptId);
        if (deptId) {
            const currentDeptAssigns = assignments.filter(a => String(a.department) === String(deptId));
            const existingDesigs = currentDeptAssigns.map(a => a.designation);
            const levels = {};
            currentDeptAssigns.forEach(a => {
                levels[a.designation] = a.level || 1;
            });
            setSelectedDesignations(existingDesigs);
            setDesignationLevels(levels);
            setDesigFilterMode(existingDesigs.length > 0 ? 'selected' : 'all');
        } else {
            setSelectedDesignations([]);
            setDesignationLevels({});
            setDesigFilterMode('all');
        }
    };

    const handleToggleDesignation = (desigId) => {
        setSelectedDesignations(prev => {
            if (prev.includes(desigId)) {
                return prev.filter(id => id !== desigId);
            } else {
                setDesignationLevels(l => ({ ...l, [desigId]: l[desigId] || 1 }));
                return [...prev, desigId];
            }
        });
    };

    const handleSelectAllVisible = (visibleDesigIds) => {
        const allVisibleSelected = visibleDesigIds.every(id => selectedDesignations.includes(id));
        if (allVisibleSelected) {
            setSelectedDesignations(prev => prev.filter(id => !visibleDesigIds.includes(id)));
        } else {
            setDesignationLevels(l => {
                const newLevels = { ...l };
                visibleDesigIds.forEach(id => {
                    if (!newLevels[id]) newLevels[id] = 1;
                });
                return newLevels;
            });
            setSelectedDesignations(prev => Array.from(new Set([...prev, ...visibleDesigIds])));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedDept) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a Department' });
            return;
        }
        if (selectedDesignations.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select at least one Designation' });
            return;
        }

        try {
            setSaving(true);
            const currentDeptAssigns = assignments.filter(a => String(a.department) === String(selectedDept));
            const currentMappedDesigIds = currentDeptAssigns.map(a => a.designation);

            const toAdd = selectedDesignations.filter(id => !currentMappedDesigIds.includes(id));
            const toRemove = currentDeptAssigns.filter(a => !selectedDesignations.includes(a.designation));
            const toUpdate = currentDeptAssigns.filter(a => selectedDesignations.includes(a.designation) && a.level !== (designationLevels[a.designation] || 1));

            // Create new mapping entries
            for (const desigId of toAdd) {
                await createDepartmentDesignation({
                    department: selectedDept,
                    designation: desigId,
                    level: designationLevels[desigId] || 1,
                    company: 1
                });
            }

            // Update existing if level changed
            for (const assignRecord of toUpdate) {
                await updateDepartmentDesignation(assignRecord.id, {
                    ...assignRecord,
                    level: designationLevels[assignRecord.designation] || 1
                });
            }

            // Remove unselected mapping entries
            for (const assignRecord of toRemove) {
                await deleteDepartmentDesignation(assignRecord.id);
            }

            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Department designation assignments updated successfully',
                timer: 2000,
                showConfirmButton: false
            });
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("API Error details:", error.response?.data || error);
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            Swal.fire({ icon: 'error', title: 'Error', text: `Failed to update assignments: ${errorMsg}` });
        } finally {
            setSaving(false);
        }
    };

    const getDeptName = (id) => departments.find(d => d.id === id)?.name || 'Unknown';
    const getDesigName = (id) => {
        const d = designations.find(d => d.id === id);
        return d ? (d.name || d.title) : 'Unknown';
    };

    const handleDeleteGroup = async (group) => {
        const result = await Swal.fire({
            title: 'Remove Department Assignments?',
            text: `Are you sure you want to remove all designation assignments for "${group.deptName}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, remove all'
        });

        if (result.isConfirmed) {
            try {
                for (const d of group.designations) {
                    await deleteDepartmentDesignation(d.assignId);
                }
                Swal.fire({ icon: 'success', title: 'Removed', text: 'Department designations removed successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to remove department designations' });
            }
        }
    };

    // Group raw assignments by Department
    const groupedAssignments = React.useMemo(() => {
        const groupsMap = {};
        
        assignments.forEach(assign => {
            const deptId = assign.department;
            if (!groupsMap[deptId]) {
                groupsMap[deptId] = {
                    deptId: deptId,
                    deptName: getDeptName(deptId),
                    designations: []
                };
            }
            groupsMap[deptId].designations.push({
                assignId: assign.id,
                desigId: assign.designation,
                desigName: getDesigName(assign.designation),
                level: assign.level
            });
        });

        const groupArray = Object.values(groupsMap).sort((a, b) => 
            a.deptName.localeCompare(b.deptName)
        );

        groupArray.forEach(group => {
            group.designations.sort((a, b) => {
                const levelA = a.level || 999;
                const levelB = b.level || 999;
                if (levelA !== levelB) return levelA - levelB;
                return a.desigName.localeCompare(b.desigName);
            });
        });

        return groupArray;
    }, [assignments, departments, designations]);

    const filteredGroups = groupedAssignments.filter(group => {
        const matchesDept = group.deptName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDesig = group.designations.some(d => d.desigName.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesDept || matchesDesig;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGroups = filteredGroups.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);

    const departmentOptions = departments.map(dept => ({ value: dept.id, label: dept.name }));
    const currentDeptValue = departmentOptions.find(opt => opt.value === selectedDept) || null;

    // Filter and sort designations (Selected items first!)
    const visibleDesignations = designations
        .filter(desig => {
            const matchesSearch = (desig.name || desig.title || '').toLowerCase().includes(desigSearchTerm.toLowerCase());
            const isSelected = selectedDesignations.includes(desig.id);
            if (desigFilterMode === 'selected') {
                return isSelected && matchesSearch;
            }
            return matchesSearch;
        })
        .sort((a, b) => {
            const aSel = selectedDesignations.includes(a.id);
            const bSel = selectedDesignations.includes(b.id);
            // Selected items come first
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;
            // Both selected: sort by level ascending (level 1 = highest rank first)
            if (aSel && bSel) {
                const aLevel = designationLevels[a.id] ?? Infinity;
                const bLevel = designationLevels[b.id] ?? Infinity;
                if (aLevel !== bLevel) return aLevel - bLevel;
            }
            // Both unselected (or same level): alphabetical
            return (a.name || a.title || '').localeCompare(b.name || b.title || '');
        });

    const visibleDesigIds = visibleDesignations.map(d => d.id);
    const isAllVisibleSelected = visibleDesigIds.length > 0 && visibleDesigIds.every(id => selectedDesignations.includes(id));

    return (
        <div className="container-fluid">
            <style>{`
                .assign-custom-modal.modal-lg {
                    max-width: 850px !important;
                }
                .assign-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .assign-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .assign-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .assign-custom-modal .modal-close-x {
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
                .assign-custom-modal .modal-close-x:hover { color: #555; }
                .assign-custom-modal .modal-body-custom { padding: 28px; }
                .assign-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .assign-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .assign-custom-modal .btn-close-custom {
                    background-color: #64748b !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .assign-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .assign-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .assign-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .search-input-custom {
                    height: 38px !important;
                    border-radius: 6px !important;
                    padding-left: 35px !important;
                    font-size: 13px !important;
                }
                .quick-add-btn {
                    transition: background-color 0.2s, color 0.2s;
                }
                .quick-add-btn:hover {
                    background-color: #0a500f !important;
                    color: white !important;
                }
            `}</style>

            

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Department - Designation Mapping</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by Dept or Designation..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-custom"
                                    />
                                </div>
                                <CreateButton
                                    module="department_designation"
                                    onClick={() => handleShowModal()}
                                >
                                    Assign Designation
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
                                    {filteredGroups.length === 0 ? (
                                        <div className="text-center py-4 text-muted">No department assignments found</div>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '80px' }}><strong>SL NO</strong></th>
                                                        <th style={{ width: '220px' }}><strong>DEPARTMENT</strong></th>
                                                        <th><strong>DESIGNATIONS ASSIGNED</strong></th>
                                                        <th className="text-end" style={{ width: '120px' }}><strong>ACTIONS</strong></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentGroups.map((group, idx) => (
                                                        <tr key={group.deptId}>
                                                            <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                            <td><strong>{group.deptName}</strong></td>
                                                            <td>
                                                                <div className="d-flex flex-wrap gap-1 align-items-center">
                                                                    {group.designations.map(d => (
                                                                        <span 
                                                                            key={d.assignId} 
                                                                            className="badge me-1 mb-1 font-w500"
                                                                            style={{ 
                                                                                fontSize: '12.5px', 
                                                                                padding: '5px 11px', 
                                                                                borderRadius: '6px',
                                                                                backgroundColor: '#f1f5f9',
                                                                                color: '#334155',
                                                                                border: '1px solid #e2e8f0'
                                                                            }}
                                                                        >
                                                                            {d.desigName} {d.level ? `(L${d.level})` : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="text-end">
                                                                {can('department-designations', 'edit') || can('department-designations', 'delete') ? (
                                                                    <div className="d-flex justify-content-end gap-1">
                                                                        <EditButton
                                                                            module="department_designation"
                                                                            onClick={() => handleShowModal({ department: group.deptId })}
                                                                        />
                                                                        <DeleteButton
                                                                            module="department_designation"
                                                                            onClick={() => handleDeleteGroup(group)}
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

                                    {filteredGroups.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 pt-2 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px', color: '#8898aa' }}>
                                                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredGroups.length)} of {filteredGroups.length} entries
                                            </div>

                                            {totalPages > 1 && (
                                                <div className="d-flex align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                        disabled={currentPage === 1}
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: currentPage === 1 ? '#cbd5e1' : '#0a500f',
                                                            fontSize: '13px',
                                                            padding: '6px 10px',
                                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                            transition: 'color 0.2s'
                                                        }}
                                                    >
                                                        <i className="fa fa-chevron-left" style={{ fontSize: '11px' }}></i>
                                                    </button>

                                                    {Array.from({ length: totalPages }, (_, index) => {
                                                        const pageNumber = index + 1;
                                                        const isActive = currentPage === pageNumber;
                                                        if (
                                                            pageNumber === 1 ||
                                                            pageNumber === totalPages ||
                                                            (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                        ) {
                                                            return (
                                                                <button
                                                                    key={pageNumber}
                                                                    type="button"
                                                                    onClick={() => setCurrentPage(pageNumber)}
                                                                    style={{
                                                                        border: 'none',
                                                                        borderRadius: '8px',
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '13px',
                                                                        fontWeight: '500',
                                                                        cursor: 'pointer',
                                                                        backgroundColor: isActive ? "var(--cc-primary, #0a500f)" : "transparent",
                                                                        color: isActive ? "#ffffff" : "var(--cc-primary, #0a500f)",
                                                                        boxShadow: isActive ? '0 4px 10px rgba(10, 80, 15, 0.3)' : 'none',
                                                                        transition: 'all 0.2s ease'
                                                                    }}
                                                                >
                                                                    {pageNumber}
                                                                </button>
                                                            );
                                                        } else if (
                                                            pageNumber === currentPage - 2 ||
                                                            pageNumber === currentPage + 2
                                                        ) {
                                                            return (
                                                                <span key={pageNumber} style={{ color: '#94a3b8', padding: '0 4px', fontSize: '13px' }}>...</span>
                                                            );
                                                        }
                                                        return null;
                                                    })}

                                                    <button
                                                        type="button"
                                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                        disabled={currentPage === totalPages}
                                                        style={{
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: currentPage === totalPages ? '#cbd5e1' : '#0a500f',
                                                            fontSize: '13px',
                                                            padding: '6px 10px',
                                                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                            transition: 'color 0.2s'
                                                        }}
                                                    >
                                                        <i className="fa fa-chevron-right" style={{ fontSize: '11px' }}></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Assignment Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)} dialogClassName="assign-custom-modal modal-lg" centered>
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {editMode ? 'Manage Department Assignments' : 'Create Department Assignments'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Select a department and check multiple designations to assign
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        <Form.Group className="mb-4">
                            <Form.Label className="form-label-custom font-w600" style={{ fontSize: '14.5px' }}>
                                Department <span className="text-danger">*</span>
                            </Form.Label>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ flex: 1 }}>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={departmentOptions}
                                        value={currentDeptValue}
                                        onChange={handleDeptSelect}
                                        onFocus={handleSelectFocus}
                                        onKeyDown={handleSelectKeyDown}
                                        isDisabled={editMode}
                                        placeholder="Choose Department..."
                                        styles={selectStyles}
                                    />
                                </div>
                                {can('departments', 'create') && (
                                    <Button
                                        variant="outline-success"
                                        onClick={() => setShowDeptQuickModal(true)}
                                        style={{
                                            height: '38px',
                                            width: '38px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '10px',
                                            borderColor: "var(--cc-primary, #0a500f)",
                                            color: "var(--cc-primary, #0a500f)",
                                            backgroundColor: 'transparent',
                                            padding: 0
                                        }}
                                        className="quick-add-btn"
                                        title="Quick Add Department"
                                    >
                                        <i className="fa fa-plus"></i>
                                    </Button>
                                )}
                            </div>
                        </Form.Group>

                        {selectedDept ? (
                            <Form.Group className="mb-2">
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                    <div>
                                        <Form.Label className="form-label-custom font-w600 mb-0" style={{ fontSize: '14.5px' }}>
                                            Designation <span className="text-danger">*</span>
                                        </Form.Label>
                                    </div>
                                    <span 
                                        className="badge badge-lg font-w600" 
                                        style={{ 
                                            fontSize: '13px', 
                                            padding: '6px 14px',
                                            backgroundColor: 'rgba(10, 80, 15, 0.12)',
                                            color: '#15803d',
                                            border: '1px solid rgba(10, 80, 15, 0.3)'
                                        }}
                                    >
                                        {selectedDesignations.length} Designation{selectedDesignations.length !== 1 ? 's' : ''} Selected
                                    </span>
                                </div>

                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                    <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search designations..."
                                            value={desigSearchTerm}
                                            onChange={(e) => setDesigSearchTerm(e.target.value)}
                                            style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                                        />
                                    </div>

                                    <div className="btn-group" role="group" style={{ height: '38px' }}>
                                        <Button
                                            type="button"
                                            onClick={() => setDesigFilterMode('selected')}
                                            style={{ 
                                                borderRadius: '8px 0 0 8px', 
                                                fontSize: '12.5px', 
                                                fontWeight: 500, 
                                                whiteSpace: 'nowrap',
                                                backgroundColor: desigFilterMode === "selected" ? "var(--cc-primary, #0a500f)" : "#ffffff",
                                                borderColor: "var(--cc-primary, #0a500f)",
                                                color: desigFilterMode === "selected" ? "#ffffff" : "var(--cc-primary, #0a500f)"
                                            }}
                                        >
                                            Selected Only ({selectedDesignations.length})
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => setDesigFilterMode('all')}
                                            style={{ 
                                                borderRadius: '0 8px 8px 0', 
                                                fontSize: '12.5px', 
                                                fontWeight: 500, 
                                                whiteSpace: 'nowrap',
                                                backgroundColor: desigFilterMode === "all" ? "var(--cc-primary, #0a500f)" : "#ffffff",
                                                borderColor: "var(--cc-primary, #0a500f)",
                                                color: desigFilterMode === "all" ? "#ffffff" : "var(--cc-primary, #0a500f)"
                                            }}
                                        >
                                            Show All ({designations.length})
                                        </Button>
                                    </div>

                                    {visibleDesigIds.length > 0 && desigFilterMode === 'all' && (
                                        <Button
                                            type="button"
                                            onClick={() => handleSelectAllVisible(visibleDesigIds)}
                                            style={{ 
                                                height: '38px', 
                                                borderRadius: '8px', 
                                                fontSize: '13px', 
                                                whiteSpace: 'nowrap', 
                                                fontWeight: 500,
                                                backgroundColor: '#ffffff',
                                                borderColor: "var(--cc-primary, #0a500f)",
                                                color: "var(--cc-primary, #0a500f)"
                                            }}
                                        >
                                            {isAllVisibleSelected ? 'Deselect All' : 'Select All'}
                                        </Button>
                                    )}

                                    {can('designations', 'create') && (
                                        <Button
                                            onClick={() => setShowDesigQuickModal(true)}
                                            style={{ 
                                                height: '38px', 
                                                borderRadius: '8px', 
                                                fontSize: '13px', 
                                                whiteSpace: 'nowrap', 
                                                fontWeight: 500,
                                                backgroundColor: "var(--cc-primary, #0a500f)",
                                                borderColor: "var(--cc-primary, #0a500f)",
                                                color: '#ffffff'
                                            }}
                                            className="quick-add-btn"
                                        >
                                            <i className="fa fa-plus me-1"></i> New Designation
                                        </Button>
                                    )}
                                </div>

                                <div 
                                    className="p-3 border rounded" 
                                    style={{ 
                                        maxHeight: '320px', 
                                        overflowY: 'auto', 
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '12px'
                                    }}
                                >
                                    {visibleDesignations.length === 0 ? (
                                        <div className="text-center py-4 text-muted">
                                            {desigSearchTerm ? 'No matching designations found' : 'No designations available'}
                                        </div>
                                    ) : (
                                        <div className="row g-2">
                                            {visibleDesignations.map(desig => {
                                                const isChecked = selectedDesignations.includes(desig.id);
                                                const name = desig.name || desig.title;
                                                return (
                                                    <div className="col-md-6" key={desig.id}>
                                                        <div 
                                                            className={`p-2 px-3 border rounded d-flex align-items-center justify-content-between bg-white ${isChecked ? 'border-success shadow-sm' : ''}`}
                                                            style={{ 
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                borderColor: isChecked ? "var(--cc-primary, #0a500f)" : "#e2e8f0",
                                                                backgroundColor: isChecked ? '#f0fdf4' : '#ffffff'
                                                            }}
                                                            onClick={() => handleToggleDesignation(desig.id)}
                                                        >
                                                            <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
                                                                <Form.Check 
                                                                    type="checkbox"
                                                                    id={`desig-chk-${desig.id}`}
                                                                    checked={isChecked}
                                                                    onChange={() => handleToggleDesignation(desig.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{ transform: 'scale(1.15)', cursor: 'pointer', margin: 0 }}
                                                                />
                                                                <span className="font-w500 text-truncate" style={{ fontSize: '13.5px', color: '#1e293b' }} title={name}>
                                                                    {name}
                                                                </span>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                {isChecked && (
                                                                    <div className="d-flex align-items-center" onClick={e => e.stopPropagation()}>
                                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginRight: '4px' }}>Lvl:</span>
                                                                        <input
                                                                            type="text"
                                                                            inputMode="numeric"
                                                                            pattern="[0-9]*"
                                                                            value={designationLevels[desig.id] || ''}
                                                                            onChange={(e) => handleLevelChange(desig.id, e.target.value)}
                                                                            style={{ 
                                                                                width: '42px', 
                                                                                height: '24px', 
                                                                                fontSize: '12px', 
                                                                                padding: '0 4px', 
                                                                                border: '1px solid #cbd5e1',
                                                                                borderRadius: '4px',
                                                                                textAlign: 'center',
                                                                                fontWeight: '500',
                                                                                color: '#334155',
                                                                                outline: 'none'
                                                                            }}
                                                                            onFocus={(e) => e.target.style.borderColor = "var(--cc-primary, #0a500f)"}
                                                                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                                                        />
                                                                    </div>
                                                                )}
                                                                {isChecked && (
                                                                    <span 
                                                                        className="badge badge-sm font-w600" 
                                                                        style={{ backgroundColor: "var(--cc-primary, #0a500f)", color: "#ffffff", fontSize: "10px", padding: "4px 6px" }}
                                                                    >
                                                                        Selected
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Form.Group>
                        ) : (
                            <div className="text-center py-5 border rounded bg-light" style={{ borderRadius: '12px' }}>
                                <i className="fa fa-info-circle text-muted me-2" style={{ fontSize: '18px' }}></i>
                                <span className="text-muted font-w500" style={{ fontSize: '14px' }}>
                                    Please select a Department above to view and assign Designations.
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer-custom">
                        <Button type="button" className="btn" style={{ backgroundColor: "var(--cancel-btn-color, #dc3545)", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", fontWeight: 500 }} onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
                        <Button type="submit" className="btn-save-custom" disabled={saving || !selectedDept}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Quick Add Modals */}
            <DepartmentFormModal
                show={showDeptQuickModal}
                onHide={() => setShowDeptQuickModal(false)}
                onSuccess={handleDeptQuickSuccess}
                editMode={false}
                department={null}
            />

            <DesignationFormModal
                show={showDesigQuickModal}
                onHide={() => setShowDesigQuickModal(false)}
                onSuccess={handleDesigQuickSuccess}
                editMode={false}
                designation={null}
            />
        </div>
    );
};

export default DepartmentDesignationList;
