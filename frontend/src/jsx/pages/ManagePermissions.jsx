import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Row, Col, Form, Button, Dropdown, ButtonGroup } from 'react-bootstrap';
import swal from 'sweetalert';
import Select from 'react-select';
import {
    fetchMenus,
    fetchSubMenus,
    fetchSubSubMenus,
    fetchPermissions,
    createPermission,
    deletePermission,
    updatePermission,
    formatError
} from '../../services/MenuManagementService';
import { getRoles } from '../../services/HRManagementService';

const ManagePermissions = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // State
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const [menus, setMenus] = useState([]);
    const [submenus, setSubmenus] = useState([]);
    const [subsubmenus, setSubSubMenus] = useState([]);
    const [selectedRole, setSelectedRole] = useState('');
    const [duplicateRole, setDuplicateRole] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState({});
    const [loading, setLoading] = useState(false);
    const [duplicating, setDuplicating] = useState(false);

    // Load data on component mount
    useEffect(() => {
        loadRoles();
        loadMenus();
        loadAllSubMenus();
        loadAllSubSubMenus();
    }, []);

    // Load permissions when role is selected
    useEffect(() => {
        if (selectedRole) {
            loadPermissions(selectedRole);
        }
    }, [selectedRole]);

    // Check URL parameter for roleId and pre-select role
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const roleIdFromUrl = urlParams.get('roleId');
        if (roleIdFromUrl && roles.length > 0) {
            setSelectedRole(roleIdFromUrl);
        } else if (!roleIdFromUrl) {
            setSelectedRole('');
        }
    }, [location.search, roles]);

    // Fetch roles
    const loadRoles = async () => {
        try {
            const data = await getRoles();
            setRoles(data);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Fetch menus
    const loadMenus = async () => {
        try {
            const response = await fetchMenus();
            const dataList = Array.isArray(response.data) ? response.data : (response.data.results || []);
            setMenus(dataList.filter(item => item.is_active !== false));
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Fetch all submenus
    const loadAllSubMenus = async () => {
        try {
            const response = await fetchSubMenus();
            const dataList = Array.isArray(response.data) ? response.data : (response.data.results || []);
            setSubmenus(dataList.filter(item => item.is_active !== false));
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Fetch all subsubmenus
    const loadAllSubSubMenus = async () => {
        try {
            const response = await fetchSubSubMenus();
            const dataList = Array.isArray(response.data) ? response.data : (response.data.results || []);
            setSubSubMenus(dataList.filter(item => item.is_active !== false));
        } catch (error) {
            swal('Error', formatError(error), 'error');
        }
    };

    // Fetch permissions for role
    const loadPermissions = async (roleId) => {
        try {
            setLoading(true);
            const response = await fetchPermissions(roleId);
            const perms = response.data;
            setPermissions(perms);

            // Build selected permissions object
            const selected = {};
            perms.forEach(perm => {
                const type = perm.sub_submenu ? 'subsubmenu' : (perm.submenu ? 'submenu' : 'menu');
                const id = perm.sub_submenu || perm.submenu || perm.menu;

                selected[`${type}_${id}`] = perm.can_view;
                selected[`create_${type}_${id}`] = perm.can_create;
                selected[`edit_${type}_${id}`] = perm.can_edit;
                selected[`delete_${type}_${id}`] = perm.can_delete;
                selected[`approve_${type}_${id}`] = perm.can_approve;
                selected[`reject_${type}_${id}`] = perm.can_reject;
                selected[`details_${type}_${id}`] = perm.can_details;
                selected[`allocate_${type}_${id}`] = perm.can_allocate;
                selected[`history_${type}_${id}`] = perm.can_history;
            });
            setSelectedPermissions(selected);
        } catch (error) {
            swal('Error', formatError(error), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Duplicate permissions from another role
    const handleDuplicate = async (sourceRoleId) => {
        if (!sourceRoleId) return;
        
        try {
            setDuplicating(true);
            const response = await fetchPermissions(sourceRoleId);
            const sourcePerms = response.data;
            
            if (sourcePerms.length === 0) {
                swal('Info', 'The selected source role has no permissions to duplicate.', 'info');
                return;
            }

            // Build new selected permissions object from source
            const newSelected = {};
            sourcePerms.forEach(perm => {
                const type = perm.sub_submenu ? 'subsubmenu' : (perm.submenu ? 'submenu' : 'menu');
                const id = perm.sub_submenu || perm.submenu || perm.menu;

                newSelected[`${type}_${id}`] = perm.can_view;
                newSelected[`create_${type}_${id}`] = perm.can_create;
                newSelected[`edit_${type}_${id}`] = perm.can_edit;
                newSelected[`delete_${type}_${id}`] = perm.can_delete;
                newSelected[`approve_${type}_${id}`] = perm.can_approve;
                newSelected[`reject_${type}_${id}`] = perm.can_reject;
                newSelected[`details_${type}_${id}`] = perm.can_details;
                newSelected[`allocate_${type}_${id}`] = perm.can_allocate;
                newSelected[`history_${type}_${id}`] = perm.can_history;
            });

            // Merge with existing or completely replace? Usually duplication should show a fresh start or add on.
            // Requirement says "duplicate an existing role's permission and give to the selected role".
            // I'll replace the state but keep it local until save.
            setSelectedPermissions(newSelected);
            swal('Success', 'Permissions duplicated! Review and Save to apply.', 'success');
        } catch (error) {
            swal('Error', formatError(error), 'error');
        } finally {
            setDuplicating(false);
            setDuplicateRole('');
        }
    };

    const ACTION_TYPES = ['create', 'edit', 'delete', 'approve', 'reject', 'details', 'allocate', 'history'];

    // Bulk selection helpers
    const handleSelectAll = (mode = 'full') => {
        setSelectedPermissions(prev => {
            const updated = { ...prev };
            menus.forEach(m => {
                updated[`menu_${m.id}`] = true;
                ACTION_TYPES.forEach(act => {
                    if (m[`has_${act}`]) {
                        updated[`${act}_menu_${m.id}`] = mode === 'full';
                    }
                });
            });
            submenus.forEach(sm => {
                if (menus.some(m => m.id === sm.menu)) {
                    updated[`submenu_${sm.id}`] = true;
                    ACTION_TYPES.forEach(act => {
                        if (sm[`has_${act}`]) {
                            updated[`${act}_submenu_${sm.id}`] = mode === 'full';
                        }
                    });
                }
            });
            subsubmenus.forEach(ssm => {
                const parentSubmenu = submenus.find(s => s.id === ssm.submenu);
                if (parentSubmenu && menus.some(m => m.id === parentSubmenu.menu)) {
                    updated[`subsubmenu_${ssm.id}`] = true;
                    ACTION_TYPES.forEach(act => {
                        if (ssm[`has_${act}`]) {
                            updated[`${act}_subsubmenu_${ssm.id}`] = mode === 'full';
                        }
                    });
                }
            });
            return updated;
        });
    };

    const handleClearAll = () => {
        setSelectedPermissions({});
    };

    const handleSelectAllMenus = (mode = 'full') => {
        setSelectedPermissions(prev => {
            const updated = { ...prev };
            menus.forEach(m => {
                updated[`menu_${m.id}`] = true;
                ACTION_TYPES.forEach(act => {
                    if (m[`has_${act}`]) {
                        updated[`${act}_menu_${m.id}`] = mode === 'full';
                    }
                });
            });
            return updated;
        });
    };

    const handleSelectAllSubmenus = (mode = 'full') => {
        setSelectedPermissions(prev => {
            const updated = { ...prev };
            submenus.forEach(sm => {
                if (menus.some(m => m.id === sm.menu)) {
                    updated[`menu_${sm.menu}`] = true;
                    updated[`submenu_${sm.id}`] = true;
                    ACTION_TYPES.forEach(act => {
                        if (sm[`has_${act}`]) {
                            updated[`${act}_submenu_${sm.id}`] = mode === 'full';
                        }
                    });
                }
            });
            return updated;
        });
    };

    const handleSelectAllSubSubMenus = (mode = 'full') => {
        setSelectedPermissions(prev => {
            const updated = { ...prev };
            subsubmenus.forEach(ssm => {
                const parentSubmenu = submenus.find(s => s.id === ssm.submenu);
                if (parentSubmenu && menus.some(m => m.id === parentSubmenu.menu)) {
                    updated[`menu_${parentSubmenu.menu}`] = true;
                    updated[`submenu_${parentSubmenu.id}`] = true;
                    updated[`subsubmenu_${ssm.id}`] = true;
                    ACTION_TYPES.forEach(act => {
                        if (ssm[`has_${act}`]) {
                            updated[`${act}_subsubmenu_${ssm.id}`] = mode === 'full';
                        }
                    });
                }
            });
            return updated;
        });
    };

    const handleCategoryBulkSelect = (group, mode = 'full') => {
        setSelectedPermissions(prev => {
            const updated = { ...prev };
            const mId = group.menu.id;

            if (mode === 'clear') {
                delete updated[`menu_${mId}`];
                ACTION_TYPES.forEach(act => delete updated[`${act}_menu_${mId}`]);
                group.submenus.forEach(sm => {
                    delete updated[`submenu_${sm.id}`];
                    ACTION_TYPES.forEach(act => delete updated[`${act}_submenu_${sm.id}`]);
                    (sm.subsubmenus || []).forEach(ssm => {
                        delete updated[`subsubmenu_${ssm.id}`];
                        ACTION_TYPES.forEach(act => delete updated[`${act}_subsubmenu_${ssm.id}`]);
                    });
                });
            } else {
                const isFull = mode === 'full';
                updated[`menu_${mId}`] = true;
                ACTION_TYPES.forEach(act => {
                    if (group.menu[`has_${act}`]) {
                        updated[`${act}_menu_${mId}`] = isFull;
                    }
                });
                group.submenus.forEach(sm => {
                    updated[`submenu_${sm.id}`] = true;
                    ACTION_TYPES.forEach(act => {
                        if (sm[`has_${act}`]) {
                            updated[`${act}_submenu_${sm.id}`] = isFull;
                        }
                    });
                    (sm.subsubmenus || []).forEach(ssm => {
                        updated[`subsubmenu_${ssm.id}`] = true;
                        ACTION_TYPES.forEach(act => {
                            if (ssm[`has_${act}`]) {
                                updated[`${act}_subsubmenu_${ssm.id}`] = isFull;
                            }
                        });
                    });
                });
            }
            return updated;
        });
    };

    // Handle checkbox change with cascading logic
    const handleCheckboxChange = (type, id, action = 'view') => {
        const key = action === 'view' ? `${type}_${id}` : `${action}_${type}_${id}`;
        const newValue = !selectedPermissions[key];

        setSelectedPermissions(prev => {
            const updated = { ...prev, [key]: newValue };

            if (action === 'view') {
                // If checking/unchecking a MENU, cascade to all its submenus and subsubmenus
                if (type === 'menu') {
                    const relatedSubmenus = submenus.filter(sm => sm.menu === id);
                    relatedSubmenus.forEach(sm => {
                        updated[`submenu_${sm.id}`] = newValue;
                        if (!newValue) {
                            ACTION_TYPES.forEach(act => delete updated[`${act}_submenu_${sm.id}`]);
                        }
                        
                        const relatedSubSubmenus = subsubmenus.filter(ssm => ssm.submenu === sm.id);
                        relatedSubSubmenus.forEach(ssm => {
                            updated[`subsubmenu_${ssm.id}`] = newValue;
                            if (!newValue) {
                                ACTION_TYPES.forEach(act => delete updated[`${act}_subsubmenu_${ssm.id}`]);
                            }
                        });
                    });
                    if (!newValue) {
                        ACTION_TYPES.forEach(act => delete updated[`${act}_menu_${id}`]);
                    }
                }

                // If checking/unchecking a SUBMENU, cascade down and up
                if (type === 'submenu') {
                    const relatedSubSubmenus = subsubmenus.filter(ssm => ssm.submenu === id);
                    relatedSubSubmenus.forEach(ssm => {
                        updated[`subsubmenu_${ssm.id}`] = newValue;
                        if (!newValue) {
                            ACTION_TYPES.forEach(act => delete updated[`${act}_subsubmenu_${ssm.id}`]);
                        }
                    });
                    if (!newValue) {
                        ACTION_TYPES.forEach(act => delete updated[`${act}_submenu_${id}`]);
                    }
                    
                    // Auto-check parent menu if all submenus are checked
                    const submenu = submenus.find(sm => sm.id === id);
                    if (submenu) {
                        const allSubmenusOfMenu = submenus.filter(sm => sm.menu === submenu.menu);
                        const allChecked = allSubmenusOfMenu.every(sm =>
                            sm.id === id ? newValue : updated[`submenu_${sm.id}`]
                        );
                        if (allChecked && newValue) updated[`menu_${submenu.menu}`] = true;
                    }
                }

                // If checking/unchecking a SUBSUBMENU, check parent submenu and menu
                if (type === 'subsubmenu') {
                    if (!newValue) {
                        ACTION_TYPES.forEach(act => delete updated[`${act}_subsubmenu_${id}`]);
                    }
                    const subsubmenu = subsubmenus.find(ssm => ssm.id === id);
                    if (subsubmenu) {
                        const submenuId = subsubmenu.submenu;
                        const allSubSubmenusOfSubmenu = subsubmenus.filter(ssm => ssm.submenu === submenuId);
                        const allChecked = allSubSubmenusOfSubmenu.every(ssm =>
                            ssm.id === id ? newValue : updated[`subsubmenu_${ssm.id}`]
                        );

                        if (allChecked && newValue) {
                            updated[`submenu_${submenuId}`] = true;
                            const submenu = submenus.find(sm => sm.id === submenuId);
                            if (submenu) {
                                const allSubmenusOfMenu = submenus.filter(sm => sm.menu === submenu.menu);
                                const allSubmenusChecked = allSubmenusOfMenu.every(sm =>
                                    sm.id === submenuId ? true : updated[`submenu_${sm.id}`]
                                );
                                if (allSubmenusChecked) updated[`menu_${submenu.menu}`] = true;
                            }
                        }
                    }
                }
            }

            return updated;
        });
    };

    // Helper to render granular checkboxes
    const renderActionCheckboxes = (type, item) => {
        const id = item.id;
        const isViewChecked = selectedPermissions[`${type}_${id}`];
        if (!isViewChecked) return null;

        const availableActions = ACTION_TYPES.filter(act => item[`has_${act}`]);
        if (availableActions.length === 0) return null;

        const allChecked = availableActions.every(act => !!selectedPermissions[`${act}_${type}_${id}`]);

        const handleToggleAllActions = () => {
            const nextVal = !allChecked;
            setSelectedPermissions(prev => {
                const updated = { ...prev };
                availableActions.forEach(act => {
                    updated[`${act}_${type}_${id}`] = nextVal;
                });
                return updated;
            });
        };

        return (
            <div 
                className="d-flex flex-wrap align-items-center gap-2 ms-4 mt-1 mb-2 p-2 rounded" 
                style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
                {availableActions.length > 1 && (
                    <Form.Check
                        type="checkbox"
                        id={`all_actions_${type}_${id}`}
                        label={
                            <span 
                                className="badge" 
                                style={{ 
                                    backgroundColor: allChecked ? '#0a500f' : '#64748b', 
                                    color: '#fff', 
                                    cursor: 'pointer', 
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '3px 6px'
                                }}
                            >
                                {allChecked ? 'All Actions ✓' : 'All Actions'}
                            </span>
                        }
                        checked={allChecked}
                        onChange={handleToggleAllActions}
                        className="me-2"
                    />
                )}
                {availableActions.map(act => (
                    <Form.Check
                        key={act}
                        type="checkbox"
                        id={`${act}_${type}_${id}`}
                        label={<small className="text-capitalize text-muted fw-500">{act}</small>}
                        checked={selectedPermissions[`${act}_${type}_${id}`] || false}
                        onChange={() => handleCheckboxChange(type, id, act)}
                        className="me-2 mb-0"
                    />
                ))}
            </div>
        );
    };

    // Group menus by category or name
    const groupMenusByCategory = () => {
        const groups = {};
        menus.forEach(menu => {
            const category = menu.name.toUpperCase();
            if (!groups[category]) {
                groups[category] = {
                    menu: menu,
                    submenus: []
                };
            }
        });

        // Add submenus to groups
        submenus.forEach(submenu => {
            const menu = menus.find(m => m.id === submenu.menu);
            if (menu) {
                const category = menu.name.toUpperCase();
                if (groups[category]) {
                    // Find subsubmenus for this submenu
                    const relatedSubSubmenus = subsubmenus.filter(ssm => ssm.submenu === submenu.id);
                    groups[category].submenus.push({
                        ...submenu,
                        subsubmenus: relatedSubSubmenus
                    });
                }
            }
        });

        return groups;
    };

    // Save permissions
    const handleSave = async () => {
        if (!selectedRole) {
            swal('Error', 'Please select a role first', 'error');
            return;
        }

        try {
            setLoading(true);

            // Get current permissions
            const currentPerms = permissions;

            // Determine what to add, update, and remove
            const itemsToProcess = [];
            const toRemove = [];

            // Check all items (menus, submenus, subsubmenus)
            const allItems = [
                ...menus.map(m => ({ ...m, type: 'menu', id: m.id, menuId: m.id, submenuId: null, subsubmenuId: null })),
                ...submenus.map(sm => ({ ...sm, type: 'submenu', id: sm.id, menuId: sm.menu, submenuId: sm.id, subsubmenuId: null })),
                ...subsubmenus.map(ssm => {
                    const sm = submenus.find(s => s.id === ssm.submenu);
                    return { ...ssm, type: 'subsubmenu', id: ssm.id, menuId: sm ? sm.menu : null, submenuId: ssm.submenu, subsubmenuId: ssm.id };
                })
            ].filter(item => item.menuId != null);

            allItems.forEach(item => {
                const viewKey = `${item.type}_${item.id}`;
                const isSelected = selectedPermissions[viewKey];
                const existingPerm = currentPerms.find(p =>
                    (item.type === 'menu' && p.menu === item.id && !p.submenu && !p.sub_submenu) ||
                    (item.type === 'submenu' && p.submenu === item.id && !p.sub_submenu) ||
                    (item.type === 'subsubmenu' && p.sub_submenu === item.id && (p.submenu === item.submenuId || !item.submenuId))
                );

                if (isSelected) {
                    const permData = {
                        role: selectedRole,
                        menu: item.menuId,
                        submenu: item.submenuId,
                        sub_submenu: item.subsubmenuId,
                        can_view: true,
                        can_create: item.has_create ? (selectedPermissions[`create_${item.type}_${item.id}`] || false) : false,
                        can_edit: item.has_edit ? (selectedPermissions[`edit_${item.type}_${item.id}`] || false) : false,
                        can_delete: item.has_delete ? (selectedPermissions[`delete_${item.type}_${item.id}`] || false) : false,
                        can_approve: item.has_approve ? (selectedPermissions[`approve_${item.type}_${item.id}`] || false) : false,
                        can_reject: item.has_reject ? (selectedPermissions[`reject_${item.type}_${item.id}`] || false) : false,
                        can_details: item.has_details ? (selectedPermissions[`details_${item.type}_${item.id}`] || false) : false,
                        can_allocate: item.has_allocate ? (selectedPermissions[`allocate_${item.type}_${item.id}`] || false) : false,
                        can_history: item.has_history ? (selectedPermissions[`history_${item.type}_${item.id}`] || false) : false,
                    };

                    if (existingPerm) {
                        // Check if data changed
                        const isChanged =
                            existingPerm.can_view !== permData.can_view ||
                            existingPerm.can_create !== permData.can_create ||
                            existingPerm.can_edit !== permData.can_edit ||
                            existingPerm.can_delete !== permData.can_delete ||
                            existingPerm.can_approve !== permData.can_approve ||
                            existingPerm.can_reject !== permData.can_reject ||
                            existingPerm.can_details !== permData.can_details ||
                            existingPerm.can_allocate !== permData.can_allocate ||
                            existingPerm.can_history !== permData.can_history;

                        if (isChanged) {
                            itemsToProcess.push({ action: 'update', id: existingPerm.id, data: permData });
                        }
                    } else {
                        itemsToProcess.push({ action: 'create', data: permData });
                    }
                } else if (existingPerm) {
                    toRemove.push(existingPerm.id);
                }
            });

            // Process removals
            for (const permId of toRemove) {
                await deletePermission(permId);
            }

            // Process additions and updates
            for (const item of itemsToProcess) {
                if (item.action === 'create') {
                    await createPermission(item.data);
                } else {
                    await updatePermission(item.id, item.data);
                }
            }

            // Re-fetch to be sure
            swal('Success', 'Permissions updated successfully!', 'success');
            navigate('/hr/roles');
        } catch (error) {
            swal('Error', formatError(error), 'error');
        } finally {
            setLoading(false);
        }
    };

    const groups = groupMenusByCategory();

    const duplicateOptions = roles
        .filter(r => r.id !== parseInt(selectedRole))
        .map(role => ({
            value: role.id.toString(),
            label: role.name
        }));

    const currentDuplicateValue = duplicateOptions.find(opt => opt.value === (duplicateRole || '').toString()) || null;

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header>
                            <h4 className="card-title">
                                Assign {selectedRole ? `Submenu Permissions For ${roles.find(r => r.id === parseInt(selectedRole))?.name || 'Role'}` : 'Submenu Permissions'}
                            </h4>
                        </Card.Header>
                        <Card.Body>
                            {!selectedRole ? (
                                <div className="text-center text-muted py-5">
                                    <i className="fa fa-users fa-3x mb-3"></i>
                                    <p>Please select a role to manage its permissions</p>
                                </div>
                            ) : loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Top Control Bar: Duplicate From & Bulk Actions on the same line */}
                                    <div 
                                        className="mb-4 mt-3 px-4 py-3 border shadow-sm" 
                                        style={{ 
                                            backgroundColor: '#ffffff', 
                                            borderRadius: '12px', 
                                            borderColor: '#e2e8f0',
                                            height: 'auto'
                                        }}
                                    >
                                        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
                                            {/* Duplicate From on the Left */}
                                            <Form.Group style={{ flex: '1 1 300px', maxWidth: '380px', marginBottom: 0 }}>
                                                <Form.Label className="text-black font-w500 mb-1" style={{ fontSize: '13px' }}>Duplicate From:</Form.Label>
                                                <div className="d-flex gap-2 align-items-center">
                                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                                        <Select
                                                            options={duplicateOptions}
                                                            value={currentDuplicateValue}
                                                            onChange={(opt) => setDuplicateRole(opt ? opt.value : '')}
                                                            placeholder="-- Choose Role to Copy --"
                                                            isClearable
                                                            isDisabled={duplicating}
                                                            styles={{
                                                                control: (base, state) => ({
                                                                    ...base,
                                                                    minHeight: '38px',
                                                                    borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
                                                                    boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.15)' : 'none',
                                                                    '&:hover': { borderColor: '#0a500f' },
                                                                    borderRadius: '10px',
                                                                    fontSize: '14px',
                                                                    color: '#334155',
                                                                }),
                                                                menu: base => ({ ...base, zIndex: 9999, fontSize: '14px' }),
                                                                option: (base, state) => ({
                                                                    ...base,
                                                                    backgroundColor: state.isSelected ? '#0a500f' : state.isFocused ? 'rgba(10, 80, 15, 0.1)' : 'white',
                                                                    color: state.isSelected ? 'white' : '#334155',
                                                                    cursor: 'pointer',
                                                                }),
                                                            }}
                                                        />
                                                    </div>
                                                    <Button 
                                                        variant="outline-info" 
                                                        onClick={() => handleDuplicate(duplicateRole)}
                                                        disabled={!duplicateRole || duplicating}
                                                        title="Copy permissions from selected role"
                                                        style={{ 
                                                            height: '38px', 
                                                            borderRadius: '10px', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            padding: '0 12px', 
                                                            fontSize: '13px', 
                                                            whiteSpace: 'nowrap' 
                                                        }}
                                                    >
                                                        {duplicating ? (
                                                            <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Copying...</>
                                                        ) : (
                                                            <><i className="fa fa-clone me-1"></i> Copy</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </Form.Group>

                                            {/* Bulk Actions on the Right */}
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <span className="fw-bold text-dark me-1" style={{ fontSize: '13px' }}>
                                                    <i className="fa fa-sliders text-primary me-1"></i>Bulk Actions:
                                                </span>
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() => handleSelectAll('full')}
                                                    style={{
                                                        backgroundColor: '#0a500f',
                                                        borderColor: '#0a500f',
                                                        borderRadius: '8px',
                                                        fontWeight: 500,
                                                        fontSize: '13px',
                                                        padding: '7px 14px',
                                                    }}
                                                >
                                                    <i className="fa fa-check-square-o me-1"></i> Select All (Full Access)
                                                </Button>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => handleSelectAll('viewOnly')}
                                                    style={{
                                                        borderRadius: '8px',
                                                        fontWeight: 500,
                                                        fontSize: '13px',
                                                        padding: '7px 14px',
                                                    }}
                                                >
                                                    <i className="fa fa-eye me-1"></i> Select All (View Only)
                                                </Button>

                                                <Dropdown as={ButtonGroup} size="sm">
                                                    <Button 
                                                        variant="outline-secondary" 
                                                        size="sm"
                                                        style={{ borderRadius: '8px 0 0 8px', fontWeight: 500, fontSize: '13px', padding: '7px 14px' }}
                                                    >
                                                        <i className="fa fa-list-ul me-1"></i> Quick Select by Tier
                                                    </Button>
                                                    <Dropdown.Toggle 
                                                        split 
                                                        variant="outline-secondary" 
                                                        id="dropdown-quick-select"
                                                        style={{ borderRadius: '0 8px 8px 0' }}
                                                    />
                                                    <Dropdown.Menu style={{ zIndex: 1050, minWidth: '230px' }}>
                                                        <Dropdown.Header className="text-uppercase fw-bold text-muted" style={{ fontSize: '11px' }}>Menus</Dropdown.Header>
                                                        <Dropdown.Item onClick={() => handleSelectAllMenus('full')}>
                                                            <i className="fa fa-check text-success me-2"></i> All Menus (Full Access)
                                                        </Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleSelectAllMenus('viewOnly')}>
                                                            <i className="fa fa-eye text-info me-2"></i> All Menus (View Only)
                                                        </Dropdown.Item>
                                                        <Dropdown.Divider />
                                                        <Dropdown.Header className="text-uppercase fw-bold text-muted" style={{ fontSize: '11px' }}>Submenus</Dropdown.Header>
                                                        <Dropdown.Item onClick={() => handleSelectAllSubmenus('full')}>
                                                            <i className="fa fa-check text-success me-2"></i> All Submenus (Full Access)
                                                        </Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleSelectAllSubmenus('viewOnly')}>
                                                            <i className="fa fa-eye text-info me-2"></i> All Submenus (View Only)
                                                        </Dropdown.Item>
                                                        <Dropdown.Divider />
                                                        <Dropdown.Header className="text-uppercase fw-bold text-muted" style={{ fontSize: '11px' }}>Sub-submenus</Dropdown.Header>
                                                        <Dropdown.Item onClick={() => handleSelectAllSubSubMenus('full')}>
                                                            <i className="fa fa-check text-success me-2"></i> All Sub-submenus (Full Access)
                                                        </Dropdown.Item>
                                                        <Dropdown.Item onClick={() => handleSelectAllSubSubMenus('viewOnly')}>
                                                            <i className="fa fa-eye text-info me-2"></i> All Sub-submenus (View Only)
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>

                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={handleClearAll}
                                                    style={{
                                                        borderRadius: '8px',
                                                        fontWeight: 500,
                                                        fontSize: '13px',
                                                        padding: '7px 14px',
                                                    }}
                                                >
                                                    <i className="fa fa-trash-o me-1"></i> Clear All
                                                </Button>

                                                {(() => {
                                                    const selectedCount = Object.keys(selectedPermissions).filter(k => 
                                                        selectedPermissions[k] && (k.startsWith('menu_') || k.startsWith('submenu_') || k.startsWith('subsubmenu_'))
                                                    ).length;
                                                    return (
                                                        <span className="badge rounded-pill bg-light text-secondary border px-3 py-2 fw-medium ms-1" style={{ fontSize: '12px' }}>
                                                            <i className="fa fa-check-circle text-success me-1"></i>
                                                            {selectedCount} item{selectedCount === 1 ? '' : 's'} selected
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Permissions Grid */}
                                    <Row>
                                        {Object.keys(groups).map(categoryName => {
                                            const group = groups[categoryName];
                                            return (
                                                <Col md={4} key={categoryName} className="mb-3">
                                                    <Card className="h-100" style={{ backgroundColor: '#f8f9fa' }}>
                                                        <Card.Header className="d-flex justify-content-between align-items-center py-2 px-3" style={{ backgroundColor: '#e9ecef' }}>
                                                            <h5 className="mb-0 fs-6 fw-bold text-dark">{categoryName}</h5>
                                                            <div className="d-flex gap-1 align-items-center">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-success py-1 px-2"
                                                                    style={{ fontSize: '11px', borderRadius: '6px', fontWeight: 500 }}
                                                                    title={`Select all in ${categoryName} (Full Access)`}
                                                                    onClick={() => handleCategoryBulkSelect(group, 'full')}
                                                                >
                                                                    All
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-info py-1 px-2"
                                                                    style={{ fontSize: '11px', borderRadius: '6px', fontWeight: 500 }}
                                                                    title={`Select all in ${categoryName} (View Only)`}
                                                                    onClick={() => handleCategoryBulkSelect(group, 'viewOnly')}
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-secondary py-1 px-2"
                                                                    style={{ fontSize: '11px', borderRadius: '6px', fontWeight: 500 }}
                                                                    title={`Clear all in ${categoryName}`}
                                                                    onClick={() => handleCategoryBulkSelect(group, 'clear')}
                                                                >
                                                                    Clear
                                                                </button>
                                                            </div>
                                                        </Card.Header>
                                                        <Card.Body>
                                                            {/* Main Menu */}
                                                            <Form.Check
                                                                type="checkbox"
                                                                id={`menu_${group.menu.id}`}
                                                                label={group.menu.name}
                                                                checked={selectedPermissions[`menu_${group.menu.id}`] || false}
                                                                onChange={() => handleCheckboxChange('menu', group.menu.id)}
                                                                className="mb-1 fw-bold"
                                                            />
                                                            {renderActionCheckboxes('menu', group.menu)}

                                                            {/* Submenus */}
                                                            {group.submenus.map(submenu => (
                                                                <div key={submenu.id} className="ms-3 mt-2">
                                                                    <Form.Check
                                                                        type="checkbox"
                                                                        id={`submenu_${submenu.id}`}
                                                                        label={submenu.name}
                                                                        checked={selectedPermissions[`submenu_${submenu.id}`] || false}
                                                                        onChange={() => handleCheckboxChange('submenu', submenu.id)}
                                                                        className="mb-1"
                                                                    />
                                                                    {renderActionCheckboxes('submenu', submenu)}

                                                                    {/* SubSubMenus nested under Submenu */}
                                                                    {submenu.subsubmenus && submenu.subsubmenus.map(subsubmenu => (
                                                                        <div key={subsubmenu.id} className="ms-4 mt-1">
                                                                            <Form.Check
                                                                                type="checkbox"
                                                                                id={`subsubmenu_${subsubmenu.id}`}
                                                                                label={subsubmenu.name}
                                                                                checked={selectedPermissions[`subsubmenu_${subsubmenu.id}`] || false}
                                                                                onChange={() => handleCheckboxChange('subsubmenu', subsubmenu.id)}
                                                                                className="mb-1 text-muted"
                                                                                style={{ fontSize: '0.9em' }}
                                                                            />
                                                                            {renderActionCheckboxes('subsubmenu', subsubmenu)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </Card.Body>
                                                    </Card>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                    {/* Action Buttons */}
                                    <div className="d-flex gap-2 mt-4 mb-4 justify-content-end">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/hr/roles')}
                                            disabled={loading}
                                            style={{
                                                backgroundColor: '#0a500f',
                                                color: 'white',
                                                borderRadius: '8px',
                                                fontWeight: 500,
                                                fontSize: '14px',
                                                padding: '10px 24px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#073d0b'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0a500f'}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={loading}
                                            style={{
                                                backgroundColor: '#0a500f',
                                                color: 'white',
                                                borderRadius: '8px',
                                                fontWeight: 500,
                                                fontSize: '14px',
                                                padding: '10px 24px',
                                                border: 'none',
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                                opacity: loading ? 0.75 : 1,
                                                transition: 'background-color 0.2s',
                                            }}
                                            onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#073d0b'; }}
                                            onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = '#0a500f'; }}
                                        >
                                            {loading ? (
                                                <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                                            ) : 'Save'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ManagePermissions;
