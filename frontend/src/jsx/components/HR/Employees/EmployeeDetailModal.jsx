import React, { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { Modal, Form, Nav, Tab, Row, Col, Badge } from 'react-bootstrap';
import Select from 'react-select';

const RELATION_OPTIONS = [
    'Father', 'Mother', 'Spouse', 'Husband', 'Wife',
    'Son', 'Daughter', 'Brother', 'Sister',
    'Grandfather', 'Grandmother', 'Uncle', 'Aunt',
    'Nephew', 'Niece', 'Cousin', 'Guardian', 'Friend', 'Other'
].map(r => ({ value: r, label: r }));
import Swal from 'sweetalert2';
import {
    getCandidateById,
    createEmploymentDetails,
    updateEmploymentDetails,
    getEmploymentDetails,
    uploadEmployeeDocument,
    getEmployeeDocuments,
    deleteEmployeeDocument,
    createBankDetails,
    updateBankDetails,
    getBankDetails,
    getUsers,
    getDepartments,
    getWorkExperiences,
    createWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,
    getRoles,
    getManagersForEmployee,
    getEmployeeById,
    updateCandidate,
    getDesignations,
    getEmployeeDepartmentHistory,
    createEmployeeDepartmentHistory,
    deleteEmployeeDepartmentHistory,
} from '../../../../services/HRManagementService';
import {
    getUnits,
} from '../../../../services/PayheadService';
import { getAccountGroups, createLedger, updateLedger, getLedgers } from '../../../../services/FinanceService';
import {
    getPayHeads,
    getEmployeePayHeads,
    saveEmployeePayHeads,
} from '../../../../services/PayrollService';
import {
    getLeaveTypes,
    getEmployeeLeaveTypes,
    saveEmployeeLeaveTypes,
} from '../../../../services/AttendanceService';
import { PAY_HEAD_TYPES } from '../../Payroll/PayHeadList';

const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const EMPTY_EMPLOYMENT = {
    id: null, employment_no: '', date_of_joining: '', employment_type: 'Full Time',
    probation_period: '', notice_period: '', work_mode: 'WFO',
    ic1_name: '', ic1_relation: '', ic1_number: '',
    ic2_name: '', ic2_relation: '', ic2_number: '', role_expiries: [], roles: [], roles_applicable_date: '',
    health_card_validity: '', health_insurance_validity: ''
};
const EMPTY_BANK = {
    id: null, bank_name: '', account_no: '', ifsc_code: '',
    mode_of_payment: '', pan_no: '', uan_no: '', esic_no: '', aadhar_no: ''
};
const EMPTY_DOCUMENT = { document_type: '', document_file: null, is_signed: false };
const EMPTY_WORK_EXPERIENCE = {
    id: null, company_name: '', designation: '', department: '', employment_type: 'FULL_TIME',
    industry: '', company_location: '', start_date: '', end_date: '', last_drawn_salary: '',
    responsibilities: '', achievements: '', notice_period_served: false, 
    reference_available: false, reference_name: '', reference_contact: '', 
    experience_certificate: null, relieving_letter: null, salary_slip: null
};

const CustomSelect = ({ 
    options, 
    value, 
    onChange, 
    placeholder, 
    isMulti, 
    required, 
    styles, 
    isDisabled, 
    className, 
    menuPortalTarget, 
    menuPosition,
    onKeyDown,
    onFocus,
    onBlur,
    inputId,
    autoAdvanceFocus = true,
}) => {
    return (
        <Select
            options={options}
            value={value}
            openMenuOnFocus={true}
            closeMenuOnSelect={!isMulti}
            onChange={(val, action) => {
                if (!isMulti && autoAdvanceFocus) {
                    setTimeout(() => {
                        const container = document.querySelector('.emp-tab-content');
                        if (!container) return;
                        
                        const activePane = container.querySelector('.tab-pane.active');
                        if (!activePane) return;

                        const focusables = Array.from(activePane.querySelectorAll('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'));
                        const saveBtn = document.getElementById('save-next-btn');
                        if (saveBtn) focusables.push(saveBtn);
                        
                        const activeElement = document.activeElement;
                        
                        let currentIndex = focusables.indexOf(activeElement);
                        if (currentIndex === -1) {
                            const reactSelectInput = activeElement?.closest('.react-select__input');
                            if (reactSelectInput) {
                                currentIndex = focusables.indexOf(reactSelectInput);
                            }
                        }
                        
                        if (currentIndex > -1 && focusables[currentIndex + 1]) {
                            focusables[currentIndex + 1].focus();
                        }
                    }, 50);
                }
                if (onChange) onChange(val, action);
            }}
            onFocus={(e) => {
                if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
                if (onBlur) onBlur(e);
            }}
            onKeyDown={(e) => {
                if (onKeyDown) onKeyDown(e);
            }}
            placeholder={placeholder}
            isMulti={isMulti}
            required={required}
            styles={styles}
            isDisabled={isDisabled}
            className={className}
            classNamePrefix="react-select"
            isSearchable={true}
            inputId={inputId}
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPortalTarget ? 'fixed' : (menuPosition || 'absolute')}
        />
    );
};

const EmployeeDetailModal = ({ show, onHide, candidateId, employeeId, employeeName, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('basic_details');
    const [candidate, setCandidate] = useState(null);
    const [basicDetailsData, setBasicDetailsData] = useState({});
    const [users, setUsers] = useState([]);
    const [managersForDropdown, setManagersForDropdown] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [units, setUnits] = useState([]);
    const [employmentData, setEmploymentData] = useState({ ...EMPTY_EMPLOYMENT });
    const [documentRows, setDocumentRows] = useState([{ ...EMPTY_DOCUMENT }]);
    const [documents, setDocuments] = useState([]);
    const [bankData, setBankData] = useState({ ...EMPTY_BANK });
    const [workExperiences, setWorkExperiences] = useState([{ ...EMPTY_WORK_EXPERIENCE }]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [ledgerData, setLedgerData] = useState({
        ledger1Id: null,
        ledger1Name: '',
        ledger1Group: '',
        ledger2Id: null,
        ledger2Name: '',
        ledger2Group: ''
    });
    const originalLedgerDataRef = useRef(null);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [overrideDept, setOverrideDept] = useState(false);
    const [reportingDeptId, setReportingDeptId] = useState(null);

    const basicDetailsFormRef = useRef(null);
    const employmentFormRef = useRef(null);
    const bankFormRef = useRef(null);
    const documentsFormRef = useRef(null);
    const workExperiencesFormRef = useRef(null);
    const ledgerFormRef = useRef(null);
    const payheadsFormRef = useRef(null);

    const onHideRef = useRef(onHide);
    useEffect(() => {
        onHideRef.current = onHide;
    }, [onHide]);

    const [allPayHeads, setAllPayHeads] = useState([]);
    const [payheadRows, setPayheadRows] = useState([
        { id: null, effective_from: getTodayDateString(), pay_head: null, pay_head_name: '', rate: '', per: '', pay_head_type: '', calculation_type: '' }
    ]);
    const [savingPayheads, setSavingPayheads] = useState(false);
    const payheadNavigatedRef = useRef({});

    const [allLeaveTypes, setAllLeaveTypes] = useState([]);
    const [leaveTypeRows, setLeaveTypeRows] = useState([
        { id: null, effective_from: getTodayDateString(), leave_type: null, leave_type_name: '', leave_type_code: '', is_paid: true, annual_limit: '', is_cumulative: false, max_limit: 0, is_active: true }
    ]);
    const [savingLeaveTypes, setSavingLeaveTypes] = useState(false);
    const leaveTypesFormRef = useRef(null);

    const [deptHistoryList, setDeptHistoryList] = useState([]);
    const [loadingDeptHistory, setLoadingDeptHistory] = useState(false);
    const [savingDeptChange, setSavingDeptChange] = useState(false);
    const [designationsForSelectedDept, setDesignationsForSelectedDept] = useState([]);
    const [loadingDesignations, setLoadingDesignations] = useState(false);
    const [deptChangeForm, setDeptChangeForm] = useState({
        department: '',
        designation: '',
        effective_from: getTodayDateString(),
        remarks: '',
    });

    const fetchDepartmentHistory = useCallback(async (cId, eId) => {
        try {
            setLoadingDeptHistory(true);
            const params = {};
            if (eId) params.employee = eId;
            if (cId) params.candidate = cId;
            const res = await getEmployeeDepartmentHistory(params);
            const list = Array.isArray(res) ? res : (res?.results || []);
            setDeptHistoryList(list);
        } catch (err) {
            console.error('Error fetching department history:', err);
            setDeptHistoryList([]);
        } finally {
            setLoadingDeptHistory(false);
        }
    }, []);

    const handleDeptChangeSelect = async (field, value) => {
        if (field === 'department') {
            setDeptChangeForm(prev => ({
                ...prev,
                department: value,
                designation: '',
            }));
            if (value) {
                try {
                    setLoadingDesignations(true);
                    const desigs = await getDesignations(value);
                    const list = Array.isArray(desigs) ? desigs : (desigs?.results || []);
                    setDesignationsForSelectedDept(list);
                } catch (err) {
                    console.error('Error fetching designations for department:', err);
                    setDesignationsForSelectedDept([]);
                } finally {
                    setLoadingDesignations(false);
                }
            } else {
                setDesignationsForSelectedDept([]);
            }
        }
    };

    const handleApplyDeptChange = async () => {
        if (!deptChangeForm.department) {
            Swal.fire({ icon: 'warning', title: 'Department Required', text: 'Please select a department.' });
            return;
        }
        if (!deptChangeForm.designation) {
            Swal.fire({ icon: 'warning', title: 'Designation Required', text: 'Please select a designation.' });
            return;
        }
        if (!deptChangeForm.effective_from) {
            Swal.fire({ icon: 'warning', title: 'Effective Date Required', text: 'Please provide an effective date.' });
            return;
        }

        try {
            setSavingDeptChange(true);
            const payload = {
                employee: employeeId || candidate?.employee_profile?.id || null,
                candidate: candidateId || null,
                department: deptChangeForm.department,
                designation: deptChangeForm.designation,
                effective_from: deptChangeForm.effective_from,
                remarks: deptChangeForm.remarks || '',
            };

            await createEmployeeDepartmentHistory(payload);

            Swal.fire({
                icon: 'success',
                title: 'Department & Designation Updated',
                text: 'The department & designation change has been tracked and applied.',
                timer: 2000,
                showConfirmButton: false,
            });

            await fetchDepartmentHistory(candidateId, employeeId || candidate?.employee_profile?.id);

            if (candidateId) {
                const refreshedCand = await getCandidateById(candidateId);
                setCandidate(refreshedCand);
            }

            setDeptChangeForm(prev => ({
                ...prev,
                remarks: '',
            }));

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error creating department history:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to record department/designation change.' });
        } finally {
            setSavingDeptChange(false);
        }
    };

    const handleDeleteDeptHistory = async (historyId) => {
        const result = await Swal.fire({
            title: 'Delete History Entry?',
            text: 'Are you sure you want to remove this record? The active designation will revert to the previous entry.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it'
        });

        if (!result.isConfirmed) return;

        try {
            await deleteEmployeeDepartmentHistory(historyId);
            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'History record deleted.',
                timer: 1500,
                showConfirmButton: false,
            });

            await fetchDepartmentHistory(candidateId, employeeId || candidate?.employee_profile?.id);

            if (candidateId) {
                const refreshedCand = await getCandidateById(candidateId);
                setCandidate(refreshedCand);
            }

            if (onUpdate) onUpdate();
        } catch (error) {
            console.error('Error deleting department history:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete history record.' });
        }
    };

    const fetchData = useCallback(async () => {
        if (!candidateId) return;
        try {
            setLoading(true);
            const candidateData = await getCandidateById(candidateId);
            setCandidate(candidateData);
            setBasicDetailsData({
                first_name: candidateData.first_name || '',
                last_name: candidateData.last_name || '',
                mobile_number: candidateData.mobile_number || '',
                email: candidateData.email || '',
                date_of_birth: candidateData.date_of_birth || '',
                gender: candidateData.gender || '',
                blood_group: candidateData.blood_group || '',
                qualification: candidateData.qualification || '',
                experience_years: candidateData.experience_years || '',
                address: candidateData.address || ''
            });
            const results = await Promise.allSettled([
                getUsers(), getUnits(), getRoles(), getAccountGroups(), getLedgers()
            ]);
            setUsers(results[0].status === 'fulfilled' ? results[0].value : []);
            setUnits(results[1].status === 'fulfilled' ? results[1].value : []);
            setRolesList(results[2].status === 'fulfilled' ? results[2].value : []);
            
            const fetchedAccountGroups = results[3].status === 'fulfilled' ? results[3].value : [];
            setAccountGroups(fetchedAccountGroups);

            const fetchedLedgersRaw = results[4].status === 'fulfilled' ? results[4].value : [];
            const fetchedLedgers = Array.isArray(fetchedLedgersRaw)
                ? fetchedLedgersRaw
                : (Array.isArray(fetchedLedgersRaw?.results) ? fetchedLedgersRaw.results : []);
            
            const indirectExpensesGroup = fetchedAccountGroups.find(g => g.name.toLowerCase() === 'indirect expenses');
            const indirectExpensesId = indirectExpensesGroup ? indirectExpensesGroup.id : '';
            
            const staffAdvanceGroup = fetchedAccountGroups.find(g => g.name.toLowerCase() === 'staff advance');
            const staffAdvanceId = staffAdvanceGroup ? staffAdvanceGroup.id : '';

            const empName = `${candidateData.first_name || ''} ${candidateData.last_name || ''}`.trim();
            const defaultL1Name = empName ? `${empName} Salary A/C` : 'Salary A/C';
            const defaultL2Name = empName ? `${empName} Adv. A/C` : 'Adv. A/C';

            let existingL1 = fetchedLedgers.find(l => (l.name || '').trim().toLowerCase() === defaultL1Name.toLowerCase());
            if (!existingL1 && (candidateData.email || candidateData.mobile_number)) {
                existingL1 = fetchedLedgers.find(l => 
                    (l.name || '').toLowerCase().includes('salary') &&
                    ((candidateData.email && (l.email || '').trim().toLowerCase() === candidateData.email.trim().toLowerCase()) ||
                     (candidateData.mobile_number && (l.phone || '').trim() === candidateData.mobile_number.trim()))
                );
            }

            let existingL2 = fetchedLedgers.find(l => (l.name || '').trim().toLowerCase() === defaultL2Name.toLowerCase());
            if (!existingL2 && (candidateData.email || candidateData.mobile_number)) {
                existingL2 = fetchedLedgers.find(l => 
                    ((l.name || '').toLowerCase().includes('adv') || (l.name || '').toLowerCase().includes('advance')) &&
                    ((candidateData.email && (l.email || '').trim().toLowerCase() === candidateData.email.trim().toLowerCase()) ||
                     (candidateData.mobile_number && (l.phone || '').trim() === candidateData.mobile_number.trim()))
                );
            }

            const initialLedgers = {
                ledger1Id: existingL1 ? existingL1.id : null,
                ledger1Name: existingL1 ? existingL1.name : defaultL1Name,
                ledger1Group: existingL1 ? (existingL1.accountGroup?.id ?? existingL1.accountGroup ?? indirectExpensesId) : indirectExpensesId,
                ledger2Id: existingL2 ? existingL2.id : null,
                ledger2Name: existingL2 ? existingL2.name : defaultL2Name,
                ledger2Group: existingL2 ? (existingL2.accountGroup?.id ?? existingL2.accountGroup ?? staffAdvanceId) : staffAdvanceId
            };
            
            setLedgerData(initialLedgers);
            originalLedgerDataRef.current = initialLedgers;
            // Load employment details and store the saved reporting_manager id
            let savedReportingManagerId = null;
            try {
                const empDetails = await getEmploymentDetails(candidateId);
                // Guard: treat empty array as no data
                if (empDetails && !Array.isArray(empDetails)) {
                    savedReportingManagerId = empDetails.reporting_manager?.id ?? empDetails.reporting_manager ?? null;
                    setEmploymentData({
                        id: empDetails.id || null,
                        employment_no: empDetails.employment_no || '',
                        date_of_joining: empDetails.date_of_joining || '',
                        employment_type: empDetails.employment_type || '',
                        work_mode: empDetails.work_mode || '',
                        probation_period: empDetails.probation_period || '',
                        notice_period: empDetails.notice_period || '',
                        reporting_manager: savedReportingManagerId || '',
                        ic1_name: empDetails.ic1_name || '',
                        ic1_relation: empDetails.ic1_relation || '',
                        ic1_number: empDetails.ic1_number || '',
                        ic2_name: empDetails.ic2_name || '',
                        ic2_relation: empDetails.ic2_relation || '',
                        ic2_number: empDetails.ic2_number || '',
                        health_card_validity: empDetails.health_card_validity || '',
                        health_insurance_validity: empDetails.health_insurance_validity || '',
                        role_expiries: (empDetails.role_expiries && empDetails.role_expiries.length > 0)
                            ? empDetails.role_expiries
                                .filter(re => !re.expiry_date || re.expiry_date >= new Date().toISOString().split('T')[0])
                                .map(re => ({ role: re.role, role_name: re.role_name, expiry_date: re.expiry_date || '' }))
                            : (candidateData?.employee_profile?.user_role ? [{ role: candidateData.employee_profile.user_role, role_name: '', expiry_date: '' }] : []),
                    });
                } else {
                    if (candidateData?.employee_profile?.user_role) {
                        setEmploymentData(prev => ({ ...prev, role_expiries: [{ role: candidateData.employee_profile.user_role, role_name: '', expiry_date: '' }] }));
                    }
                }
            } catch { 
                if (candidateData?.employee_profile?.user_role) {
                    setEmploymentData(prev => ({ ...prev, role_expiries: [{ role: candidateData.employee_profile.user_role, role_name: '', expiry_date: '' }] }));
                }
            }
            // Load reporting manager dropdown based on employee's department and designation level.
            // After loading, if the saved manager is not in the filtered list (e.g. cross-dept),
            // fetch them individually and inject into the options so the saved value always renders.
            const designationLevel = candidateData?.employee_profile?.designation_level;
            const departmentId = candidateData?.employee_profile?.department_id;
            if (designationLevel != null && departmentId != null) {
                try {
                    let fetchedManagers = await getManagersForEmployee(departmentId, designationLevel);
                    if (!Array.isArray(fetchedManagers)) fetchedManagers = [];
                    // If the saved manager is missing from the filtered list, fetch and inject them
                    if (savedReportingManagerId && !fetchedManagers.some(m => m.id == savedReportingManagerId)) {
                        try {
                            const savedMgr = await getEmployeeById(savedReportingManagerId);
                            if (savedMgr) fetchedManagers = [savedMgr, ...fetchedManagers];
                        } catch { /* ignore — manager may have been deleted */ }
                    }
                    setManagersForDropdown(fetchedManagers);
                } catch {
                    setManagersForDropdown([]);
                }
            } else {
                // No department/level filter — still try to inject the saved manager if present
                if (savedReportingManagerId) {
                    try {
                        const savedMgr = await getEmployeeById(savedReportingManagerId);
                        setManagersForDropdown(savedMgr ? [savedMgr] : []);
                    } catch {
                        setManagersForDropdown([]);
                    }
                } else {
                    setManagersForDropdown([]);
                }
            }
            try {
                const docs = await getEmployeeDocuments(candidateId);
                setDocuments(docs || []);
            } catch { /* no docs yet */ }
            try {
                const exps = await getWorkExperiences(candidateId);
                if (exps && exps.length > 0) {
                    setWorkExperiences(exps);
                }
            } catch { /* no work experiences */ }
            try {
                const bank = await getBankDetails(candidateId);
                if (bank) {
                    setBankData({
                        id: bank.id || null, bank_name: bank.bank_name || '',
                        account_no: bank.account_no || '', ifsc_code: bank.ifsc_code || '',
                        mode_of_payment: bank.mode_of_payment || '', pan_no: bank.pan_no || '',
                        uan_no: bank.uan_no || '', esic_no: bank.esic_no || '',
                        aadhar_no: bank.aadhar_no || '',
                    });
                }
            } catch { /* no bank yet */ }

            // Load active pay components and employee assigned pay components
            try {
                const phData = await getPayHeads({ is_active: true });
                const phList = Array.isArray(phData) ? phData : (phData.results || []);
                setAllPayHeads(phList);
            } catch { /* ignore */ }

            try {
                const empPhData = await getEmployeePayHeads(employeeId, { candidate: candidateId });
                const empPhList = Array.isArray(empPhData) ? empPhData : (empPhData.results || []);
                if (empPhList && empPhList.length > 0) {
                    setPayheadRows(empPhList.map(item => ({
                        id: item.id,
                        effective_from: item.effective_from || '',
                        pay_head: item.pay_head,
                        pay_head_name: item.pay_head_name || '',
                        rate: item.rate != null ? item.rate : '',
                        per: item.default_period || item.per || item.production_type_unit || item.attendance_production_type_unit || '',
                        pay_head_type: item.pay_head_type_display || item.pay_head_type || '',
                        calculation_type: item.calculation_type_name || '',
                        computation_method: (item.computed_on && item.computed_on !== '-') ? item.computed_on : (item.computation_method_display || ''),
                    })));
                } else {
                    setPayheadRows([{
                        id: null,
                        effective_from: getTodayDateString(),
                        pay_head: null,
                        pay_head_name: '',
                        rate: '',
                        per: '',
                        pay_head_type: '',
                        calculation_type: '',
                    }]);
                }
            } catch {
                setPayheadRows([{
                    id: null,
                    effective_from: getTodayDateString(),
                    pay_head: null,
                    pay_head_name: '',
                    rate: '',
                    per: '',
                    pay_head_type: '',
                    calculation_type: '',
                }]);
            }

            // Load active leave types and employee assigned leave types
            try {
                const ltData = await getLeaveTypes({ is_active: true });
                const ltList = Array.isArray(ltData) ? ltData : (ltData.results || []);
                setAllLeaveTypes(ltList);
            } catch { /* ignore */ }

            try {
                const empLtData = await getEmployeeLeaveTypes(employeeId, { candidate: candidateId });
                const empLtList = Array.isArray(empLtData) ? empLtData : (empLtData.results || []);
                if (empLtList && empLtList.length > 0) {
                    setLeaveTypeRows(empLtList.map(item => ({
                        id: item.id,
                        effective_from: item.effective_from || getTodayDateString(),
                        leave_type: item.leave_type,
                        leave_type_name: item.leave_type_name || '',
                        leave_type_code: item.leave_type_code || '',
                        is_paid: item.is_paid,
                        annual_limit: item.annual_limit,
                        is_cumulative: item.is_cumulative,
                        max_limit: item.max_limit,
                        is_active: item.is_active !== undefined ? item.is_active : true,
                    })));
                } else {
                    setLeaveTypeRows([{
                        id: null,
                        effective_from: getTodayDateString(),
                        leave_type: null,
                        leave_type_name: '',
                        leave_type_code: '',
                        is_paid: true,
                        annual_limit: '',
                        is_cumulative: false,
                        max_limit: 0,
                        is_active: true,
                    }]);
                }
            } catch {
                setLeaveTypeRows([{
                    id: null,
                    effective_from: getTodayDateString(),
                    leave_type: null,
                    leave_type_name: '',
                    leave_type_code: '',
                    is_paid: true,
                    annual_limit: '',
                    is_cumulative: false,
                    max_limit: 0,
                    is_active: true,
                }]);
            }

            // Load department history
            try {
                const histData = await getEmployeeDepartmentHistory({
                    employee: employeeId || candidateData?.employee_profile?.id || undefined,
                    candidate: candidateId
                });
                const histList = Array.isArray(histData) ? histData : (histData?.results || []);
                setDeptHistoryList(histList);
            } catch (err) {
                console.error('Failed to load department history:', err);
                setDeptHistoryList([]);
            }

            // Pre-initialize department in change form if candidate has a department
            const activeDeptId = candidateData.department_applied || candidateData.employee_profile?.department_id;
            if (activeDeptId) {
                setDeptChangeForm(prev => ({
                    ...prev,
                    department: activeDeptId,
                    designation: '',
                    effective_from: new Date().toISOString().split('T')[0]
                }));
                getDesignations(activeDeptId).then(desigs => {
                    const list = Array.isArray(desigs) ? desigs : (desigs?.results || []);
                    setDesignationsForSelectedDept(list);
                }).catch(() => {});
            }
        } catch (error) {
            console.error('EmployeeDetailModal error:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load employee details' });
            onHideRef.current?.();
        } finally {
            setLoading(false);
        }
    }, [candidateId, employeeId]);

    // Always ensure active leave types are loaded when modal is opened
    useEffect(() => {
        if (show) {
            getLeaveTypes({ is_active: true })
                .then(data => {
                    const list = Array.isArray(data) ? data : (data?.results || []);
                    setAllLeaveTypes(list);
                })
                .catch(err => console.error('Failed to load leave types in EmployeeDetailModal:', err));
        }
    }, [show]);

    useEffect(() => {
        if (show && candidateId) {
            setActiveTab('basic_details');
            setEmploymentData({ ...EMPTY_EMPLOYMENT });
            setBankData({ ...EMPTY_BANK });
            setDocumentRows([{ ...EMPTY_DOCUMENT }]);
            setWorkExperiences([{ ...EMPTY_WORK_EXPERIENCE }]);
            setDocuments([]);
            setCandidate(null);
            setOverrideDept(false);
            setReportingDeptId(null);
            setDeptHistoryList([]);
            setDeptChangeForm({
                department: '',
                designation: '',
                effective_from: getTodayDateString(),
                remarks: '',
            });
            setDesignationsForSelectedDept([]);
            setPayheadRows([{
                id: null,
                effective_from: getTodayDateString(),
                pay_head: null,
                pay_head_name: '',
                rate: '',
                per: '',
                pay_head_type: '',
                calculation_type: '',
            }]);
            setLeaveTypeRows([{
                id: null,
                effective_from: getTodayDateString(),
                leave_type: null,
                leave_type_name: '',
                leave_type_code: '',
                is_paid: true,
                annual_limit: '',
                is_cumulative: false,
                max_limit: 0,
                is_active: true,
            }]);
            originalLedgerDataRef.current = null;
            fetchData();
        }
    }, [show, candidateId, employeeId]);

    // Reload managers whenever the override dept changes
    useEffect(() => {
        if (!overrideDept || !reportingDeptId) return;
        // Different department selected — show ALL employees of that dept (no rank filter)
        getManagersForEmployee(reportingDeptId)
            .then(data => {
                setManagersForDropdown(Array.isArray(data) ? data : []);
            })
            .catch(() => {});
    }, [overrideDept, reportingDeptId]);

    // Fetch departments list once when modal opens
    useEffect(() => {
        if (!show) return;
        getDepartments().then(res => {
            const data = res?.results || res || [];
            setDepartmentsList(Array.isArray(data) ? data : []);
        }).catch(() => {});
    }, [show]);

    useEffect(() => {
        if (!show) return;
        const timer = setTimeout(() => {
            const container = document.querySelector('.emp-tab-content');
            if (container) {
                // Use the specific class we added to bypass React Bootstrap transition delays
                const activePane = container.querySelector(`.tab-pane-${activeTab}`);
                if (activePane) {
                    const focusables = Array.from(activePane.querySelectorAll('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'));
                    if (focusables.length > 0) {
                        focusables[0].focus();
                    }
                }
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [activeTab, show]);

    const handleGlobalKeyDown = (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            
            if (target.tagName.toLowerCase() === 'button' && target.id !== 'save-next-btn') {
                return;
            }

            if (target.getAttribute('aria-expanded') === 'true' || target.getAttribute('aria-haspopup') === 'listbox') {
                if (target.getAttribute('aria-expanded') === 'true') {
                    return;
                }
            }

            if (target.tagName.toLowerCase() === 'textarea') {
                const value = target.value;
                const selectionStart = target.selectionStart;
                if (selectionStart > 0 && value.substring(selectionStart - 1, selectionStart) === '\n') {
                    e.preventDefault();
                } else {
                    return; 
                }
            } else if (target.type === 'file') {
                if (target.value || target.dataset.enterPressed === 'true') {
                    e.preventDefault();
                    target.dataset.enterPressed = 'false';
                } else {
                    target.dataset.enterPressed = 'true';
                    // The file dialog might cause a blur, so we just let them try again if they cancel
                    target.addEventListener('blur', () => {
                        target.dataset.enterPressed = 'false';
                    }, { once: true });
                    return;
                }
            } else if (target.id === 'save-next-btn') {
                return;
            } else {
                e.preventDefault();
            }

            const container = document.querySelector('.emp-tab-content');
            if (!container) return;
            
            const activePane = container.querySelector('.tab-pane.active');
            if (!activePane) return;
            
            const focusables = Array.from(activePane.querySelectorAll('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'));
            const saveBtn = document.getElementById('save-next-btn');
            if (saveBtn) focusables.push(saveBtn);
            
            let currentIndex = focusables.indexOf(target);
            if (currentIndex === -1) {
                const reactSelectInput = target.closest('.react-select__input');
                if (reactSelectInput) {
                    currentIndex = focusables.indexOf(reactSelectInput);
                }
            }
            
            if (currentIndex > -1) {
                const nextField = focusables[currentIndex + 1];

                if (target.dataset.expLast === 'true') {
                    handleAddWorkExperienceRow();
                    setTimeout(() => {
                        const newContainer = document.querySelector('.emp-tab-content .tab-pane.active');
                        if (!newContainer) return;
                        const firsts = newContainer.querySelectorAll('input[data-exp-first="true"]');
                        if (firsts.length > 0) firsts[firsts.length - 1].focus();
                    }, 50);
                    return;
                }
                
                if (target.dataset.expFirst === 'true' && (!target.value || !target.value.trim())) {
                    const index = parseInt(target.dataset.index, 10);
                    if (index > 0) {
                        handleRemoveWorkExperienceRow(index);
                        if (saveBtn) saveBtn.focus();
                        return;
                    }
                }
                
                if (target.dataset.docSigned === 'true') {
                    const index = parseInt(target.dataset.index, 10);
                    if (index === documentRows.length - 1) {
                        handleAddDocumentRow();
                        setTimeout(() => {
                            const newContainer = document.querySelector('.emp-tab-content .tab-pane.active');
                            if (!newContainer) return;
                            const firsts = newContainer.querySelectorAll('input[data-doc-first="true"]');
                            if (firsts.length > 0) firsts[firsts.length - 1].focus();
                        }, 50);
                        return;
                    }
                }

                if (target.dataset.docFirst === 'true' && (!target.value || !target.value.trim())) {
                    const index = parseInt(target.dataset.index, 10);
                    if (index > 0) {
                        handleRemoveDocumentRow(index);
                        if (saveBtn) saveBtn.focus();
                        return;
                    }
                }

                if (nextField) {
                    nextField.focus();
                }
            }
        }
    };

    const handleSaveBasicDetails = async (e) => {
        e.preventDefault();
        try {
            if (!candidateId) return;
            setLoading(true);
            await updateCandidate(candidateId, basicDetailsData);

            // Auto-save department change if filled
            if (deptChangeForm.department && deptChangeForm.designation && deptChangeForm.effective_from) {
                const alreadyExists = deptHistoryList.some(h =>
                    h.department === deptChangeForm.department &&
                    h.designation === deptChangeForm.designation &&
                    h.effective_from === deptChangeForm.effective_from
                );
                if (!alreadyExists) {
                    try {
                        await createEmployeeDepartmentHistory({
                            employee: employeeId || candidate?.employee_profile?.id || null,
                            candidate: candidateId || null,
                            department: deptChangeForm.department,
                            designation: deptChangeForm.designation,
                            effective_from: deptChangeForm.effective_from,
                            remarks: deptChangeForm.remarks || '',
                        });
                    } catch (err) {
                        console.error('Auto-saving dept history error:', err);
                    }
                }
            }

            const candidateData = await getCandidateById(candidateId);
            setCandidate(candidateData);
            
            if (onUpdate) onUpdate();
            setActiveTab('employment');
        } catch (error) {
            Swal.fire('Error', 'Failed to update basic details', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Employment ────────────────────────────────────────────────────────────
    const handleSaveEmploymentDetails = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...employmentData,
                user: candidateId,
                employee_id: employeeId,
                // Send per-role expiry data
                role_expiries_input: employmentData.role_expiries.map(re => ({
                    role: re.role,
                    expiry_date: re.expiry_date || null,
                })),
                // Keep roles in sync with the role_expiries list
                roles: employmentData.role_expiries.map(re => re.role),
            };
            
            // Convert empty strings to null for nullable FK/date fields
            if (payload.roles_applicable_date === '') {
                payload.roles_applicable_date = null;
            }
            if (payload.reporting_manager === '' || payload.reporting_manager == null) {
                payload.reporting_manager = null;
            }
            if (payload.health_card_validity === '') {
                payload.health_card_validity = null;
            }
            if (payload.health_insurance_validity === '') {
                payload.health_insurance_validity = null;
            }
            if (employmentData.id) {
                await updateEmploymentDetails(employmentData.id, payload);
            } else {
                const result = await createEmploymentDetails(payload);
                setEmploymentData((p) => ({ ...p, id: result.id }));
            }
            setActiveTab('payheads');
        } catch (error) {
            const errData = error.response?.data;
            let errMsg = 'Failed to save employment details';
            if (errData) {
                if (typeof errData === 'string') {
                    errMsg = errData;
                } else if (errData.message) {
                    errMsg = errData.message;
                } else if (errData.detail) {
                    errMsg = errData.detail;
                } else {
                    // DRF field-level errors: { field: ["msg"] }
                    const msgs = Object.entries(errData)
                        .map(([key, val]) => {
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            const msg = Array.isArray(val) ? val.join(', ') : String(val);
                            return `${label}: ${msg}`;
                        });
                    if (msgs.length > 0) errMsg = msgs.join('\n');
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errMsg });
        }
    };

    // ── Documents ─────────────────────────────────────────────────────────────
    const handleUploadDocuments = async (e) => {
        e.preventDefault();
        const isDocEmpty = (doc) => !doc.document_type && !doc.document_file && doc.is_signed === false;
        
        const allEmpty = documentRows.every(isDocEmpty);
        if (allEmpty) {
            setActiveTab('ledger');
            return;
        }

        const hasInvalid = documentRows.some(row => 
            !isDocEmpty(row) && (!row.document_type || !row.document_file)
        );

        if (hasInvalid) {
            Swal.fire({ icon: 'warning', title: 'Incomplete Data', text: 'Please provide both Document Type and File for each entered document, or clear the row to skip.' });
            return;
        }

        const validRows = documentRows.filter(row => !isDocEmpty(row));

        try {
            await Promise.all(validRows.map(row => 
                uploadEmployeeDocument({
                    user: candidateId,
                    document_type: row.document_type,
                    document_file: row.document_file,
                    is_signed: row.is_signed,
                })
            ));
            Swal.fire({ icon: 'success', title: 'Success', text: 'Employee details are saved', timer: 2000, showConfirmButton: false });
            setDocumentRows([{ ...EMPTY_DOCUMENT }]);
            const docs = await getEmployeeDocuments(candidateId);
            setDocuments(docs || []);
            setActiveTab('ledger');
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to upload one or more documents' });
        }
    };

    const handleAddDocumentRow = () => {
        setDocumentRows([...documentRows, { ...EMPTY_DOCUMENT }]);
    };

    const handleRemoveDocumentRow = (index) => {
        setDocumentRows(documentRows.filter((_, i) => i !== index));
    };

    const handleDocumentRowChange = (index, field, value) => {
        const updatedRows = [...documentRows];
        updatedRows[index][field] = value;
        setDocumentRows(updatedRows);
    };

    const handleDeleteDocument = async (docId) => {
        const res = await Swal.fire({ title: 'Delete Document?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it' });
        if (res.isConfirmed) {
            try {
                await deleteEmployeeDocument(docId);
                Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
                const docs = await getEmployeeDocuments(candidateId);
                setDocuments(docs || []);
            } catch {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete document' });
            }
        }
    };

    // ── Work Experiences ──────────────────────────────────────────────────────
    const handleAddWorkExperienceRow = () => {
        setWorkExperiences([...workExperiences, { ...EMPTY_WORK_EXPERIENCE }]);
    };

    const handleRemoveWorkExperienceRow = async (index) => {
        const exp = workExperiences[index];
        if (exp.id) {
            const res = await Swal.fire({ title: 'Delete Work Experience?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, delete it' });
            if (res.isConfirmed) {
                try {
                    await deleteWorkExperience(exp.id);
                    Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
                    const newExps = workExperiences.filter((_, i) => i !== index);
                    setWorkExperiences(newExps.length ? newExps : [{ ...EMPTY_WORK_EXPERIENCE }]);
                } catch {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete work experience' });
                }
            }
        } else {
            const newExps = workExperiences.filter((_, i) => i !== index);
            setWorkExperiences(newExps.length ? newExps : [{ ...EMPTY_WORK_EXPERIENCE }]);
        }
    };

    const handleWorkExperienceRowChange = (index, field, value) => {
        const updatedExps = [...workExperiences];
        updatedExps[index][field] = value;
        setWorkExperiences(updatedExps);
    };

    const handleSaveWorkExperiences = async (e) => {
        e.preventDefault();
        try {
            const isExpEmpty = (exp) => !exp.company_name && !exp.designation && !exp.department && !exp.industry && !exp.company_location && !exp.start_date && !exp.end_date && !exp.last_drawn_salary && !exp.responsibilities && !exp.achievements && !exp.reference_name && !exp.reference_contact;
            
            const allEmpty = workExperiences.every(isExpEmpty);
            if (allEmpty) {
                setActiveTab('bank');
                return;
            }

            const hasInvalid = workExperiences.some(exp => 
                !isExpEmpty(exp) && (!exp.company_name || !exp.designation || !exp.start_date || !exp.end_date)
            );

            if (hasInvalid) {
                Swal.fire({ icon: 'warning', title: 'Incomplete Data', text: 'Please fill out required fields (Company Name, Designation, Start Date, End Date) for each entered experience, or clear the row to skip.' });
                return;
            }

            const validExps = workExperiences.filter(exp => !isExpEmpty(exp));

            await Promise.all(validExps.map(exp => {
                const payload = { ...exp, employee: candidateId };
                if (exp.id) {
                    return updateWorkExperience(exp.id, payload);
                }
                return createWorkExperience(payload);
            }));

            // Refetch to get IDs and file URLs
            const exps = await getWorkExperiences(candidateId);
            setWorkExperiences(exps && exps.length > 0 ? exps : [{ ...EMPTY_WORK_EXPERIENCE }]);

            setActiveTab('bank');
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save work experiences' });
        }
    };

    // ── Bank ──────────────────────────────────────────────────────────────────
    const handleSaveBankDetails = async (e) => {
        e.preventDefault();
        try {
            const isBankEmpty = () => !bankData.bank_name && !bankData.account_no && !bankData.ifsc_code && !bankData.mode_of_payment && !bankData.pan_no && !bankData.uan_no && !bankData.esic_no && !bankData.aadhar_no;
            
            if (isBankEmpty()) {
                setActiveTab('documents');
                return;
            }

            if (!bankData.bank_name || !bankData.account_no || !bankData.ifsc_code || !bankData.aadhar_no) {
                Swal.fire({ icon: 'warning', title: 'Incomplete Data', text: 'Please fill out all required Bank Details, or clear all fields to skip.' });
                return;
            }

            const payload = { ...bankData, user: candidateId };
            if (bankData.id) {
                await updateBankDetails(bankData.id, payload);
            } else {
                const result = await createBankDetails(payload);
                setBankData((p) => ({ ...p, id: result.id }));
            }
            setActiveTab('documents');
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save bank details' });
        }
    };



    const handleSaveLedgers = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);

            if (!ledgerData.ledger1Name || !ledgerData.ledger2Name) {
                Swal.fire({ icon: 'warning', title: 'Incomplete Data', text: 'Both ledger names are required.' });
                setLoading(false);
                return;
            }

            const orig = originalLedgerDataRef.current || {};
            const l1Changed = !ledgerData.ledger1Id || 
                ledgerData.ledger1Name.trim() !== (orig.ledger1Name || '').trim() || 
                String(ledgerData.ledger1Group || '') !== String(orig.ledger1Group || '');
            const l2Changed = !ledgerData.ledger2Id || 
                ledgerData.ledger2Name.trim() !== (orig.ledger2Name || '').trim() || 
                String(ledgerData.ledger2Group || '') !== String(orig.ledger2Group || '');

            // If neither ledger changed and both already exist in DB, treat as success without calling createLedger
            if (!l1Changed && !l2Changed) {
                Swal.fire({ icon: 'success', title: 'Ledgers saved successfully', timer: 1500, showConfirmButton: false });
                onHide();
                return;
            }

            const commonData = {
                address: basicDetailsData.address || '',
                phone: basicDetailsData.mobile_number || '',
                email: basicDetailsData.email || '',
                maintain_biilwise_details: false,
                credit_limit: 0,
                opening_balance: 0,
                opening_balance_type: 'Dr'
            };

            const payload1 = {
                ...commonData,
                name: ledgerData.ledger1Name.trim(),
                mailing_name: ledgerData.ledger1Name.trim(),
                accountGroup: ledgerData.ledger1Group
            };

            const payload2 = {
                ...commonData,
                name: ledgerData.ledger2Name.trim(),
                mailing_name: ledgerData.ledger2Name.trim(),
                accountGroup: ledgerData.ledger2Group
            };

            let savedL1Id = ledgerData.ledger1Id;
            let savedL2Id = ledgerData.ledger2Id;

            // Handle Ledger 1
            if (l1Changed) {
                try {
                    if (savedL1Id) {
                        await updateLedger(savedL1Id, payload1);
                    } else {
                        // Check if a ledger with this name already exists in database before creating
                        const currentLedgers = await getLedgers();
                        const list = Array.isArray(currentLedgers) ? currentLedgers : (currentLedgers?.results || []);
                        const match = list.find(l => (l.name || '').trim().toLowerCase() === payload1.name.toLowerCase());
                        if (match) {
                            savedL1Id = match.id;
                            await updateLedger(match.id, payload1);
                        } else {
                            const res1 = await createLedger(payload1);
                            savedL1Id = res1?.id || null;
                        }
                    }
                } catch (error) {
                    if (error.response?.status === 400) {
                        Swal.fire({ icon: 'error', title: 'Duplicate Name', text: `Ledger '${payload1.name}' already exists. Please rename it.` });
                        setLoading(false);
                        return;
                    }
                    throw error;
                }
            }

            // Handle Ledger 2
            if (l2Changed) {
                try {
                    if (savedL2Id) {
                        await updateLedger(savedL2Id, payload2);
                    } else {
                        // Check if a ledger with this name already exists in database before creating
                        const currentLedgers = await getLedgers();
                        const list = Array.isArray(currentLedgers) ? currentLedgers : (currentLedgers?.results || []);
                        const match = list.find(l => (l.name || '').trim().toLowerCase() === payload2.name.toLowerCase());
                        if (match) {
                            savedL2Id = match.id;
                            await updateLedger(match.id, payload2);
                        } else {
                            const res2 = await createLedger(payload2);
                            savedL2Id = res2?.id || null;
                        }
                    }
                } catch (error) {
                    if (error.response?.status === 400) {
                        Swal.fire({ icon: 'error', title: 'Duplicate Name', text: `Ledger '${payload2.name}' already exists. Please rename it.` });
                        setLoading(false);
                        return;
                    }
                    throw error;
                }
            }

            const updatedState = {
                ...ledgerData,
                ledger1Id: savedL1Id,
                ledger2Id: savedL2Id
            };
            setLedgerData(updatedState);
            originalLedgerDataRef.current = updatedState;

            Swal.fire({ icon: 'success', title: 'Ledgers saved successfully', timer: 1500, showConfirmButton: false });
            onHide();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save ledgers' });
        } finally {
            setLoading(false);
        }
    };

    // ── Pay Heads Handlers ──────────────────────────────────────────────────
    const handleAddPayheadRow = (defaultDate = null) => {
        setPayheadRows(prev => {
            const lastEffectiveFrom = defaultDate !== null
                ? defaultDate
                : (prev.length > 0 ? (prev[prev.length - 1].effective_from || getTodayDateString()) : getTodayDateString());
            return [
                ...prev,
                {
                    id: null,
                    effective_from: lastEffectiveFrom,
                    pay_head: null,
                    pay_head_name: '',
                    rate: '',
                    per: '',
                    pay_head_type: '',
                    calculation_type: '',
                }
            ];
        });
    };

    const handleRemovePayheadRow = (index) => {
        setPayheadRows(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (updated.length === 0) {
                return [{
                    id: null,
                    effective_from: getTodayDateString(),
                    pay_head: null,
                    pay_head_name: '',
                    rate: '',
                    per: '',
                    pay_head_type: '',
                    calculation_type: '',
                }];
            }
            return updated;
        });
    };

    const handlePayheadSelectKeyDown = (e, index) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!payheadNavigatedRef.current) payheadNavigatedRef.current = {};
            payheadNavigatedRef.current[index] = true;
            return;
        }

        if (e.key === 'Enter') {
            const row = payheadRows[index];
            const inputVal = e.target?.value || '';

            // If no pay head is selected and user hasn't typed a search term or navigated the menu with arrows
            if (!row?.pay_head && !inputVal.trim() && !payheadNavigatedRef.current?.[index]) {
                e.preventDefault();
                e.stopPropagation();

                if (payheadRows.length > 1) {
                    handleRemovePayheadRow(index);
                }

                setTimeout(() => {
                    const saveBtn = document.getElementById('save-next-btn');
                    if (saveBtn) saveBtn.focus();
                }, 50);
                return;
            }

            // If payhead is already selected on this row and user presses Enter:
            if (row?.pay_head) {
                const ph = allPayHeads.find(p => p.id === row.pay_head);
                const calcType = row.calculation_type || ph?.calculation_type_name || ph?.calculation_type_display || '';
                const isComputed = Boolean(calcType && String(calcType).toLowerCase().includes('computed'));

                if (isComputed) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (index === payheadRows.length - 1) {
                        handleAddPayheadRow(row.effective_from || '');
                        setTimeout(() => {
                            const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                            if (!activePane) return;
                            const dateInputs = activePane.querySelectorAll('input[data-payhead-date="true"]');
                            if (dateInputs.length > 0) {
                                dateInputs[dateInputs.length - 1].focus();
                            }
                        }, 50);
                    } else {
                        const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                        if (activePane) {
                            const dateInputs = activePane.querySelectorAll('input[data-payhead-date="true"]');
                            if (dateInputs[index + 1]) {
                                dateInputs[index + 1].focus();
                            }
                        }
                    }
                    return;
                } else {
                    // Not computed: advance focus to Rate field
                    e.preventDefault();
                    e.stopPropagation();
                    const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                    if (activePane) {
                        const rateInputs = activePane.querySelectorAll('input[data-payhead-rate="true"]');
                        if (rateInputs[index]) {
                            rateInputs[index].focus();
                            if (rateInputs[index].select) rateInputs[index].select();
                        }
                    }
                    return;
                }
            }
        }
    };

    const handlePayheadFieldChange = (index, field, value) => {
        setPayheadRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handlePayheadSelect = (index, opt) => {
        if (!opt) {
            setPayheadRows(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    pay_head: null,
                    pay_head_name: '',
                    rate: '',
                    per: '',
                    pay_head_type: '',
                    calculation_type: '',
                    computation_method: '',
                };
                return updated;
            });
            return;
        }

        const ph = allPayHeads.find(p => p.id === opt.value);
        if (!ph) return;

        const calcType = ph.calculation_type_name
            || ph.calculation_type_display
            || (ph.calculation_type && typeof ph.calculation_type === 'object' ? ph.calculation_type.name : ph.calculation_type)
            || '';
        const isComputed = Boolean(calcType && String(calcType).toLowerCase().includes('computed'));
        const isOnProduction = Boolean(calcType && String(calcType).toLowerCase().includes('production'));

        let defaultPeriodOrType = '';
        if (isComputed) {
            defaultPeriodOrType = '';
        } else if (isOnProduction) {
            defaultPeriodOrType = ph.production_type_unit
                || ph.attendance_production_type_unit
                || ph.calculation_period_symbol
                || '';
        } else {
            defaultPeriodOrType = ph.calculation_period_symbol
                || ph.calculation_period_formal_name
                || ph.attendance_production_type_name
                || (ph.attendance_production_type ? ph.attendance_production_type.name : '')
                || '';
        }

        const computeMethod = ph.computation?.compute_method_display
            || ph.computation_method_display
            || (ph.computed_on && ph.computed_on !== '-' ? ph.computed_on : '')
            || '';

        const isLastRow = index === payheadRows.length - 1;

        if (isComputed) {
            setPayheadRows(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    pay_head: ph.id,
                    pay_head_name: ph.name,
                    rate: '',
                    per: defaultPeriodOrType,
                    pay_head_type: ph.pay_head_type_display || ph.pay_head_type || '',
                    calculation_type: calcType,
                    computation_method: computeMethod,
                };
                if (isLastRow) {
                    const effectiveDate = updated[index].effective_from || '';
                    return [
                        ...updated,
                        {
                            id: null,
                            effective_from: effectiveDate,
                            pay_head: null,
                            pay_head_name: '',
                            rate: '',
                            per: '',
                            pay_head_type: '',
                            calculation_type: '',
                        }
                    ];
                }
                return updated;
            });

            setTimeout(() => {
                const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                if (!activePane) return;
                const dateInputs = activePane.querySelectorAll('input[data-payhead-date="true"]');
                if (isLastRow) {
                    if (dateInputs.length > 0) {
                        dateInputs[dateInputs.length - 1].focus();
                    }
                } else {
                    if (dateInputs[index + 1]) {
                        dateInputs[index + 1].focus();
                    }
                }
            }, 60);
        } else {
            setPayheadRows(prev => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    pay_head: ph.id,
                    pay_head_name: ph.name,
                    rate: updated[index].rate,
                    per: defaultPeriodOrType,
                    pay_head_type: ph.pay_head_type_display || ph.pay_head_type || '',
                    calculation_type: calcType,
                    computation_method: computeMethod,
                };
                return updated;
            });

            setTimeout(() => {
                const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                if (!activePane) return;
                const rateInputs = activePane.querySelectorAll('input[data-payhead-rate="true"]');
                if (rateInputs[index]) {
                    rateInputs[index].focus();
                    if (rateInputs[index].select) rateInputs[index].select();
                }
            }, 60);
        }
    };

    const handleSavePayheads = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            setSavingPayheads(true);
            const validRows = payheadRows
                .filter(r => r.pay_head)
                .map((r, idx) => {
                    const ph = allPayHeads.find(p => p.id === r.pay_head);
                    const calcType = r.calculation_type
                        || ph?.calculation_type_name
                        || ph?.calculation_type_display
                        || '';
                    const isComputed = Boolean(calcType && String(calcType).toLowerCase().includes('computed'));
                    const isOnProduction = Boolean(calcType && String(calcType).toLowerCase().includes('production'));
                    const prodUnit = ph?.production_type_unit || ph?.attendance_production_type_unit || '';
                    const resolvedPer = isComputed ? '' : (isOnProduction ? (r.per || prodUnit || '') : (r.per || ''));

                    return {
                        id: r.id || undefined,
                        effective_from: r.effective_from || null,
                        pay_head: r.pay_head,
                        rate: isComputed ? null : ((r.rate !== '' && r.rate != null) ? parseFloat(String(r.rate).replace(/,/g, '')) : null),
                        per: resolvedPer,
                        order: idx,
                    };
                });

            const resolvedEmpId = employeeId || candidate?.employee_profile?.id || null;
            await saveEmployeePayHeads(resolvedEmpId, validRows, candidateId);

            Swal.fire({
                icon: 'success',
                title: 'Pay Components Saved',
                text: 'Employee pay components updated successfully.',
                timer: 1500,
                showConfirmButton: false,
            });
            setActiveTab('leave_types');
        } catch (error) {
            console.error('Error saving employee pay heads:', error);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: error.response?.data?.detail || error.response?.data?.message || 'Failed to save employee pay components',
            });
        } finally {
            setSavingPayheads(false);
        }
    };

    const handleAddLeaveTypeRow = (defaultDate = null) => {
        setLeaveTypeRows(prev => {
            const lastRow = prev[prev.length - 1];
            const fallbackDate = defaultDate || lastRow?.effective_from || getTodayDateString();
            return [
                ...prev,
                {
                    id: null,
                    effective_from: fallbackDate,
                    leave_type: null,
                    leave_type_name: '',
                    leave_type_code: '',
                    is_paid: true,
                    annual_limit: '',
                    is_cumulative: false,
                    max_limit: 0,
                    is_active: true,
                }
            ];
        });
    };

    const handleRemoveLeaveTypeRow = (index) => {
        setLeaveTypeRows(prev => {
            if (prev.length <= 1) {
                return [{
                    id: null,
                    effective_from: getTodayDateString(),
                    leave_type: null,
                    leave_type_name: '',
                    leave_type_code: '',
                    is_paid: true,
                    annual_limit: '',
                    is_cumulative: false,
                    max_limit: 0,
                    is_active: true,
                }];
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleLeaveTypeFieldChange = (index, field, value) => {
        setLeaveTypeRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleLeaveTypeSelect = (index, opt) => {
        if (!opt) {
            setLeaveTypeRows(prev => {
                const next = [...prev];
                next[index] = {
                    ...next[index],
                    leave_type: null,
                    leave_type_name: '',
                    leave_type_code: '',
                    is_paid: true,
                    annual_limit: '',
                    is_cumulative: false,
                    max_limit: 0,
                };
                return next;
            });
            return;
        }

        const lt = allLeaveTypes.find(l => l.id === opt.value);
        setLeaveTypeRows(prev => {
            const next = [...prev];
            next[index] = {
                ...next[index],
                leave_type: opt.value,
                leave_type_name: lt ? lt.name : opt.label,
                leave_type_code: lt ? lt.code : '',
                is_paid: lt ? lt.is_paid : true,
                annual_limit: lt ? lt.annual_limit : '',
                is_cumulative: lt ? lt.is_cumulative : false,
                max_limit: lt ? lt.max_limit : 0,
            };
            return next;
        });
    };

    const handleSaveLeaveTypes = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            setSavingLeaveTypes(true);
            const validRows = leaveTypeRows
                .filter(r => r.leave_type)
                .map(r => ({
                    id: r.id || undefined,
                    effective_from: r.effective_from || null,
                    leave_type: r.leave_type,
                    annual_limit: r.annual_limit !== '' && r.annual_limit !== null && r.annual_limit !== undefined ? r.annual_limit : null,
                    is_active: r.is_active !== undefined ? r.is_active : true,
                }));

            // Check for missing effective_from
            const missingDate = validRows.find(r => !r.effective_from);
            if (missingDate) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Date',
                    text: 'Please specify an Effective From date for each assigned leave type.',
                });
                setSavingLeaveTypes(false);
                return;
            }

            // Check duplicate mappings
            const seenKeys = new Set();
            for (const r of validRows) {
                const key = `${r.leave_type}_${r.effective_from}`;
                if (seenKeys.has(key)) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Duplicate Mapping',
                        text: 'Duplicate leave type found with the same Effective From date. Please ensure unique leave types per date.',
                    });
                    setSavingLeaveTypes(false);
                    return;
                }
                seenKeys.add(key);
            }

            const resolvedEmpId = employeeId || candidate?.employee_profile?.id || null;
            await saveEmployeeLeaveTypes(resolvedEmpId, validRows, candidateId);

            Swal.fire({
                icon: 'success',
                title: 'Leave Types Saved',
                text: 'Employee leave type mappings updated successfully.',
                timer: 1500,
                showConfirmButton: false,
            });
            setActiveTab('previous_experience');
        } catch (error) {
            console.error('Error saving employee leave types:', error);
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: error.response?.data?.detail || error.response?.data?.message || 'Failed to save employee leave types',
            });
        } finally {
            setSavingLeaveTypes(false);
        }
    };

    const handleSaveAndNext = (e) => {
        e.preventDefault();
        if (activeTab === 'basic_details') {
            if (basicDetailsFormRef.current && basicDetailsFormRef.current.reportValidity()) {
                handleSaveBasicDetails(e);
            }
        } else if (activeTab === 'employment' && employmentFormRef.current) {
            employmentFormRef.current.requestSubmit();
        } else if (activeTab === 'payheads') {
            handleSavePayheads(e);
        } else if (activeTab === 'leave_types') {
            handleSaveLeaveTypes(e);
        } else if (activeTab === 'previous_experience' && workExperiencesFormRef.current) {
            workExperiencesFormRef.current.requestSubmit();
        } else if (activeTab === 'bank' && bankFormRef.current) {
            bankFormRef.current.requestSubmit();
        } else if (activeTab === 'documents' && documentsFormRef.current) {
            documentsFormRef.current.requestSubmit();
        } else if (activeTab === 'ledger' && ledgerFormRef.current) {
            ledgerFormRef.current.requestSubmit();
        }
    };

    const selectStyles = {
        control: (base, state) => ({
            ...base, minHeight: '40px',
            borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1',
            borderRadius: '10px', fontSize: '13px',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(109,74,255,0.15)' : 'none',
            '&:hover': { borderColor: '#6d4aff' },
        }),
        menu: (base) => ({ ...base, fontSize: '13px', zIndex: 9999 }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#6d4aff' : state.isFocused ? '#f0ecff' : 'white',
            color: state.isSelected ? 'white' : '#333',
        }),
    };

    return (
        <div className="container-fluid">
            <style>{`
                .emp-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .emp-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .emp-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .emp-custom-modal .modal-close-x {
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
                .emp-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .emp-custom-modal .modal-body-custom {
                    padding: 0;
                    max-height: 70vh;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .emp-custom-tabs {
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 20px;
                    background: #fff;
                    display: flex;
                    flex-wrap: wrap;
                    overflow: visible !important;
                }
                .emp-custom-tabs .nav-link {
                    color: #64748b;
                    font-weight: 500;
                    font-size: 13px;
                    padding: 12px 14px;
                    border: none;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -1px;
                    transition: all 0.2s;
                    white-space: nowrap;
                    cursor: pointer;
                }
                .emp-custom-tabs .nav-link:hover { color: #475569; border-bottom-color: #cbd5e1; }
                .emp-custom-tabs .nav-link.active {
                    color: #2ece8a;
                    background: transparent;
                    border-bottom-color: #2ece8a;
                }
                .emp-tab-content { padding: 24px 28px; overflow-x: hidden; }
                .emp-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .emp-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .emp-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .emp-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .emp-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .emp-custom-modal .form-check-input:checked {
                    background-color: #2ece8a;
                    border-color: #2ece8a;
                }
                .emp-custom-modal .btn-close-custom {
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
                .emp-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .emp-custom-modal .btn-save-custom {
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
                .emp-custom-modal .btn-save-custom:hover {
                    background-color: #26b277 !important;
                }
                
                /* Extra styles for Employee forms */
                .emp-section-label {
                    font-size: 11.5px; font-weight: 600; color: #94a3b8;
                    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 18px;
                    display: flex; align-items: center; gap: 10px;
                }
                .emp-section-label::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
                .emp-doc-item {
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 14px; background: #f8fafc;
                    border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 8px;
                }
                .emp-doc-item .doc-name { flex: 1; font-size: 13px; font-weight: 500; color: #334155; }
                .emp-doc-item a { font-size: 12px; color: #2ece8a; text-decoration: none; }
                .emp-doc-item a:hover { text-decoration: underline; }
                .emp-loading {
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; min-height: 280px; gap: 12px;
                }
                .emp-loading .spinner-border { width: 2.2rem; height: 2.2rem; color: #2ece8a; border-width: 3px; }
                .emp-loading p { font-size: 13px; color: #94a3b8; margin: 0; }
                .emp-empty-state {
                    text-align: center; padding: 36px 20px;
                    background: #f8fafc; border-radius: 12px;
                    border: 1px dashed #e2e8f0;
                }
                .emp-empty-state i { font-size: 2rem; color: #cbd5e1; margin-bottom: 10px; display: block; }
                .emp-empty-state p { color: #94a3b8; font-size: 13px; margin: 0; }
                .emp-payhead-date-badge {
                    font-size: 12px; font-weight: 600; color: #2ece8a;
                    padding: 5px 12px; background: #e6fcf1;
                    border-radius: 8px; border-left: 3px solid #2ece8a; margin-bottom: 10px;
                }
            `}</style>

            <Modal
                show={show}
                onHide={onHide}
                dialogClassName="emp-custom-modal"
                backdrop="static"
                keyboard={false}
                size="xl"
                centered
            >
                {/* Header */}
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                Employee Details
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {employeeName || candidate?.full_name || 'Loading...'}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                {/* Body */}
                <div className="modal-body-custom" onKeyDown={handleGlobalKeyDown}>
                    {loading ? (
                        <div className="emp-loading">
                            <div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div>
                            <p>Loading employee data...</p>
                        </div>
                    ) : (
                        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                            <Nav className="emp-custom-tabs">
                                <Nav.Item><Nav.Link eventKey="basic_details">Basic Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="employment">Employment Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="payheads">Pay Components</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="leave_types">Leave Types</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="previous_experience">Previous Experience</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="bank">Bank Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="documents">Documents</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="ledger">Ledgers</Nav.Link></Nav.Item>
                            </Nav>

                            <Tab.Content className="emp-tab-content">
                                {/* Basic Details Tab */}
                                <Tab.Pane eventKey="basic_details" className="tab-pane-basic_details">
                                    <Form ref={basicDetailsFormRef} onSubmit={handleSaveBasicDetails}>
                                        <div className="emp-section-label">Candidate Profile Information</div>
                                        <Row className="mb-3">
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">First Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={basicDetailsData.first_name || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, first_name: e.target.value })} required />
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Last Name</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={basicDetailsData.last_name || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, last_name: e.target.value })} />
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Contact Number <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={basicDetailsData.mobile_number || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, mobile_number: e.target.value })} required />
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Email <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="email" className="form-control-custom" value={basicDetailsData.email || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, email: e.target.value })} required />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Date of Birth</Form.Label>
                                                <Form.Control type="date" className="form-control-custom" value={basicDetailsData.date_of_birth || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, date_of_birth: e.target.value })} />
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Gender</Form.Label>
                                                <Form.Select className="form-control-custom" value={basicDetailsData.gender || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, gender: e.target.value })}>
                                                    <option value="">Select Gender</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </Form.Select>
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom">Blood Group</Form.Label>
                                                <Form.Select className="form-control-custom" value={basicDetailsData.blood_group || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, blood_group: e.target.value })}>
                                                    <option value="">Select Blood Group</option>
                                                    <option value="A+">A+</option>
                                                    <option value="A-">A-</option>
                                                    <option value="B+">B+</option>
                                                    <option value="B-">B-</option>
                                                    <option value="O+">O+</option>
                                                    <option value="O-">O-</option>
                                                    <option value="AB+">AB+</option>
                                                    <option value="AB-">AB-</option>
                                                </Form.Select>
                                            </Col>
                                            <Col md={3} className="mb-3">
                                                <Form.Label className="form-label-custom text-muted">Department</Form.Label>
                                                <div style={{ fontWeight: 500, padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                                    {candidate?.department_applied_name || 'N/A'}
                                                </div>
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={4} className="mb-3">
                                                <Form.Label className="form-label-custom text-muted">Designation</Form.Label>
                                                <div style={{ fontWeight: 500, padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                                    {candidate?.position_applied_name || 'N/A'}
                                                </div>
                                            </Col>
                                            <Col md={4} className="mb-3">
                                                <Form.Label className="form-label-custom">Qualification</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={basicDetailsData.qualification || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, qualification: e.target.value })} />
                                            </Col>
                                            <Col md={4} className="mb-3">
                                                <Form.Label className="form-label-custom">Experience (Years)</Form.Label>
                                                <Form.Control type="number" step="0.1" className="form-control-custom" value={basicDetailsData.experience_years || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, experience_years: e.target.value })} />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={12}>
                                                <Form.Label className="form-label-custom">Address</Form.Label>
                                                <Form.Control as="textarea" rows={2} className="form-control-custom" value={basicDetailsData.address || ''} onChange={(e) => setBasicDetailsData({ ...basicDetailsData, address: e.target.value })} />
                                            </Col>
                                        </Row>

                                        {/* Department & Designation Track Section */}
                                        <div className="d-flex align-items-center justify-content-between mt-4 mb-3 pt-3 border-top">
                                            <div className="d-flex align-items-center gap-2">
                                                <div style={{
                                                    width: '32px', height: '32px', borderRadius: '8px',
                                                    background: 'linear-gradient(135deg, #2ece8a 0%, #10b981 100%)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontSize: '14px', boxShadow: '0 2px 8px rgba(46, 206, 138, 0.25)'
                                                }}>
                                                    <i className="fa fa-sitemap" />
                                                </div>
                                                <div>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                                                        Department & Designation Change
                                                    </span>
                                                    <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                                        Track department or designation transfers, promotions & effective dates
                                                    </span>
                                                </div>
                                            </div>
                                            {deptHistoryList.length > 0 && (
                                                <span className="badge rounded-pill" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 500, padding: '6px 12px' }}>
                                                    {deptHistoryList.length} {deptHistoryList.length === 1 ? 'Record' : 'Records'}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{
                                            background: '#f8fafc',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            padding: '16px 18px',
                                            marginBottom: '16px'
                                        }}>
                                            <Row className="align-items-end g-3">
                                                <Col md={4}>
                                                    <Form.Label className="form-label-custom mb-1" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                                        Department <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Select
                                                        options={departmentsList.map(d => ({ value: d.id, label: d.name }))}
                                                        value={departmentsList.find(d => d.id === deptChangeForm.department) ? { value: deptChangeForm.department, label: departmentsList.find(d => d.id === deptChangeForm.department).name } : null}
                                                        onChange={(opt) => handleDeptChangeSelect('department', opt ? opt.value : '')}
                                                        placeholder="Select Department..."
                                                        styles={selectStyles}
                                                        isClearable
                                                    />
                                                </Col>
                                                <Col md={4}>
                                                    <Form.Label className="form-label-custom mb-1" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                                        Designation <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Select
                                                        options={designationsForSelectedDept.map(d => ({ value: d.id, label: d.name }))}
                                                        value={designationsForSelectedDept.find(d => d.id === deptChangeForm.designation) ? { value: deptChangeForm.designation, label: designationsForSelectedDept.find(d => d.id === deptChangeForm.designation).name } : null}
                                                        onChange={(opt) => setDeptChangeForm(prev => ({ ...prev, designation: opt ? opt.value : '' }))}
                                                        placeholder={deptChangeForm.department ? (loadingDesignations ? "Loading..." : "Select Designation...") : "Select Department First"}
                                                        isDisabled={!deptChangeForm.department || loadingDesignations}
                                                        styles={selectStyles}
                                                        isClearable
                                                    />
                                                </Col>
                                                <Col md={2}>
                                                    <Form.Label className="form-label-custom mb-1" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                                                        Effective From <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="date"
                                                        className="form-control-custom"
                                                        style={{ height: '40px', fontSize: '13px' }}
                                                        value={deptChangeForm.effective_from}
                                                        onChange={(e) => setDeptChangeForm(prev => ({ ...prev, effective_from: e.target.value }))}
                                                    />
                                                </Col>
                                                <Col md={2}>
                                                    <button
                                                        type="button"
                                                        className="btn w-100"
                                                        disabled={savingDeptChange || !deptChangeForm.department || !deptChangeForm.designation || !deptChangeForm.effective_from}
                                                        onClick={handleApplyDeptChange}
                                                        style={{
                                                            height: '40px',
                                                            borderRadius: '8px',
                                                            backgroundColor: (!deptChangeForm.department || !deptChangeForm.designation || !deptChangeForm.effective_from)
                                                                ? '#e2e8f0'
                                                                : '#2ece8a',
                                                            color: (!deptChangeForm.department || !deptChangeForm.designation || !deptChangeForm.effective_from)
                                                                ? '#94a3b8'
                                                                : '#ffffff',
                                                            fontWeight: 600,
                                                            fontSize: '13px',
                                                            border: 'none',
                                                            boxShadow: (!deptChangeForm.department || !deptChangeForm.designation || !deptChangeForm.effective_from)
                                                                ? 'none'
                                                                : '0 2px 6px rgba(46, 206, 138, 0.25)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            whiteSpace: 'nowrap',
                                                            padding: '0 12px',
                                                            transition: 'all 0.2s ease',
                                                            cursor: (!deptChangeForm.department || !deptChangeForm.designation || !deptChangeForm.effective_from) ? 'not-allowed' : 'pointer'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (deptChangeForm.department && deptChangeForm.designation && deptChangeForm.effective_from) {
                                                                e.currentTarget.style.backgroundColor = '#26b277';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (deptChangeForm.department && deptChangeForm.designation && deptChangeForm.effective_from) {
                                                                e.currentTarget.style.backgroundColor = '#2ece8a';
                                                            }
                                                        }}
                                                    >
                                                        {savingDeptChange ? (
                                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                                                        ) : (
                                                            <>
                                                                <i className="fa fa-plus" style={{ fontSize: '11px' }} />
                                                                <span>Add Change</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </Col>
                                            </Row>
                                        </div>

                                        {/* History Table */}
                                        <div style={{
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            overflow: 'hidden',
                                            background: '#fff',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                            marginBottom: '20px'
                                        }}>
                                            <div className="table-responsive">
                                                <table className="table mb-0 align-middle" style={{ fontSize: '13px' }}>
                                                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <tr>
                                                            <th style={{ color: '#64748b', fontWeight: 600, padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</th>
                                                            <th style={{ color: '#64748b', fontWeight: 600, padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Designation</th>
                                                            <th style={{ color: '#64748b', fontWeight: 600, padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Effective From</th>
                                                            <th style={{ color: '#64748b', fontWeight: 600, padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                                            <th style={{ color: '#64748b', fontWeight: 600, padding: '10px 14px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', width: '80px' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loadingDeptHistory ? (
                                                            <tr>
                                                                <td colSpan={5} className="text-center py-3 text-muted">
                                                                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                                                                    Loading history...
                                                                </td>
                                                            </tr>
                                                        ) : deptHistoryList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="text-center py-3 text-muted" style={{ fontStyle: 'italic' }}>
                                                                    No department or designation changes recorded yet.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            deptHistoryList.map((item, idx) => (
                                                                <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                    <td style={{ fontWeight: 500, color: '#1e293b', padding: '10px 14px' }}>
                                                                        {item.department_name || '-'}
                                                                    </td>
                                                                    <td style={{ fontWeight: 500, color: '#334155', padding: '10px 14px' }}>
                                                                        {item.designation_name || '-'}
                                                                    </td>
                                                                    <td style={{ color: '#64748b', padding: '10px 14px' }}>
                                                                        <i className="fa fa-calendar-alt text-muted me-1" style={{ fontSize: '11px' }} />
                                                                        {item.effective_from || '-'}
                                                                    </td>
                                                                    <td style={{ padding: '10px 14px' }}>
                                                                        {item.status === 'active' ? (
                                                                            <span className="badge" style={{ backgroundColor: 'rgba(46, 206, 138, 0.15)', color: '#0d9488', border: '1px solid rgba(46, 206, 138, 0.3)', padding: '5px 9px', borderRadius: '6px', fontWeight: 600, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0d9488' }} />
                                                                                Active
                                                                            </span>
                                                                        ) : item.status === 'upcoming' ? (
                                                                            <span className="badge" style={{ backgroundColor: 'rgba(109, 74, 255, 0.12)', color: '#6d4aff', border: '1px solid rgba(109, 74, 255, 0.25)', padding: '5px 9px', borderRadius: '6px', fontWeight: 600, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6d4aff' }} />
                                                                                Upcoming
                                                                            </span>
                                                                        ) : (
                                                                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '5px 9px', borderRadius: '6px', fontWeight: 500, fontSize: '11px' }}>
                                                                                Past
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                                                                        {item.remarks !== 'Initial Department & Designation' && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-link text-danger p-0"
                                                                                onClick={() => handleDeleteDeptHistory(item.id)}
                                                                                title="Delete record"
                                                                            >
                                                                                <i className="fa fa-trash-alt" />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                    </Form>
                                </Tab.Pane>

                                {/* Employment Tab */}
                                <Tab.Pane eventKey="employment" className="tab-pane-employment">
                                    <Form ref={employmentFormRef} onSubmit={handleSaveEmploymentDetails}>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Employment No <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.employment_no}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, employment_no: e.target.value })}
                                                    placeholder="e.g. EMP-001" required />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Date of Joining <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="date" className="form-control-custom" value={employmentData.date_of_joining}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, date_of_joining: e.target.value })} required />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Employment Type <span className="text-danger">*</span></Form.Label>
                                                <CustomSelect
                                                    options={[
                                                        { value: 'Full Time', label: 'Full Time' },
                                                        { value: 'Part Time', label: 'Part Time' },
                                                        { value: 'Contract', label: 'Contract' },
                                                    ]}
                                                    value={{ value: employmentData.employment_type, label: employmentData.employment_type || 'Select type' }}
                                                    onChange={(opt) => setEmploymentData({ ...employmentData, employment_type: opt ? opt.value : '' })}
                                                    styles={selectStyles}
                                                />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Work Mode <span className="text-danger">*</span></Form.Label>
                                                <CustomSelect
                                                    options={[
                                                        { value: 'WFH', label: 'Work From Home' },
                                                        { value: 'WFO', label: 'Work From Office' },
                                                        { value: 'FV', label: 'Field Visit' },
                                                    ]}
                                                    value={
                                                        employmentData.work_mode === 'WFH' ? { value: 'WFH', label: 'Work From Home' } :
                                                        employmentData.work_mode === 'WFO' ? { value: 'WFO', label: 'Work From Office' } : 
                                                        employmentData.work_mode === 'FV' ? { value: 'FV', label: 'Field Visit' } :
                                                        { value: employmentData.work_mode, label: employmentData.work_mode || 'Select mode' }
                                                    }
                                                    onChange={(opt) => setEmploymentData({ ...employmentData, work_mode: opt ? opt.value : '' })}
                                                    styles={selectStyles}
                                                />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Probation Period(Months) <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.probation_period}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, probation_period: e.target.value })}
                                                    placeholder="e.g. 3" required />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Notice Period(Months) <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.notice_period}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, notice_period: e.target.value })}
                                                    placeholder="e.g. 1" required />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <Form.Label className="form-label-custom mb-0">Reporting Department</Form.Label>
                                                    <Form.Check
                                                        type="checkbox"
                                                        id="override-dept-checkbox"
                                                        label="Different department"
                                                        checked={overrideDept}
                                                        onChange={(e) => {
                                                            setOverrideDept(e.target.checked);
                                                            if (!e.target.checked) {
                                                                setReportingDeptId(null);
                                                                // Back to own dept — apply level filter again
                                                                const designationLevel = candidate?.employee_profile?.designation_level;
                                                                const departmentId = candidate?.employee_profile?.department_id;
                                                                if (departmentId != null) {
                                                                    getManagersForEmployee(departmentId, designationLevel ?? null)
                                                                        .then(data => {
                                                                            setManagersForDropdown(Array.isArray(data) ? data : []);
                                                                        })
                                                                        .catch(() => {});
                                                                }
                                                            }
                                                        }}
                                                        style={{ fontSize: '12px', marginTop: '1px' }}
                                                    />
                                                </div>
                                                {overrideDept ? (
                                                    <CustomSelect
                                                        options={departmentsList
                                                            .filter(d => d.id !== candidate?.employee_profile?.department_id)
                                                            .map(d => ({ value: d.id, label: d.name }))}
                                                        value={departmentsList.find(d => d.id === reportingDeptId) ? { value: reportingDeptId, label: departmentsList.find(d => d.id === reportingDeptId).name } : null}
                                                        onChange={(opt) => setReportingDeptId(opt ? opt.value : null)}
                                                        placeholder="Select department..."
                                                        styles={selectStyles}
                                                    />
                                                ) : (
                                                    <div
                                                        className="form-control-custom"
                                                        style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', minHeight: '38px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '6px 12px', fontWeight: 500 }}
                                                    >
                                                        {candidate?.employee_profile?.department_name || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not assigned</span>}
                                                    </div>
                                                )}
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Reporting Manager <span className="text-danger">*</span></Form.Label>
                                                <CustomSelect
                                                    options={managersForDropdown.map((emp) => {
                                                        const name = emp.full_name || `Employee #${emp.id}`;
                                                        const label = emp.designation_title ? `${name} — ${emp.designation_title}` : name;
                                                        return { value: emp.id, label };
                                                    })}
                                                    value={(() => {
                                                        const emp = managersForDropdown.find(e => e.id == employmentData.reporting_manager);
                                                        if (!emp) return null;
                                                        const name = emp.full_name || `Employee #${emp.id}`;
                                                        const label = emp.designation_title ? `${name} — ${emp.designation_title}` : name;
                                                        return { value: emp.id, label };
                                                    })()}
                                                    onChange={(opt) => setEmploymentData({ ...employmentData, reporting_manager: opt ? opt.value : '' })}
                                                    placeholder="Select manager"
                                                    styles={selectStyles}
                                                />
                                                {candidate?.employee_profile?.designation_level != null && (
                                                    <Form.Text className="text-muted" style={{ fontSize: '11px' }}>
                                                        Showing employees in <strong>{(overrideDept && reportingDeptId) ? (departmentsList.find(d => d.id === reportingDeptId)?.name || 'selected department') : (candidate.employee_profile.department_name || 'the same department')}</strong> with a higher rank (level &lt; {candidate.employee_profile.designation_level}).
                                                    </Form.Text>
                                                )}
                                                {managersForDropdown.length === 0 && !overrideDept && (
                                                    <Form.Text className="text-warning d-block" style={{ fontSize: '11px', marginTop: '3px' }}>
                                                        No higher-ranking employee in this department. Check "Different department" to select a manager from another department.
                                                    </Form.Text>
                                                )}
                                            </Col>
                                        </Row>

                                        {candidate?.employee_profile?.user_email && (
                                            <>
                                                <div className="emp-section-label">Additional Roles</div>
                                                <Row className="mb-4">
                                                    <Col md={12}>
                                                        <Form.Text className="text-muted d-block mb-2" style={{ fontSize: '12px' }}>
                                                            Each role is active until its individual Expiry Date. After that date, it is automatically removed.
                                                        </Form.Text>
                                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                                            {/* Table Header */}
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 40px', background: '#f8fafc', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                <span>Role</span>
                                                                <span>Expiry Date</span>
                                                                <span></span>
                                                            </div>
                                                            {/* Rows */}
                                                            {employmentData.role_expiries.map((re, idx) => (
                                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 40px', alignItems: 'center', padding: '8px 16px', borderBottom: idx < employmentData.role_expiries.length - 1 ? '1px solid #f1f5f9' : 'none', gap: '8px' }}>
                                                                    <CustomSelect
                                                                        options={rolesList
                                                                            .filter(r => !employmentData.role_expiries.some((x, i) => i !== idx && String(x.role) === String(r.id)))
                                                                            .map(r => ({ value: r.id, label: r.name }))}
                                                                        value={rolesList.find(r => String(r.id) === String(re.role)) ? { value: re.role, label: rolesList.find(r => String(r.id) === String(re.role)).name } : (re.role_name ? { value: re.role, label: re.role_name } : null)}
                                                                        onChange={(opt) => {
                                                                            const updated = [...employmentData.role_expiries];
                                                                            updated[idx] = { ...updated[idx], role: opt ? opt.value : '', role_name: opt ? opt.label : '' };
                                                                            setEmploymentData({ ...employmentData, role_expiries: updated });
                                                                        }}
                                                                        placeholder="Select role..."
                                                                        menuPortalTarget={document.body}
                                                                        styles={{ control: (base, state) => ({ ...base, minHeight: '36px', borderRadius: '8px', fontSize: '13px', borderColor: state.isFocused ? '#6d4aff' : '#cbd5e1', boxShadow: state.isFocused ? '0 0 0 3px rgba(109,74,255,0.15)' : 'none' }), menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                                                                    />
                                                                    <Form.Control
                                                                        type="date"
                                                                        value={re.expiry_date || ''}
                                                                        min={new Date().toISOString().split('T')[0]}
                                                                        onChange={(e) => {
                                                                            const updated = [...employmentData.role_expiries];
                                                                            updated[idx] = { ...updated[idx], expiry_date: e.target.value };
                                                                            setEmploymentData({ ...employmentData, role_expiries: updated });
                                                                        }}
                                                                        style={{ height: '36px', fontSize: '13px', borderRadius: '8px' }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updated = employmentData.role_expiries.filter((_, i) => i !== idx);
                                                                            setEmploymentData({ ...employmentData, role_expiries: updated });
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', padding: '0', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        title="Remove role"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {employmentData.role_expiries.length === 0 && (
                                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                                    No additional roles assigned. Click "+ Add Role" to add one.
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Add Role Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setEmploymentData({
                                                                ...employmentData,
                                                                role_expiries: [...employmentData.role_expiries, { role: '', role_name: '', expiry_date: '' }]
                                                            })}
                                                            style={{ marginTop: '10px', background: 'none', border: '1px dashed #7c3aed', color: '#7c3aed', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                        >
                                                            <i className="fa fa-plus" style={{ fontSize: '11px' }} /> Add Role
                                                        </button>
                                                    </Col>
                                                </Row>
                                            </>
                                        )}

                                        <div className="emp-section-label">Immediate Contact 1</div>
                                        <Row className="mb-3">
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.ic1_name}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, ic1_name: e.target.value })}
                                                    placeholder="Enter name" required />
                                            </Col>
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Relation <span className="text-danger">*</span></Form.Label>
                                                <CustomSelect
                                                    options={RELATION_OPTIONS}
                                                    value={RELATION_OPTIONS.find(o => o.value === employmentData.ic1_relation) || null}
                                                    onChange={(opt) => setEmploymentData({ ...employmentData, ic1_relation: opt ? opt.value : '' })}
                                                    placeholder="Select relation..."
                                                    isClearable
                                                    menuPortalTarget={document.body}
                                                    styles={selectStyles}
                                                />
                                            </Col>
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Contact Number <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.ic1_number}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, ic1_number: e.target.value })}
                                                    placeholder="Enter number" required />
                                            </Col>
                                        </Row>

                                        <div className="emp-section-label mt-4">Immediate Contact 2</div>
                                        <Row className="mb-4">
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.ic2_name}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, ic2_name: e.target.value })}
                                                    placeholder="Enter name" required />
                                            </Col>
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Relation <span className="text-danger">*</span></Form.Label>
                                                <CustomSelect
                                                    options={RELATION_OPTIONS}
                                                    value={RELATION_OPTIONS.find(o => o.value === employmentData.ic2_relation) || null}
                                                    onChange={(opt) => setEmploymentData({ ...employmentData, ic2_relation: opt ? opt.value : '' })}
                                                    placeholder="Select relation..."
                                                    isClearable
                                                    menuPortalTarget={document.body}
                                                    styles={selectStyles}
                                                />
                                            </Col>
                                            <Col md={4}>
                                                <Form.Label className="form-label-custom">Contact Number <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={employmentData.ic2_number}
                                                    onChange={(e) => setEmploymentData({ ...employmentData, ic2_number: e.target.value })}
                                                    placeholder="Enter number" required />
                                            </Col>
                                        </Row>

                                        <div className="emp-section-label mt-4">Insurance details</div>
                                        <Row className="mb-4">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Health Card Validity</Form.Label>
                                                <Form.Control type="date" className="form-control-custom" value={employmentData.health_card_validity || ''} onChange={(e) => setEmploymentData({ ...employmentData, health_card_validity: e.target.value })} />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Health Insurance Validity</Form.Label>
                                                <Form.Control type="date" className="form-control-custom" value={employmentData.health_insurance_validity || ''} onChange={(e) => setEmploymentData({ ...employmentData, health_insurance_validity: e.target.value })} />
                                            </Col>
                                        </Row>
                                    </Form>
                                </Tab.Pane>

                                {/* Pay Components Tab */}
                                <Tab.Pane eventKey="payheads" className="tab-pane-payheads">
                                    <Form ref={payheadsFormRef} onSubmit={handleSavePayheads} noValidate>
                                        <div className="table-responsive mb-3" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', overflowY: 'visible' }}>
                                            <table className="table table-bordered mb-0" style={{ fontSize: '13px', verticalAlign: 'middle', width: '100%' }}>
                                                <thead style={{ backgroundColor: '#f8fafc' }}>
                                                    <tr>
                                                        <th style={{ width: '140px', fontWeight: 600, color: '#475569' }}>Effective From</th>
                                                        <th style={{ minWidth: '180px', fontWeight: 600, color: '#475569' }}>Pay Component</th>
                                                        <th style={{ width: '120px', fontWeight: 600, color: '#475569' }}>Rate</th>
                                                        <th style={{ width: '100px', fontWeight: 600, color: '#475569' }}>Per</th>
                                                        <th style={{ minWidth: '140px', fontWeight: 600, color: '#475569' }}>Pay Component Type</th>
                                                        <th style={{ minWidth: '150px', fontWeight: 600, color: '#475569' }}>Calculation Method</th>
                                                        <th style={{ width: '45px', textAlign: 'center' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payheadRows.map((row, index) => {
                                                        const payHeadOptions = allPayHeads.map(ph => ({
                                                            value: ph.id,
                                                            label: ph.name,
                                                        }));
                                                        const selectedOption = row.pay_head
                                                            ? payHeadOptions.find(o => o.value === row.pay_head)
                                                            : null;
                                                        const ph = allPayHeads.find(p => p.id === row.pay_head);
                                                        const calcType = row.calculation_type
                                                            || ph?.calculation_type_name
                                                            || ph?.calculation_type_display
                                                            || (ph?.calculation_type && typeof ph?.calculation_type === 'object' ? ph.calculation_type.name : ph?.calculation_type)
                                                            || '';
                                                        const isComputed = Boolean(calcType && String(calcType).toLowerCase().includes('computed'));
                                                        const isOnProduction = Boolean(calcType && String(calcType).toLowerCase().includes('production'));
                                                        const prodUnit = ph?.production_type_unit || ph?.attendance_production_type_unit || '';
                                                        const computationMethod = row.computation_method
                                                            || (row.computed_on && row.computed_on !== '-' ? row.computed_on : '')
                                                            || ph?.computation_method_display
                                                            || ph?.computation?.compute_method_display
                                                            || (ph?.computed_on && ph?.computed_on !== '-' ? ph?.computed_on : '')
                                                            || '';

                                                        return (
                                                            <tr key={index}>
                                                                <td style={{ padding: '8px' }}>
                                                                    <Form.Control
                                                                        type="date"
                                                                        data-payhead-date="true"
                                                                        data-index={index}
                                                                        value={row.effective_from || ''}
                                                                        onChange={(e) => handlePayheadFieldChange(index, 'effective_from', e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                const rowEl = e.target.closest('tr');
                                                                                if (rowEl) {
                                                                                    const selectEl = rowEl.querySelector('.react-select__input');
                                                                                    if (selectEl) {
                                                                                        selectEl.focus();
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        style={{ height: '40px', fontSize: '13px', borderRadius: '10px' }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <CustomSelect
                                                                        options={payHeadOptions}
                                                                        value={selectedOption}
                                                                        onChange={(opt) => handlePayheadSelect(index, opt)}
                                                                        onFocus={() => {
                                                                            if (!payheadNavigatedRef.current) payheadNavigatedRef.current = {};
                                                                            payheadNavigatedRef.current[index] = false;
                                                                        }}
                                                                        onKeyDown={(e) => handlePayheadSelectKeyDown(e, index)}
                                                                        autoAdvanceFocus={false}
                                                                        placeholder="Select Pay Component..."
                                                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                                        styles={selectStyles}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <Form.Control
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        data-payhead-rate="true"
                                                                        data-index={index}
                                                                        value={isComputed ? '' : (row.rate ?? '')}
                                                                        disabled={isComputed}
                                                                        onChange={(e) => {
                                                                            if (isComputed) return;
                                                                            const val = e.target.value;
                                                                            if (val === '' || /^-?\d*(\.\d*)?$/.test(val)) {
                                                                                handlePayheadFieldChange(index, 'rate', val);
                                                                            }
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                if (index === payheadRows.length - 1) {
                                                                                    handleAddPayheadRow(row.effective_from || '');
                                                                                    setTimeout(() => {
                                                                                        const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                                                                                        if (!activePane) return;
                                                                                        const dateInputs = activePane.querySelectorAll('input[data-payhead-date="true"]');
                                                                                        if (dateInputs.length > 0) {
                                                                                            dateInputs[dateInputs.length - 1].focus();
                                                                                        }
                                                                                    }, 50);
                                                                                } else {
                                                                                    const activePane = document.querySelector('.emp-tab-content .tab-pane.active');
                                                                                    if (activePane) {
                                                                                        const dateInputs = activePane.querySelectorAll('input[data-payhead-date="true"]');
                                                                                        if (dateInputs[index + 1]) {
                                                                                            dateInputs[index + 1].focus();
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        placeholder={isComputed ? '—' : '0.00'}
                                                                        style={{
                                                                            height: '40px',
                                                                            fontSize: '13px',
                                                                            textAlign: 'right',
                                                                            borderRadius: '10px',
                                                                            backgroundColor: isComputed ? '#f1f5f9' : '#ffffff',
                                                                            cursor: isComputed ? 'not-allowed' : 'text',
                                                                            borderColor: isComputed ? '#e2e8f0' : undefined,
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <Form.Control
                                                                        type="text"
                                                                        data-payhead-per="true"
                                                                        data-index={index}
                                                                        value={isComputed ? '' : (isOnProduction ? (row.per || prodUnit || '') : (row.per ?? ''))}
                                                                        disabled
                                                                        placeholder={isComputed ? '—' : (isOnProduction && prodUnit ? prodUnit : '—')}
                                                                        style={{
                                                                            height: '40px',
                                                                            fontSize: '13px',
                                                                            borderRadius: '10px',
                                                                            backgroundColor: '#f1f5f9',
                                                                            cursor: 'not-allowed',
                                                                            borderColor: '#e2e8f0',
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                                                                    {row.pay_head_type ? (
                                                                        <span className="badge badge-light border text-dark" style={{ fontSize: '11px', padding: '5px 8px' }}>
                                                                            {row.pay_head_type}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted small">—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                                                                    {calcType ? (
                                                                        <div>
                                                                            <div className="text-secondary small font-weight-bold" style={{ lineHeight: '1.25' }}>
                                                                                {calcType}
                                                                            </div>
                                                                            {isComputed && computationMethod ? (
                                                                                <div className="text-muted font-weight-normal" style={{ fontSize: '11px', marginTop: '3px', lineHeight: '1.25' }}>
                                                                                    ({computationMethod})
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted small">—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger"
                                                                        style={{ width: '28px', height: '28px', padding: 0, borderRadius: '4px' }}
                                                                        onClick={() => handleRemovePayheadRow(index)}
                                                                        title="Remove Row"
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
                                        <div className="d-flex justify-content-between align-items-center">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                style={{ borderRadius: '6px', fontWeight: 500 }}
                                                onClick={handleAddPayheadRow}
                                            >
                                                <i className="fa fa-plus mr-1"></i> Add Row
                                            </button>
                                        </div>
                                    </Form>
                                </Tab.Pane>

                                {/* Leave Types Tab */}
                                <Tab.Pane eventKey="leave_types" className="tab-pane-leave_types">
                                    <Form ref={leaveTypesFormRef} onSubmit={handleSaveLeaveTypes} noValidate>
                                        <div className="table-responsive mb-3" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', overflowY: 'visible' }}>
                                            <table className="table table-bordered mb-0" style={{ fontSize: '13px', verticalAlign: 'middle', width: '100%' }}>
                                                <thead style={{ backgroundColor: '#f8fafc' }}>
                                                    <tr>
                                                        <th style={{ width: '160px', fontWeight: 600, color: '#475569' }}>Effective From</th>
                                                        <th style={{ minWidth: '220px', fontWeight: 600, color: '#475569' }}>Leave Type</th>
                                                        <th style={{ width: '120px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Nature</th>
                                                        <th style={{ width: '130px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Annual Limit</th>
                                                        <th style={{ width: '160px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Accumulation</th>
                                                        <th style={{ width: '45px', textAlign: 'center' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {leaveTypeRows.map((row, index) => {
                                                        const leaveTypeOptions = allLeaveTypes.map(lt => ({
                                                            value: lt.id,
                                                            label: `${lt.name} (${lt.code})`,
                                                        }));
                                                        const selectedOption = row.leave_type
                                                            ? (leaveTypeOptions.find(o => String(o.value) === String(row.leave_type)) || (
                                                                row.leave_type_name
                                                                    ? { value: row.leave_type, label: `${row.leave_type_name}${row.leave_type_code ? ` (${row.leave_type_code})` : ''}` }
                                                                    : null
                                                            ))
                                                            : null;
                                                        const lt = allLeaveTypes.find(l => l.id === row.leave_type);
                                                        const isPaid = lt ? lt.is_paid : row.is_paid;
                                                        const limit = lt ? lt.annual_limit : row.annual_limit;
                                                        const isCumulative = lt ? lt.is_cumulative : row.is_cumulative;
                                                        const maxLimit = lt ? lt.max_limit : row.max_limit;

                                                        return (
                                                            <tr key={index}>
                                                                <td style={{ padding: '8px' }}>
                                                                    <Form.Control
                                                                        type="date"
                                                                        value={row.effective_from || ''}
                                                                        onChange={(e) => handleLeaveTypeFieldChange(index, 'effective_from', e.target.value)}
                                                                        style={{ height: '40px', fontSize: '13px', borderRadius: '10px' }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <CustomSelect
                                                                        options={leaveTypeOptions}
                                                                        value={selectedOption}
                                                                        onChange={(opt) => handleLeaveTypeSelect(index, opt)}
                                                                        autoAdvanceFocus={false}
                                                                        placeholder="Select Leave Type..."
                                                                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                                        styles={selectStyles}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                    {row.leave_type ? (
                                                                        <Badge bg={isPaid ? "success" : "secondary"} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '6px' }}>
                                                                            {isPaid ? "Paid" : "Unpaid"}
                                                                        </Badge>
                                                                    ) : (
                                                                        <span className="text-muted small">—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '8px' }}>
                                                                    <Form.Control
                                                                        type="number"
                                                                        step="0.5"
                                                                        min="0"
                                                                        placeholder="0"
                                                                        value={row.annual_limit !== undefined && row.annual_limit !== null ? row.annual_limit : ''}
                                                                        onChange={(e) => handleLeaveTypeFieldChange(index, 'annual_limit', e.target.value)}
                                                                        disabled={!row.leave_type}
                                                                        style={{ height: '40px', fontSize: '13px', borderRadius: '10px', textAlign: 'center' }}
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                                                    {row.leave_type ? (
                                                                        isCumulative ? (
                                                                            <span className="badge bg-light text-primary border" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                                                Cumulative (Max {maxLimit || '∞'})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-muted small">No</span>
                                                                        )
                                                                    ) : (
                                                                        <span className="text-muted small">—</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger"
                                                                        style={{ width: '28px', height: '28px', padding: 0, borderRadius: '4px' }}
                                                                        onClick={() => handleRemoveLeaveTypeRow(index)}
                                                                        title="Remove Row"
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
                                        <div className="d-flex justify-content-between align-items-center">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                style={{ borderRadius: '6px', fontWeight: 500 }}
                                                onClick={() => handleAddLeaveTypeRow()}
                                            >
                                                <i className="fa fa-plus mr-1"></i> Add Leave Type
                                            </button>
                                        </div>
                                    </Form>
                                </Tab.Pane>

                                {/* Previous Experience Tab */}
                                <Tab.Pane eventKey="previous_experience" className="tab-pane-previous_experience">
                                    <Form ref={workExperiencesFormRef} onSubmit={handleSaveWorkExperiences} noValidate>
                                        {workExperiences.map((exp, index) => (
                                            <div key={index} className="mb-4 p-3 border rounded position-relative" style={{ backgroundColor: '#f8f9fa' }}>
                                                {index > 0 && (
                                                    <button type="button" className="btn btn-sm btn-danger position-absolute" style={{ top: '10px', right: '10px', borderRadius: '50%', width: '28px', height: '28px', padding: 0 }} onClick={() => handleRemoveWorkExperienceRow(index)}>
                                                        <i className="fa fa-times"></i>
                                                    </button>
                                                )}
                                                
                                                <Row className="mb-3 mt-2">
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Company Name <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={exp.company_name}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'company_name', e.target.value)}
                                                            placeholder="Enter company name" required data-exp-first="true" data-index={index} />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Designation <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={exp.designation}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'designation', e.target.value)}
                                                            placeholder="Enter designation" required />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Department</Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={exp.department}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'department', e.target.value)}
                                                            placeholder="Enter department" />
                                                    </Col>
                                                </Row>
                                                
                                                <Row className="mb-3">
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Employment Type</Form.Label>
                                                        <CustomSelect
                                                            options={[
                                                                { value: 'FULL_TIME', label: 'Full Time' },
                                                                { value: 'PART_TIME', label: 'Part Time' },
                                                                { value: 'CONTRACT', label: 'Contract' },
                                                                { value: 'TEMPORARY', label: 'Temporary' },
                                                                { value: 'INTERNSHIP', label: 'Internship' },
                                                                { value: 'FREELANCE', label: 'Freelance' },
                                                            ]}
                                                            value={{ value: exp.employment_type, label: exp.employment_type.replace('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }}
                                                            onChange={(opt) => handleWorkExperienceRowChange(index, 'employment_type', opt ? opt.value : 'FULL_TIME')}
                                                            styles={selectStyles}
                                                        />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Industry</Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={exp.industry}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'industry', e.target.value)}
                                                            placeholder="Enter industry" />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Company Location</Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={exp.company_location}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'company_location', e.target.value)}
                                                            placeholder="Enter location" />
                                                    </Col>
                                                </Row>
                                                
                                                <Row className="mb-3">
                                                    <Col md={6}>
                                                        <Form.Label className="form-label-custom">Start Date <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="date" className="form-control-custom" value={exp.start_date}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'start_date', e.target.value)} required />
                                                    </Col>
                                                    <Col md={6}>
                                                        <Form.Label className="form-label-custom">End Date <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="date" className="form-control-custom" value={exp.end_date}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'end_date', e.target.value)} required />
                                                    </Col>
                                                </Row>

                                                <Row className="mb-3">
                                                    <Col md={6}>
                                                        <Form.Label className="form-label-custom">Responsibilities</Form.Label>
                                                        <Form.Control as="textarea" rows={3} className="form-control-custom" value={exp.responsibilities}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'responsibilities', e.target.value)}
                                                            placeholder="Key responsibilities handled" />
                                                    </Col>
                                                    <Col md={6}>
                                                        <Form.Label className="form-label-custom">Achievements</Form.Label>
                                                        <Form.Control as="textarea" rows={3} className="form-control-custom" value={exp.achievements}
                                                            onChange={(e) => handleWorkExperienceRowChange(index, 'achievements', e.target.value)}
                                                            placeholder="Notable achievements" data-exp-last="true" data-index={index} />
                                                    </Col>
                                                </Row>

                                                <div className="d-flex justify-content-end mb-2 mt-3">
                                                    <button type="button" className="btn btn-sm" style={{ background: '#2ece8a', color: 'white', borderRadius: '6px' }} onClick={handleAddWorkExperienceRow}>
                                                        <i className="fa fa-plus me-1"></i> Add Experience
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <div className="alert alert-info mt-3 py-2" role="alert" style={{ fontSize: '0.9rem' }}>
                                            <i className="fa fa-info-circle me-2"></i>
                                            <strong>Note:</strong> Please upload any related work experience documents (like experience certificates, relieving letters, and salary slips) in the <strong>Documents</strong> tab.
                                        </div>
                                    </Form>
                                </Tab.Pane>

                                {/* Bank Tab */}
                                <Tab.Pane eventKey="bank" className="tab-pane-bank">
                                    <Form ref={bankFormRef} onSubmit={handleSaveBankDetails} noValidate>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Bank Name <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.bank_name}
                                                    onChange={(e) => setBankData({ ...bankData, bank_name: e.target.value })}
                                                    placeholder="e.g. State Bank of India" required />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Account Number <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.account_no}
                                                    onChange={(e) => setBankData({ ...bankData, account_no: e.target.value })}
                                                    placeholder="Enter account number" required />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">IFSC Code <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.ifsc_code}
                                                    onChange={(e) => setBankData({ ...bankData, ifsc_code: e.target.value })}
                                                    placeholder="e.g. SBIN0001234" required />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Mode of Payment</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.mode_of_payment}
                                                    onChange={(e) => setBankData({ ...bankData, mode_of_payment: e.target.value })}
                                                    placeholder="e.g. NEFT / RTGS" />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">PAN Number</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.pan_no}
                                                    onChange={(e) => setBankData({ ...bankData, pan_no: e.target.value })}
                                                    placeholder="ABCDE1234F" />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">Aadhar Number <span className="text-danger">*</span></Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.aadhar_no}
                                                    onChange={(e) => setBankData({ ...bankData, aadhar_no: e.target.value })}
                                                    placeholder="Enter Aadhar Number" required />
                                            </Col>
                                        </Row>
                                        <Row className="mb-3">
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">PF Number</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.uan_no}
                                                    onChange={(e) => setBankData({ ...bankData, uan_no: e.target.value })}
                                                    placeholder="Enter PF Number" />
                                            </Col>
                                            <Col md={6}>
                                                <Form.Label className="form-label-custom">ESIC Number</Form.Label>
                                                <Form.Control type="text" className="form-control-custom" value={bankData.esic_no}
                                                    onChange={(e) => setBankData({ ...bankData, esic_no: e.target.value })}
                                                    placeholder="Enter ESIC" />
                                            </Col>
                                        </Row>
                                        
                                    </Form>
                                </Tab.Pane>

                                {/* Documents Tab */}
                                <Tab.Pane eventKey="documents" className="tab-pane-documents">
                                    {documents.length > 0 && (
                                        <>
                                            <div className="emp-section-label">Uploaded Documents</div>
                                            {documents.map((doc) => (
                                                <div key={doc.id} className="emp-doc-item">
                                                    <i className="fa fa-file-alt" style={{ color: '#2ece8a', fontSize: '15px' }}></i>
                                                    <span className="doc-name">{doc.document_type}</span>
                                                    {doc.is_signed && <span className="badge bg-success" style={{ fontSize: '11px' }}>Signed</span>}
                                                    <a href={doc.document_file} target="_blank" rel="noopener noreferrer">
                                                        <i className="fa fa-download me-1"></i>Download
                                                    </a>
                                                    <button
                                                        type="button"
                                                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                    >
                                                        <i className="fa fa-trash"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="emp-section-label" style={{ marginTop: '20px' }}>Upload New Document</div>
                                        </>
                                    )}

                                    <Form ref={documentsFormRef} onSubmit={handleUploadDocuments} noValidate>
                                        {documentRows.map((row, index) => (
                                            <div key={index} className="p-3 mb-3" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <Row className="align-items-end">
                                                    <Col md={5}>
                                                        <Form.Label className="form-label-custom">Document Type <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="text" className="form-control-custom" value={row.document_type}
                                                            onChange={(e) => handleDocumentRowChange(index, 'document_type', e.target.value)}
                                                            placeholder="e.g. Offer Letter, ID Proof" required data-doc-first="true" data-index={index} />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="form-label-custom">Document File <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control type="file" className="form-control-custom" style={{ padding: '6px 14px' }}
                                                            onChange={(e) => handleDocumentRowChange(index, 'document_file', e.target.files[0])} required={!row.document_file} />
                                                    </Col>
                                                    <Col md={2}>
                                                        <div className="form-check" style={{ marginBottom: '8px' }}>
                                                            <input type="checkbox" className="form-check-input" id={`docSigned_${index}`}
                                                                checked={row.is_signed}
                                                                onChange={(e) => handleDocumentRowChange(index, 'is_signed', e.target.checked)} data-doc-signed="true" data-index={index} />
                                                            <label className="form-check-label" htmlFor={`docSigned_${index}`} style={{ fontSize: '13px', color: '#4a5568' }}>
                                                                Signed
                                                            </label>
                                                        </div>
                                                    </Col>
                                                    <Col md={1} className="text-end d-flex gap-2 justify-content-end" style={{ marginBottom: '4px' }}>
                                                        {documentRows.length > 1 && (
                                                            <button type="button" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}
                                                                onClick={() => handleRemoveDocumentRow(index)} title="Remove Row">
                                                                <i className="fa fa-times"></i>
                                                            </button>
                                                        )}
                                                        <button type="button" style={{ background: '#d1fae5', color: '#10b981', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' }}
                                                            onClick={handleAddDocumentRow} title="Add Row">
                                                            <i className="fa fa-plus"></i>
                                                        </button>
                                                    </Col>
                                                </Row>
                                            </div>
                                        ))}
                                    </Form>
                                </Tab.Pane>

                                {/* Ledger Tab */}
                                <Tab.Pane eventKey="ledger" className="tab-pane-ledger">
                                    <Form ref={ledgerFormRef} onSubmit={handleSaveLedgers}>
                                        <div className="emp-section-label">Create Ledgers</div>
                                        
                                        {/* Ledger 1 */}
                                        <div className="p-3 mb-4" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <h6 className="mb-3" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Ledger 1</h6>
                                            <Row>
                                                <Col md={6}>
                                                    <Form.Label className="form-label-custom">Ledger Name <span className="text-danger">*</span></Form.Label>
                                                    <Form.Control type="text" className="form-control-custom" 
                                                        value={ledgerData.ledger1Name} 
                                                        onChange={(e) => setLedgerData({...ledgerData, ledger1Name: e.target.value})} 
                                                        required />
                                                </Col>
                                                <Col md={6}>
                                                    <Form.Label className="form-label-custom">Account Group <span className="text-danger">*</span></Form.Label>
                                                    <CustomSelect
                                                        options={accountGroups.map(g => ({ value: g.id, label: g.name }))}
                                                        value={accountGroups.find(g => g.id === ledgerData.ledger1Group) ? { value: ledgerData.ledger1Group, label: accountGroups.find(g => g.id === ledgerData.ledger1Group).name } : null}
                                                        onChange={(opt) => setLedgerData({...ledgerData, ledger1Group: opt ? opt.value : ''})}
                                                        placeholder="Select Group..."
                                                        styles={selectStyles}
                                                    />
                                                    <input type="text" style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} value={ledgerData.ledger1Group} required onChange={() => {}} />
                                                </Col>
                                            </Row>
                                        </div>

                                        {/* Ledger 2 */}
                                        <div className="p-3 mb-4" style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <h6 className="mb-3" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Ledger 2</h6>
                                            <Row>
                                                <Col md={6}>
                                                    <Form.Label className="form-label-custom">Ledger Name <span className="text-danger">*</span></Form.Label>
                                                    <Form.Control type="text" className="form-control-custom" 
                                                        value={ledgerData.ledger2Name} 
                                                        onChange={(e) => setLedgerData({...ledgerData, ledger2Name: e.target.value})} 
                                                        required />
                                                </Col>
                                                <Col md={6}>
                                                    <Form.Label className="form-label-custom">Account Group <span className="text-danger">*</span></Form.Label>
                                                    <CustomSelect
                                                        options={accountGroups.map(g => ({ value: g.id, label: g.name }))}
                                                        value={accountGroups.find(g => g.id === ledgerData.ledger2Group) ? { value: ledgerData.ledger2Group, label: accountGroups.find(g => g.id === ledgerData.ledger2Group).name } : null}
                                                        onChange={(opt) => setLedgerData({...ledgerData, ledger2Group: opt ? opt.value : ''})}
                                                        placeholder="Select Group..."
                                                        styles={selectStyles}
                                                    />
                                                    <input type="text" style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} value={ledgerData.ledger2Group} required onChange={() => {}} />
                                                </Col>
                                            </Row>
                                        </div>
                                    </Form>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer-custom">
                    <button type="button" className="btn-close-custom" onClick={onHide}>Close</button>
                    <button type="button" id="save-next-btn" className="btn-save-custom" onClick={handleSaveAndNext}>
                        {activeTab === 'ledger' ? 'Save Ledgers' : 'Save & Next'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default EmployeeDetailModal;
