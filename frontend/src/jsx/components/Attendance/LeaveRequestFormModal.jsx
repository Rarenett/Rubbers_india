import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    createLeaveRequest,
    updateLeaveRequest,
    getLeaveTypes,
    getEmployeeLeaveTypes,
    getLeaveBalances,
    formatFriendlyError
} from '../../../services/AttendanceService';
import EmployeeLeaveHistoryModal from './EmployeeLeaveHistoryModal';

const LeaveRequestFormModal = ({ show, onHide, onSuccess, editMode = false, leaveRequest = null }) => {
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [leaveBalances, setLeaveBalances] = useState({});
    const [loadingDropdowns, setLoadingDropdowns] = useState(false);
    const [showLastLeavesModal, setShowLastLeavesModal] = useState(false);

    const [selectedLeaveType, setSelectedLeaveType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedDates, setSelectedDates] = useState([]);
    const [singleDateInput, setSingleDateInput] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dateErrorMessage, setDateErrorMessage] = useState('');

    const [selectedFiles, setSelectedFiles] = useState([]);
    const [existingDocuments, setExistingDocuments] = useState([]);
    const [deletedDocIds, setDeletedDocIds] = useState([]);
    const fileInputRef = useRef(null);

    // Retrieve logged-in user info for display
    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const loggedInUser = userDetails.user || {};
    const applicantName = editMode && leaveRequest?.employee_name
        ? leaveRequest.employee_name
        : (loggedInUser.first_name
            ? `${loggedInUser.first_name} ${loggedInUser.last_name || ''}`.trim()
            : (loggedInUser.username || 'Current Logged-in User'));

    // Helper to get formatted local date string 'YYYY-MM-DD'
    const getLocalDateStr = (d = new Date()) => {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
    };

    // Helper to format dates to DD-MM-YYYY
    const formatDateDMY = (dateStr) => {
        if (!dateStr) return '';
        try {
            const clean = String(dateStr).split('T')[0];
            const parts = clean.split('-');
            if (parts.length === 3 && parts[0].length === 4) {
                const [y, m, d] = parts;
                return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    const formatDateDisplay = formatDateDMY;

    // Get current leave type details and apply_before_days
    const selectedLeaveTypeObj = leaveTypes.find(lt => String(lt.id) === String(selectedLeaveType));
    const applyBeforeDays = selectedLeaveTypeObj ? (parseInt(selectedLeaveTypeObj.apply_before_days, 10) || 0) : 0;

    // Minimum allowed date according to apply_before_days
    const minAllowedDate = React.useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + applyBeforeDays);
        return getLocalDateStr(d);
    }, [applyBeforeDays]);

    useEffect(() => {
        if (show) {
            loadDropdowns();
            if (editMode && leaveRequest) {
                const targetId = String(leaveRequest.leave_type || leaveRequest.leave_type_id || '');
                setSelectedLeaveType(targetId);
                const rawDates = leaveRequest.leave_dates || [];
                const dates = rawDates.map(d => typeof d === 'string' ? d : (d.date || '')).filter(Boolean);
                setSelectedDates(dates);
                setStartDate(dates[0] || '');
                setEndDate(dates.length > 1 ? dates[dates.length - 1] : (dates[0] || ''));
                setSingleDateInput('');
                setReason(leaveRequest.reason || '');
                setExistingDocuments(leaveRequest.documents || []);
                setSelectedFiles([]);
                setDeletedDocIds([]);
                setDateErrorMessage('');
                setSubmitting(false);
            } else {
                resetForm();
            }
        }
    }, [show, editMode, leaveRequest]);

    const resetForm = () => {
        setSelectedLeaveType('');
        setStartDate('');
        setEndDate('');
        setSelectedDates([]);
        setSingleDateInput('');
        setReason('');
        setSelectedFiles([]);
        setExistingDocuments([]);
        setDeletedDocIds([]);
        setDateErrorMessage('');
        setSubmitting(false);
        setShowLastLeavesModal(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveNewFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExistingDoc = (docId) => {
        setExistingDocuments(prev => prev.filter(d => d.id !== docId));
        setDeletedDocIds(prev => [...prev, docId]);
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileIcon = (fileName = '') => {
        const ext = String(fileName).split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'fa-file-image text-primary';
        if (['pdf'].includes(ext)) return 'fa-file-pdf text-danger';
        if (['doc', 'docx'].includes(ext)) return 'fa-file-word text-info';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel text-success';
        return 'fa-file-alt text-secondary';
    };

    const handleLeaveTypeChange = (newTypeId) => {
        setSelectedLeaveType(newTypeId);
        setDateErrorMessage('');

        const newTypeObj = leaveTypes.find(lt => String(lt.id) === String(newTypeId));
        const newApplyBefore = newTypeObj ? (parseInt(newTypeObj.apply_before_days, 10) || 0) : 0;

        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + newApplyBefore);
        const newMinDate = getLocalDateStr(d);

        // Check if previously selected dates violate the new minimum date requirement
        const invalidDates = selectedDates.filter(dateStr => dateStr < newMinDate);
        if (invalidDates.length > 0) {
            const validDates = selectedDates.filter(dateStr => dateStr >= newMinDate);
            setSelectedDates(validDates);
            const msg = `Selected date(s) [${invalidDates.join(', ')}] were removed because "${newTypeObj?.name || 'this leave type'}" requires at least ${newApplyBefore} day(s) advance notice. Earliest allowed date is ${formatDateDisplay(newMinDate)} (${newMinDate}).`;
            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Dates Adjusted',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
        }

        // Reset range / single inputs if they violate the new min date
        if (startDate && startDate < newMinDate) {
            setStartDate('');
        }
        if (endDate && endDate < newMinDate) {
            setEndDate('');
        }
        if (singleDateInput && singleDateInput < newMinDate) {
            setSingleDateInput('');
        }
    };

    const handleDateInput = (e, fieldType) => {
        const val = e.target.value;
        if (!val) {
            if (fieldType === 'start') setStartDate('');
            else if (fieldType === 'end') setEndDate('');
            else if (fieldType === 'single') setSingleDateInput('');
            return;
        }

        // Check if entered date is earlier than minAllowedDate or rangeUnderflow
        if (val < minAllowedDate || e.target.validity?.rangeUnderflow) {
            e.target.value = '';
            if (fieldType === 'start') setStartDate('');
            else if (fieldType === 'end') setEndDate('');
            else if (fieldType === 'single') setSingleDateInput('');

            const leaveName = selectedLeaveTypeObj?.name || 'Selected leave type';
            const formattedMin = formatDateDisplay(minAllowedDate);
            const formattedVal = formatDateDisplay(val);
            const msg = `It is not possible to select ${formattedVal} (${val}). "${leaveName}" requires at least ${applyBeforeDays} day(s) advance notice. The earliest date you can apply for is ${formattedMin} (${minAllowedDate}).`;

            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        setDateErrorMessage('');
        if (fieldType === 'start') {
            setStartDate(val);
            if (endDate && endDate < val) {
                setEndDate('');
            }
        } else if (fieldType === 'end') {
            if (startDate && val < startDate) {
                e.target.value = '';
                setEndDate('');
                const msg = `End date (${formatDateDisplay(val)}) cannot be earlier than start date (${formatDateDisplay(startDate)}).`;
                setDateErrorMessage(msg);
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Date Range',
                    text: msg,
                    confirmButtonColor: '#0a500f'
                });
                return;
            }
            setEndDate(val);
        } else if (fieldType === 'single') {
            setSingleDateInput(val);
        }
    };

    const handleDateBlur = (e, fieldType) => {
        const val = e.target.value;
        if ((val && val < minAllowedDate) || e.target.validity?.rangeUnderflow) {
            e.target.value = '';
            if (fieldType === 'start') setStartDate('');
            else if (fieldType === 'end') setEndDate('');
            else if (fieldType === 'single') setSingleDateInput('');

            const leaveName = selectedLeaveTypeObj?.name || 'Selected leave type';
            const formattedMin = formatDateDisplay(minAllowedDate);
            const formattedVal = formatDateDisplay(val);
            const msg = `It is not possible to select ${formattedVal} (${val}). "${leaveName}" requires at least ${applyBeforeDays} day(s) advance notice. The earliest date you can apply for is ${formattedMin} (${minAllowedDate}).`;

            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
        }
    };

    const loadDropdowns = async () => {
        try {
            setLoadingDropdowns(true);
            const ltData = await getLeaveTypes({ is_active: true });
            const allActiveTypes = Array.isArray(ltData) ? ltData : (ltData.results || []);

            const empParam = (editMode && leaveRequest) ? (leaveRequest.employee?.id || leaveRequest.employee || 'me') : 'me';

            // Check if employee has specific mapped leave types
            let availableTypes = allActiveTypes;
            try {
                const empLtData = await getEmployeeLeaveTypes(empParam, { is_active: true });
                const empLtList = Array.isArray(empLtData) ? empLtData : (empLtData.results || []);
                if (empLtList.length > 0) {
                    const mappedIds = new Set(empLtList.map(item => Number(item.leave_type)));
                    const filtered = allActiveTypes.filter(lt => mappedIds.has(Number(lt.id)));
                    if (filtered.length > 0) {
                        availableTypes = filtered;
                    }
                }
            } catch (err) {
                console.warn('Could not load employee specific leave types, defaulting to all active leave types:', err);
            }

            setLeaveTypes(availableTypes);

            // Fetch remaining leave balances calculated from EmployeeLeaveTransaction
            try {
                const balancesData = await getLeaveBalances({ employee: empParam });
                if (balancesData && typeof balancesData === 'object') {
                    setLeaveBalances(balancesData);
                }
            } catch (err) {
                console.warn('Could not load leave balances:', err);
            }

            if (editMode && leaveRequest) {
                const targetId = String(leaveRequest.leave_type || leaveRequest.leave_type_id || '');
                if (targetId) setSelectedLeaveType(targetId);
            } else if (availableTypes.length > 0) {
                setSelectedLeaveType(String(availableTypes[0].id));
            } else {
                setSelectedLeaveType('');
            }
        } catch (error) {
            console.error('Error loading leave types:', error);
            setLeaveTypes([]);
        } finally {
            setLoadingDropdowns(false);
        }
    };

    // Auto-generate date range when start and end date are selected
    const handleGenerateDateRange = () => {
        if (!startDate || !endDate) return;

        if (startDate < minAllowedDate) {
            const msg = `It is not possible to select ${formatDateDisplay(startDate)}. "${selectedLeaveTypeObj?.name || 'This leave type'}" requires at least ${applyBeforeDays} day(s) advance notice. Earliest date allowed is ${formatDateDisplay(minAllowedDate)} (${minAllowedDate}).`;
            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Date Range',
                text: 'End date must be on or after start date.'
            });
            return;
        }

        const dates = [];
        const cur = new Date(start);
        while (cur <= end) {
            const yr = cur.getFullYear();
            const mo = String(cur.getMonth() + 1).padStart(2, '0');
            const da = String(cur.getDate()).padStart(2, '0');
            const dateStr = `${yr}-${mo}-${da}`;
            if (dateStr >= minAllowedDate) {
                dates.push(dateStr);
            }
            cur.setDate(cur.getDate() + 1);
        }

        if (dates.length === 0) {
            const msg = `It is not possible to select these dates. "${selectedLeaveTypeObj?.name || 'This leave type'}" requires at least ${applyBeforeDays} day(s) advance notice. Earliest date allowed is ${formatDateDisplay(minAllowedDate)} (${minAllowedDate}).`;
            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        // Merge unique sorted
        const merged = Array.from(new Set([...selectedDates, ...dates])).sort();
        setSelectedDates(merged);
        setDateErrorMessage('');
    };

    const handleAddSingleDate = () => {
        if (!singleDateInput) return;

        if (singleDateInput < minAllowedDate) {
            const msg = `It is not possible to select ${formatDateDisplay(singleDateInput)}. "${selectedLeaveTypeObj?.name || 'This leave type'}" requires at least ${applyBeforeDays} day(s) advance notice. Earliest date allowed is ${formatDateDisplay(minAllowedDate)} (${minAllowedDate}).`;
            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'warning',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        if (!selectedDates.includes(singleDateInput)) {
            setSelectedDates([...selectedDates, singleDateInput].sort());
        }
        setSingleDateInput('');
        setDateErrorMessage('');
    };

    const handleRemoveDate = (dateToRemove) => {
        setSelectedDates(selectedDates.filter(d => d !== dateToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedLeaveType) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select a leave type.' });
            return;
        }
        if (selectedDates.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please select at least one leave date.' });
            return;
        }

        // Final validation against minimum notice days
        const invalidDates = selectedDates.filter(d => d < minAllowedDate);
        if (invalidDates.length > 0) {
            const msg = `It is not possible to submit request for: ${invalidDates.join(', ')}. "${selectedLeaveTypeObj?.name || 'This leave type'}" requires at least ${applyBeforeDays} day(s) advance notice. Earliest date allowed is ${formatDateDisplay(minAllowedDate)} (${minAllowedDate}).`;
            setDateErrorMessage(msg);
            Swal.fire({
                icon: 'error',
                title: 'Not Possible',
                text: msg,
                confirmButtonColor: '#0a500f'
            });
            return;
        }

        if (!reason.trim()) {
            Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please enter a reason for the leave.' });
            return;
        }

        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('leave_type', parseInt(selectedLeaveType, 10));
            formData.append('dates', JSON.stringify(selectedDates));
            formData.append('total_days', selectedDates.length);
            formData.append('reason', reason.trim());

            selectedFiles.forEach((file) => {
                formData.append('documents', file);
            });

            if (editMode && deletedDocIds.length > 0) {
                formData.append('deleted_document_ids', JSON.stringify(deletedDocIds));
            }

            let saved;
            if (editMode && leaveRequest?.id) {
                saved = await updateLeaveRequest(leaveRequest.id, formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Request Updated',
                    text: 'Leave request has been updated successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                saved = await createLeaveRequest(formData);
                Swal.fire({
                    icon: 'success',
                    title: 'Request Submitted',
                    text: 'Leave request has been submitted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            if (onSuccess) onSuccess(saved);
            onHide();
        } catch (error) {
            const errorMsg = formatFriendlyError(error, editMode ? 'Failed to update leave request' : 'Failed to submit leave request');
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} dialogClassName="leave-custom-modal modal-lg" centered>
            <style>{`
                .leave-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .leave-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .leave-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .leave-custom-modal .modal-close-x {
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
                .leave-custom-modal .modal-close-x:hover { color: #555; }
                .leave-custom-modal .modal-body-custom { padding: 28px; }
                .leave-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .leave-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .leave-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .leave-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .leave-custom-modal input[type="date"]::-webkit-calendar-picker-indicator {
                    display: inline-block !important;
                    width: 20px !important;
                    height: 20px !important;
                    min-width: 20px !important;
                    min-height: 20px !important;
                    opacity: 1 !important;
                    cursor: pointer !important;
                    margin-left: auto !important;
                    padding: 0 !important;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E") !important;
                    background-repeat: no-repeat !important;
                    background-position: center !important;
                    background-size: 16px 16px !important;
                }
                .leave-custom-modal input[type="date"]::-webkit-calendar-picker-indicator:hover {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%232ece8a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E") !important;
                }
                .leave-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .leave-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .leave-custom-modal .btn-save-custom {
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
                .leave-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .date-badge-pill {
                    display: inline-flex;
                    align-items: center;
                    background-color: #e0f2fe;
                    color: #0369a1;
                    font-weight: 500;
                    font-size: 13px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    margin: 3px;
                }
                .date-badge-pill .remove-pill {
                    margin-left: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    color: #0284c7;
                }
                .date-badge-pill .remove-pill:hover {
                    color: #b91c1c;
                }
                .leave-custom-modal .btn-action-add-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: transparent;
                    border: none;
                    padding: 0;
                    font-size: 13px;
                    font-weight: 500;
                    color: #0a500f;
                    text-decoration: none;
                    cursor: pointer;
                    transition: color 0.15s ease-in-out, opacity 0.15s ease-in-out;
                    white-space: nowrap;
                    line-height: 1.2;
                }
                .leave-custom-modal .btn-action-add-link:hover:not(:disabled) {
                    color: #24ab72;
                    text-decoration: none;
                }
                .leave-custom-modal .btn-action-add-link:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }
                .leave-custom-modal .btn-action-add-link i {
                    font-size: 14px;
                    color: #0a500f;
                }
                .leave-custom-modal .btn-action-add-link:hover:not(:disabled) i {
                    color: #24ab72;
                }
            `}</style>

            <div className="modal-header-custom">
                <div className="d-flex align-items-center gap-3">
                    <div className="modal-icon-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" fill="white"/>
                        </svg>
                    </div>
                    <div>
                        <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                            {editMode ? 'Edit Leave Request' : 'New Leave Request'}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                            {editMode ? 'Modify employee leave application and requested dates' : 'Submit an employee leave application with requested dates'}
                        </p>
                    </div>
                </div>
                <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
            </div>

            <Form onSubmit={handleSubmit}>
                <div className="modal-body-custom">
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom d-flex justify-content-between align-items-center">
                                    <span>Applicant</span>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom bg-light text-muted"
                                    value={applicantName}
                                    readOnly
                                    disabled
                                />
                            </Form.Group>
                        </Col>

                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="form-label-custom d-flex justify-content-between align-items-center">
                                    <span>Leave Type <span className="text-danger">*</span></span>
                                    {selectedLeaveType && (
                                        <span className="badge bg-light text-primary border fs-11 fw-semibold">
                                            Remaining: {(() => {
                                                const b = leaveBalances[selectedLeaveType] ?? leaveBalances[String(selectedLeaveType)];
                                                const r = b !== undefined ? Number(b.remaining) : 0;
                                                return Number.isInteger(r) ? r : r.toFixed(1);
                                            })()} day(s)
                                        </span>
                                    )}
                                </Form.Label>
                                <Form.Select
                                    className="form-control-custom"
                                    value={selectedLeaveType}
                                    onChange={(e) => handleLeaveTypeChange(e.target.value)}
                                    required
                                    disabled={loadingDropdowns}
                                >
                                    <option value="">-- Select Leave Type --</option>
                                    {leaveTypes.map((lt) => {
                                        const balObj = leaveBalances[lt.id] ?? leaveBalances[String(lt.id)];
                                        const rem = balObj !== undefined ? Number(balObj.remaining) : 0;
                                        const remDisplay = Number.isInteger(rem) ? rem : rem.toFixed(1);
                                        return (
                                            <option key={lt.id} value={lt.id}>
                                                {lt.name} ({lt.code}) ({remDisplay} remaining)
                                            </option>
                                        );
                                    })}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>

                    

                    {/* Separate modal displaying details of last leaves taken */}
                    <EmployeeLeaveHistoryModal
                        show={showLastLeavesModal}
                        onHide={() => setShowLastLeavesModal(false)}
                        leaveRequestId={editMode && leaveRequest ? leaveRequest.id : null}
                        employeeId={editMode && leaveRequest ? (leaveRequest.employee?.id || leaveRequest.employee) : 'me'}
                        employeeName={applicantName}
                        appliedLeaveTypeId={selectedLeaveType || (leaveRequest?.leave_type?.id || leaveRequest?.leave_type)}
                    />

                    {/* Notice Requirement Information Banner */}
                    {selectedLeaveType && (
                        <div
                            className="d-flex align-items-center justify-content-between p-2 mb-3 rounded"
                            style={{
                                backgroundColor: applyBeforeDays > 0 ? '#fffbeb' : '#f0fdf4',
                                border: `1px solid ${applyBeforeDays > 0 ? '#fde68a' : '#bbf7d0'}`
                            }}
                        >
                            <div className="d-flex align-items-center gap-2 fs-12">
                                <i className={`fa ${applyBeforeDays > 0 ? 'fa-info-circle text-warning' : 'fa-check-circle text-success'}`}></i>
                                <span style={{ color: applyBeforeDays > 0 ? '#92400e' : '#166534', fontWeight: 500 }}>
                                    {applyBeforeDays > 0
                                        ? `Notice Policy: Requires at least ${applyBeforeDays} day(s) advance notice. Earliest allowed date is ${formatDateDisplay(minAllowedDate)}. Dates prior to this are disabled in the calendar.`
                                        : 'Notice Policy: Immediate application (0 days notice). Same-day and future dates are allowed.'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Error Banner when typing an invalid date */}
                    {dateErrorMessage && (
                        <div
                            className="alert alert-danger d-flex align-items-center py-2 px-3 mb-3 fs-12"
                            role="alert"
                            style={{ borderRadius: '8px' }}
                        >
                            <i className="fa fa-exclamation-triangle me-2 fs-14"></i>
                            <div>
                                <strong>Not Possible:</strong> {dateErrorMessage}
                            </div>
                        </div>
                    )}

                    {/* Button to view details of last leaves taken in separate modal */}
                    <div
                        className="d-flex align-items-center justify-content-between p-2 px-3 mb-3 rounded-3"
                        style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <div
                                style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '6px',
                                    backgroundColor: '#e8faf2',
                                    color: '#0a500f',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                }}
                            >
                                <i className="fa fa-history"></i>
                            </div>
                            <div>
                                
                                <small className="text-muted d-block fs-11">
                                    Review previous leaves taken by {applicantName} and remaining quotas
                                </small>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline-primary"
                            size="sm"
                            className="d-inline-flex align-items-center gap-1 py-1 px-3 fs-12 fw-semibold"
                            style={{ borderRadius: '6px' }}
                            onClick={() => setShowLastLeavesModal(true)}
                        >
                            View Previous Leaves
                        </Button>
                    </div>

                    {/* Date Selection Box */}
                    <div className="p-3 border rounded-3 bg-light bg-opacity-50 mb-3">
                        <span className="fw-semibold text-dark fs-13 d-block mb-2">
                            Select Leave Dates
                        </span>

                        {!selectedLeaveType && (
                            <div className="text-muted fs-12 mb-2 italic">
                                <em>Please select a leave type above to enable date selection.</em>
                            </div>
                        )}

                        <Row className="align-items-end g-2 mb-3">
                            <Col md={5}>
                                <Form.Label className="fs-12 text-muted mb-1">From Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }}
                                    min={minAllowedDate}
                                    value={startDate}
                                    disabled={!selectedLeaveType}
                                    onChange={(e) => handleDateInput(e, 'start')}
                                    onBlur={(e) => handleDateBlur(e, 'start')}
                                />
                            </Col>
                            <Col md={5}>
                                <Form.Label className="fs-12 text-muted mb-1">To Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    className="form-control-custom"
                                    style={{ padding: '4px 8px', fontSize: '12px', height: '32px' }}
                                    min={startDate && startDate > minAllowedDate ? startDate : minAllowedDate}
                                    value={endDate}
                                    disabled={!selectedLeaveType}
                                    onChange={(e) => handleDateInput(e, 'end')}
                                    onBlur={(e) => handleDateBlur(e, 'end')}
                                />
                            </Col>
                            <Col md={2} className="d-flex align-items-end" style={{ paddingBottom: '7px' }}>
                                <button
                                    type="button"
                                    className="btn-action-add-link"
                                    onClick={handleGenerateDateRange}
                                    disabled={!startDate || !endDate || !selectedLeaveType}
                                    title="Add date range"
                                >
                                    <i className="fa fa-plus-circle me-1"></i> Add Range
                                </button>
                            </Col>
                        </Row>

                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                            <span className="fs-12 text-muted">Or add specific date:</span>
                            <Form.Control
                                type="date"
                                className="form-control-custom"
                                style={{ width: '145px', padding: '4px 8px', fontSize: '12px', height: '30px' }}
                                min={minAllowedDate}
                                value={singleDateInput}
                                disabled={!selectedLeaveType}
                                onChange={(e) => handleDateInput(e, 'single')}
                                onBlur={(e) => handleDateBlur(e, 'single')}
                            />
                            <button
                                type="button"
                                className="btn-action-add-link"
                                onClick={handleAddSingleDate}
                                disabled={!singleDateInput || !selectedLeaveType}
                                title="Add individual date"
                            >
                                <i className="fa fa-plus-circle me-1"></i> Add Date
                            </button>
                        </div>

                        {/* Selected Dates Container */}
                        <div className="mt-2 pt-2 border-top">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fs-12 fw-semibold text-dark">
                                    Selected Dates ({selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''}):
                                </span>
                                {selectedDates.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-link p-0 text-danger fs-11"
                                        onClick={() => setSelectedDates([])}
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {selectedDates.length === 0 ? (
                                <div className="text-muted fs-12 py-1">
                                    No dates added yet. Choose a date range or add individual dates above.
                                </div>
                            ) : (
                                <div className="d-flex flex-wrap">
                                    {selectedDates.map((dateStr) => (
                                        <span key={dateStr} className="date-badge-pill">
                                            {formatDateDMY(dateStr)}
                                            <span
                                                className="remove-pill"
                                                onClick={() => handleRemoveDate(dateStr)}
                                                title="Remove date"
                                            >
                                                &times;
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">
                            Reason for Leave <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            className="form-control-custom"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter detailed reason for leave..."
                            required
                        />
                    </Form.Group>

                    {/* Multiple Documents Upload Field */}
                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom d-flex justify-content-between align-items-center">
                            <span>
                                <i className="fa fa-paperclip me-1 text-muted"></i>
                                Supporting Documents <small className="text-muted fw-normal">(Optional)</small>
                            </span>
                            <span className="text-muted fs-12">
                                {(selectedFiles.length + existingDocuments.length) > 0
                                    ? `${selectedFiles.length + existingDocuments.length} file(s) selected`
                                    : 'Multiple files allowed'}
                            </span>
                        </Form.Label>

                        {/* Drop / Upload Box */}
                        <div
                            className="p-3 rounded-3 text-center position-relative"
                            style={{
                                border: '2px dashed #cbd5e1',
                                backgroundColor: '#f8fafc',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt"
                            />
                            <div className="py-1">
                                <i className="fa fa-cloud-upload-alt fs-2 text-primary mb-2 d-block"></i>
                                <div className="fw-semibold fs-13 text-dark">
                                    Click to browse or drag and drop files here
                                </div>
                                <small className="text-muted fs-11">
                                    Supports PDF, Images (JPG, PNG), Word (DOC, DOCX), Excel files
                                </small>
                            </div>
                        </div>

                        {/* Selected & Existing Files List */}
                        {(existingDocuments.length > 0 || selectedFiles.length > 0) && (
                            <div className="mt-2 d-flex flex-column gap-2">
                                {/* Existing documents in edit mode */}
                                {existingDocuments.map((doc) => (
                                    <div
                                        key={`exist-${doc.id}`}
                                        className="d-flex align-items-center justify-content-between p-2 px-3 rounded-2 border bg-white shadow-sm"
                                        style={{ fontSize: '13px' }}
                                    >
                                        <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                            <i className={`fa ${getFileIcon(doc.file_name || doc.original_name)} fs-16`}></i>
                                            <span className="fw-semibold text-truncate text-dark" style={{ maxWidth: '300px' }}>
                                                {doc.file_name || doc.original_name || 'Document'}
                                            </span>
                                            {doc.file_size && <small className="text-muted">({formatFileSize(doc.file_size)})</small>}
                                            <span className="badge bg-light text-secondary border fs-10">Saved</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            {doc.file_url && (
                                                <a
                                                    href={doc.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm btn-link p-0 text-info"
                                                    title="View Document"
                                                >
                                                    <i className="fa fa-eye"></i>
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link p-0 text-danger"
                                                onClick={() => handleRemoveExistingDoc(doc.id)}
                                                title="Delete Document"
                                            >
                                                <i className="fa fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Newly selected files */}
                                {selectedFiles.map((file, idx) => (
                                    <div
                                        key={`new-${idx}`}
                                        className="d-flex align-items-center justify-content-between p-2 px-3 rounded-2 border bg-white shadow-sm"
                                        style={{ fontSize: '13px' }}
                                    >
                                        <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                            <i className={`fa ${getFileIcon(file.name)} fs-16`}></i>
                                            <span className="fw-semibold text-truncate text-dark" style={{ maxWidth: '300px' }}>
                                                {file.name}
                                            </span>
                                            <small className="text-muted">({formatFileSize(file.size)})</small>
                                            <span className="badge bg-success-light text-success fs-10">New</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link p-0 text-danger"
                                            onClick={() => handleRemoveNewFile(idx)}
                                            title="Remove File"
                                        >
                                            <i className="fa fa-times"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Form.Group>
                </div>

                <div className="modal-footer-custom">
                    <Button type="button" className="btn-close-custom" onClick={onHide} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="btn-save-custom" disabled={submitting}>
                        {submitting ? (editMode ? 'Updating...' : 'Submitting...') : (editMode ? 'Update Request' : 'Submit Request')}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default LeaveRequestFormModal;
