import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import {
    getPayHeads,
    createPayHead,
    updatePayHead,
    deletePayHead,
    getCalculationTypes,
    getAttendanceProductionTypes,
} from '../../../services/PayrollService';
import { getAccountGroups } from '../../../services/FinanceService';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

export const PAY_HEAD_TYPES = [
    { value: 'EARNING', label: 'Employee Earnings', badgeClass: 'badge-success', color: '#0a500f' },
    { value: 'DEDUCTION', label: 'Employee Deductions', badgeClass: 'badge-danger', color: '#ff5c75' },
    { value: 'EMPLOYEE_STATUTORY_DEDUCTION', label: 'Statutory Deductions (Employee)', badgeClass: 'badge-warning', color: '#ffaa2b' },
    { value: 'EMPLOYER_STATUTORY_CONTRIBUTION', label: 'Statutory Contributions (Employer)', badgeClass: 'badge-primary', color: '#0a500f' },
    { value: 'GRATUITY', label: 'Gratuity Benefit', badgeClass: 'badge-info', color: '#2b98d6' },
    { value: 'LOAN_ADVANCE', label: 'Loan & Advance Recoveries', badgeClass: 'badge-secondary', color: '#6c757d' },
    { value: 'REIMBURSEMENT', label: 'Employee Reimbursements', badgeClass: 'badge-dark', color: '#343a40' },
    { value: 'NOT_APPLICABLE', label: 'Not Applicable', badgeClass: 'badge-light', color: '#adb5bd' },
];

export const INCOME_TYPES = [
    { value: 'FIXED', label: 'Fixed' },
    { value: 'VARIABLE', label: 'Variable' },
];

export const CALCULATION_TYPES = [
    { value: 'COMPUTED_VALUE', label: 'Formula & Slab Computed' },
    { value: 'USER_DEFINED_VALUE', label: 'Manual Value' },
    { value: 'FLAT_RATE', label: 'Fixed Flat Rate' },
    { value: 'ON_ATTENDANCE', label: 'Attendance-Based' },
    { value: 'ON_PRODUCTION', label: 'Production / Output-Based' },
];

export const METHODS_OF_COMPUTATION = [
    { value: 'on_current_deductions_total', label: 'Total Current Deductions' },
    { value: 'on_current_earnings_total', label: 'Total Current Earnings' },
    { value: 'on_current_subtotal', label: 'Current Subtotal / Gross' },
    { value: 'on_specified_formula', label: 'Custom Formula' },
];

export const SLAB_TYPES = [
    { value: 'percentage', label: 'Percentage' },
    { value: 'value', label: 'Value' },
];

export const FORMULA_FUNCTIONS = [
    { value: 'add_pay_head', label: 'Add Pay Component', category: 'pay_head' },
    { value: 'divide_by_attendance', label: 'Divide by Attendance Units', category: 'attendance_type' },
    { value: 'multiply_with_attendance', label: 'Multiply by Attendance Units', category: 'attendance_type' },
    { value: 'subtract_pay_head', label: 'Subtract Pay Component', category: 'pay_head' },
];
export const TALLY_FORMULA_FUNCTIONS = FORMULA_FUNCTIONS;

const DEFAULT_FORMULA_ROW = {
    function: 'add_pay_head',
    pay_head: null,
    attendance_type: null,
};

export const getFormulaSummaryText = (formulaItems = [], payHeads = [], attendanceTypes = []) => {
    if (!formulaItems || formulaItems.length === 0) return '';
    const parts = [];
    formulaItems.forEach((item, idx) => {
        let targetName = '';
        if (item.function === 'add_pay_head' || item.function === 'subtract_pay_head') {
            const found = payHeads.find(p => p.id === item.pay_head || p.value === item.pay_head);
            targetName = item.pay_head_name || found?.name || found?.label || '';
        } else if (item.function === 'divide_by_attendance' || item.function === 'multiply_with_attendance') {
            const found = attendanceTypes.find(a => a.id === item.attendance_type || a.value === item.attendance_type);
            targetName = item.attendance_type_name || found?.name || found?.label || '';
        }

        if (!targetName) return;

        if (item.function === 'add_pay_head') {
            parts.push(idx === 0 ? targetName : `+ ${targetName}`);
        } else if (item.function === 'subtract_pay_head') {
            parts.push(`- ${targetName}`);
        } else if (item.function === 'divide_by_attendance') {
            parts.push(`/ [Att: ${targetName}]`);
        } else if (item.function === 'multiply_with_attendance') {
            parts.push(`* [Att: ${targetName}]`);
        }
    });
    return parts.join(' ');
};

const DEFAULT_SLAB_ROW = {
    effective_from: '2026-04-01',
    amount_greater_than: '',
    amount_up_to: '',
    slab_type: 'percentage',
    value: '',
};

const EMPTY_PAY_HEAD = {
    id: null,
    name: '',
    pay_head_type: 'EARNING',
    income_type: 'FIXED',
    under: null,
    affect_net_salary: true,
    use_for_gratuity: false,
    calculation_type: null,
    calculation_period: null,
    attendance_production_type: null,
    attendance_leave_with_pay: null,
    leave_without_pay: null,
    compute_method: 'on_current_earnings_total',
    computation_slabs: [{ ...DEFAULT_SLAB_ROW }],
    computation_formula_items: [{ ...DEFAULT_FORMULA_ROW }],
    is_active: true
};

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: '42px',
        borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(10, 80, 15, 0.2)' : 'none',
        '&:hover': { borderColor: '#0a500f' },
        borderRadius: '8px',
        fontSize: '14px',
        backgroundColor: '#fff',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    }),
    menu: base => ({
        ...base,
        zIndex: 99999,
        fontSize: '14px',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
            ? '#0a500f'
            : state.isFocused
            ? 'rgba(10, 80, 15, 0.1)'
            : 'transparent',
        color: state.isSelected ? '#fff' : '#334155',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
    }),
    singleValue: base => ({
        ...base,
        color: '#1e293b',
        fontSize: '14px',
    }),
    placeholder: base => ({
        ...base,
        color: '#94a3b8',
        fontSize: '14px',
    }),
};

const PayHeadList = () => {
    usePageTitle('Pay Components');

    const [items, setItems] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [calculationTypes, setCalculationTypes] = useState([]);
    const [allAttendanceTypes, setAllAttendanceTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [calcFilter, setCalcFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [showFormulaModal, setShowFormulaModal] = useState(false);
    const [editingFormulaItems, setEditingFormulaItems] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [showAllSlabs, setShowAllSlabs] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY_PAY_HEAD });
    const [submitting, setSubmitting] = useState(false);
    const firstInputRef = useRef(null);
    const isPromptingRef = useRef(false);
    const lastPromptedRef = useRef({});

    // Auto-focus first input when modal opens
    useEffect(() => {
        if (showModal) {
            const timer = setTimeout(() => {
                if (firstInputRef.current) {
                    firstInputRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [showModal]);

    // Keyboard navigation helper
    const getFocusable = () => {
        const modal = document.querySelector('.payhead-custom-modal');
        if (!modal) return [];

        return Array.from(
            modal.querySelectorAll(
                'input.form-control:not([disabled]):not([readonly]), ' +
                '.react-select__control, ' +
                '.choice-pill, ' +
                'select.form-select:not([disabled]), ' +
                'input.form-check-input:not([disabled]), ' +
                'button.btn-save-custom:not([disabled])'
            )
        ).filter(el => {
            if (el.disabled) return false;
            if (el.classList.contains('react-select__control--is-disabled')) return false;
            if (!el.offsetParent && el.type !== 'checkbox') return false;
            return true;
        });
    };

    const focusControl = (el) => {
        if (!el) return;
        if (el.classList.contains('react-select__control')) {
            const input = el.querySelector('input');
            if (input) {
                input.focus();
            } else {
                el.focus();
            }
        } else if (el.classList.contains('choice-pill')) {
            el.focus();
        } else if (el.tagName.toLowerCase() === 'select') {
            el.focus();
            if (typeof el.showPicker === 'function') {
                try { el.showPicker(); } catch (_) {}
            }
        } else {
            el.focus();
        }
    };

    const focusNextFromControl = (currentControl) => {
        const all = getFocusable();
        if (!all.length) return;

        // Pay Head Type -> Fixed
        const phtControl = currentControl?.closest?.('.pay-head-type-select');
        if (phtControl) {
            const fixedTab = document.getElementById('income-type-fixed');
            if (fixedTab) {
                fixedTab.focus();
                return;
            }
        }

        // Calculation Type -> Compute (if computed value)
        const calcControl = currentControl?.closest?.('.calc-type-select-container');
        if (calcControl) {
            const selectedCalc = calculationTypes.find(c => c.id === formData.calculation_type);
            const cName = selectedCalc?.name?.trim().toLowerCase() || '';
            const isComputed = Boolean(formData.calculation_type) && (cName === 'as computed value' || cName.includes('computed'));
            if (isComputed) {
                const computeControl = document.querySelector('.compute-method-select .react-select__control');
                if (computeControl) {
                    focusControl(computeControl);
                    return;
                }
            }
        }

        // Compute -> first slab input
        const compControl = currentControl?.closest?.('.compute-method-select');
        if (compControl) {
            const firstSlabInput = document.querySelector('.slabs-table tbody tr:first-child input, .slabs-table tbody tr:first-child .form-control');
            if (firstSlabInput) {
                firstSlabInput.focus();
                return;
            }
        }

        const control = currentControl?.closest?.('.react-select__control') || currentControl;
        const index = all.indexOf(control);
        if (index > -1 && index < all.length - 1) {
            focusControl(all[index + 1]);
        }
    };

    const handleSelectKeyDown = (e) => {
        if (e.key === 'Enter') {
            const control = e.target.closest('.react-select__control');
            setTimeout(() => {
                if (control) focusNextFromControl(control);
            }, 100);
        }
    };

    // Keyboard navigation (Enter key advances to next field)
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.target.tagName.toLowerCase() === 'textarea') return;
        if (e.target.type === 'submit') return;
        if (e.target.closest('.react-select__control')) {
            e.preventDefault();
            return;
        }
        if (e.target.classList.contains('choice-pill')) {
            e.preventDefault();
            return;
        }
        if (e.target.closest('.slabs-table')) {
            return;
        }

        e.preventDefault();
        focusNextFromControl(e.target);
    };

    useEffect(() => {
        fetchData();
        fetchAccountGroups();
        fetchCalculationTypes();
        fetchAttendanceTypes();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getPayHeads();
            setItems(Array.isArray(data) ? data : (data.results || []));
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch pay components.'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAccountGroups = async () => {
        try {
            const data = await getAccountGroups();
            const groups = Array.isArray(data) ? data : (data.results || []);
            setAccountGroups(groups);
        } catch (error) {
            console.error('Failed to fetch account groups:', error);
        }
    };

    const fetchCalculationTypes = async () => {
        try {
            const data = await getCalculationTypes();
            const list = Array.isArray(data) ? data : (data.results || []);
            setCalculationTypes(list);
        } catch (error) {
            console.error('Failed to fetch calculation types:', error);
        }
    };

    const fetchAttendanceTypes = async () => {
        try {
            const data = await getAttendanceProductionTypes({ is_active: true });
            const list = Array.isArray(data) ? data : (data.results || []);
            setAllAttendanceTypes(list);
        } catch (error) {
            console.error('Failed to fetch attendance production types:', error);
        }
    };

    const handleShowModal = (item = null) => {
        if (item) {
            const attId = item.attendance_production_type || null;
            let withPayId = null;
            let withoutPayId = null;
            if (attId) {
                const found = allAttendanceTypes.find(a => a.id === attId);
                if (found?.type === 'leave_without_pay') {
                    withoutPayId = attId;
                } else if (found?.type === 'attendance_leave_with_pay') {
                    withPayId = attId;
                }
            }

            const comp = item.computation || null;
            const slabs = (comp?.slabs && comp.slabs.length > 0)
                ? comp.slabs.map(s => ({
                    effective_from: s.effective_from || '2026-04-01',
                    amount_greater_than: s.amount_greater_than ?? '',
                    amount_up_to: s.amount_up_to ?? '',
                    slab_type: s.slab_type || 'percentage',
                    value: s.value ?? ''
                }))
                : [{ ...DEFAULT_SLAB_ROW }];

            const formulaItems = (comp?.formula_items && comp.formula_items.length > 0)
                ? comp.formula_items.map(f => ({
                    id: f.id,
                    function: f.function || 'add_pay_head',
                    pay_head: f.pay_head || null,
                    pay_head_name: f.pay_head_name || '',
                    attendance_type: f.attendance_type || null,
                    attendance_type_name: f.attendance_type_name || '',
                }))
                : [{ ...DEFAULT_FORMULA_ROW }];

            setFormData({
                id: item.id,
                name: item.name || '',
                pay_head_type: item.pay_head_type || 'EARNING',
                income_type: item.income_type || 'FIXED',
                under: item.under || null,
                affect_net_salary: item.affect_net_salary ?? true,
                use_for_gratuity: item.use_for_gratuity ?? false,
                calculation_type: item.calculation_type || null,
                calculation_period: item.calculation_period || null,
                attendance_production_type: attId,
                attendance_leave_with_pay: withPayId,
                leave_without_pay: withoutPayId,
                compute_method: comp?.compute_method || 'on_current_earnings_total',
                computation_slabs: slabs,
                computation_formula_items: formulaItems,
                is_active: item.is_active ?? true
            });
            setEditMode(true);
            setShowAllSlabs(false);
        } else {
            setFormData({ ...EMPTY_PAY_HEAD });
            setEditMode(false);
            setShowAllSlabs(true);
        }
        lastPromptedRef.current = {};
        isPromptingRef.current = false;
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setShowFormulaModal(false);
        setFormData({ ...EMPTY_PAY_HEAD });
        setEditMode(false);
        setShowAllSlabs(false);
        lastPromptedRef.current = {};
        isPromptingRef.current = false;
    };

    const focusFormulaFunction = (rowIndex) => {
        setTimeout(() => {
            let input = document.querySelector(`.formula-custom-modal .formula-row-${rowIndex} .formula-function-select input`);
            if (input) {
                input.focus();
            } else {
                setTimeout(() => {
                    input = document.querySelector(`.formula-custom-modal .formula-row-${rowIndex} .formula-function-select input`);
                    if (input) input.focus();
                }, 100);
            }
        }, 80);
    };

    const focusFormulaTarget = (rowIndex) => {
        setTimeout(() => {
            let input = document.querySelector(`.formula-custom-modal .formula-row-${rowIndex} .formula-target-select input`);
            if (input) {
                input.focus();
            } else {
                setTimeout(() => {
                    input = document.querySelector(`.formula-custom-modal .formula-row-${rowIndex} .formula-target-select input`);
                    if (input) input.focus();
                }, 100);
            }
        }, 80);
    };

    const focusFormulaSave = () => {
        setTimeout(() => {
            let saveBtn = document.querySelector('.formula-custom-modal .btn-save-custom');
            if (saveBtn) {
                saveBtn.focus();
            } else {
                setTimeout(() => {
                    saveBtn = document.querySelector('.formula-custom-modal .btn-save-custom');
                    if (saveBtn) saveBtn.focus();
                }, 80);
            }
        }, 80);
    };

    // Auto-focus first input when formula modal opens
    useEffect(() => {
        if (showFormulaModal) {
            const timer = setTimeout(() => {
                focusFormulaFunction(0);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [showFormulaModal]);

    const handleOpenFormulaModal = () => {
        const current = (formData.computation_formula_items && formData.computation_formula_items.length > 0)
            ? formData.computation_formula_items.map(f => ({ ...f }))
            : [{ ...DEFAULT_FORMULA_ROW }];
        setEditingFormulaItems(current);
        setShowFormulaModal(true);
    };

    const handleFormulaItemChange = (index, field, value) => {
        setEditingFormulaItems(prev => {
            const updated = [...prev];
            if (field === 'function') {
                const isPayHead = value === 'add_pay_head' || value === 'subtract_pay_head';
                updated[index] = {
                    ...updated[index],
                    function: value,
                    pay_head: isPayHead ? updated[index].pay_head : null,
                    pay_head_name: isPayHead ? updated[index].pay_head_name : '',
                    attendance_type: !isPayHead ? updated[index].attendance_type : null,
                    attendance_type_name: !isPayHead ? updated[index].attendance_type_name : '',
                };
            } else if (field === 'pay_head') {
                const ph = items.find(p => p.id === value);
                updated[index] = {
                    ...updated[index],
                    pay_head: value,
                    pay_head_name: ph?.name || '',
                };
                if (index === updated.length - 1 && value) {
                    updated.push({ ...DEFAULT_FORMULA_ROW });
                }
            } else if (field === 'attendance_type') {
                const att = allAttendanceTypes.find(a => a.id === value);
                updated[index] = {
                    ...updated[index],
                    attendance_type: value,
                    attendance_type_name: att?.name || '',
                };
                if (index === updated.length - 1 && value) {
                    updated.push({ ...DEFAULT_FORMULA_ROW });
                }
            }
            return updated;
        });
    };

    const handleFunctionSelect = (index, selectedOption) => {
        if (!selectedOption) return;
        handleFormulaItemChange(index, 'function', selectedOption.value);
        focusFormulaTarget(index);
    };

    const handleFunctionKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setTimeout(() => {
                focusFormulaTarget(index);
            }, 80);
        }
    };

    const handleFormulaTargetChange = (index, field, value) => {
        handleFormulaItemChange(index, field, value);
        if (value) {
            focusFormulaFunction(index + 1);
        } else {
            setTimeout(() => {
                setEditingFormulaItems(prev => {
                    if (prev.length > 1) {
                        return prev.filter((_, i) => i !== index);
                    }
                    return prev;
                });
                focusFormulaSave();
            }, 100);
        }
    };

    const handleTargetKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            const currentItem = editingFormulaItems[index];
            const hasVal = currentItem && Boolean(currentItem.pay_head || currentItem.attendance_type);
            const searchVal = e.target?.value?.trim();

            if (!hasVal && !searchVal) {
                // Empty payhead/attendance type field: prevent selecting default option, delete row & focus save
                e.preventDefault();
                e.stopPropagation();

                setEditingFormulaItems(prev => {
                    if (prev.length > 1) {
                        return prev.filter((_, i) => i !== index);
                    }
                    return prev;
                });
                focusFormulaSave();
                return;
            }

            if (hasVal) {
                e.preventDefault();
                setEditingFormulaItems(prev => {
                    if (index === prev.length - 1) {
                        focusFormulaFunction(index + 1);
                        return [...prev, { ...DEFAULT_FORMULA_ROW }];
                    }
                    focusFormulaFunction(index + 1);
                    return prev;
                });
                return;
            }
        }
    };

    const handleAddFormulaRow = () => {
        setEditingFormulaItems(prev => {
            const nextIndex = prev.length;
            focusFormulaFunction(nextIndex);
            return [...prev, { ...DEFAULT_FORMULA_ROW }];
        });
    };

    const handleRemoveFormulaRow = (index) => {
        setEditingFormulaItems(prev => {
            if (prev.length <= 1) {
                focusFormulaFunction(0);
                return [{ ...DEFAULT_FORMULA_ROW }];
            }
            const updated = prev.filter((_, i) => i !== index);
            const targetRow = Math.min(index, updated.length - 1);
            focusFormulaFunction(targetRow);
            return updated;
        });
    };

    const handleSaveFormula = () => {
        const valid = editingFormulaItems.filter(item => {
            if (item.function === 'add_pay_head' || item.function === 'subtract_pay_head') {
                return Boolean(item.pay_head);
            }
            if (item.function === 'divide_by_attendance' || item.function === 'multiply_with_attendance') {
                return Boolean(item.attendance_type);
            }
            return false;
        });

        if (valid.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Empty Formula',
                text: 'Please select at least one Pay Component or Attendance & Output Type for the formula.'
            });
            return;
        }

        setFormData(prev => ({
            ...prev,
            computation_formula_items: valid,
        }));
        setShowFormulaModal(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Pay Component Name is required.'
            });
            return;
        }

        if (!formData.pay_head_type) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Pay Component Type is required.'
            });
            return;
        }

        if (!formData.calculation_type) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Calculation Type is required.'
            });
            return;
        }

        if (!formData.under) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Under (Account Group) is required.'
            });
            return;
        }

        const selectedTypeObj = calculationTypes.find(c => c.id === formData.calculation_type);
        const calcTypeName = selectedTypeObj?.name?.trim().toLowerCase() || '';
        const isOnAttendance = Boolean(formData.calculation_type) && (calcTypeName === 'on attendance' || calcTypeName.includes('attendance'));
        const isOnProduction = Boolean(formData.calculation_type) && (calcTypeName === 'on production' || calcTypeName.includes('production'));
        const isComputedValue = Boolean(formData.calculation_type) && (calcTypeName === 'as computed value' || calcTypeName.includes('computed'));
        const requiresPeriod = Boolean(selectedTypeObj?.is_calculation_period_required || (selectedTypeObj?.payroll_units_details || []).length > 0);

        let finalAttendanceType = null;
        if (isOnAttendance) {
            finalAttendanceType = formData.attendance_leave_with_pay || formData.leave_without_pay || null;
            if (!finalAttendanceType) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Error',
                    text: 'Please select either Paid Attendance / Leave or Unpaid Leave / Loss of Pay.'
                });
                return;
            }
        } else if (isOnProduction) {
            finalAttendanceType = formData.attendance_production_type || null;
            if (!finalAttendanceType) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Error',
                    text: 'Piece-rate / Output Type is required.'
                });
                return;
            }
        }

        if (requiresPeriod && !formData.calculation_period) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Calculation Period is required.'
            });
            return;
        }

        let computationPayload = null;
        if (isComputedValue) {
            const validSlabs = (formData.computation_slabs || []).filter(s =>
                s.value !== '' && s.value !== null && !isNaN(Number(s.value))
            ).map((s, idx) => ({
                effective_from: s.effective_from || null,
                amount_greater_than: s.amount_greater_than !== '' && !isNaN(Number(s.amount_greater_than)) ? Number(s.amount_greater_than) : 0,
                amount_up_to: s.amount_up_to !== '' && !isNaN(Number(s.amount_up_to)) ? Number(s.amount_up_to) : null,
                slab_type: s.slab_type || 'percentage',
                value: Number(s.value),
                order: idx,
            }));

            if (validSlabs.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Error',
                    text: 'Please enter at least one computation slab with a valid value.'
                });
                return;
            }

            let validFormulaItems = [];
            if (formData.compute_method === 'on_specified_formula') {
                validFormulaItems = (formData.computation_formula_items || []).filter(item => {
                    if (item.function === 'add_pay_head' || item.function === 'subtract_pay_head') {
                        return Boolean(item.pay_head);
                    }
                    if (item.function === 'divide_by_attendance' || item.function === 'multiply_with_attendance') {
                        return Boolean(item.attendance_type);
                    }
                    return false;
                }).map((item, idx) => ({
                    function: item.function,
                    pay_head: (item.function === 'add_pay_head' || item.function === 'subtract_pay_head') ? item.pay_head : null,
                    attendance_type: (item.function === 'divide_by_attendance' || item.function === 'multiply_with_attendance') ? item.attendance_type : null,
                    order: idx,
                }));

                if (validFormulaItems.length === 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Formula Required',
                        text: 'Please configure at least one formula item for "On Specified Formula".'
                    });
                    handleOpenFormulaModal();
                    return;
                }
            }

            computationPayload = {
                compute_method: formData.compute_method || 'on_current_earnings_total',
                slabs: validSlabs,
                formula_items: formData.compute_method === 'on_specified_formula' ? validFormulaItems : []
            };
        }

        const payload = {
            name: formData.name.trim(),
            pay_head_type: formData.pay_head_type,
            income_type: formData.income_type,
            under: formData.under || null,
            affect_net_salary: formData.affect_net_salary,
            use_for_gratuity: formData.use_for_gratuity,
            calculation_type: formData.calculation_type,
            calculation_period: formData.calculation_period || null,
            attendance_production_type: finalAttendanceType || null,
            computation: isComputedValue ? computationPayload : null,
            is_active: formData.is_active
        };

        try {
            setSubmitting(true);
            if (editMode) {
                await updatePayHead(formData.id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated!',
                    text: 'Pay Component updated successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                await createPayHead(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Created!',
                    text: 'Pay Component created successfully.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to save pay component.';
            if (error.response?.data) {
                if (typeof error.response.data === 'string') {
                    errorMsg = error.response.data;
                } else if (error.response.data.name) {
                    errorMsg = Array.isArray(error.response.data.name) ? error.response.data.name.join(', ') : error.response.data.name;
                } else if (error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                } else {
                    const firstKey = Object.keys(error.response.data)[0];
                    if (firstKey) {
                        const val = error.response.data[firstKey];
                        errorMsg = `${firstKey}: ${Array.isArray(val) ? val.join(', ') : val}`;
                    }
                }
            }
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: errorMsg
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id, name) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `Do you want to delete pay component "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff5c75',
            cancelButtonColor: '#0a500f',
            confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deletePayHead(id);
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted!',
                        text: 'Pay Component deleted successfully.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    fetchData();
                } catch (error) {
                    let errMsg = 'Failed to delete pay component.';
                    if (error.response?.data?.detail) {
                        errMsg = error.response.data.detail;
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: errMsg
                    });
                }
            }
        });
    };

    // Helper functions for badges and labels
    const getPayHeadTypeMeta = (typeVal) => {
        return PAY_HEAD_TYPES.find(t => t.value === typeVal) || { label: typeVal, badgeClass: 'badge-light' };
    };

    const getCalculationTypeLabel = (calcVal) => {
        const found = calculationTypes.find(c => c.id === calcVal);
        if (found) return found.name;
        const legacy = CALCULATION_TYPES.find(c => c.value === calcVal);
        return legacy ? legacy.label : (calcVal || '-');
    };

    const handleCalcTypeChange = (selected) => {
        const selectedId = selected ? selected.value : null;
        const selectedTypeObj = calculationTypes.find(c => c.id === selectedId);
        const unitsForType = selectedTypeObj?.payroll_units_details || [];
        const attendanceForType = selectedTypeObj?.attendance_production_types_details || [];
        const isCurrentPeriodValid = unitsForType.some(u => u.id === formData.calculation_period);
        const isCurrentAttendanceValid = attendanceForType.some(a => a.id === formData.attendance_production_type);

        setFormData(prev => ({
            ...prev,
            calculation_type: selectedId,
            calculation_period: isCurrentPeriodValid ? prev.calculation_period : null,
            attendance_production_type: isCurrentAttendanceValid ? prev.attendance_production_type : null,
            attendance_leave_with_pay: isCurrentAttendanceValid ? prev.attendance_leave_with_pay : null,
            leave_without_pay: isCurrentAttendanceValid ? prev.leave_without_pay : null
        }));
    };

    const handleAttendanceWithPayChange = (selected) => {
        const val = selected && selected.value ? selected.value : null;
        setFormData(prev => ({
            ...prev,
            attendance_leave_with_pay: val,
            // Second field is enabled only if first field is Not Applicable or empty
            leave_without_pay: val ? null : prev.leave_without_pay,
            attendance_production_type: val || prev.leave_without_pay || null
        }));
    };

    const handleLeaveWithoutPayChange = (selected) => {
        const val = selected && selected.value ? selected.value : null;
        setFormData(prev => ({
            ...prev,
            leave_without_pay: val,
            attendance_production_type: val || prev.attendance_leave_with_pay || null
        }));
    };

    const handleAddSlabRow = () => {
        setFormData(prev => {
            const currentSlabs = prev.computation_slabs || [];
            const allDates = [...new Set(currentSlabs.map(s => s.effective_from).filter(Boolean))].sort();
            const latestDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;
            const latestDateSlabs = latestDate ? currentSlabs.filter(s => s.effective_from === latestDate) : currentSlabs;
            const lastSlab = (latestDateSlabs.length > 0 ? latestDateSlabs[latestDateSlabs.length - 1] : null) || currentSlabs[currentSlabs.length - 1];
            const nextGreaterThan = lastSlab?.amount_up_to || '';
            const nextEffective = lastSlab?.effective_from || latestDate || '2026-04-01';
            return {
                ...prev,
                computation_slabs: [
                    ...currentSlabs,
                    {
                        effective_from: nextEffective,
                        amount_greater_than: nextGreaterThan,
                        amount_up_to: '',
                        slab_type: lastSlab?.slab_type || 'percentage',
                        value: ''
                    }
                ]
            };
        });
    };

    const handleRemoveSlabRow = (index) => {
        setFormData(prev => {
            const currentSlabs = prev.computation_slabs || [];
            if (currentSlabs.length <= 1) {
                return {
                    ...prev,
                    computation_slabs: [{ ...DEFAULT_SLAB_ROW }]
                };
            }
            return {
                ...prev,
                computation_slabs: currentSlabs.filter((_, i) => i !== index)
            };
        });
    };

    const checkIsNewEffectiveDate = (newDate, prevRowDate) => {
        if (!newDate || !prevRowDate) return false;
        // Must be a complete, fully-formed date (YYYY-MM-DD)
        const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(newDate);
        if (!isCompleteDate) return false;

        const [prevY, prevM] = prevRowDate.split('-');
        const [newY, newM] = newDate.split('-');

        // "The copy from above popup should appear only after the complete date not just date. only after selecting month and year tha the modal should popup"
        // Require that the complete date has month or year changed compared to the preceding date block
        const isMonthOrYearChanged = Boolean(prevY && prevM && (newY !== prevY || newM !== prevM));
        return isMonthOrYearChanged;
    };

    const handlePromptNewEffectiveDate = async (index, newDate, prevRowDate) => {
        if (!checkIsNewEffectiveDate(newDate, prevRowDate)) return false;

        const currentSlabs = formData.computation_slabs || [];
        const rowsAbove = currentSlabs.slice(0, index);
        if (rowsAbove.length === 0) return false;

        isPromptingRef.current = true;
        try {
            const result = await Swal.fire({
                title: 'New Effective Date',
                html: `
                    <div style="text-align: left; font-size: 13px; color: #475569; line-height: 1.6;">
                        You have selected a new effective date: <strong style="color: #1e293b;">${newDate}</strong>.<br/>
                        How would you like to set up the slabs for this date?
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '<i class="fa fa-copy me-1"></i> Copy from above',
                denyButtonText: '<i class="fa fa-refresh me-1"></i> Start fresh',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#0a500f',
                denyButtonColor: '#0a500f',
                cancelButtonColor: '#94a3b8',
                focusConfirm: true,
            });

            if (result.isConfirmed) {
                // Copy from above: duplicate all rows from the preceding date block to the new date
                const sourceDate = prevRowDate;
                const rowsToCopy = rowsAbove.filter(r => r.effective_from === sourceDate);
                const sourceRows = rowsToCopy.length > 0 ? rowsToCopy : rowsAbove;

                const duplicatedRows = sourceRows.map(r => ({
                    effective_from: newDate,
                    amount_greater_than: r.amount_greater_than,
                    amount_up_to: r.amount_up_to,
                    slab_type: r.slab_type || 'percentage',
                    value: r.value
                }));

                setFormData(prev => {
                    const existing = prev.computation_slabs || [];
                    const before = existing.slice(0, index);
                    const after = existing.slice(index + 1);
                    return {
                        ...prev,
                        computation_slabs: [...before, ...duplicatedRows, ...after]
                    };
                });
                setShowAllSlabs(true);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Copied ${duplicatedRows.length} slabs to ${newDate}`,
                    timer: 2000,
                    showConfirmButton: false
                });
                return true;
            } else if (result.isDenied) {
                // Start fresh: set this row with new date and clear previous range/values
                setFormData(prev => {
                    const updated = [...(prev.computation_slabs || [])];
                    updated[index] = {
                        effective_from: newDate,
                        amount_greater_than: 0,
                        amount_up_to: '',
                        slab_type: 'percentage',
                        value: ''
                    };
                    return {
                        ...prev,
                        computation_slabs: updated
                    };
                });
                setShowAllSlabs(true);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: `Started fresh slab for ${newDate}`,
                    timer: 2000,
                    showConfirmButton: false
                });
                return true;
            } else {
                // User cancelled / dismissed: revert to prevRowDate
                setFormData(prev => {
                    const updated = [...(prev.computation_slabs || [])];
                    if (updated[index]) {
                        updated[index] = {
                            ...updated[index],
                            effective_from: prevRowDate
                        };
                    }
                    return {
                        ...prev,
                        computation_slabs: updated
                    };
                });
                return false;
            }
        } finally {
            setTimeout(() => {
                isPromptingRef.current = false;
            }, 300);
        }
    };

    const handleSlabFieldChange = (index, field, value) => {
        setFormData(prev => {
            const newSlabs = [...(prev.computation_slabs || [])];
            newSlabs[index] = {
                ...newSlabs[index],
                [field]: value
            };
            return {
                ...prev,
                computation_slabs: newSlabs
            };
        });
    };

    const handleSlabRowKeyDown = async (e, rowIndex, originalIndex, fieldName) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();

        const currentSlabs = formData.computation_slabs || [];
        const slab = currentSlabs[originalIndex] || {};
        const totalSlabsCount = currentSlabs.length;

        const effVal = fieldName === 'effective_from' ? (e.target.value ?? slab.effective_from ?? '') : (slab.effective_from ?? '');
        const isEffEmpty = !effVal || String(effVal).trim() === '';

        const gtVal = fieldName === 'amount_greater_than' ? (e.target.value ?? slab.amount_greater_than ?? '') : (slab.amount_greater_than ?? '');
        const isGtEmpty = gtVal === '' || gtVal === null || gtVal === undefined || String(gtVal).trim() === '';

        const upVal = fieldName === 'amount_up_to' ? (e.target.value ?? slab.amount_up_to ?? '') : (slab.amount_up_to ?? '');
        const isUpEmpty = upVal === '' || upVal === null || upVal === undefined || String(upVal).trim() === '';

        const valVal = fieldName === 'value' ? (e.target.value ?? slab.value ?? '') : (slab.value ?? '');
        const isValEmpty = valVal === '' || valVal === null || valVal === undefined || String(valVal).trim() === '';

        // "When navigating through enter key and a new row is created, if From Amount (>), amount upto and value fields are empty, delete the row"
        const areAmountsAndValEmpty = isGtEmpty && isUpEmpty && isValEmpty;

        const rowEl = e.target.closest('tr');
        if (!rowEl) return;

        if (fieldName === 'effective_from') {
            // If user cleared effective_from and all amounts/value are empty, delete row
            if (isEffEmpty && areAmountsAndValEmpty && totalSlabsCount > 1) {
                handleRemoveSlabRow(originalIndex);
                setTimeout(() => {
                    const firstSwitch = document.getElementById('affectSalarySwitch');
                    if (firstSwitch) {
                        firstSwitch.focus();
                    }
                }, 50);
                return;
            }

            // Check if user completed entering a new effective date (with month/year changed)
            const rowsAbove = currentSlabs.slice(0, originalIndex);
            const prevRowDate = rowsAbove[rowsAbove.length - 1]?.effective_from;
            if (rowsAbove.length > 0 && checkIsNewEffectiveDate(effVal, prevRowDate)) {
                if (lastPromptedRef.current?.[originalIndex] !== effVal) {
                    if (!lastPromptedRef.current) lastPromptedRef.current = {};
                    lastPromptedRef.current[originalIndex] = effVal;
                    const handled = await handlePromptNewEffectiveDate(originalIndex, effVal, prevRowDate);
                    if (handled) {
                        setTimeout(() => {
                            const table = document.querySelector('.slabs-table');
                            const targetRow = table?.querySelectorAll('tbody tr')[rowIndex];
                            const gtInput = targetRow?.querySelector('input[data-slab-field="amount_greater_than"]');
                            if (gtInput) {
                                gtInput.focus();
                                gtInput.select?.();
                            }
                        }, 100);
                        return;
                    } else {
                        const dateInput = rowEl.querySelector('input[data-slab-field="effective_from"]');
                        if (dateInput) {
                            dateInput.focus();
                        }
                        return;
                    }
                }
            }

            // Normal progression: move to From Amount (>)
            const gtInput = rowEl.querySelector('input[data-slab-field="amount_greater_than"]');
            if (gtInput) {
                gtInput.focus();
                gtInput.select?.();
            }
        } else if (fieldName === 'amount_greater_than') {
            // If From Amount (>), amount upto, and value are empty in this row, delete row and focus toggle
            if (areAmountsAndValEmpty && totalSlabsCount > 1) {
                handleRemoveSlabRow(originalIndex);
                setTimeout(() => {
                    const firstSwitch = document.getElementById('affectSalarySwitch');
                    if (firstSwitch) {
                        firstSwitch.focus();
                    }
                }, 50);
                return;
            }
            const upInput = rowEl.querySelector('input[data-slab-field="amount_up_to"]');
            if (upInput) {
                upInput.focus();
                upInput.select?.();
            }
        } else if (fieldName === 'amount_up_to') {
            if (areAmountsAndValEmpty && totalSlabsCount > 1) {
                handleRemoveSlabRow(originalIndex);
                setTimeout(() => {
                    const firstSwitch = document.getElementById('affectSalarySwitch');
                    if (firstSwitch) {
                        firstSwitch.focus();
                    }
                }, 50);
                return;
            }
            const typeSelect = rowEl.querySelector('select[data-slab-field="slab_type"]');
            if (typeSelect) {
                typeSelect.focus();
                if (typeof typeSelect.showPicker === 'function') {
                    try { typeSelect.showPicker(); } catch (_) {}
                }
            }
        } else if (fieldName === 'slab_type') {
            if (areAmountsAndValEmpty && totalSlabsCount > 1) {
                handleRemoveSlabRow(originalIndex);
                setTimeout(() => {
                    const firstSwitch = document.getElementById('affectSalarySwitch');
                    if (firstSwitch) {
                        firstSwitch.focus();
                    }
                }, 50);
                return;
            }
            const valInput = rowEl.querySelector('input[data-slab-field="value"]');
            if (valInput) {
                valInput.focus();
                valInput.select?.();
            }
        } else if (fieldName === 'value') {
            // If on value field and From Amount (>), amount upto and value are empty, delete row
            if (areAmountsAndValEmpty && totalSlabsCount > 1) {
                handleRemoveSlabRow(originalIndex);
                setTimeout(() => {
                    const firstSwitch = document.getElementById('affectSalarySwitch');
                    if (firstSwitch) {
                        firstSwitch.focus();
                    }
                }, 50);
                return;
            }

            // "When i press enter from value field, a new row should be created."
            const isLastRow = rowIndex === visibleSlabItems.length - 1;
            if (isLastRow) {
                const lastSlab = currentSlabs[originalIndex] || {};
                const prevEffective = lastSlab.effective_from || '2026-04-01';
                const newRow = {
                    effective_from: prevEffective,
                    amount_greater_than: '',
                    amount_up_to: '',
                    slab_type: lastSlab.slab_type || 'percentage',
                    value: ''
                };
                setFormData(prev => ({
                    ...prev,
                    computation_slabs: [...(prev.computation_slabs || []), newRow]
                }));

                setTimeout(() => {
                    const table = document.querySelector('.slabs-table');
                    const lastRow = table?.querySelector('tbody tr:last-child');
                    const firstInput = lastRow?.querySelector('input[data-slab-field="effective_from"]');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }, 60);
            } else {
                const nextRow = rowEl.nextElementSibling;
                const nextInput = nextRow?.querySelector('input[data-slab-field="effective_from"]');
                if (nextInput) nextInput.focus();
            }
        }
    };

    // Filter items
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.under_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.pay_head_type === typeFilter;
        const matchesCalc = calcFilter === 'all' || String(item.calculation_type) === String(calcFilter);
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && item.is_active) ||
            (statusFilter === 'inactive' && !item.is_active);
        return matchesSearch && matchesType && matchesCalc && matchesStatus;
    });

    // Pagination
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

    // Options for React Select
    const accountGroupOptions = accountGroups.map(grp => ({
        value: grp.id,
        label: grp.name
    }));

    const calculationTypeOptions = calculationTypes.map(c => ({
        value: c.id,
        label: c.name
    }));

    const selectedCalcTypeObj = calculationTypes.find(c => c.id === formData.calculation_type);
    const availablePeriodUnits = selectedCalcTypeObj?.payroll_units_details || [];
    const availableAttendanceTypes = selectedCalcTypeObj?.attendance_production_types_details || [];

    const calcTypeName = selectedCalcTypeObj?.name?.trim().toLowerCase() || '';
    const isOnAttendance = Boolean(formData.calculation_type) && (calcTypeName === 'on attendance' || calcTypeName.includes('attendance'));
    const isOnProduction = Boolean(formData.calculation_type) && (calcTypeName === 'on production' || calcTypeName.includes('production'));
    const isComputedValue = Boolean(formData.calculation_type) && (calcTypeName === 'as computed value' || calcTypeName.includes('computed'));
    const isPeriodRequired = Boolean(selectedCalcTypeObj?.is_calculation_period_required || availablePeriodUnits.length > 0);

    const calculationPeriodOptions = availablePeriodUnits.map(u => ({
        value: u.id,
        label: `${u.formal_name} (${u.symbol})`
    }));

    // For On Attendance: Attendance / Leave with Pay options
    const withPayPool = availableAttendanceTypes.some(a => a.type === 'attendance_leave_with_pay')
        ? availableAttendanceTypes
        : allAttendanceTypes;
    const attendanceWithPayTypes = withPayPool.filter(a => a.type === 'attendance_leave_with_pay');
    const attendanceWithPayOptions = [
        { value: '', label: 'Not Applicable' },
        ...attendanceWithPayTypes.map(a => ({
            value: a.id,
            label: a.name
        }))
    ];

    // For On Attendance: Leave without Pay options
    const withoutPayPool = availableAttendanceTypes.some(a => a.type === 'leave_without_pay')
        ? availableAttendanceTypes
        : allAttendanceTypes;
    const leaveWithoutPayTypes = withoutPayPool.filter(a => a.type === 'leave_without_pay');
    const leaveWithoutPayOptions = [
        { value: '', label: 'Not Applicable' },
        ...leaveWithoutPayTypes.map(a => ({
            value: a.id,
            label: a.name
        }))
    ];

    // Second field is enabled only if the first field is Not Applicable or empty
    const isLeaveWithoutPayDisabled = Boolean(formData.attendance_leave_with_pay);

    // For On Production
    const productionPool = availableAttendanceTypes.some(a => a.type === 'production')
        ? availableAttendanceTypes
        : allAttendanceTypes;
    const productionTypes = productionPool.filter(a => a.type === 'production');
    const productionTypeOptions = productionTypes.map(a => ({
        value: a.id,
        label: a.type_display ? `${a.name} (${a.type_display})` : a.name
    }));

    // Computation Slabs: Filter by latest effective date for edit mode
    const computationSlabs = formData.computation_slabs || [];
    const allSlabDates = [...new Set(computationSlabs.map(s => s.effective_from).filter(Boolean))].sort();
    const latestSlabDate = allSlabDates.length > 0 ? allSlabDates[allSlabDates.length - 1] : null;
    const hasMultipleSlabDates = allSlabDates.length > 1;
    const isFilteringLatest = !showAllSlabs && hasMultipleSlabDates && Boolean(latestSlabDate);
    const visibleSlabItems = isFilteringLatest
        ? computationSlabs
            .map((slab, originalIndex) => ({ slab, originalIndex }))
            .filter(item => item.slab.effective_from === latestSlabDate || !item.slab.effective_from)
        : computationSlabs.map((slab, originalIndex) => ({ slab, originalIndex }));

    const availableFormulaPayHeads = items
        .filter(ph => !formData.id || ph.id !== formData.id)
        .map(ph => ({
            value: ph.id,
            label: ph.name,
            type: ph.pay_head_type_display || ph.pay_head_type,
        }));

    const availableFormulaAttendanceTypes = allAttendanceTypes.map(att => ({
        value: att.id,
        label: att.name,
        type: att.type,
    }));

    const formulaSummaryText = getFormulaSummaryText(formData.computation_formula_items, items, allAttendanceTypes);
    const currentFormulaPreview = getFormulaSummaryText(editingFormulaItems, items, allAttendanceTypes);

    return (
        <Fragment>
            <style>{`
                .payhead-custom-modal {
                    max-width: 1020px !important;
                    width: 96% !important;
                }
                .formula-custom-modal {
                    max-width: 860px !important;
                    width: 95% !important;
                }
                @media (min-width: 1200px) {
                    .payhead-custom-modal:not(.formula-custom-modal) {
                        max-width: 1140px !important;
                    }
                }
                .payhead-custom-modal .modal-content {
                    border: none;
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
                    overflow: hidden;
                }
                .payhead-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                }
                .payhead-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .payhead-custom-modal .modal-close-x {
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
                .payhead-custom-modal .modal-close-x:hover { color: #555; }
                .payhead-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .payhead-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .payhead-custom-modal .btn-close-custom {
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
                .payhead-custom-modal .btn-close-custom:hover { background-color: #bb2d3b !important; }
                .payhead-custom-modal .btn-save-custom {
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
                .payhead-custom-modal .btn-save-custom:hover { background-color: #073d0b !important; }

                .choice-pill {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 16px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    background-color: #fff;
                    transition: all 0.15s ease-in-out;
                    user-select: none;
                }
                .choice-pill:focus, .choice-pill:focus-visible {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.25);
                }
                .choice-pill.active {
                    background-color: #e6f9f1;
                    border-color: #0a500f;
                    color: #1a7f53;
                    font-weight: 600;
                }
                .form-check-input:focus {
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 0.25rem rgba(10, 80, 15, 0.25) !important;
                }
            `}</style>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Pay Components</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* Search */}
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Pay Component..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>

                                {/* Pay Head Type Filter */}
                                <div style={{ minWidth: '180px' }}>
                                    <Form.Select
                                        value={typeFilter}
                                        onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                                        style={{ height: '37px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="all">All Pay Component Types</option>
                                        {PAY_HEAD_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </Form.Select>
                                </div>

                                {/* Calculation Type Filter */}
                                {/* <div style={{ minWidth: '160px' }}>
                                    <Form.Select
                                        value={calcFilter}
                                        onChange={(e) => { setCalcFilter(e.target.value); setCurrentPage(1); }}
                                        style={{ height: '37px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="all">All Calc Types</option>
                                        {calculationTypes.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </Form.Select>
                                </div> */}

                                {/* Status Filter */}
                                <div style={{ minWidth: '120px' }}>
                                    <Form.Select
                                        value={statusFilter}
                                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                                        style={{ height: '37px', borderRadius: '6px', fontSize: '13px' }}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </Form.Select>
                                </div>

                                <CreateButton
                                    module="payheads"
                                    onClick={() => handleShowModal()}
                                >
                                    Pay Component
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
                                                <th style={{ width: '60px' }}><strong>SL NO</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>PAY COMPONENT TYPE</strong></th>
                                                <th><strong>INCOME TYPE</strong></th>
                                                <th><strong>UNDER (GROUP)</strong></th>
                                                <th><strong>CALCULATION TYPE</strong></th>
                                                <th style={{ width: '100px' }}><strong>STATUS</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="text-center py-4 text-muted">
                                                        No pay components found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, index) => {
                                                    const typeMeta = getPayHeadTypeMeta(item.pay_head_type);
                                                    return (
                                                        <tr key={item.id || index}>
                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                            <td>
                                                                <strong className="text-dark">{item.name}</strong>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${typeMeta.badgeClass} light`} style={{ fontSize: '12px' }}>
                                                                    {item.pay_head_type_display || typeMeta.label}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${item.income_type === 'FIXED' ? 'badge-primary' : 'badge-warning'} light`} style={{ fontSize: '12px' }}>
                                                                    {item.income_type_display || item.income_type}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {item.under_name ? (
                                                                    <span className="text-muted font-w500">{item.under_name}</span>
                                                                ) : (
                                                                    <span className="text-muted fst-italic">-</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className="badge badge-info light" style={{ fontSize: '12px' }}>
                                                                    {item.calculation_type_name || item.calculation_type_display || getCalculationTypeLabel(item.calculation_type)}
                                                                </span>
                                                                {item.computation?.compute_method_display && (
                                                                    <div className="mt-1">
                                                                        <span className="d-block text-muted font-w500" style={{ fontSize: '11px' }}>
                                                                            {item.computation.compute_method_display}
                                                                        </span>
                                                                        {item.computation.compute_method === 'on_specified_formula' && item.computation.formula_items?.length > 0 && (
                                                                            <span className="d-inline-block text-primary font-monospace mt-1 px-1 rounded" style={{ fontSize: '10px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                                                                                {getFormulaSummaryText(item.computation.formula_items, items, allAttendanceTypes)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                           
                                                            <td>
                                                                {item.is_active ? (
                                                                    <span className="badge badge-success light">Active</span>
                                                                ) : (
                                                                    <span className="badge badge-danger light">Inactive</span>
                                                                )}
                                                            </td>
                                                            <td className="text-end">
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="payheads"
                                                                        onClick={() => handleShowModal(item)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="payheads"
                                                                        onClick={() => handleDelete(item.id, item.name)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredItems.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredItems.length)} of {filteredItems.length} entries
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

            {/* Modal for Add / Edit */}
            <Modal
                show={showModal}
                onHide={handleCloseModal}
                centered
                size="xl"
                dialogClassName="payhead-custom-modal"
            >
                <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                    <div className="modal-header-custom">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" fill="white" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {editMode ? 'Edit Pay Component' : 'Create Pay Component'}
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    Configure pay component classification, calculation method, and accounting mapping
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={handleCloseModal}>&times;</button>
                    </div>

                    <div className="modal-body-custom">
                        <div className="row g-3">
                            {/* Pay Head Name */}
                            <div className="col-md-6">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Pay Component Name <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    ref={firstInputRef}
                                    type="text"
                                    placeholder="e.g. Basic Salary, HRA, Conveyance, EPF Deduction"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    style={{ borderRadius: '8px', fontSize: '14px', padding: '10px 14px' }}
                                />
                            </div>

                            {/* Pay Head Type */}
                            <div className="col-md-6 pay-head-type-select">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Pay Component Type <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                    options={PAY_HEAD_TYPES}
                                    value={PAY_HEAD_TYPES.find(t => t.value === formData.pay_head_type)}
                                    onChange={(selected) => setFormData({ ...formData, pay_head_type: selected ? selected.value : '' })}
                                    placeholder="Select Pay Component Type..."
                                    isSearchable
                                    openMenuOnFocus={true}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </div>

                            {/* Income Type */}
                            <div className="col-md-6">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Income Type <span className="text-danger">*</span>
                                </Form.Label>
                                <div className="d-flex gap-2 income-type-group" style={{ marginTop: '2px' }}>
                                    {INCOME_TYPES.map(inc => {
                                        const isSelected = formData.income_type === inc.value;
                                        const pillId = inc.value === 'FIXED' ? 'income-type-fixed' : 'income-type-variable';
                                        return (
                                            <div
                                                key={inc.value}
                                                id={pillId}
                                                role="button"
                                                tabIndex={0}
                                                className={`choice-pill flex-fill justify-content-center ${isSelected ? 'active' : ''}`}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        income_type: prev.income_type === inc.value ? '' : inc.value
                                                    }));
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === ' ' || e.code === 'Space') {
                                                        e.preventDefault();
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            income_type: prev.income_type === inc.value ? '' : inc.value
                                                        }));
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (inc.value === 'FIXED') {
                                                            const varTab = document.getElementById('income-type-variable');
                                                            if (varTab) varTab.focus();
                                                        } else {
                                                            const underSelect = document.querySelector('.under-account-select .react-select__control');
                                                            if (underSelect) {
                                                                focusControl(underSelect);
                                                            } else {
                                                                focusNextFromControl(e.currentTarget);
                                                            }
                                                        }
                                                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        const varTab = document.getElementById('income-type-variable');
                                                        if (varTab) varTab.focus();
                                                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        const fixedTab = document.getElementById('income-type-fixed');
                                                        if (fixedTab) fixedTab.focus();
                                                    }
                                                }}
                                            >
                                                <i className={`fa fa-${isSelected ? 'check-circle' : 'circle-o'} me-2`} />
                                                {inc.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Under / Account Group */}
                            <div className="col-md-6 under-account-select">
                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                    Accounting Group (General Ledger) <span className="text-danger">*</span>
                                </Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                    options={accountGroupOptions}
                                    value={accountGroupOptions.find(opt => opt.value === formData.under) || null}
                                    onChange={(selected) => setFormData({ ...formData, under: selected ? selected.value : null })}
                                    placeholder="Search & select Accounting Group..."
                                    isClearable
                                    isSearchable
                                    openMenuOnFocus={true}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </div>

                            {/* Calculation Details Section */}
                            <div className="col-md-12 pt-1">
                                <div className="card p-3 mb-0" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                    <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(10, 80, 15, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a500f' }}>
                                            <i className="fa fa-calculator" style={{ fontSize: '13px' }}></i>
                                        </div>
                                        <div>
                                            <h6 className="mb-0 font-w600" style={{ fontSize: '13px', color: '#1e293b' }}>Calculation & Frequency Settings</h6>
                                            <span className="text-muted" style={{ fontSize: '11px' }}>Configure calculation method and associated period or attendance parameters</span>
                                        </div>
                                    </div>

                                    <div className="row g-3">
                                        {/* Calculation Type */}
                                        <div className={`calc-type-select-container ${isPeriodRequired && !isOnAttendance && !isOnProduction && !isComputedValue ? "col-md-6 mb-3" : "col-md-12 mb-3"}`}>
                                            <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                                Calculation Type <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Select
                                                classNamePrefix="react-select"
                                                styles={selectStyles}
                                                menuPortalTarget={document.body}
                                                options={calculationTypeOptions}
                                                value={calculationTypeOptions.find(c => c.value === formData.calculation_type) || null}
                                                onChange={handleCalcTypeChange}
                                                placeholder="Select Calculation Method..."
                                                isSearchable
                                                isClearable
                                                openMenuOnFocus={true}
                                                onKeyDown={handleSelectKeyDown}
                                            />
                                        </div>

                                        {/* Attendance / Production fields */}
                                        {isOnAttendance ? (
                                            <>
                                                {/* Attendance / Leave with Pay */}
                                                <div className="col-md-6 mb-3">
                                                    <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                                        Paid Attendance / Leave <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Select
                                                        classNamePrefix="react-select"
                                                        styles={selectStyles}
                                                        menuPortalTarget={document.body}
                                                        options={attendanceWithPayOptions}
                                                        value={
                                                            formData.attendance_leave_with_pay
                                                                ? attendanceWithPayOptions.find(a => a.value === formData.attendance_leave_with_pay) || null
                                                                : attendanceWithPayOptions[0]
                                                        }
                                                        onChange={handleAttendanceWithPayChange}
                                                        placeholder="Select Paid Attendance / Leave..."
                                                        isSearchable
                                                        openMenuOnFocus={true}
                                                        onKeyDown={handleSelectKeyDown}
                                                    />
                                                </div>

                                                {/* Leave without Pay (enabled only if first field is Not Applicable or empty) */}
                                                <div className="col-md-6 mb-3">
                                                    <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: isLeaveWithoutPayDisabled ? '#94a3b8' : '#334155' }}>
                                                        Unpaid Leave / Loss of Pay (LOP) {!isLeaveWithoutPayDisabled && <span className="text-danger">*</span>}
                                                    </Form.Label>
                                                    <Select
                                                        classNamePrefix="react-select"
                                                        styles={selectStyles}
                                                        menuPortalTarget={document.body}
                                                        options={leaveWithoutPayOptions}
                                                        value={
                                                            isLeaveWithoutPayDisabled
                                                                ? leaveWithoutPayOptions[0]
                                                                : (formData.leave_without_pay
                                                                    ? leaveWithoutPayOptions.find(a => a.value === formData.leave_without_pay) || null
                                                                    : leaveWithoutPayOptions[0])
                                                        }
                                                        onChange={handleLeaveWithoutPayChange}
                                                        placeholder={isLeaveWithoutPayDisabled ? "Not Applicable (Disabled)" : "Select Unpaid Leave / Loss of Pay..."}
                                                        isSearchable
                                                        isDisabled={isLeaveWithoutPayDisabled}
                                                        openMenuOnFocus={true}
                                                        onKeyDown={handleSelectKeyDown}
                                                    />
                                                </div>
                                            </>
                                        ) : isOnProduction ? (
                                            <div className="col-md-12 mb-3">
                                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                                    Piece-rate / Output Type <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Select
                                                    classNamePrefix="react-select"
                                                    styles={selectStyles}
                                                    menuPortalTarget={document.body}
                                                    options={productionTypeOptions}
                                                    value={productionTypeOptions.find(a => a.value === formData.attendance_production_type) || null}
                                                    onChange={(selected) => setFormData({ ...formData, attendance_production_type: selected ? selected.value : null })}
                                                    placeholder="Select Piece-rate / Output Type..."
                                                    isSearchable
                                                    isClearable
                                                    openMenuOnFocus={true}
                                                    onKeyDown={handleSelectKeyDown}
                                                />
                                            </div>
                                        ) : null}

                                        {/* Calculation Basis & Configuration Section for 'As Computed Value' */}
                                        {isComputedValue && (
                                            <div className="col-md-12 mb-3">
                                                <div className="p-3" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                                    <div className="text-center mb-3">
                                                        <h6 className="mb-0 font-w600" style={{ fontSize: '13px', color: '#1e293b', textDecoration: 'underline' }}>
                                                            Calculation Basis & Configuration
                                                        </h6>
                                                    </div>

                                                    {/* Compute Field */}
                                                    <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
                                                        <Form.Label className="mb-0 text-nowrap" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                                                            Calculation Basis <span className="text-danger">*</span> :
                                                        </Form.Label>
                                                        <div className="compute-method-select" style={{ width: '340px', maxWidth: '100%' }}>
                                                            <Select
                                                                classNamePrefix="react-select"
                                                                styles={selectStyles}
                                                                menuPortalTarget={document.body}
                                                                options={METHODS_OF_COMPUTATION}
                                                                value={METHODS_OF_COMPUTATION.find(m => m.value === formData.compute_method) || METHODS_OF_COMPUTATION[1]}
                                                                onChange={(selected) => {
                                                                    const val = selected ? selected.value : 'on_current_earnings_total';
                                                                    setFormData(prev => ({ ...prev, compute_method: val }));
                                                                    if (val === 'on_specified_formula') {
                                                                        handleOpenFormulaModal();
                                                                    }
                                                                }}
                                                                placeholder="Select Calculation Basis..."
                                                                isSearchable={false}
                                                                openMenuOnFocus={true}
                                                                onKeyDown={handleSelectKeyDown}
                                                            />
                                                        </div>
                                                        {formData.compute_method === 'on_specified_formula' && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-primary d-inline-flex align-items-center gap-1"
                                                                style={{ height: '42px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, padding: '0 14px' }}
                                                                onClick={handleOpenFormulaModal}
                                                            >
                                                                <i className="fa fa-calculator me-1"></i> {formulaSummaryText ? 'Edit Formula' : 'Set Formula'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {formData.compute_method === 'on_specified_formula' && (
                                                        <div
                                                            className="p-2 px-3 mb-3 rounded d-flex align-items-center justify-content-between flex-wrap gap-2"
                                                            style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                <span className="badge badge-primary light" style={{ fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '5px' }}>
                                                                    <i className="fa fa-calculator me-1"></i> Specified Formula
                                                                </span>
                                                                <span
                                                                    style={{
                                                                        fontSize: '13px',
                                                                        fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                                                        fontWeight: 600,
                                                                        color: formulaSummaryText ? '#1e293b' : '#94a3b8',
                                                                        fontStyle: formulaSummaryText ? 'normal' : 'italic'
                                                                    }}
                                                                >
                                                                    {formulaSummaryText || 'No formula defined yet. Click Set Formula.'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn btn-link btn-sm p-0 text-primary font-w600"
                                                                style={{ fontSize: '12px', textDecoration: 'underline' }}
                                                                onClick={handleOpenFormulaModal}
                                                            >
                                                                Configure
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Multi-date filter banner */}
                                                    {hasMultipleSlabDates && (
                                                        <div
                                                            className="d-flex flex-wrap align-items-center justify-content-between p-2 mb-2 rounded"
                                                            style={{
                                                                backgroundColor: isFilteringLatest ? '#f0fdf4' : '#f8fafc',
                                                                border: isFilteringLatest ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span
                                                                    className="badge"
                                                                    style={{
                                                                        backgroundColor: isFilteringLatest ? '#16a34a' : '#64748b',
                                                                        color: '#ffffff',
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px'
                                                                    }}
                                                                >
                                                                    <i className={`fa ${isFilteringLatest ? 'fa-calendar-check-o' : 'fa-list'} me-1`}></i>
                                                                    {isFilteringLatest ? `Latest Date: ${latestSlabDate}` : 'All Dates'}
                                                                </span>
                                                                <span style={{ fontSize: '12px', color: isFilteringLatest ? '#166534' : '#475569' }}>
                                                                    {isFilteringLatest
                                                                        ? (
                                                                            <>
                                                                                Showing latest date slabs (<strong>{visibleSlabItems.length}</strong> rows).
                                                                                <span className="text-muted ms-1">({computationSlabs.length - visibleSlabItems.length} older slabs hidden)</span>
                                                                            </>
                                                                        )
                                                                        : (
                                                                            <>
                                                                                Showing all <strong>{computationSlabs.length}</strong> slabs across <strong>{allSlabDates.length}</strong> dates.
                                                                            </>
                                                                        )
                                                                    }
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <button
                                                                    type="button"
                                                                    className={`btn btn-xs ${isFilteringLatest ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                                                                    onClick={() => setShowAllSlabs(!showAllSlabs)}
                                                                    style={{
                                                                        fontSize: '11px',
                                                                        fontWeight: 600,
                                                                        padding: '4px 10px',
                                                                        borderRadius: '5px',
                                                                        boxShadow: 'none'
                                                                    }}
                                                                    title={isFilteringLatest ? "Click to view all slabs across all dates" : "Click to view only latest date's slabs"}
                                                                >
                                                                    <i className={`fa ${isFilteringLatest ? 'fa-history' : 'fa-filter'} me-1`}></i>
                                                                    {isFilteringLatest ? 'View All Dates / History' : 'View Latest Date Only'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Slabs Table */}
                                                    <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                                        <table className="table table-bordered table-sm mb-0 slabs-table" style={{ fontSize: '12px' }}>
                                                            <thead style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}>
                                                                <tr className="text-center align-middle">
                                                                    <th style={{ width: '18%', minWidth: '115px', fontWeight: 600, padding: '8px 6px' }}>
                                                                        Effective From
                                                                    </th>
                                                                    <th style={{ width: '21%', minWidth: '115px', fontWeight: 600, padding: '8px 6px' }}>
                                                                        {"From Amount (>)"}
                                                                    </th>
                                                                    <th style={{ width: '21%', minWidth: '115px', fontWeight: 600, padding: '8px 6px' }}>
                                                                        {"To Amount (<=)"}
                                                                    </th>
                                                                    <th style={{ width: '18%', minWidth: '110px', fontWeight: 600, padding: '8px 6px' }}>
                                                                        Rate Type
                                                                    </th>
                                                                    <th style={{ width: '17%', minWidth: '95px', fontWeight: 600, padding: '8px 6px' }}>
                                                                        Value
                                                                    </th>
                                                                    <th style={{ width: '5%', minWidth: '40px', fontWeight: 600, padding: '8px 4px' }}>
                                                                    </th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {visibleSlabItems.map(({ slab, originalIndex }, rowIndex) => (
                                                                    <tr key={originalIndex} className="align-middle">
                                                                        <td style={{ padding: '4px' }}>
                                                                            <Form.Control
                                                                                type="date"
                                                                                size="sm"
                                                                                data-slab-field="effective_from"
                                                                                value={slab.effective_from || ''}
                                                                                onChange={(e) => handleSlabFieldChange(originalIndex, 'effective_from', e.target.value)}
                                                                                onBlur={async (e) => {
                                                                                    const val = e.target.value;
                                                                                    if (isPromptingRef.current) return;
                                                                                    const currentSlabs = formData.computation_slabs || [];
                                                                                    const rowsAbove = currentSlabs.slice(0, originalIndex);
                                                                                    const prevRowDate = rowsAbove[rowsAbove.length - 1]?.effective_from;
                                                                                    if (rowsAbove.length > 0 && checkIsNewEffectiveDate(val, prevRowDate)) {
                                                                                        if (lastPromptedRef.current?.[originalIndex] === val) return;
                                                                                        if (!lastPromptedRef.current) lastPromptedRef.current = {};
                                                                                        lastPromptedRef.current[originalIndex] = val;
                                                                                        await handlePromptNewEffectiveDate(originalIndex, val, prevRowDate);
                                                                                    }
                                                                                }}
                                                                                onKeyDown={(e) => handleSlabRowKeyDown(e, rowIndex, originalIndex, 'effective_from')}
                                                                                style={{ fontSize: '12px', height: '32px' }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ padding: '4px' }}>
                                                                            <Form.Control
                                                                                type="number"
                                                                                step="0.01"
                                                                                size="sm"
                                                                                data-slab-field="amount_greater_than"
                                                                                placeholder="0.00"
                                                                                value={slab.amount_greater_than}
                                                                                onChange={(e) => handleSlabFieldChange(originalIndex, 'amount_greater_than', e.target.value)}
                                                                                onKeyDown={(e) => handleSlabRowKeyDown(e, rowIndex, originalIndex, 'amount_greater_than')}
                                                                                style={{ fontSize: '12px', height: '32px', textAlign: 'right' }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ padding: '4px' }}>
                                                                            <Form.Control
                                                                                type="number"
                                                                                step="0.01"
                                                                                size="sm"
                                                                                data-slab-field="amount_up_to"
                                                                                placeholder="No limit"
                                                                                value={slab.amount_up_to}
                                                                                onChange={(e) => handleSlabFieldChange(originalIndex, 'amount_up_to', e.target.value)}
                                                                                onKeyDown={(e) => handleSlabRowKeyDown(e, rowIndex, originalIndex, 'amount_up_to')}
                                                                                style={{ fontSize: '12px', height: '32px', textAlign: 'right' }}
                                                                            />
                                                                        </td>
                                                                        <td style={{ padding: '4px' }}>
                                                                            <select
                                                                                className="form-select form-select-sm"
                                                                                data-slab-field="slab_type"
                                                                                value={slab.slab_type}
                                                                                onChange={(e) => handleSlabFieldChange(originalIndex, 'slab_type', e.target.value)}
                                                                                onKeyDown={(e) => handleSlabRowKeyDown(e, rowIndex, originalIndex, 'slab_type')}
                                                                                style={{ fontSize: '12px', height: '32px' }}
                                                                            >
                                                                                <option value="percentage">Percentage</option>
                                                                                <option value="value">Value</option>
                                                                            </select>
                                                                        </td>
                                                                        <td style={{ padding: '4px' }}>
                                                                            <Form.Control
                                                                                type="number"
                                                                                step="0.01"
                                                                                size="sm"
                                                                                data-slab-field="value"
                                                                                placeholder="0.00"
                                                                                value={slab.value}
                                                                                onChange={(e) => handleSlabFieldChange(originalIndex, 'value', e.target.value)}
                                                                                onKeyDown={(e) => handleSlabRowKeyDown(e, rowIndex, originalIndex, 'value')}
                                                                                style={{ fontSize: '12px', height: '32px', textAlign: 'right' }}
                                                                            />
                                                                        </td>
                                                                        <td className="text-center" style={{ padding: '4px' }}>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-outline-danger btn-xxs"
                                                                                onClick={() => handleRemoveSlabRow(originalIndex)}
                                                                                title="Delete Slab Row"
                                                                                style={{ width: '26px', height: '26px', padding: 0, borderRadius: '4px' }}
                                                                                disabled={(formData.computation_slabs || []).length <= 1}
                                                                            >
                                                                                <i className="fa fa-times"></i>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="d-flex justify-content-between align-items-center mt-2 px-1">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="text-muted" style={{ fontSize: '11px' }}>
                                                                Leave <strong>{"To Amount (<=)"}</strong> blank for the open-ended final slab.
                                                            </span>
                                                            {isFilteringLatest && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-link text-primary p-0"
                                                                    onClick={() => setShowAllSlabs(true)}
                                                                    style={{ fontSize: '11px', textDecoration: 'underline', fontWeight: 500 }}
                                                                >
                                                                    (Click here to display all {computationSlabs.length} slabs)
                                                                </button>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-link text-primary p-0"
                                                            onClick={handleAddSlabRow}
                                                            style={{ fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}
                                                        >
                                                            <i className="fa fa-plus-circle me-1"></i> Add Slab Row
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Calculation Period (Placed Last) */}
                                        {isPeriodRequired ? (
                                            <div className={isOnAttendance || isOnProduction || isComputedValue ? "col-md-12 mb-3" : "col-md-6 mb-3"}>
                                                <Form.Label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                                                    Calculation Period <span className="text-danger">*</span>
                                                </Form.Label>
                                                <Select
                                                    classNamePrefix="react-select"
                                                    styles={selectStyles}
                                                    menuPortalTarget={document.body}
                                                    options={calculationPeriodOptions}
                                                    value={calculationPeriodOptions.find(p => p.value === formData.calculation_period) || null}
                                                    onChange={(selected) => setFormData({ ...formData, calculation_period: selected ? selected.value : null })}
                                                    placeholder={
                                                        calculationPeriodOptions.length === 0
                                                            ? "No units linked"
                                                            : "Select Calculation Period..."
                                                    }
                                                    isSearchable
                                                    isClearable
                                                    isDisabled={calculationPeriodOptions.length === 0}
                                                    openMenuOnFocus={true}
                                                    onKeyDown={handleSelectKeyDown}
                                                />
                                                {calculationPeriodOptions.length === 0 && (
                                                    <span className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                                        (Configure linked units under Payroll &gt; Calculation Types)
                                                    </span>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="col-md-12 pt-2">
                                <div className="card p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                    <div className="row g-3">
                                        <div className="col-md-4 mb-3">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="affectSalarySwitch"
                                                    checked={formData.affect_net_salary}
                                                    onChange={(e) => setFormData({ ...formData, affect_net_salary: e.target.checked })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <label className="form-check-label" htmlFor="affectSalarySwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                                    Include in Net Pay (Take-home)
                                                </label>
                                            </div>
                                            <span className="text-muted d-block" style={{ fontSize: '11px', marginLeft: '2.5rem' }}>
                                                Include in payslip net earnings
                                            </span>
                                        </div>

                                        <div className="col-md-4">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="gratuitySwitch"
                                                    checked={formData.use_for_gratuity}
                                                    onChange={(e) => setFormData({ ...formData, use_for_gratuity: e.target.checked })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <label className="form-check-label" htmlFor="gratuitySwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                                    Eligible for Gratuity Calculation
                                                </label>
                                            </div>
                                            <span className="text-muted d-block" style={{ fontSize: '11px', marginLeft: '2.5rem' }}>
                                                Consider for gratuity calculation
                                            </span>
                                        </div>

                                        <div className="col-md-4">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="payHeadActiveSwitch"
                                                    checked={formData.is_active}
                                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <label className="form-check-label" htmlFor="payHeadActiveSwitch" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                                                    Active Pay Component
                                                </label>
                                            </div>
                                            <span className="text-muted d-block" style={{ fontSize: '11px', marginLeft: '2.5rem' }}>
                                                Enable or disable for payroll runs
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-custom">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={handleCloseModal}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="btn-save-custom"
                            disabled={submitting}
                        >
                            {submitting ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Computation Info (Specified Formula) Modal */}
            <Modal
                show={showFormulaModal}
                onHide={() => setShowFormulaModal(false)}
                centered
                size="lg"
                dialogClassName="payhead-custom-modal formula-custom-modal"
                backdrop="static"
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-calculator text-white" style={{ fontSize: '18px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Formula Builder — Custom Calculation
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Configure formula operations using pay components and attendance & output types
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={() => setShowFormulaModal(false)}>&times;</button>
                </div>

                <div className="modal-body-custom">
                    <div className="table-responsive mb-3" style={{ border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'visible' }}>
                        <table className="table mb-0 text-nowrap" style={{ borderCollapse: 'collapse', width: '100%' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ width: '42%', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Function
                                    </th>
                                    <th style={{ width: '48%', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Pay Component / Attendance Type
                                    </th>
                                    <th style={{ width: '10%', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {editingFormulaItems.map((item, index) => {
                                    const isPayHead = item.function === 'add_pay_head' || item.function === 'subtract_pay_head';
                                    const currentFunction = FORMULA_FUNCTIONS.find(f => f.value === item.function) || FORMULA_FUNCTIONS[0];

                                    return (
                                        <tr
                                            key={index}
                                            className={`formula-row-${index}`}
                                            style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                                        >
                                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                                <div className="formula-function-select">
                                                    <Select
                                                        classNamePrefix="react-select"
                                                        styles={selectStyles}
                                                        menuPortalTarget={document.body}
                                                        options={FORMULA_FUNCTIONS}
                                                        value={currentFunction}
                                                        onChange={(sel) => handleFunctionSelect(index, sel)}
                                                        onKeyDown={(e) => handleFunctionKeyDown(e, index)}
                                                        isSearchable={false}
                                                        openMenuOnFocus={false}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                                                <div className="formula-target-select">
                                                    {isPayHead ? (
                                                        <Select
                                                            classNamePrefix="react-select"
                                                            styles={selectStyles}
                                                            menuPortalTarget={document.body}
                                                            options={availableFormulaPayHeads}
                                                            value={availableFormulaPayHeads.find(p => p.value === item.pay_head) || null}
                                                            onChange={(sel) => handleFormulaTargetChange(index, 'pay_head', sel ? sel.value : null)}
                                                            onKeyDown={(e) => handleTargetKeyDown(e, index)}
                                                            placeholder="Select Pay Component..."
                                                            isSearchable={true}
                                                            openMenuOnFocus={false}
                                                        />
                                                    ) : (
                                                        <Select
                                                            classNamePrefix="react-select"
                                                            styles={selectStyles}
                                                            menuPortalTarget={document.body}
                                                            options={availableFormulaAttendanceTypes}
                                                            value={availableFormulaAttendanceTypes.find(a => a.value === item.attendance_type) || null}
                                                            onChange={(sel) => handleFormulaTargetChange(index, 'attendance_type', sel ? sel.value : null)}
                                                            onKeyDown={(e) => handleTargetKeyDown(e, index)}
                                                            placeholder="Select Attendance / Output Type..."
                                                            isSearchable={true}
                                                            openMenuOnFocus={false}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm btn-outline-danger d-inline-flex align-items-center justify-content-center formula-delete-${index}`}
                                                    style={{ borderRadius: '6px', width: '30px', height: '30px', padding: 0, fontSize: '13px' }}
                                                    onClick={() => handleRemoveFormulaRow(index)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleRemoveFormulaRow(index);
                                                        }
                                                    }}
                                                    title="Remove row"
                                                >
                                                    <i className="fa fa-times"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="d-flex justify-content-end mb-3">
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-primary p-0 formula-add-row-btn"
                            onClick={handleAddFormulaRow}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddFormulaRow();
                                }
                            }}
                            style={{ fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}
                        >
                            <i className="fa fa-plus-circle me-1"></i> Add Row
                        </button>
                    </div>

                    {/* Real-time Formula Preview */}
                    <div
                        className="p-3 rounded d-flex align-items-center gap-2 flex-wrap"
                        style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                        }}
                    >
                        <span className="badge badge-primary light" style={{ fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '5px' }}>
                            <i className="fa fa-calculator me-1"></i> Formula Preview
                        </span>
                        <span
                            style={{
                                fontSize: '13px',
                                fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontWeight: 600,
                                color: currentFormulaPreview ? '#1e293b' : '#94a3b8',
                                fontStyle: currentFormulaPreview ? 'normal' : 'italic'
                            }}
                        >
                            {currentFormulaPreview || 'Formula is empty — select Pay Component or Attendance Type'}
                        </span>
                    </div>
                </div>

                <div className="modal-footer-custom">
                    <Button
                        type="button"
                        className="btn-close-custom"
                        onClick={() => setShowFormulaModal(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                setShowFormulaModal(false);
                            }
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="btn-save-custom"
                        onClick={handleSaveFormula}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveFormula();
                            }
                        }}
                    >
                        Save
                    </Button>
                </div>
            </Modal>
        </Fragment>
    );
};

export default PayHeadList;
