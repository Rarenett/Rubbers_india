import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { Card, Modal, Form, Button, Tabs, Tab, Nav } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import { getStockItems } from '../../../services/InventoryService';
import { ThemeContext } from '../../../context/ThemeContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePageTitle } from '../../../context/TitleContext';
import { useDispatch, useSelector } from 'react-redux';
import { navtoggle } from '../../../store/actions/AuthActions';
import Pagination from '../Common/Pagination';


const WalletSchemes = () => {
    usePageTitle("Schemes");
    const dispatch = useDispatch();
    const sideMenu = useSelector(state => state.sideMenu);
    const sideMenuRef = useRef(sideMenu);

    useEffect(() => {
        sideMenuRef.current = sideMenu;
    }, [sideMenu]);

    useEffect(() => {
        if (window.innerWidth <= 1199 && sideMenuRef.current) {
            dispatch(navtoggle());
        }
    }, [dispatch]);

    const { background } = useContext(ThemeContext) || {};
    const isDark = background?.value === 'dark';

    const [schemes, setSchemes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Search and Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Stock Items for Product ID dropdown
    const [stockItems, setStockItems] = useState([]);

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const data = await getStockItems();
                const list = Array.isArray(data) ? data : (data?.results || []);
                setStockItems(list);
            } catch (err) {
                console.error('Error fetching stock items:', err);
            }
        };
        fetchItems();
    }, []);

    const productOptions = useMemo(() => {
        return stockItems.map(item => ({
            value: item.id,
            label: item.item_code ? `${item.item_code} - ${item.name}` : `${item.name} (#${item.id})`,
            item_code: item.item_code,
            name: item.name
        }));
    }, [stockItems]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [activeTab, setActiveTab] = useState('general');

    const [formData, setFormData] = useState({
        name: '',
        start_date: '',
        end_date: '',
        status: 'Active',
        criteria_type: 'Quantity',
        is_consolidated: false,
        remarks: '',
        criteria: ''
    });
    const [formErrors, setFormErrors] = useState({});

    // Dynamic criteria rows helper (Tab 2: Quantity based)
    const createEmptyCriteriaRow = () => ({
        _tempId: `row_qty_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        id: null,
        product: null,
        quantity: '',
        percentage: '',
        value: '',
        points: ''
    });

    // Dynamic criteria values helper (Tab 3: Value based - stored in wallet_criteria_values)
    const createEmptyCriteriaValueRow = () => ({
        _tempId: `row_val_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        id: null,
        product: null,
        value: '',
        discount_percentage: '',
        discount_value: '',
        points: ''
    });

    const [criteriaRows, setCriteriaRows] = useState([createEmptyCriteriaRow()]);
    const [criteriaRows2, setCriteriaRows2] = useState([createEmptyCriteriaValueRow()]);

    // Custom select styles for criteria table cell - matches rendered dimensions and styling of Form.Control fields
    const tableSelectStyles = useMemo(() => ({
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused ? '#0a500f' : (isDark ? '#636363' : '#EEEEEE'),
            borderWidth: '0.0625rem',
            borderStyle: 'solid',
            minHeight: '56px',
            height: '56px',
            borderRadius: '0.5rem',
            fontSize: '13px',
            boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(67, 220, 128, 0.25)' : 'none',
            width: '100%',
            cursor: 'text',
            transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            '&:hover': {
                borderColor: state.isFocused ? '#0a500f' : (isDark ? '#636363' : '#cbd5e1')
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 1.25rem',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            minWidth: 0,
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#6e6e6e',
            fontSize: '13px',
            margin: '0',
            lineHeight: '1.5',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? '#888888' : '#6c757d',
            fontSize: '13px',
            margin: '0',
            lineHeight: '1.5',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#4b5563' : '#cbd5e1',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 99999
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 99999
        }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '13px',
            backgroundColor: state.isSelected
                ? '#0a500f'
                : state.isFocused
                    ? (isDark ? '#334155' : '#f1f5f9')
                    : 'transparent',
            color: state.isSelected ? '#ffffff' : (isDark ? '#ffffff' : '#1e293b'),
            cursor: 'pointer'
        }),
        input: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#6e6e6e',
            margin: '0px',
            padding: '0px',
            fontSize: '13px',
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            paddingRight: '0.5rem',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            padding: '0 6px',
            color: isDark ? '#94a3b8' : '#7e7e7e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
                color: '#0a500f'
            }
        }),
        clearIndicator: (provided) => ({
            ...provided,
            padding: '0 4px',
            color: isDark ? '#94a3b8' : '#7e7e7e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
                color: '#ef4444'
            }
        })
    }), [isDark]);

    // Fetch records
    const fetchSchemes = useCallback(async () => {
        setLoading(true);
        try {
            const data = await WalletService.getSchemes();
            const list = Array.isArray(data) ? data : (data?.results || []);
            setSchemes(list);
        } catch (error) {
            console.error('Error fetching schemes:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load schemes records.'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSchemes();
    }, [fetchSchemes]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Filter and Search logic
    const filteredRecords = useMemo(() => {
        let list = schemes;
        if (statusFilter !== 'All') {
            list = list.filter(item => (item.effective_status || item.status) === statusFilter);
        }
        if (!searchTerm) return list;
        const lower = searchTerm.toLowerCase();
        return list.filter(item => {
            const matchesName = item.name && item.name.toLowerCase().includes(lower);
            const matchesRemarks = item.remarks && item.remarks.toLowerCase().includes(lower);
            const matchesCriteria = item.criteria && item.criteria.toLowerCase().includes(lower);
            return matchesName || matchesRemarks || matchesCriteria;
        });
    }, [schemes, searchTerm, statusFilter]);

    // Pagination slice
    const totalRecords = filteredRecords.length;
    const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentRecords = filteredRecords.slice(indexOfFirst, indexOfLast);

    // Modal Handlers
    const handleShowModal = (item = null) => {
        if (item && item.id) {
            setIsEditMode(true);
            setCurrentId(item.id);
            setFormData({
                name: item.name || '',
                start_date: item.start_date || '',
                end_date: item.end_date || '',
                status: item.status || 'Active',
                criteria_type: item.criteria_type || 'Quantity',
                is_consolidated: Boolean(item.is_consolidated),
                remarks: item.remarks || '',
                criteria: item.criteria || ''
            });

            // Map criteria rows for Tab 1 (group 'criteria')
            if (item.criteria_rows && item.criteria_rows.length > 0) {
                setCriteriaRows(
                    item.criteria_rows.map(r => ({
                        id: r.id,
                        _tempId: `saved_${r.id}`,
                        product: r.product,
                        percentage: r.percentage !== null && r.percentage !== undefined ? r.percentage : '',
                        value: r.value !== null && r.value !== undefined ? r.value : '',
                        quantity: r.quantity !== null && r.quantity !== undefined ? r.quantity : '',
                        points: r.points !== null && r.points !== undefined ? r.points : ''
                    }))
                );
            } else {
                // Fetch criteria rows from API for group 'criteria'
                WalletService.getSchemeCriteria(item.id, 'criteria')
                    .then(rows => {
                        if (Array.isArray(rows) && rows.length > 0) {
                            setCriteriaRows(
                                rows.map(r => ({
                                    id: r.id,
                                    _tempId: `saved_${r.id}`,
                                    product: r.product,
                                    percentage: r.percentage !== null && r.percentage !== undefined ? r.percentage : '',
                                    value: r.value !== null && r.value !== undefined ? r.value : '',
                                    quantity: r.quantity !== null && r.quantity !== undefined ? r.quantity : '',
                                    points: r.points !== null && r.points !== undefined ? r.points : ''
                                }))
                            );
                        } else {
                            setCriteriaRows([createEmptyCriteriaRow()]);
                        }
                    })
                    .catch(() => {
                        setCriteriaRows([createEmptyCriteriaRow()]);
                    });
            }

            // Map criteria values for Tab 3 (Value Based, table wallet_criteria_values)
            const rawValRows = item.criteria_values || item.criteria_rows_2;
            if (rawValRows && rawValRows.length > 0) {
                setCriteriaRows2(
                    rawValRows.map(r => ({
                        id: r.id,
                        _tempId: `saved2_${r.id}`,
                        product: r.product,
                        value: r.value !== null && r.value !== undefined ? r.value : '',
                        discount_percentage: r.discount_percentage !== null && r.discount_percentage !== undefined
                            ? r.discount_percentage
                            : (r.percentage !== null && r.percentage !== undefined ? r.percentage : ''),
                        discount_value: r.discount_value !== null && r.discount_value !== undefined
                            ? r.discount_value
                            : (r.quantity !== null && r.quantity !== undefined ? r.quantity : ''),
                        points: r.points !== null && r.points !== undefined ? r.points : ''
                    }))
                );
            } else if (rawValRows !== undefined && rawValRows.length === 0) {
                setCriteriaRows2([createEmptyCriteriaValueRow()]);
            } else {
                // Fetch criteria rows from API for group 'criteria_2' / values
                WalletService.getSchemeCriteria(item.id, 'criteria_2')
                    .then(rows => {
                        if (Array.isArray(rows) && rows.length > 0) {
                            setCriteriaRows2(
                                rows.map(r => ({
                                    id: r.id,
                                    _tempId: `saved2_${r.id}`,
                                    product: r.product,
                                    value: r.value !== null && r.value !== undefined ? r.value : '',
                                    discount_percentage: r.discount_percentage !== null && r.discount_percentage !== undefined
                                        ? r.discount_percentage
                                        : (r.percentage !== null && r.percentage !== undefined ? r.percentage : ''),
                                    discount_value: r.discount_value !== null && r.discount_value !== undefined
                                        ? r.discount_value
                                        : (r.quantity !== null && r.quantity !== undefined ? r.quantity : ''),
                                    points: r.points !== null && r.points !== undefined ? r.points : ''
                                }))
                            );
                        } else {
                            setCriteriaRows2([createEmptyCriteriaValueRow()]);
                        }
                    })
                    .catch(() => {
                        setCriteriaRows2([createEmptyCriteriaValueRow()]);
                    });
            }
        } else {
            setIsEditMode(false);
            setCurrentId(null);
            setFormData({
                name: '',
                start_date: '',
                end_date: '',
                status: 'Active',
                criteria_type: 'Quantity',
                is_consolidated: false,
                remarks: '',
                criteria: ''
            });
            setCriteriaRows([createEmptyCriteriaRow()]);
            setCriteriaRows2([createEmptyCriteriaValueRow()]);
        }
        setActiveTab('general');
        setFormErrors({});
        setShowModal(true);
    };

    const handleEdit = (item) => {
        handleShowModal(item);
    };

    const resetForm = () => {
        setIsEditMode(false);
        setCurrentId(null);
        setFormData({
            name: '',
            start_date: '',
            end_date: '',
            status: 'Active',
            criteria_type: 'Quantity',
            is_consolidated: false,
            remarks: '',
            criteria: ''
        });
        setCriteriaRows([createEmptyCriteriaRow()]);
        setCriteriaRows2([createEmptyCriteriaValueRow()]);
        setActiveTab('general');
        setFormErrors({});
        setShowModal(false);
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 100);
    };

    // Criteria row management
    const handleAddCriteriaRow = () => {
        setCriteriaRows(prev => [...prev, createEmptyCriteriaRow()]);
        if (formErrors.criteria || formErrors.row_errors) {
            setFormErrors(prev => ({ ...prev, criteria: undefined, row_errors: undefined }));
        }
    };

    const handleCriteriaRowChange = (tempId, field, value) => {
        setCriteriaRows(prev => prev.map(row => {
            if (row._tempId === tempId) {
                return { ...row, [field]: value };
            }
            return row;
        }));
        if (formErrors.criteria || formErrors.row_errors) {
            setFormErrors(prev => ({ ...prev, criteria: undefined, row_errors: undefined }));
        }
    };

    const handleRemoveCriteriaRow = (tempId) => {
        setCriteriaRows(prev => {
            const updated = prev.filter(r => r._tempId !== tempId);
            return updated.length > 0 ? updated : [createEmptyCriteriaRow()];
        });
        if (formErrors.criteria || formErrors.row_errors) {
            setFormErrors(prev => ({ ...prev, criteria: undefined, row_errors: undefined }));
        }
    };

    // Criteria 2 row management (Second Criteria Tab - Value Based)
    const handleAddCriteriaRow2 = () => {
        setCriteriaRows2(prev => [...prev, createEmptyCriteriaValueRow()]);
        if (formErrors.criteria_2 || formErrors.row_errors_2) {
            setFormErrors(prev => ({ ...prev, criteria_2: undefined, row_errors_2: undefined }));
        }
    };

    const handleCriteriaRowChange2 = (tempId, field, value) => {
        setCriteriaRows2(prev => prev.map(row => {
            if (row._tempId === tempId) {
                return { ...row, [field]: value };
            }
            return row;
        }));
        if (formErrors.criteria_2 || formErrors.row_errors_2) {
            setFormErrors(prev => ({ ...prev, criteria_2: undefined, row_errors_2: undefined }));
        }
    };

    const handleRemoveCriteriaRow2 = (tempId) => {
        setCriteriaRows2(prev => {
            const updated = prev.filter(r => r._tempId !== tempId);
            return updated.length > 0 ? updated : [createEmptyCriteriaValueRow()];
        });
        if (formErrors.criteria_2 || formErrors.row_errors_2) {
            setFormErrors(prev => ({ ...prev, criteria_2: undefined, row_errors_2: undefined }));
        }
    };

    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                const inputs = Array.from(
                    document.querySelectorAll('.wallet-scheme-modal input:not([disabled]):not([readonly]), .wallet-scheme-modal textarea:not([disabled]):not([readonly])')
                ).filter(el => el.offsetParent !== null && el.type !== 'hidden');
                if (inputs.length > 0) {
                    inputs[0].focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal, activeTab]);

    const getFocusable = () => {
        const modal = document.querySelector('.wallet-scheme-modal');
        if (!modal) return [];
        return Array.from(
            modal.querySelectorAll(
                '.form-control-custom, button[type="submit"]:not([disabled])'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled);
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        if (e.target.closest('.react-select') || e.target.closest('table')) return;

        const all = getFocusable();
        const index = all.indexOf(document.activeElement);
        if (index > -1 && index < all.length - 1) {
            e.preventDefault();
            if (index === all.length - 2) {
                all[all.length - 1].click();
            } else {
                all[index + 1].focus();
            }
        }
    };

    const handleFocus = () => {
        // Keeps standard focus behavior
    };

    // Validation
    const validateForm = () => {
        const errors = {};
        const trimmedName = formData.name.trim();

        if (!trimmedName) {
            errors.name = 'Scheme Name is required.';
        } else {
            const isDuplicate = schemes.some(s => 
                s.name && 
                s.name.trim().toLowerCase() === trimmedName.toLowerCase() && 
                (!isEditMode || String(s.id) !== String(currentId))
            );
            if (isDuplicate) {
                errors.name = `A scheme with the name '${trimmedName}' already exists. Duplicate scheme names are not allowed.`;
            }
        }

        if (!formData.start_date) {
            errors.start_date = 'Start Date is required.';
        }

        if (!formData.end_date) {
            errors.end_date = 'End Date is required.';
        } else if (formData.start_date && formData.end_date < formData.start_date) {
            errors.end_date = 'End Date cannot be earlier than Start Date.';
        }

        const isQtyRequired = formData.criteria_type === 'Quantity' || formData.criteria_type === 'Both' || !formData.criteria_type;
        const isValRequired = formData.criteria_type === 'Value' || formData.criteria_type === 'Both';

        // Mandatory Criteria Validation (Tab 2: Quantity Based):
        const rowErrors = {};
        const criteriaErrList = [];

        if (isQtyRequired) {
            if (!criteriaRows || criteriaRows.length === 0) {
                errors.criteria = 'Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme.';
            } else {
                const hasAnyProduct = criteriaRows.some(r => !!r.product);
                const hasAnyInput = criteriaRows.some(r => 
                    r.product || 
                    (r.percentage !== '' && r.percentage !== null && r.percentage !== undefined) ||
                    (r.value !== '' && r.value !== null && r.value !== undefined) ||
                    (r.quantity !== '' && r.quantity !== null && r.quantity !== undefined) ||
                    (r.points !== '' && r.points !== null && r.points !== undefined)
                );

                if (!hasAnyInput || !hasAnyProduct) {
                    errors.criteria = 'Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme.';
                }

                let validCount = 0;
                criteriaRows.forEach((row, idx) => {
                    const rErr = {};
                    const rowNum = idx + 1;

                    const isCompletelyEmpty = !row.product && 
                        (row.percentage === '' || row.percentage === null || row.percentage === undefined) &&
                        (row.value === '' || row.value === null || row.value === undefined) &&
                        (row.quantity === '' || row.quantity === null || row.quantity === undefined) &&
                        (row.points === '' || row.points === null || row.points === undefined);

                    if (isCompletelyEmpty) {
                        rErr.product = 'Product ID is required';
                        criteriaErrList.push(`Row ${rowNum}: Please select a Product ID or delete this blank row.`);
                    } else if (!row.product) {
                        rErr.product = 'Product ID is required';
                        criteriaErrList.push(`Row ${rowNum}: Please select a Product ID.`);
                    }

                    if (row.percentage !== '' && row.percentage !== null && row.percentage !== undefined) {
                        const pct = parseFloat(row.percentage);
                        if (isNaN(pct) || pct < 0 || pct > 100) {
                            rErr.percentage = 'Must be between 0 and 100';
                            criteriaErrList.push(`Row ${rowNum}: Percentage must be between 0 and 100.`);
                        }
                    }

                    if (row.value !== '' && row.value !== null && row.value !== undefined) {
                        const val = parseFloat(row.value);
                        if (isNaN(val) || val < 0) {
                            rErr.value = 'Cannot be negative';
                            criteriaErrList.push(`Row ${rowNum}: Value cannot be negative.`);
                        }
                    }

                    if (row.quantity !== '' && row.quantity !== null && row.quantity !== undefined) {
                        const qty = parseFloat(row.quantity);
                        if (isNaN(qty) || qty < 0) {
                            rErr.quantity = 'Cannot be negative';
                            criteriaErrList.push(`Row ${rowNum}: Quantity cannot be negative.`);
                        }
                    }

                    if (row.points !== '' && row.points !== null && row.points !== undefined) {
                        const pts = parseFloat(row.points);
                        if (isNaN(pts) || pts < 0) {
                            rErr.points = 'Cannot be negative';
                            criteriaErrList.push(`Row ${rowNum}: Points cannot be negative.`);
                        }
                    }

                    if (Object.keys(rErr).length > 0) {
                        rowErrors[idx] = rErr;
                    } else if (row.product) {
                        validCount++;
                    }
                });

                if (Object.keys(rowErrors).length > 0) {
                    errors.row_errors = rowErrors;
                    if (!errors.criteria) {
                        errors.criteria = criteriaErrList.join(' ');
                    }
                } else if (validCount === 0) {
                    errors.criteria = 'Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme.';
                }
            }
        }

        // Validate Tab 3 (Second Criteria Tab - Value Based):
        const rowErrors2 = {};
        const criteria2ErrList = [];

        if (isValRequired) {
            if (!criteriaRows2 || criteriaRows2.length === 0) {
                errors.criteria_2 = 'Please add at least one valid criteria row in the Value Based Criteria tab before saving the scheme.';
            } else {
                const hasAnyProduct2 = criteriaRows2.some(r => !!r.product);
                const hasAnyInput2 = criteriaRows2.some(r => 
                    r.product || 
                    (r.value !== '' && r.value !== null && r.value !== undefined) ||
                    (r.discount_percentage !== '' && r.discount_percentage !== null && r.discount_percentage !== undefined) ||
                    (r.discount_value !== '' && r.discount_value !== null && r.discount_value !== undefined) ||
                    (r.points !== '' && r.points !== null && r.points !== undefined)
                );

                if (!hasAnyInput2 || !hasAnyProduct2) {
                    errors.criteria_2 = 'Please add at least one valid criteria row in the Value Based Criteria tab before saving the scheme.';
                }

                let validCount2 = 0;
                criteriaRows2.forEach((row, idx) => {
                    const rErr = {};
                    const rowNum = idx + 1;

                    const isCompletelyEmpty = !row.product && 
                        (row.value === '' || row.value === null || row.value === undefined) &&
                        (row.discount_percentage === '' || row.discount_percentage === null || row.discount_percentage === undefined) &&
                        (row.discount_value === '' || row.discount_value === null || row.discount_value === undefined) &&
                        (row.points === '' || row.points === null || row.points === undefined);

                    if (isCompletelyEmpty) {
                        rErr.product = 'Product ID is required';
                        criteria2ErrList.push(`Row ${rowNum}: Please select a Product ID or delete this blank row.`);
                    } else if (!row.product) {
                        rErr.product = 'Product ID is required';
                        criteria2ErrList.push(`Row ${rowNum}: Please select a Product ID.`);
                    }

                    if (row.value !== '' && row.value !== null && row.value !== undefined) {
                        const val = parseFloat(row.value);
                        if (isNaN(val) || val < 0) {
                            rErr.value = 'Cannot be negative';
                            criteria2ErrList.push(`Row ${rowNum}: Value cannot be negative.`);
                        }
                    }

                    if (row.discount_percentage !== '' && row.discount_percentage !== null && row.discount_percentage !== undefined) {
                        const pct = parseFloat(row.discount_percentage);
                        if (isNaN(pct) || pct < 0 || pct > 100) {
                            rErr.discount_percentage = 'Must be between 0 and 100';
                            criteria2ErrList.push(`Row ${rowNum}: Discount Percentage must be between 0 and 100.`);
                        }
                    }

                    if (row.discount_value !== '' && row.discount_value !== null && row.discount_value !== undefined) {
                        const dv = parseFloat(row.discount_value);
                        if (isNaN(dv) || dv < 0) {
                            rErr.discount_value = 'Cannot be negative';
                            criteria2ErrList.push(`Row ${rowNum}: Discount Value cannot be negative.`);
                        }
                    }

                    if (row.points !== '' && row.points !== null && row.points !== undefined) {
                        const pts = parseFloat(row.points);
                        if (isNaN(pts) || pts < 0) {
                            rErr.points = 'Cannot be negative';
                            criteria2ErrList.push(`Row ${rowNum}: Points cannot be negative.`);
                        }
                    }

                    if (Object.keys(rErr).length > 0) {
                        rowErrors2[idx] = rErr;
                    } else if (row.product) {
                        validCount2++;
                    }
                });

                if (Object.keys(rowErrors2).length > 0) {
                    errors.row_errors_2 = rowErrors2;
                    if (!errors.criteria_2) {
                        errors.criteria_2 = criteria2ErrList.join(' ');
                    }
                } else if (validCount2 === 0) {
                    errors.criteria_2 = 'Please add at least one valid criteria row in the Value Based Criteria tab before saving the scheme.';
                }
            }
        }

        setFormErrors(errors);

        if (errors.name || errors.start_date || errors.end_date) {
            setActiveTab('general');
        } else if (errors.criteria) {
            setActiveTab('criteria');
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: errors.criteria,
                confirmButtonColor: '#0a500f'
            });
        } else if (errors.criteria_2) {
            setActiveTab('criteria_2');
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: errors.criteria_2,
                confirmButtonColor: '#0a500f'
            });
        }

        return Object.keys(errors).length === 0;
    };

    // Form Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setSubmitting(true);
        const isQtyRequired = formData.criteria_type === 'Quantity' || formData.criteria_type === 'Both' || !formData.criteria_type;
        const isValRequired = formData.criteria_type === 'Value' || formData.criteria_type === 'Both';

        const validRows1 = isQtyRequired
            ? criteriaRows.map(r => ({
                ...(r.id ? { id: r.id } : {}),
                product: r.product,
                quantity: r.quantity !== '' && r.quantity !== null && !isNaN(parseFloat(r.quantity)) ? parseFloat(r.quantity) : 0,
                percentage: r.percentage !== '' && r.percentage !== null && !isNaN(parseFloat(r.percentage)) ? parseFloat(r.percentage) : 0,
                value: r.value !== '' && r.value !== null && !isNaN(parseFloat(r.value)) ? parseFloat(r.value) : 0,
                points: r.points !== '' && r.points !== null && !isNaN(parseFloat(r.points)) ? parseFloat(r.points) : 0,
            })).filter(r => !!r.product)
            : [];

        const validRows2 = isValRequired
            ? criteriaRows2.map(r => ({
                ...(r.id ? { id: r.id } : {}),
                product: r.product,
                value: r.value !== '' && r.value !== null && !isNaN(parseFloat(r.value)) ? parseFloat(r.value) : 0,
                discount_percentage: r.discount_percentage !== '' && r.discount_percentage !== null && !isNaN(parseFloat(r.discount_percentage)) ? parseFloat(r.discount_percentage) : 0,
                discount_value: r.discount_value !== '' && r.discount_value !== null && !isNaN(parseFloat(r.discount_value)) ? parseFloat(r.discount_value) : 0,
                points: r.points !== '' && r.points !== null && !isNaN(parseFloat(r.points)) ? parseFloat(r.points) : 0,
            })).filter(r => !!r.product)
            : [];

        if (isQtyRequired && validRows1.length === 0) {
            setSubmitting(false);
            setFormErrors(prev => ({
                ...prev,
                criteria: 'Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme.'
            }));
            setActiveTab('criteria');
            return;
        }

        if (isValRequired && validRows2.length === 0) {
            setSubmitting(false);
            setFormErrors(prev => ({
                ...prev,
                criteria_2: 'Please add at least one valid criteria row in Value Based Criteria before saving the scheme.'
            }));
            setActiveTab('criteria_2');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            start_date: formData.start_date,
            end_date: formData.end_date,
            status: formData.status || 'Active',
            criteria_type: formData.criteria_type || 'Quantity',
            is_consolidated: Boolean(formData.is_consolidated),
            remarks: formData.remarks ? formData.remarks.trim() : '',
            criteria: formData.criteria || '',
            criteria_rows: validRows1,
            criteria_values: validRows2,
            criteria_rows_2: validRows2
        };

        try {
            if (isEditMode) {
                await WalletService.updateScheme(currentId, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'Scheme updated successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            } else {
                await WalletService.createScheme(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Scheme created successfully',
                    timer: 2000,
                    showConfirmButton: false,
                    returnFocus: false
                });
            }
            resetForm();
            fetchSchemes();
        } catch (error) {
            console.error('Error saving scheme:', error);
            const serverErrors = error.response?.data;
            if (serverErrors && typeof serverErrors === 'object') {
                const formatted = {};
                if (serverErrors.name) {
                    formatted.name = Array.isArray(serverErrors.name) ? serverErrors.name[0] : serverErrors.name;
                }
                if (serverErrors.start_date) {
                    formatted.start_date = Array.isArray(serverErrors.start_date) ? serverErrors.start_date[0] : serverErrors.start_date;
                }
                if (serverErrors.end_date) {
                    formatted.end_date = Array.isArray(serverErrors.end_date) ? serverErrors.end_date[0] : serverErrors.end_date;
                }
                if (serverErrors.status) {
                    formatted.status = Array.isArray(serverErrors.status) ? serverErrors.status[0] : serverErrors.status;
                }
                if (serverErrors.criteria) {
                    formatted.criteria = Array.isArray(serverErrors.criteria) ? serverErrors.criteria[0] : serverErrors.criteria;
                }
                if (serverErrors.criteria_2) {
                    formatted.criteria_2 = Array.isArray(serverErrors.criteria_2) ? serverErrors.criteria_2[0] : serverErrors.criteria_2;
                }
                if (serverErrors.criteria_rows) {
                    formatted.criteria = Array.isArray(serverErrors.criteria_rows)
                        ? serverErrors.criteria_rows.map((e, i) => typeof e === 'object' ? Object.entries(e).map(([k, v]) => `Row ${i+1} ${k}: ${v}`).join(', ') : e).join('; ')
                        : JSON.stringify(serverErrors.criteria_rows);
                }
                if (serverErrors.criteria_values) {
                    formatted.criteria_2 = Array.isArray(serverErrors.criteria_values)
                        ? serverErrors.criteria_values.map((e, i) => typeof e === 'object' ? Object.entries(e).map(([k, v]) => `Row ${i+1} ${k}: ${v}`).join(', ') : e).join('; ')
                        : JSON.stringify(serverErrors.criteria_values);
                }
                if (serverErrors.criteria_rows_2) {
                    formatted.criteria_2 = Array.isArray(serverErrors.criteria_rows_2)
                        ? serverErrors.criteria_rows_2.map((e, i) => typeof e === 'object' ? Object.entries(e).map(([k, v]) => `Row ${i+1} ${k}: ${v}`).join(', ') : e).join('; ')
                        : JSON.stringify(serverErrors.criteria_rows_2);
                }
                if (serverErrors.remarks) {
                    formatted.remarks = Array.isArray(serverErrors.remarks) ? serverErrors.remarks[0] : serverErrors.remarks;
                }
                if (serverErrors.non_field_errors || serverErrors.detail || serverErrors.error) {
                    formatted.general = serverErrors.non_field_errors?.[0] || serverErrors.detail || serverErrors.error;
                }
                setFormErrors(formatted);
                if (formatted.name || formatted.start_date || formatted.end_date) {
                    setActiveTab('general');
                } else if (formatted.criteria) {
                    setActiveTab('criteria');
                } else if (formatted.criteria_2) {
                    setActiveTab('criteria_2');
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to save scheme. Please try again.',
                    returnFocus: false
                });
            }
        } finally {
            setSubmitting(false);
            setTimeout(() => {
                if (document.activeElement && typeof document.activeElement.blur === 'function') {
                    document.activeElement.blur();
                }
            }, 100);
        }
    };


    // Delete Record
    const handleDelete = async (item) => {
        if (item.points_entries_count > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Cannot Delete Scheme',
                html: `The scheme <b>"${item.name}"</b> has already been used for <b>${item.points_entries_count}</b> point ${item.points_entries_count === 1 ? 'entry' : 'entries'}.<br/><br/><span class="text-muted small">Schemes associated with existing point entries cannot be deleted to preserve transaction and audit history.</span>`,
                confirmButtonColor: '#0a500f',
                confirmButtonText: 'Understood'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'Delete Scheme?',
            text: `Are you sure you want to delete "${item.name || 'this scheme'}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await WalletService.deleteScheme(item.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted',
                    text: 'Scheme deleted successfully',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchSchemes();
            } catch (error) {
                console.error('Error deleting scheme:', error);
                const errMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to delete scheme.';
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: errMsg
                });
            }
        }
    };

    // Toggle Status with expired guard
    const handleToggleStatus = async (item) => {
        if (item.is_expired) {
            Swal.fire({
                icon: 'warning',
                title: 'Scheme Expired',
                text: `Cannot activate expired scheme "${item.name}". Its End Date (${formatDate(item.end_date)}) has passed. Please edit the scheme and extend the End Date first.`,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        const nextStatus = item.status === 'Active' ? 'Inactive' : 'Active';
        const actionLabel = item.status === 'Active' ? 'deactivate' : 'activate';

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to ${actionLabel} scheme "${item.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: `Yes, ${actionLabel}`,
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#0a500f'
        });

        if (result.isConfirmed) {
            try {
                await WalletService.toggleSchemeStatus(item.id);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: `Scheme has been set to ${nextStatus}.`,
                    timer: 1800,
                    showConfirmButton: false
                });
                fetchSchemes();
            } catch (error) {
                console.error('Error toggling scheme status:', error);
                const errMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to update scheme status.';
                Swal.fire({
                    icon: 'error',
                    title: 'Action Failed',
                    text: errMsg,
                    confirmButtonColor: '#0a500f'
                });
            }
        }
    };

    // Format date from YYYY-MM-DD to DD-MM-YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const parts = String(dateStr).split('-');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="container-fluid park-area-page">
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
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <Card.Title className="mb-0 text-nowrap">Schemes Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-3 flex-grow-1 justify-content-end header-actions-wrapper">
                                <div className="search-bar-container m-0 search-bar-wrapper" style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: '350px' }}>
                                    <span className="search-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Search scheme..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Form.Select
                                    style={{ width: '130px', minWidth: '130px' }}
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="form-control"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </Form.Select>
                                <div className="d-flex gap-2 align-items-center justify-content-start flex-shrink-0">
                                    <CreateButton
                                        module="wallet_schemes"
                                        onClick={() => handleShowModal()}
                                    >
                                        Scheme
                                    </CreateButton>
                                </div>
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
                                <div className="table-responsive park-area-table-wrapper">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>START DATE</strong></th>
                                                <th><strong>END DATE</strong></th>
                                                <th><strong>REMARKS</strong></th>
                                                <th><strong>CRITERIA</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentRecords.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td>{indexOfFirst + index + 1}</td>
                                                        <td><strong>{item.name || '-'}</strong></td>
                                                        <td>{formatDate(item.start_date)}</td>
                                                        <td>{formatDate(item.end_date)}</td>
                                                        <td>{item.remarks || '-'}</td>
                                                        <td>
                                                            <div style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={
                                                                ((item.criteria_rows?.length || 0) + (item.criteria_rows_2?.length || 0)) > 0
                                                                    ? `${(item.criteria_rows?.length || 0) + (item.criteria_rows_2?.length || 0)} criteria defined`
                                                                    : (item.criteria || '-')
                                                            }>
                                                                {((item.criteria_rows?.length || 0) + (item.criteria_rows_2?.length || 0)) > 0 ? (
                                                                    <span className="badge badge-sm badge-info light">
                                                                        <i className="fa fa-list me-1"></i> {(item.criteria_rows?.length || 0) + (item.criteria_rows_2?.length || 0)} Criteria
                                                                    </span>
                                                                ) : (
                                                                    item.criteria || '-'
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`badge rounded-pill ${
                                                                    (item.effective_status || item.status) === 'Active' && !item.is_expired
                                                                        ? 'bg-success-subtle text-success border border-success-subtle'
                                                                        : 'bg-danger text-white'
                                                                }`}
                                                                style={{ fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}
                                                                onClick={() => handleToggleStatus(item)}
                                                                title={
                                                                    item.is_expired
                                                                        ? 'Scheme expired (End Date passed). Click for details.'
                                                                        : 'Click to toggle status'
                                                                }
                                                            >
                                                                {item.effective_status || item.status}
                                                            </span>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end align-items-center gap-2">
                                                                <EditButton
                                                                    module="wallet_schemes"
                                                                    onClick={() => handleEdit(item)}
                                                                />
                                                                <DeleteButton
                                                                    module="wallet_schemes"
                                                                    onClick={() => handleDelete(item)}
                                                                    title={
                                                                        item.points_entries_count > 0
                                                                            ? `Cannot delete: used in ${item.points_entries_count} point ${item.points_entries_count === 1 ? 'entry' : 'entries'}`
                                                                            : 'Delete Scheme'
                                                                    }
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

                            {!loading && filteredRecords.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    setCurrentPage={setCurrentPage}
                                    totalPages={totalPages}
                                    indexOfFirst={indexOfFirst}
                                    indexOfLast={indexOfLast}
                                    totalRecords={filteredRecords.length}
                                    loading={loading}
                                />
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <Modal
                show={showModal}
                onHide={resetForm}
                dialogClassName="wallet-scheme-modal"
                backdrop="static"
                keyboard={false}
                restoreFocus={false}
                size="lg"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM10 19H5V5H10V19ZM19 19H12V5H19V19Z" fill="white" />
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                                {isEditMode ? 'Edit Scheme' : 'Add Scheme'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '12.5px' }}>
                                Enter details to manage scheme
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={resetForm}>
                        &times;
                    </button>
                </div>

                <Form noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocus}>
                    <div className="modal-body-custom">
                        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                            <Nav className="scheme-custom-tabs">
                                <Nav.Item>
                                    <Nav.Link eventKey="general">General Info</Nav.Link>
                                </Nav.Item>
                                {(formData.criteria_type === 'Quantity' || formData.criteria_type === 'Both' || !formData.criteria_type) && (
                                    <Nav.Item>
                                        <Nav.Link eventKey="criteria">
                                            Quantity Criteria <span className="text-danger">*</span>
                                            {criteriaRows.filter(r => !!r.product).length > 0 && (
                                                <span className="badge badge-xs badge-info ms-2" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
                                                    {criteriaRows.filter(r => !!r.product).length}
                                                </span>
                                            )}
                                            {formErrors.criteria && activeTab !== 'criteria' && (
                                                <span className="badge bg-danger rounded-pill ms-2" style={{ fontSize: '9px', padding: '2px 5px' }}>!</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                )}
                                {(formData.criteria_type === 'Value' || formData.criteria_type === 'Both') && (
                                    <Nav.Item>
                                        <Nav.Link eventKey="criteria_2">
                                            Value Criteria <span className="text-danger">*</span>
                                            {criteriaRows2.filter(r => !!r.product).length > 0 && (
                                                <span className="badge badge-xs badge-info ms-2" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
                                                    {criteriaRows2.filter(r => !!r.product).length}
                                                </span>
                                            )}
                                            {formErrors.criteria_2 && activeTab !== 'criteria_2' && (
                                                <span className="badge bg-danger rounded-pill ms-2" style={{ fontSize: '9px', padding: '2px 5px' }}>!</span>
                                            )}
                                        </Nav.Link>
                                    </Nav.Item>
                                )}
                            </Nav>

                            <Tab.Content className="scheme-tab-content">
                                {formErrors.general && (
                                    <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '13px' }}>{formErrors.general}</div>
                                )}

                                {/* Tab 1: General Info */}
                                <Tab.Pane eventKey="general">
                                    <div className="mb-2">
                                        <Form.Label className="form-label-custom">Scheme Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="name"
                                            className={`form-control-custom ${formErrors.name ? 'is-invalid' : ''}`}
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter scheme name"
                                            autoFocus
                                            required
                                        />
                                        {formErrors.name && (
                                            <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.name}</div>
                                        )}
                                    </div>

                                    <div className="row g-3 mb-2">
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Start Date <span className="text-danger">*</span></Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="start_date"
                                                className={`form-control-custom ${formErrors.start_date ? 'is-invalid' : ''}`}
                                                value={formData.start_date}
                                                onChange={(e) => {
                                                    const newStartDate = e.target.value;
                                                    setFormData(prev => ({ ...prev, start_date: newStartDate }));
                                                    if (formData.end_date && newStartDate && formData.end_date < newStartDate) {
                                                        setFormErrors(prev => ({
                                                            ...prev,
                                                            end_date: 'End Date cannot be earlier than Start Date.'
                                                        }));
                                                    } else {
                                                        setFormErrors(prev => ({
                                                            ...prev,
                                                            start_date: undefined,
                                                            end_date: prev.end_date === 'End Date cannot be earlier than Start Date.' ? undefined : prev.end_date
                                                        }));
                                                    }
                                                }}
                                                required
                                            />
                                            {formErrors.start_date && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.start_date}</div>
                                            )}
                                        </div>

                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">End Date <span className="text-danger">*</span></Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="end_date"
                                                className={`form-control-custom ${formErrors.end_date ? 'is-invalid' : ''}`}
                                                value={formData.end_date}
                                                min={formData.start_date || undefined}
                                                onChange={(e) => {
                                                    const newEndDate = e.target.value;
                                                    setFormData(prev => ({ ...prev, end_date: newEndDate }));
                                                    if (formData.start_date && newEndDate && newEndDate < formData.start_date) {
                                                        setFormErrors(prev => ({
                                                            ...prev,
                                                            end_date: 'End Date cannot be earlier than Start Date.'
                                                        }));
                                                    } else {
                                                        setFormErrors(prev => ({
                                                            ...prev,
                                                            end_date: undefined
                                                        }));
                                                    }
                                                }}
                                                required
                                            />
                                            {formErrors.end_date && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.end_date}</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-2">
                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">Status</Form.Label>
                                            <Form.Select
                                                name="status"
                                                size="sm"
                                                className={`form-control-custom form-control-sm ${formErrors.status ? 'is-invalid' : ''}`}
                                                style={{ fontSize: '13px', height: '38px', minHeight: '38px' }}
                                                value={formData.status || 'Active'}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, status: e.target.value });
                                                    setFormErrors(prev => ({ ...prev, status: undefined }));
                                                }}
                                            >
                                                <option value="Active">Active</option>
                                                <option value="Inactive">Inactive</option>
                                            </Form.Select>
                                            {formErrors.status && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.status}</div>
                                            )}
                                        </div>

                                        <div className="col-md-6">
                                            <Form.Label className="form-label-custom">
                                                Criteria Based On <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Select
                                                name="criteria_type"
                                                size="sm"
                                                className={`form-control-custom form-control-sm ${formErrors.criteria_type ? 'is-invalid' : ''}`}
                                                style={{ fontSize: '13px', height: '38px', minHeight: '38px' }}
                                                value={formData.criteria_type || 'Quantity'}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, criteria_type: e.target.value });
                                                    setFormErrors(prev => ({ ...prev, criteria_type: undefined }));
                                                }}
                                            >
                                                <option value="Quantity">Quantity Based</option>
                                                <option value="Value">Value Based</option>
                                                <option value="Both">Both (Quantity & Value)</option>
                                            </Form.Select>
                                            {formErrors.criteria_type && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{formErrors.criteria_type}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Consolidated Checkbox Field */}
                                    <div className="mb-2">
                                        <div className="form-check d-flex align-items-center gap-2 ps-0">
                                            <Form.Check
                                                type="checkbox"
                                                id="is_consolidated_check"
                                                name="is_consolidated"
                                                checked={Boolean(formData.is_consolidated)}
                                                onChange={(e) => setFormData({ ...formData, is_consolidated: e.target.checked })}
                                                label={
                                                    <span className="form-label-custom mb-0" style={{ cursor: 'pointer', userSelect: 'none' }}>
                                                        Consolidated
                                                    </span>
                                                }
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-1">
                                        <Form.Label className="form-label-custom">Remarks <span className="text-muted fw-normal">(Optional)</span></Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={2}
                                            name="remarks"
                                            className="form-control-custom"
                                            placeholder="Optional notes or administrative remarks..."
                                            value={formData.remarks}
                                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        />
                                    </div>
                                </Tab.Pane>

                                {/* Tab 2: Criteria */}
                                <Tab.Pane eventKey="criteria">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <h6 className="fw-bold mb-1 text-primary" style={{ fontSize: '13.5px' }}>
                                                <i className="fa fa-list-check me-2"></i>
                                                Scheme Criteria Quantity Based
                                            </h6>
                                            <p className="text-muted mb-0 small" style={{ fontSize: '12px' }}>
                                                Add multiple criteria rows for this scheme based on  quantity 
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={handleAddCriteriaRow}
                                            className="fw-semibold"
                                            style={{ fontSize: '12px', padding: '4px 10px' }}
                                        >
                                            <i className="fa fa-plus me-1"></i> Add Criteria
                                        </Button>
                                    </div>

                                    {formErrors.criteria && (
                                        <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '12px' }}>
                                            {formErrors.criteria}
                                        </div>
                                    )}

                                    <div className="table-responsive border rounded mb-1">
                                        <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                                            <thead style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                                <tr>
                                                    <th style={{ minWidth: '140px' }}>Scheme Name</th>
                                                    <th style={{ minWidth: '220px' }}>Product ID <span className="text-danger">*</span></th>
                                                    <th style={{ width: '115px' }}>Quantity</th>
                                                    <th style={{ width: '115px' }}>Discount Percentage (%)</th>
                                                    <th style={{ width: '110px' }}>Discount Value</th>
                                                    <th style={{ width: '110px' }}>Points</th>
                                                    <th style={{ width: '50px' }} className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaRows.map((row, idx) => {
                                                    const rowErr = formErrors.row_errors?.[idx] || {};
                                                    return (
                                                        <tr key={row._tempId} style={{ backgroundColor: isDark ? '#24292D' : '#ffffff' }}>
                                                            {/* Scheme Name - Auto-populated from General Info */}
                                                            <td>
                                                                <Form.Control
                                                                    type="text"
                                                                    size="sm"
                                                                    value={formData.name || '(Current Scheme)'}
                                                                    readOnly
                                                                    className="bg-light text-muted"
                                                                    style={{ fontSize: '13px', cursor: 'default' }}
                                                                    title="Scheme Name automatically populated from General Info"
                                                                />
                                                            </td>

                                                            {/* Product ID */}
                                                            <td>
                                                                <Select
                                                                    className="criteria-product-select"
                                                                    classNamePrefix="react-select"
                                                                    options={productOptions}
                                                                    value={productOptions.find(opt => opt.value === row.product) || null}
                                                                    onChange={(selected) => handleCriteriaRowChange(row._tempId, 'product', selected ? selected.value : null)}
                                                                    placeholder="Select Product"
                                                                    isSearchable
                                                                    isClearable
                                                                    tabSelectsValue={false}
                                                                    styles={{
                                                                        ...tableSelectStyles,
                                                                        control: (provided, state) => ({
                                                                            ...tableSelectStyles.control(provided, state),
                                                                            ...(rowErr.product ? {
                                                                                borderColor: '#dc3545',
                                                                                boxShadow: '0 0 0 0.25rem rgba(220, 53, 69, 0.25)'
                                                                            } : {})
                                                                        })
                                                                    }}
                                                                    menuPortalTarget={document.body}
                                                                    menuPosition="fixed"
                                                                />
                                                                {rowErr.product && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.product}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Quantity */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="quantity"
                                                                    aria-label="Quantity"
                                                                    placeholder="0.00"
                                                                    value={row.quantity}
                                                                    isInvalid={!!rowErr.quantity}
                                                                    onChange={(e) => handleCriteriaRowChange(row._tempId, 'quantity', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.quantity && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.quantity}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Discount Percentage */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    size="sm"
                                                                    name="percentage"
                                                                    aria-label="Discount Percentage"
                                                                    placeholder="0.00"
                                                                    value={row.percentage}
                                                                    isInvalid={!!rowErr.percentage}
                                                                    onChange={(e) => handleCriteriaRowChange(row._tempId, 'percentage', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.percentage && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.percentage}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Discount Value */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="value"
                                                                    aria-label="Discount Value"
                                                                    placeholder="0.00"
                                                                    value={row.value}
                                                                    isInvalid={!!rowErr.value}
                                                                    onChange={(e) => handleCriteriaRowChange(row._tempId, 'value', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.value && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.value}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Points */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="points"
                                                                    aria-label="Points"
                                                                    placeholder="0.00"
                                                                    value={row.points}
                                                                    isInvalid={!!rowErr.points}
                                                                    onChange={(e) => handleCriteriaRowChange(row._tempId, 'points', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.points && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.points}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Action */}
                                                            <td className="text-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    className="py-0 px-2"
                                                                    style={{ height: '36px', minWidth: '36px' }}
                                                                    onClick={() => handleRemoveCriteriaRow(row._tempId)}
                                                                    title="Delete Criteria Row"
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Tab.Pane>

                                {/* Tab 3: Criteria (Second Criteria Tab) */}
                                <Tab.Pane eventKey="criteria_2">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <h6 className="fw-bold mb-1 text-primary" style={{ fontSize: '13.5px' }}>
                                                <i className="fa fa-list-check me-2"></i>
                                                Scheme Criteria Value Based
                                            </h6>
                                            <p className="text-muted mb-0 small" style={{ fontSize: '12px' }}>
                                                Add multiple criteria rows for this scheme based on value 
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={handleAddCriteriaRow2}
                                            className="fw-semibold"
                                            style={{ fontSize: '12px', padding: '4px 10px' }}
                                        >
                                            <i className="fa fa-plus me-1"></i> Add Criteria
                                        </Button>
                                    </div>

                                    {formErrors.criteria_2 && (
                                        <div className="alert alert-danger py-2 mb-2" style={{ fontSize: '12px' }}>
                                            {formErrors.criteria_2}
                                        </div>
                                    )}

                                    <div className="table-responsive border rounded mb-1">
                                        <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                                            <thead style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                                <tr>
                                                    <th style={{ minWidth: '140px' }}>Scheme Name</th>
                                                    <th style={{ minWidth: '220px' }}>Product ID <span className="text-danger">*</span></th>
                                                    <th style={{ width: '115px' }}>Value</th>
                                                    <th style={{ width: '115px' }}>Discount Percentage (%)</th>
                                                    <th style={{ width: '110px' }}>Discount Value</th>
                                                    <th style={{ width: '110px' }}>Points</th>
                                                    <th style={{ width: '50px' }} className="text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {criteriaRows2.map((row, idx) => {
                                                    const rowErr = formErrors.row_errors_2?.[idx] || {};
                                                    return (
                                                        <tr key={row._tempId} style={{ backgroundColor: isDark ? '#24292D' : '#ffffff' }}>
                                                            {/* Scheme Name - Auto-populated from General Info */}
                                                            <td>
                                                                <Form.Control
                                                                    type="text"
                                                                    size="sm"
                                                                    value={formData.name || '(Current Scheme)'}
                                                                    readOnly
                                                                    className="bg-light text-muted"
                                                                    style={{ fontSize: '13px', cursor: 'default' }}
                                                                    title="Scheme Name automatically populated from General Info"
                                                                />
                                                            </td>

                                                            {/* Product ID */}
                                                            <td>
                                                                <Select
                                                                    className="criteria-product-select"
                                                                    classNamePrefix="react-select"
                                                                    options={productOptions}
                                                                    value={productOptions.find(opt => opt.value === row.product) || null}
                                                                    onChange={(selected) => handleCriteriaRowChange2(row._tempId, 'product', selected ? selected.value : null)}
                                                                    placeholder="Select Product"
                                                                    isSearchable
                                                                    isClearable
                                                                    tabSelectsValue={false}
                                                                    styles={{
                                                                        ...tableSelectStyles,
                                                                        control: (provided, state) => ({
                                                                            ...tableSelectStyles.control(provided, state),
                                                                            ...(rowErr.product ? {
                                                                                borderColor: '#dc3545',
                                                                                boxShadow: '0 0 0 0.25rem rgba(220, 53, 69, 0.25)'
                                                                            } : {})
                                                                        })
                                                                    }}
                                                                    menuPortalTarget={document.body}
                                                                    menuPosition="fixed"
                                                                />
                                                                {rowErr.product && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.product}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Value */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="value"
                                                                    aria-label="Value"
                                                                    placeholder="0.00"
                                                                    value={row.value}
                                                                    isInvalid={!!rowErr.value}
                                                                    onChange={(e) => handleCriteriaRowChange2(row._tempId, 'value', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.value && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.value}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Discount Percentage */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    max="100"
                                                                    size="sm"
                                                                    name="discount_percentage"
                                                                    aria-label="Discount Percentage"
                                                                    placeholder="0.00"
                                                                    value={row.discount_percentage}
                                                                    isInvalid={!!rowErr.discount_percentage}
                                                                    onChange={(e) => handleCriteriaRowChange2(row._tempId, 'discount_percentage', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.discount_percentage && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.discount_percentage}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Discount Value */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="discount_value"
                                                                    aria-label="Discount Value"
                                                                    placeholder="0.00"
                                                                    value={row.discount_value}
                                                                    isInvalid={!!rowErr.discount_value}
                                                                    onChange={(e) => handleCriteriaRowChange2(row._tempId, 'discount_value', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.discount_value && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.discount_value}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Points */}
                                                            <td>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    size="sm"
                                                                    name="points"
                                                                    aria-label="Points"
                                                                    placeholder="0.00"
                                                                    value={row.points}
                                                                    isInvalid={!!rowErr.points}
                                                                    onChange={(e) => handleCriteriaRowChange2(row._tempId, 'points', e.target.value)}
                                                                    style={{ fontSize: '13px' }}
                                                                />
                                                                {rowErr.points && (
                                                                    <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                                        {rowErr.points}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Action */}
                                                            <td className="text-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    className="py-0 px-2"
                                                                    style={{ height: '36px', minWidth: '36px' }}
                                                                    onClick={() => handleRemoveCriteriaRow2(row._tempId)}
                                                                    title="Delete Criteria Row"
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    </div>

                    <div className="modal-footer-custom">
                        <button type="button" className="btn-close-custom" onClick={resetForm}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-save-custom" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Saving...
                                </>
                            ) : (
                                isEditMode ? 'Update Scheme' : 'Add Scheme'
                            )}
                        </button>
                    </div>
                </Form>
            </Modal>

            <style>{`
                .wallet-scheme-modal.modal-dialog {
                    max-width: 960px !important;
                    width: 95vw !important;
                    margin: 1.75rem auto !important;
                    max-height: calc(100vh - 3.5rem) !important;
                    max-height: calc(100dvh - 3.5rem) !important;
                    display: flex !important;
                    align-items: center !important;
                }
                .wallet-scheme-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    max-height: calc(100vh - 3.5rem) !important;
                    max-height: calc(100dvh - 3.5rem) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    background: #fff;
                }
                .wallet-scheme-modal .modal-header-custom {
                    flex-shrink: 0 !important;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px 14px 24px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                .wallet-scheme-modal .modal-icon-circle {
                    width: 42px;
                    height: 42px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                    flex-shrink: 0;
                }
                .wallet-scheme-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 22px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    flex-shrink: 0;
                }
                .wallet-scheme-modal .modal-close-x:hover {
                    color: #555;
                }
                .wallet-scheme-modal form {
                    display: flex !important;
                    flex-direction: column !important;
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    overflow: hidden !important;
                }
                .wallet-scheme-modal .modal-body-custom {
                    display: flex !important;
                    flex-direction: column !important;
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                }
                .wallet-scheme-modal .scheme-custom-tabs {
                    flex-shrink: 0 !important;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 24px;
                    background: #fff;
                }
                .wallet-scheme-modal .scheme-custom-tabs .nav-link {
                    text-decoration: none !important;
                    color: #64748b;
                    font-weight: 500;
                    font-size: 13.5px;
                    border: none !important;
                    border-bottom: 2px solid transparent !important;
                    padding: 10px 18px;
                    margin-bottom: -1px;
                    background-color: transparent !important;
                    transition: all 0.2s ease;
                }
                .wallet-scheme-modal .scheme-custom-tabs .nav-link:hover {
                    text-decoration: none !important;
                    color: #0a500f;
                    border-bottom-color: #cbd5e1 !important;
                }
                .wallet-scheme-modal .scheme-custom-tabs .nav-link.active {
                    text-decoration: none !important;
                    color: #0a500f !important;
                    font-weight: 600;
                    background-color: transparent !important;
                    border: none !important;
                    border-bottom: 2px solid #0a500f !important;
                }
                .wallet-scheme-modal .scheme-tab-content {
                    flex: 1 1 auto !important;
                    min-height: 0 !important;
                    max-height: min(320px, 48vh) !important;
                    padding: 18px 24px;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 #f1f5f9;
                }
                .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar {
                    width: 6px;
                }
                .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .wallet-scheme-modal .modal-footer-custom {
                    flex-shrink: 0 !important;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 12px 24px 14px 24px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 10px;
                }
                .wallet-scheme-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 5px;
                }
                .wallet-scheme-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .wallet-scheme-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .wallet-scheme-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .wallet-scheme-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 13.5px !important;
                    padding: 8px 22px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .wallet-scheme-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .wallet-scheme-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 13.5px !important;
                    padding: 8px 22px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .wallet-scheme-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                
                /* Criteria Table Product Select Dimension & Sizing Matching */
                .wallet-scheme-modal .criteria-product-select {
                    width: 100% !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__control {
                    height: 56px !important;
                    min-height: 56px !important;
                    border-radius: 0.5rem !important;
                    border: 0.0625rem solid #EEEEEE !important;
                    background-color: #fff !important;
                    box-shadow: none !important;
                    display: flex !important;
                    align-items: center !important;
                    width: 100% !important;
                    font-size: 13px !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__value-container {
                    padding: 0 1.25rem !important;
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                    font-size: 13px !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__single-value {
                    color: #6e6e6e !important;
                    font-size: 13px !important;
                    margin: 0 !important;
                    line-height: 1.5 !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__placeholder {
                    color: #6c757d !important;
                    font-size: 13px !important;
                    margin: 0 !important;
                    line-height: 1.5 !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__indicators {
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                    padding-right: 0.5rem !important;
                }
                .wallet-scheme-modal .criteria-product-select .react-select__dropdown-indicator {
                    color: #7e7e7e !important;
                    padding: 0 6px !important;
                }
                @media only screen and (max-width: 1400px) {
                    .wallet-scheme-modal .criteria-product-select .react-select__control {
                        height: 52px !important;
                        min-height: 52px !important;
                    }
                }
                
                /* Scoped Search Bar Styles matching Park Area */
                .park-area-page .search-bar-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .park-area-page .search-bar-container .search-icon {
                    position: absolute;
                    left: 12px;
                    display: flex;
                    align-items: center;
                    pointer-events: none;
                    color: #64748b;
                }
                .park-area-page .search-bar-container .search-input {
                    width: 100%;
                    height: 38px;
                    padding: 0.5rem 1rem 0.5rem 2.4rem;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    font-size: 13px;
                    color: #334155;
                    background: #fff;
                    transition: all 0.2s ease;
                }
                .park-area-page .search-bar-container .search-input:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }

                /* Responsive Scoped Styles for Park Area */
                .park-area-page .park-area-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .park-area-page .search-bar-wrapper {
                    max-width: 250px;
                }
                @media (max-width: 768px) {
                    .park-area-page .header-actions-wrapper {
                        width: 100% !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .park-area-page .search-bar-wrapper {
                        max-width: 100% !important;
                    }
                    .park-area-page .header-actions-wrapper > div {
                        width: 100% !important;
                    }
                    .park-area-page .header-actions-wrapper .btn {
                        width: 100% !important;
                    }
                }
                @media (max-width: 576px) {
                    .wallet-scheme-modal.modal {
                        padding: 0 10px !important;
                    }
                    .wallet-scheme-modal.modal-dialog {
                        max-width: calc(100vw - 20px) !important;
                        width: calc(100vw - 20px) !important;
                        margin: 10px auto !important;
                        max-height: calc(100vh - 20px) !important;
                        max-height: calc(100dvh - 20px) !important;
                    }
                    .wallet-scheme-modal .modal-content {
                        max-height: calc(100vh - 20px) !important;
                        max-height: calc(100dvh - 20px) !important;
                    }
                    .wallet-scheme-modal .scheme-tab-content {
                        padding: 14px 16px !important;
                        max-height: calc(100vh - 190px) !important;
                        max-height: calc(100dvh - 190px) !important;
                    }
                    .wallet-scheme-modal .modal-header-custom {
                        padding: 14px 16px !important;
                    }
                    .wallet-scheme-modal .modal-footer-custom {
                        flex-direction: column !important;
                        padding: 12px 16px !important;
                    }
                    .wallet-scheme-modal .btn-close-custom,
                    .wallet-scheme-modal .btn-save-custom {
                        width: 100% !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default WalletSchemes;
