import React, { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { Modal, Form, Nav, Tab, Row, Col, Table, Badge, Card, Spinner } from 'react-bootstrap';
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
} from '../../../../services/HRManagementService';
import {
    getUnits,
} from '../../../../services/PayheadService';
import { getAccountGroups, createLedger, updateLedger, getLedgers } from '../../../../services/FinanceService';

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

const CustomSelect = ({ options, value, onChange, placeholder, isMulti, required, styles, isDisabled, className, menuPortalTarget, menuPosition }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Select
            options={options}
            value={value}
            onChange={(val, action) => {
                // For multi-select: keep the menu open so the user can
                // continue searching and selecting more options.
                // For single-select: close the menu and advance focus.
                if (!isMulti) {
                    setIsOpen(false);
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
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            menuIsOpen={isOpen}
            placeholder={placeholder}
            isMulti={isMulti}
            required={required}
            styles={styles}
            isDisabled={isDisabled}
            className={className}
            classNamePrefix="react-select"
            isSearchable={true}
            menuPortalTarget={menuPortalTarget}
            menuPosition={menuPortalTarget ? 'fixed' : (menuPosition || 'absolute')}
        />
    );
};

const EmployeeReportModal = ({ show, onHide, candidateId, employeeId, employeeName, onUpdate }) => {
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
        } catch (error) {
            console.error('EmployeeDetailModal error:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load employee details' });
            onHide();
        } finally {
            setLoading(false);
        }
    }, [candidateId, onHide]);

    useEffect(() => {
        if (show && candidateId) {
            setActiveTab('basic_details');
            setEmploymentData({ ...EMPTY_EMPLOYMENT });
            setBankData({ ...EMPTY_BANK });
            setDocumentRows([{ ...EMPTY_DOCUMENT }]);
            setWorkExperiences([{ ...EMPTY_WORK_EXPERIENCE }]);
            setDocuments([]);
            setCandidate(null);
            originalLedgerDataRef.current = null;
            setOverrideDept(false);
            setReportingDeptId(null);
            fetchData();
        }
    }, [show, candidateId, fetchData]);

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
            setActiveTab('previous_experience');
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

    const handleSaveAndNext = (e) => {
        e.preventDefault();
        if (activeTab === 'basic_details') {
            if (basicDetailsFormRef.current && basicDetailsFormRef.current.reportValidity()) {
                handleSaveBasicDetails(e);
            }
        } else if (activeTab === 'employment' && employmentFormRef.current) {
            employmentFormRef.current.requestSubmit();
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
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
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
                    color: var(--cc-primary, #0a500f);
                    background: transparent;
                    border-bottom-color: var(--cc-primary, #0a500f);
                }
                .emp-tab-content { padding: 24px 28px; }
                
                .report-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                }
                .report-value {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f1f5f9;
                    min-height: 28px;
                }
                .report-section-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 2px solid #e2e8f0;
                }
            `}</style>
            
            <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="emp-custom-modal" backdrop="static">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="la la-user text-white" style={{ fontSize: '24px' }}></i>
                        </div>
                        <div>
                            <h4 className="mb-1" style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
                                Employee Report
                            </h4>
                            <p className="mb-0" style={{ fontSize: '13px', color: '#64748b' }}>
                                {employeeName ? `Viewing details for ${employeeName}` : 'View saved employee data'}
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <div className="modal-body-custom">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <div className="mt-2 text-muted">Loading data...</div>
                        </div>
                    ) : (
                        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                            <Nav variant="tabs" className="emp-custom-tabs">
                                <Nav.Item><Nav.Link eventKey="basic_details">Basic Details</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="employment">Employment</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="previous_experience">Experience</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="bank">Bank & Statutory</Nav.Link></Nav.Item>
                                <Nav.Item><Nav.Link eventKey="documents">Documents</Nav.Link></Nav.Item>
                            </Nav>

                            <Tab.Content className="emp-tab-content">
                                {/* Basic Details Tab */}
                                <Tab.Pane eventKey="basic_details">
                                    <div className="report-section-title">Personal Information</div>
                                    <Row>
                                        <Col md={3}>
                                            <div className="report-label">First Name</div>
                                            <div className="report-value">{basicDetailsData.first_name || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Last Name</div>
                                            <div className="report-value">{basicDetailsData.last_name || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Contact Number</div>
                                            <div className="report-value">{basicDetailsData.mobile_number || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Email</div>
                                            <div className="report-value">{basicDetailsData.email || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Date of Birth</div>
                                            <div className="report-value">{basicDetailsData.date_of_birth || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Gender</div>
                                            <div className="report-value">{basicDetailsData.gender || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Blood Group</div>
                                            <div className="report-value">{basicDetailsData.blood_group || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Qualification</div>
                                            <div className="report-value">{basicDetailsData.qualification || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Experience (Years)</div>
                                            <div className="report-value">{basicDetailsData.experience_years || '-'}</div>
                                        </Col>
                                        <Col md={9}>
                                            <div className="report-label">Address</div>
                                            <div className="report-value">{basicDetailsData.address || '-'}</div>
                                        </Col>
                                    </Row>
                                </Tab.Pane>

                                {/* Employment Tab */}
                                <Tab.Pane eventKey="employment">
                                    <div className="report-section-title">Employment Information</div>
                                    <Row>
                                        <Col md={3}>
                                            <div className="report-label">Employment No</div>
                                            <div className="report-value">{employmentData.employment_no || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Date of Joining</div>
                                            <div className="report-value">{employmentData.date_of_joining || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Employment Type</div>
                                            <div className="report-value">{employmentData.employment_type || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Work Mode</div>
                                            <div className="report-value">{employmentData.work_mode || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Probation Period</div>
                                            <div className="report-value">{employmentData.probation_period || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Notice Period</div>
                                            <div className="report-value">{employmentData.notice_period || '-'}</div>
                                        </Col>
                                        <Col md={3}>
                                            <div className="report-label">Reporting Manager</div>
                                            <div className="report-value">
                                                {managersForDropdown && managersForDropdown.length > 0 ? (managersForDropdown.find(m => m.id == employmentData.reporting_manager)?.full_name || '-') : '-'}
                                            </div>
                                        </Col>
                                    </Row>

                                    <div className="report-section-title mt-3">Role Details</div>
                                    <div className="table-responsive">
                                        <Table bordered hover size="sm">
                                            <thead>
                                                <tr>
                                                    <th className="bg-light">Role</th>
                                                    <th className="bg-light">Expiry Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {employmentData.role_expiries && employmentData.role_expiries.length > 0 ? (
                                                    employmentData.role_expiries.map((re, idx) => (
                                                        <tr key={idx}>
                                                            <td>{rolesList && rolesList.length > 0 ? (rolesList.find(r => r.id == re.role)?.name || re.role_name || '-') : '-'}</td>
                                                            <td>{re.expiry_date || '-'}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="2" className="text-center text-muted">No roles assigned</td></tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>

                                    <div className="report-section-title mt-3">Emergency Contacts</div>
                                    <Row>
                                        <Col md={4}>
                                            <div className="report-label">Contact 1 Name</div>
                                            <div className="report-value">{employmentData.ic1_name || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Relation</div>
                                            <div className="report-value">{employmentData.ic1_relation || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Phone Number</div>
                                            <div className="report-value">{employmentData.ic1_number || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Contact 2 Name</div>
                                            <div className="report-value">{employmentData.ic2_name || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Relation</div>
                                            <div className="report-value">{employmentData.ic2_relation || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Phone Number</div>
                                            <div className="report-value">{employmentData.ic2_number || '-'}</div>
                                        </Col>
                                    </Row>
                                    
                                    <div className="report-section-title mt-3">Health & Insurance</div>
                                    <Row>
                                        <Col md={6}>
                                            <div className="report-label">Health Card Validity</div>
                                            <div className="report-value">{employmentData.health_card_validity || '-'}</div>
                                        </Col>
                                        <Col md={6}>
                                            <div className="report-label">Health Insurance Validity</div>
                                            <div className="report-value">{employmentData.health_insurance_validity || '-'}</div>
                                        </Col>
                                    </Row>
                                </Tab.Pane>

                                {/* Previous Experience Tab */}
                                <Tab.Pane eventKey="previous_experience">
                                    <div className="report-section-title">Previous Work Experience</div>
                                    {workExperiences && workExperiences.length > 0 && workExperiences[0].company_name ? (
                                        workExperiences.map((exp, idx) => (
                                            <Card key={idx} className="mb-3 shadow-sm border">
                                                <Card.Body>
                                                    <Row>
                                                        <Col md={4}>
                                                            <div className="report-label">Company Name</div>
                                                            <div className="report-value border-0 mb-2">{exp.company_name || '-'}</div>
                                                        </Col>
                                                        <Col md={4}>
                                                            <div className="report-label">Designation</div>
                                                            <div className="report-value border-0 mb-2">{exp.designation || '-'}</div>
                                                        </Col>
                                                        <Col md={4}>
                                                            <div className="report-label">Location</div>
                                                            <div className="report-value border-0 mb-2">{exp.company_location || '-'}</div>
                                                        </Col>
                                                        <Col md={3}>
                                                            <div className="report-label">Start Date</div>
                                                            <div className="report-value border-0 mb-2">{exp.start_date || '-'}</div>
                                                        </Col>
                                                        <Col md={3}>
                                                            <div className="report-label">End Date</div>
                                                            <div className="report-value border-0 mb-2">{exp.end_date || '-'}</div>
                                                        </Col>
                                                        <Col md={6}>
                                                            <div className="report-label">Responsibilities</div>
                                                            <div className="report-value border-0 mb-2">{exp.responsibilities || '-'}</div>
                                                        </Col>
                                                    </Row>
                                                </Card.Body>
                                            </Card>
                                        ))
                                    ) : (
                                        <div className="text-muted text-center py-4">No previous experience recorded.</div>
                                    )}
                                </Tab.Pane>

                                {/* Bank Tab */}
                                <Tab.Pane eventKey="bank">
                                    <div className="report-section-title">Bank & Statutory Details</div>
                                    <Row>
                                        <Col md={4}>
                                            <div className="report-label">Bank Name</div>
                                            <div className="report-value">{bankData.bank_name || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Account No</div>
                                            <div className="report-value">{bankData.account_no || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">IFSC Code</div>
                                            <div className="report-value">{bankData.ifsc_code || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Mode of Payment</div>
                                            <div className="report-value">{bankData.mode_of_payment || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">PAN No</div>
                                            <div className="report-value">{bankData.pan_no || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">Aadhar No</div>
                                            <div className="report-value">{bankData.aadhar_no || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">UAN No</div>
                                            <div className="report-value">{bankData.uan_no || '-'}</div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="report-label">ESIC No</div>
                                            <div className="report-value">{bankData.esic_no || '-'}</div>
                                        </Col>
                                    </Row>
                                </Tab.Pane>

                                {/* Documents Tab */}
                                <Tab.Pane eventKey="documents">
                                    <div className="report-section-title">Uploaded Documents</div>
                                    <div className="table-responsive">
                                        <Table bordered hover>
                                            <thead>
                                                <tr>
                                                    <th className="bg-light">Document Type</th>
                                                    <th className="bg-light">Signed</th>
                                                    <th className="bg-light text-center">View</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {documents && documents.length > 0 ? (
                                                    documents.map((doc, idx) => (
                                                        <tr key={idx}>
                                                            <td className="align-middle">{doc.document_type || '-'}</td>
                                                            <td className="align-middle">
                                                                {doc.is_signed ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>}
                                                            </td>
                                                            <td className="align-middle text-center">
                                                                {doc.document_file && (
                                                                    <a href={doc.document_file} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary py-1 px-3">
                                                                        <i className="fa fa-external-link me-1"></i> View
                                                                    </a>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="3" className="text-center text-muted py-3">No documents uploaded.</td></tr>
                                                )}
                                            </tbody>
                                        </Table>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default EmployeeReportModal;
