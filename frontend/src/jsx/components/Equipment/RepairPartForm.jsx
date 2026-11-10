import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Button, Form, Row, Col } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import swal from 'sweetalert';
import { 
    getTypeNames, 
    getCategoryNames,
    getSubCategoryNames,
    getEmployeesByDepartment,
    getBoardOfDirectors,
    createRepairPart,
    updateRepairPart
} from '../../../services/MachineManagementService';
import { getTableConfiguration } from '../../../services/ConfigurationService';
import { getDepartments, getUsers, getEmployees } from '../../../services/HRManagementService';
import LogisticsService from '../../../services/LogisticsService';
import { getStockItems } from '../../../services/InventoryService';
import { useEnterTraversal } from '../../../hooks/useEnterTraversal';
import Select from 'react-select';

const CustomSelect = ({ name, value, onChange, options, placeholder, autoFocus, onFocus, onKeyDown }) => {
    let selectedOption = null;
    for (const opt of options) {
        if (opt.options) {
            const found = opt.options.find(o => String(o.value) === String(value));
            if (found) { selectedOption = found; break; }
        } else if (String(opt.value) === String(value)) {
            selectedOption = opt;
            break;
        }
    }

    const handleSelectChange = (selected) => {
        onChange({ target: { name, value: selected ? selected.value : '' } });
    };

    return (
        <Select
            name={name}
            value={selectedOption}
            onChange={handleSelectChange}
            options={options}
            placeholder={placeholder}
            autoFocus={autoFocus}
            openMenuOnFocus={true}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            className="react-select-container"
            classNamePrefix="react-select"
            isClearable
        />
    );
};

// BoardOfDirectors records don't have a fixed field name for designation across
// setups, so check the common variants (mirrors CommentPattern.jsx's BOD handling)
const getBodDesignationLabel = (bod) =>
    bod.designation_name ||
    bod.designation_title ||
    bod.designation?.name ||
    'BOD';

// Maps a raw BoardOfDirectors record to the {value, label, user_id} shape the
// employee lists in this form already expect. BoardOfDirectorSerializer returns
// the linked account as a plain FK id under `user` (null if the BOD has no login).
const mapBodToOption = (bod) => ({
    value: String(bod.id),
    label: `${bod.name} (${getBodDesignationLabel(bod)})`,
    user_id: bod.user != null ? String(bod.user) : null,
    is_bod: true,
    level: 'BOD',
    designation_level: 'BOD'
});

const RepairPartForm = () => {
    // Dropdown options
    const [typeNames, setTypeNames] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [users, setUsers] = useState([]);

    // Search state for departments and employees
    const [deptSearch, setDeptSearch] = useState('');
    const [empSearch, setEmpSearch] = useState('');
    
    // States for the Assigned Decision Maker selection box
    const [decisionMakerPatternType, setDecisionMakerPatternType] = useState('');
    const [dmDeptSearch, setDmDeptSearch] = useState('');
    const [dmEmpSearch, setDmEmpSearch] = useState('');
    const [decisionMakerEmployees, setDecisionMakerEmployees] = useState([]);
    const [decisionMakerDepartments, setDecisionMakerDepartments] = useState([]);

    // Filtered options based on cascading logic
    const [filteredCategories, setFilteredCategories] = useState([]);
    const [filteredSubCategories, setFilteredSubCategories] = useState([]);

    const navigate = useNavigate();
    const location = useLocation();
    const editData = location.state?.editData;

    const [formConfig, setFormConfig] = useState(null);

    // Refs for scrolling/focusing to a field when validation fails
    const fieldRefs = useRef({});
    const setFieldRef = (key) => (el) => { fieldRefs.current[key] = el; };
    const focusField = (key) => {
        const el = fieldRefs.current[key];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = el.querySelector('input, select, textarea, [tabindex]');
        if (focusable) {
            setTimeout(() => focusable.focus(), 300);
        }
    };

    // Remembers which employees were selected for each targeted-department combination,
    // so switching departments back and forth (without submitting) restores the prior pick
    const employeeSelectionsRef = useRef({});

    const [formData, setFormData] = useState({
        machine_or_vehicle: '',
        typename: '',
        category: '',
        subcategory: '',
        department: '',
        part_name: '',
        part_code: '',
        cutoff_days: '',
        narration: '',
        pattern_type: '',
        targeted_departments: [],
        employees: [],
        decision_maker: ''
    });

    useEffect(() => {
        if (editData) {
            let machine_or_vehicle = '';
            if (editData.machine) {
                machine_or_vehicle = `machine_${editData.machine}`;
            } else if (editData.vehicle) {
                machine_or_vehicle = `vehicle_${editData.vehicle}`;
            }
            
            let empArray = [];
            if (editData.employees) {
                try {
                    empArray = typeof editData.employees === 'string' ? JSON.parse(editData.employees) : editData.employees;
                } catch (e) {
                    empArray = [];
                }
            }

            let targetedDeptArray = [];
            if (editData.targeted_departments) {
                try {
                    targetedDeptArray = typeof editData.targeted_departments === 'string' ? JSON.parse(editData.targeted_departments) : editData.targeted_departments;
                } catch (e) {
                    targetedDeptArray = [];
                }
            }

            let dmDeptArray = [];
            if (editData.decision_maker_departments) {
                try {
                    dmDeptArray = typeof editData.decision_maker_departments === 'string' ? JSON.parse(editData.decision_maker_departments) : editData.decision_maker_departments;
                } catch (e) {
                    dmDeptArray = [];
                }
            }

            const targetedDeptStrArray = Array.isArray(targetedDeptArray) ? targetedDeptArray.map(String) : [];
            const empStrArray = Array.isArray(empArray) ? empArray.map(String) : [];
            const dmDeptStrArray = Array.isArray(dmDeptArray) ? dmDeptArray.map(String) : [];

            // Seed the per-department employee memory so switching away and back restores this
            const initialDeptKey = targetedDeptStrArray.join(',');
            if (initialDeptKey) {
                employeeSelectionsRef.current[initialDeptKey] = empStrArray;
            }

            if (editData.decision_maker_pattern_type) {
                setDecisionMakerPatternType(editData.decision_maker_pattern_type);
            }
            if (dmDeptStrArray.length > 0) {
                setDecisionMakerDepartments(dmDeptStrArray);
            }

            setFormData({
                machine_or_vehicle: machine_or_vehicle,
                typename: String(editData.typename || ''),
                category: String(editData.category || ''),
                subcategory: String(editData.subcategory || ''),
                department: String(editData.department || ''),
                part_name: editData.part_name || '',
                part_code: editData.part_code || '',
                cutoff_days: editData.cutoff_days || '',
                narration: editData.narration || '',
                pattern_type: editData.pattern_type || '',
                targeted_departments: targetedDeptStrArray,
                employees: empStrArray,
                decision_maker: editData.decision_maker ? String(editData.decision_maker) : ''
            });
        } else if (location.state?.prefilledMachineId) {
            setFormData(prev => ({
                ...prev,
                machine_or_vehicle: `machine_${location.state.prefilledMachineId}`
            }));
        }
    }, [editData, location.state]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [typesRes, catsRes, subCatsRes, deptsRes, vehiclesRes, stockItemsRes, configRes, usersRes, allEmpsRes] = await Promise.all([
                    getTypeNames(),
                    getCategoryNames(),
                    getSubCategoryNames(),
                    getDepartments(),
                    LogisticsService.getVehicles().catch(() => []),
                    getStockItems({ from_stock_definition: 'true' }).catch(() => []),
                    getTableConfiguration('machine_app_repairpart', 'RepairPartForm').catch(() => null),
                    getUsers().catch(() => []),
                    getEmployees().catch(() => [])
                ]);
                setTypeNames(typesRes);
                setCategories(catsRes);
                setSubCategories(subCatsRes);
                setDepartments(deptsRes);
                setVehicles(vehiclesRes.data ? (vehiclesRes.data.results || vehiclesRes.data) : (vehiclesRes.results || vehiclesRes));
                setStockItems(stockItemsRes.results || stockItemsRes.data || stockItemsRes);
                setFormConfig(configRes?.settings || {});
                setUsers(usersRes.results || usersRes.data || usersRes || []);
                setAllEmployees(Array.isArray(allEmpsRes) ? allEmpsRes : (allEmpsRes?.results || []));
            } catch (err) {
                console.error("Error loading initial data", err);
            }
        };
        loadInitialData();
    }, []);

    // Handle cascading Type -> Category
    useEffect(() => {
        if (formData.typename) {
            const filtered = categories.filter(c => String(c.typename) === String(formData.typename));
            setFilteredCategories(filtered);
            setFormData(prev => {
                if (editData && String(prev.category) === String(editData.category) && String(prev.typename) === String(editData.typename)) {
                    return prev;
                }
                return { ...prev, category: '', subcategory: '' };
            });
        } else {
            setFilteredCategories([]);
        }
    }, [formData.typename, categories, editData]);

    // Handle cascading Category -> SubCategory
    useEffect(() => {
        if (formData.category) {
            const filtered = subCategories.filter(sc => String(sc.categoryname) === String(formData.category));
            setFilteredSubCategories(filtered);
            setFormData(prev => {
                if (editData && String(prev.subcategory) === String(editData.subcategory) && String(prev.category) === String(editData.category)) {
                    return prev;
                }
                return { ...prev, subcategory: '' };
            });
        } else {
            setFilteredSubCategories([]);
        }
    }, [formData.category, subCategories, editData]);

    // Fetch employees based on targeted_departments
    useEffect(() => {
        const loadEmployees = async () => {
            if (formData.pattern_type === 'BOD') {
                try {
                    const bods = await getBoardOfDirectors();
                    setEmployees(bods.map(mapBodToOption));
                } catch (err) {
                    console.error("Error fetching Board of Directors", err);
                }
            } else if (['Assign', 'HOD'].includes(formData.pattern_type)) {
                try {
                    const emps = await getEmployeesByDepartment('all', formData.pattern_type);
                    setEmployees(emps);
                } catch (err) {
                    console.error("Error fetching employees", err);
                }
            } else if (formData.targeted_departments.length > 0) {
                try {
                    // The "BOD" department is a stand-in for the real BoardOfDirectors
                    // table, so its members come from there instead of the normal
                    // employee/department mapping.
                    const bodDepartmentIds = departments
                        .filter(d => (d.name || '').trim().toUpperCase() === 'BOD')
                        .map(d => String(d.id));
                    const nonBodDepts = formData.targeted_departments.filter(id => !bodDepartmentIds.includes(String(id)));
                    const bodSelected = formData.targeted_departments.some(id => bodDepartmentIds.includes(String(id)));

                    const [emps, bods] = await Promise.all([
                        nonBodDepts.length > 0 ? getEmployeesByDepartment(nonBodDepts.join(','), formData.pattern_type) : Promise.resolve([]),
                        bodSelected ? getBoardOfDirectors() : Promise.resolve([])
                    ]);

                    setEmployees([...(emps || []), ...bods.map(mapBodToOption)]);
                } catch (err) {
                    console.error("Error fetching employees", err);
                }
            } else {
                setEmployees([]);
                if (formData.employees.length > 0) {
                    setFormData(prev => ({ ...prev, employees: [] }));
                }
            }
        };
        loadEmployees();
    }, [formData.targeted_departments, formData.pattern_type, departments]);

    // Fetch employees for Decision Maker based on decisionMakerDepartments
    useEffect(() => {
        const loadDmEmployees = async () => {
            if (decisionMakerPatternType === 'BOD') {
                try {
                    const bods = await getBoardOfDirectors();
                    setDecisionMakerEmployees(bods.map(mapBodToOption));
                } catch (err) {
                    console.error("Error fetching Board of Directors", err);
                }
            } else if (['Assign', 'HOD'].includes(decisionMakerPatternType)) {
                try {
                    const emps = await getEmployeesByDepartment('all', decisionMakerPatternType);
                    setDecisionMakerEmployees(emps);
                } catch (err) {
                    console.error("Error fetching decision maker employees", err);
                }
            } else if (decisionMakerDepartments.length > 0) {
                try {
                    // Same rule as the responders list: the "BOD" department pulls
                    // its members from the real BoardOfDirectors table.
                    const bodDepartmentIds = departments
                        .filter(d => (d.name || '').trim().toUpperCase() === 'BOD')
                        .map(d => String(d.id));
                    const nonBodDepts = decisionMakerDepartments.filter(id => !bodDepartmentIds.includes(String(id)));
                    const bodSelected = decisionMakerDepartments.some(id => bodDepartmentIds.includes(String(id)));

                    const [emps, bods] = await Promise.all([
                        nonBodDepts.length > 0 ? getEmployeesByDepartment(nonBodDepts.join(','), decisionMakerPatternType) : Promise.resolve([]),
                        bodSelected ? getBoardOfDirectors() : Promise.resolve([])
                    ]);

                    setDecisionMakerEmployees([...(emps || []), ...bods.map(mapBodToOption)]);
                } catch (err) {
                    console.error("Error fetching decision maker employees", err);
                }
            } else {
                setDecisionMakerEmployees([]);
            }
        };
        loadDmEmployees();
    }, [decisionMakerDepartments, decisionMakerPatternType, departments]);

    // Level-wise hierarchy helper (L1 is highest rank, higher rank = strictly lower number)
    const getEmpLevel = useCallback((emp) => {
        if (!emp) return null;
        if (emp.level != null && !isNaN(emp.level)) return Number(emp.level);
        if (emp.designation_level != null && !isNaN(emp.designation_level)) return Number(emp.designation_level);
        if (emp.dept_designation && typeof emp.dept_designation === 'object' && emp.dept_designation.level != null) {
            return Number(emp.dept_designation.level);
        }
        return null;
    }, []);

    // Calculate highest ranking level among currently selected targeted employees
    const highestTargetRank = useMemo(() => {
        if (formData.pattern_type === 'BOD') return 'BOD';

        const hasBod = formData.employees.some(id => {
            const inCur = employees.find(e => String(e.value) === String(id));
            return inCur?.is_bod;
        });
        if (hasBod) return 'BOD';

        const levels = [];
        formData.employees.forEach(id => {
            const inCur = employees.find(e => String(e.value) === String(id));
            let lvl = getEmpLevel(inCur);
            if (lvl == null) {
                const inAll = allEmployees.find(e => String(e.id) === String(id));
                lvl = getEmpLevel(inAll);
            }
            if (lvl != null && !isNaN(lvl)) {
                levels.push(Number(lvl));
            }
        });

        if (levels.length === 0) return null;
        return Math.min(...levels);
    }, [formData.pattern_type, formData.employees, employees, allEmployees, getEmpLevel]);

    // Check if candidate is strictly higher level than the selected targeted employees
    const isHigherImplementator = useCallback((candidateEmp) => {
        if (!candidateEmp) return false;

        // Cannot supervise / implement over yourself (exclude self by employee value)
        if (formData.employees.some(id => String(id) === String(candidateEmp.value))) {
            return false;
        }

        // Cannot implement over yourself (exclude self by linked user account)
        if (candidateEmp.user_id) {
            const isSameUserAsSelected = formData.employees.some(id => {
                const empInList = employees.find(e => String(e.value) === String(id));
                const empInAll = allEmployees.find(e => String(e.id) === String(id));
                const selUserId = empInList?.user_id || (empInAll?.user ? String(empInAll.user) : null);
                return selUserId && String(selUserId) === String(candidateEmp.user_id);
            });
            if (isSameUserAsSelected) return false;
        }

        // BOD is top authority across the company
        const isCandBod = candidateEmp.is_bod || decisionMakerPatternType === 'BOD';
        if (isCandBod) {
            return true;
        }

        // If targeted selection is BOD, regular employees cannot implement over BOD
        if (highestTargetRank === 'BOD' || formData.pattern_type === 'BOD') {
            return false;
        }

        // Resolve candidate level
        let cLevel = getEmpLevel(candidateEmp);
        if (cLevel == null) {
            const empInAll = allEmployees.find(e => 
                String(e.id) === String(candidateEmp.value) || 
                (e.user && String(e.user) === String(candidateEmp.user_id))
            );
            cLevel = getEmpLevel(empInAll);
        }

        if (highestTargetRank == null) {
            return cLevel != null;
        }

        if (cLevel == null) return false;

        // Numerical rank rule: Level 1 is highest rank.
        // Higher rank = strictly lower number. Peers (equal level) and juniors (higher number) are excluded.
        return Number(cLevel) < Number(highestTargetRank);
    }, [formData.employees, formData.pattern_type, employees, allEmployees, decisionMakerPatternType, highestTargetRank, getEmpLevel]);

    // Auto-prune decision_maker if targeted employees change and current decision_maker is no longer higher level
    useEffect(() => {
        if (formData.decision_maker) {
            if (formData.employees.length === 0) {
                setFormData(prev => ({ ...prev, decision_maker: '' }));
                return;
            }
            const cand = decisionMakerEmployees.find(e => String(e.user_id) === String(formData.decision_maker)) ||
                allEmployees.find(e => String(e.user) === String(formData.decision_maker));
            if (cand) {
                const formatted = cand.value ? cand : {
                    value: String(cand.id),
                    user_id: String(cand.user),
                    level: getEmpLevel(cand),
                    is_bod: false
                };
                if (!isHigherImplementator(formatted)) {
                    setFormData(prev => ({ ...prev, decision_maker: '' }));
                }
            }
        }
    }, [formData.employees, highestTargetRank, isHigherImplementator, decisionMakerEmployees, allEmployees, getEmpLevel]);

    const eligibleDmEmployees = useMemo(() => {
        if (formData.employees.length === 0) return [];
        return decisionMakerEmployees.filter(isHigherImplementator);
    }, [decisionMakerEmployees, isHigherImplementator, formData.employees.length]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (type === 'checkbox' || type === 'radio') {
            if (name === 'targeted_departments') {
                // Remember the currently selected employees against the department(s) being left
                const oldDeptKey = formData.targeted_departments.join(',');
                if (oldDeptKey) {
                    employeeSelectionsRef.current[oldDeptKey] = formData.employees;
                }

                const newDepartments = formData.pattern_type === 'Single'
                    ? [value]
                    : (checked
                        ? [...formData.targeted_departments, value]
                        : formData.targeted_departments.filter(item => item !== value));

                // Restore any previously selected employees for the department(s) being entered
                const newDeptKey = newDepartments.join(',');
                const restoredEmployees = employeeSelectionsRef.current[newDeptKey] || [];

                setFormData({ ...formData, targeted_departments: newDepartments, employees: restoredEmployees });
            } else if (name === 'employees') {
                const updated = formData.pattern_type === 'Single'
                    ? [value]
                    : (checked
                        ? [...formData.employees, value]
                        : formData.employees.filter(item => item !== value));

                // Keep the per-department memory in sync as the user picks employees
                const deptKey = formData.targeted_departments.join(',');
                employeeSelectionsRef.current[deptKey] = updated;

                setFormData({ ...formData, employees: updated });
            } else if (name === 'decision_maker_departments') {
                const newDmDepartments = decisionMakerPatternType === 'Single'
                        ? [value]
                        : (checked
                            ? [...decisionMakerDepartments, value]
                            : decisionMakerDepartments.filter(item => item !== value));
                setDecisionMakerDepartments(newDmDepartments);
            } else if (name === 'decision_maker_employee') {
                // We receive the user_id as the value from the radio button
                setFormData({ ...formData, decision_maker: value });
            } else if (name === 'pattern_type') {
                employeeSelectionsRef.current = {};
                setFormData({ ...formData, pattern_type: value, targeted_departments: [], employees: [] });
            } else if (name === 'decision_maker_pattern_type') {
                setDecisionMakerPatternType(value);
                setDecisionMakerDepartments([]);
                setFormData({ ...formData, decision_maker: '' });
            }
        } else if (type === 'select-multiple') {
            const options = Array.from(e.target.selectedOptions, option => option.value);
            setFormData({ ...formData, [name]: options });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleEmployeeSelect = (e) => {
        if (formData.pattern_type === 'Single') {
            setFormData({ ...formData, employees: [e.target.value] });
        } else {
            const options = Array.from(e.target.selectedOptions, option => option.value);
            setFormData({ ...formData, employees: options });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate mandatory fields before proceeding
        const requiredFields = [
            { key: 'machine_or_vehicle', configKey: 'machine', label: 'Select Item' },
            { key: 'typename', configKey: 'typename', label: 'Type Name' },
            { key: 'category', configKey: 'category', label: 'Category' },
            { key: 'subcategory', configKey: 'subcategory', label: 'Subcategory' },
            { key: 'part_code', configKey: 'part_code', label: 'Part Code' },
            { key: 'pattern_type', configKey: 'pattern_type', label: 'Pattern Type' },
            { key: 'employees', configKey: 'employees', label: 'Employees', isArray: true },
        ];

        for (const field of requiredFields) {
            const isVisible = !formConfig || formConfig[field.configKey]?.show !== false;
            const isEmpty = field.isArray ? formData[field.key].length === 0 : !formData[field.key];
            if (isVisible && isEmpty) {
                swal("Warning", `${field.label} is mandatory`, "warning").then(() => {
                    focusField(field.key);
                });
                return;
            }
        }

        if (formData.decision_maker) {
            if (formData.employees.length === 0) {
                swal("Warning", "Please select targeted employees before assigning an implementator", "warning");
                return;
            }
            const cand = decisionMakerEmployees.find(e => String(e.user_id) === String(formData.decision_maker)) ||
                allEmployees.find(e => String(e.user) === String(formData.decision_maker));
            if (cand) {
                const formatted = cand.value ? cand : {
                    value: String(cand.id),
                    user_id: String(cand.user),
                    level: getEmpLevel(cand),
                    is_bod: false
                };
                if (!isHigherImplementator(formatted)) {
                    swal("Warning", "The assigned implementator must be of a higher level than the selected employee(s).", "warning");
                    return;
                }
            }
        }

        try {
            const payload = { ...formData };
            if (payload.machine_or_vehicle.startsWith('machine_')) {
                payload.machine = payload.machine_or_vehicle.replace('machine_', '');
            } else if (payload.machine_or_vehicle.startsWith('vehicle_')) {
                payload.vehicle = payload.machine_or_vehicle.replace('vehicle_', '');
            }
            delete payload.machine_or_vehicle;

            if (payload.department === '') {
                payload.department = null;
            }
            if (payload.decision_maker === '') {
                payload.decision_maker = null;
            }

            if (payload.cutoff_days === '') {
                payload.cutoff_days = null;
            } else {
                payload.cutoff_days = parseInt(payload.cutoff_days, 10);
            }

            payload.decision_maker_pattern_type = decisionMakerPatternType;
            payload.decision_maker_departments = decisionMakerDepartments;

            if (editData) {
                await updateRepairPart(editData.id, payload);
                swal("Success", "Repair Part Updated Successfully", "success").then(() => {
                    navigate('/repair-part-list');
                });
            } else {
                await createRepairPart(payload);
                swal("Success", "Repair Part Created Successfully", "success").then(() => {
                    navigate('/repair-part-list');
                });
            }
            setFormData({
                machine_or_vehicle: '',
                typename: '',
                category: '',
                subcategory: '',
                department: '',
                part_name: '',
                part_code: '',
                cutoff_days: '',
                narration: '',
                pattern_type: '',
                targeted_departments: [],
                employees: [],
                decision_maker: ''
            });
            setDecisionMakerPatternType('');
            setDecisionMakerDepartments([]);
        } catch (err) {
            const errorMsg = err.response?.data?.machine?.[0] || err.response?.data?.vehicle?.[0] || "Failed to create/update repair part";
            swal("Error", errorMsg, "error");
        }
    };

    const { handleFormKeyDown, handleSelectFocus, handleSelectKeyDown } = useEnterTraversal('.repair-part-form-container');

    const machineOptions = [
        {
            label: 'Machines',
            options: (Array.isArray(stockItems) ? stockItems : []).map(s => ({ value: `machine_${s.id}`, label: s.name }))
        }
    ];

    return (
        <Card className="repair-part-form-container">
            <style>{`
                .repair-part-form-container .form-label {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                    color: #64748b;
                    font-size: 0.9rem;
                }
                .repair-part-form-container .form-control {
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 0.9rem;
                    color: #1e293b;
                    background: #fff;
                    transition: all 0.2s ease;
                }
                .repair-part-form-container .form-control:focus {
                    border-color: #0a500f;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .repair-part-form-container .react-select__control {
                    border: 1.5px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    min-height: 43px;
                    box-shadow: none !important;
                    transition: all 0.2s ease;
                }
                .repair-part-form-container .react-select__control--is-focused {
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                }
                .repair-part-form-container .react-select__value-container {
                    padding: 2px 12px;
                }
                .repair-part-form-container .react-select__placeholder {
                    color: #94a3b8;
                    font-size: 0.9rem;
                }
                .repair-part-form-container .react-select__single-value {
                    color: #1e293b;
                    font-size: 0.9rem;
                }
            `}</style>
            <Card.Header>
                <Card.Title>Create Repair Part</Card.Title>
            </Card.Header>
            <Card.Body>
                <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <Row className="mb-3">
                        {(!formConfig || formConfig.machine?.show !== false || formConfig.vehicle?.show !== false) && (
                        <Col md={3} ref={setFieldRef('machine_or_vehicle')}>
                            <Form.Group>
                                <Form.Label>Select Item</Form.Label>
                                <CustomSelect 
                                    name="machine_or_vehicle" 
                                    value={formData.machine_or_vehicle} 
                                    onChange={handleChange} 
                                    options={machineOptions}
                                    placeholder="Select Item"
                                    autoFocus 
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.typename?.show !== false) && (
                        <Col md={3} ref={setFieldRef('typename')}>
                            <Form.Group>
                                <Form.Label>Type Name</Form.Label>
                                <CustomSelect 
                                    name="typename" 
                                    value={formData.typename} 
                                    onChange={handleChange} 
                                    options={typeNames.map(t => ({ value: String(t.id), label: t.typename }))}
                                    placeholder="Select Type Name"
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.category?.show !== false) && (
                        <Col md={3} ref={setFieldRef('category')}>
                            <Form.Group>
                                <Form.Label>Category</Form.Label>
                                <CustomSelect 
                                    name="category" 
                                    value={formData.category} 
                                    onChange={handleChange} 
                                    options={filteredCategories.map(c => ({ value: String(c.id), label: c.categoryname }))}
                                    placeholder="---------"
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.subcategory?.show !== false) && (
                        <Col md={3} ref={setFieldRef('subcategory')}>
                            <Form.Group>
                                <Form.Label>Subcategory</Form.Label>
                                <CustomSelect 
                                    name="subcategory" 
                                    value={formData.subcategory} 
                                    onChange={handleChange} 
                                    options={filteredSubCategories.map(sc => ({ value: String(sc.id), label: sc.subcategoryname }))}
                                    placeholder="---------"
                                    onFocus={handleSelectFocus}
                                    onKeyDown={handleSelectKeyDown}
                                />
                            </Form.Group>
                        </Col>
                        )}
                    </Row>

                    <Row className="mb-3">
                        {(!formConfig || formConfig.part_code?.show !== false) && (
                        <Col md={4} ref={setFieldRef('part_code')}>
                            <Form.Group>
                                <Form.Label>Part Code</Form.Label>
                                <Form.Control type="text" name="part_code" placeholder="Enter part code" value={formData.part_code} onChange={handleChange} required />
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.cutoff_days?.show !== false) && (
                        <Col md={4} ref={setFieldRef('cutoff_days')}>
                            <Form.Group>
                                <Form.Label>Cutoff Days</Form.Label>
                                <Form.Control type="number" min="0" name="cutoff_days" placeholder="Enter cutoff days" value={formData.cutoff_days} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.narration?.show !== false) && (
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Narration</Form.Label>
                                <Form.Control as="textarea" rows={2} name="narration" placeholder="Enter narration..." value={formData.narration} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        )}
                    </Row>

                    {(!formConfig || formConfig.pattern_type?.show !== false) && (
                    <>
                    <h5 className="mt-4 mb-3">Pattern Type</h5>
                    <Form.Group className="mb-4" ref={setFieldRef('pattern_type')}>
                        <div className="d-flex flex-wrap gap-3">
                            {['Single', 'Multiple', 'HOD', 'BOD', 'Assign'].map(type => (
                                <Form.Check 
                                    key={type || 'default'}
                                    type="radio"
                                    id={`pattern-${type || 'default'}`}
                                    name="pattern_type"
                                    value={type}
                                    label={type || '---------'}
                                    checked={formData.pattern_type === type}
                                    onChange={handleChange}
                                />
                            ))}
                        </div>
                    </Form.Group>
                    </>
                    )}

                    <Row className="mb-4">
                        {(!formConfig || formConfig.targeted_departments?.show !== false) && (
                        <Col md={6}>
                            <Form.Group style={['Assign', 'HOD', 'BOD'].includes(formData.pattern_type) ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                                <Form.Label>Targeted Departments</Form.Label>
                                <div style={{ border: '1px solid #ced4da', padding: '10px', borderRadius: '4px' }}>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Search departments..." 
                                        value={deptSearch} 
                                        onChange={(e) => setDeptSearch(e.target.value)}
                                        className="mb-2"
                                        disabled={['Assign', 'HOD', 'BOD'].includes(formData.pattern_type)}
                                    />
                                    <div style={{ height: '160px', overflowY: 'auto' }}>
                                        {departments.filter(d => (d.name || '').toLowerCase().includes(deptSearch.toLowerCase())).map(d => (
                                            <Form.Check 
                                                key={d.id}
                                                type={formData.pattern_type === 'Single' ? 'radio' : 'checkbox'}
                                                id={`dept-${d.id}`}
                                                name="targeted_departments"
                                                value={String(d.id)}
                                                label={d.name}
                                                checked={formData.targeted_departments.includes(String(d.id))}
                                                onChange={handleChange}
                                                disabled={['Assign', 'HOD', 'BOD'].includes(formData.pattern_type)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </Form.Group>
                        </Col>
                        )}
                        {(!formConfig || formConfig.employees?.show !== false) && (
                        <Col md={6} ref={setFieldRef('employees')}>
                            <Form.Group>
                                <Form.Label>Employees</Form.Label>
                                <div style={{ border: '1px solid #ced4da', padding: '10px', borderRadius: '4px' }}>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Search employees..." 
                                        value={empSearch} 
                                        onChange={(e) => setEmpSearch(e.target.value)}
                                        className="mb-2"
                                    />
                                    <div style={{ height: '160px', overflowY: 'auto' }}>
                                        {employees.length > 0 ? employees.filter(emp => (emp.label || '').toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
                                            <Form.Check 
                                                key={emp.value}
                                                type={formData.pattern_type === 'Single' ? 'radio' : 'checkbox'}
                                                id={`emp-${emp.value}`}
                                                name="employees"
                                                value={String(emp.value)}
                                                label={emp.label}
                                                checked={formData.employees.includes(String(emp.value))}
                                                onChange={handleChange}
                                            />
                                        )) : (
                                            <div className="text-muted">{['Assign', 'HOD', 'BOD'].includes(formData.pattern_type) ? 'Loading employees...' : 'Select department(s) to display employees.'}</div>
                                        )}
                                    </div>
                                </div>
                            </Form.Group>
                        </Col>
                        )}
                    </Row>

                    <Row className="mb-4">
                        <Col md={12} className="mb-2">
                            <Form.Label className="mb-0">Assigned For Making Implementations <span className="text-muted" style={{ fontSize: '11px' }}>(Optional)</span></Form.Label>
                            <Form.Text className="text-muted d-block mb-2">
                                If assigned, only this user can make the final admin implementations on repair requests for this part.
                            </Form.Text>
                            
                            <Form.Group className="mb-3 mt-2">
                                <Form.Label style={{ fontSize: '13px' }} className="fw-bold">Pattern Type</Form.Label>
                                <div className="d-flex flex-wrap gap-3">
                                    {['Single', 'Multiple', 'HOD', 'BOD', 'Assign'].map(type => (
                                        <Form.Check 
                                            key={`dm-pattern-${type || 'default'}`}
                                            type="radio"
                                            id={`dm-pattern-${type || 'default'}`}
                                            name="decision_maker_pattern_type"
                                            value={type}
                                            label={type || '---------'}
                                            checked={decisionMakerPatternType === type}
                                            onChange={handleChange}
                                        />
                                    ))}
                                </div>
                            </Form.Group>
                        </Col>
                        
                        <Col md={6} ref={setFieldRef('decision_maker_departments')}>
                            <Form.Group style={(!decisionMakerPatternType || ['Assign', 'HOD', 'BOD'].includes(decisionMakerPatternType)) ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                                <Form.Label>Implementator Department(s)</Form.Label>
                                <div style={{ border: '1px solid #ced4da', padding: '10px', borderRadius: '4px' }}>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Search departments..." 
                                        value={dmDeptSearch} 
                                        onChange={(e) => setDmDeptSearch(e.target.value)}
                                        className="mb-2"
                                        disabled={!decisionMakerPatternType || ['Assign', 'HOD', 'BOD'].includes(decisionMakerPatternType)}
                                    />
                                    <div style={{ height: '160px', overflowY: 'auto' }}>
                                        {departments.filter(d => (d.name || '').toLowerCase().includes(dmDeptSearch.toLowerCase())).map(d => (
                                            <Form.Check 
                                                key={`dm-dept-${d.id}`}
                                                type={decisionMakerPatternType === 'Single' ? 'radio' : 'checkbox'}
                                                id={`dm-dept-${d.id}`}
                                                name="decision_maker_departments"
                                                value={String(d.id)}
                                                label={d.name}
                                                checked={decisionMakerDepartments.includes(String(d.id))}
                                                onChange={handleChange}
                                                disabled={!decisionMakerPatternType || ['Assign', 'HOD', 'BOD'].includes(decisionMakerPatternType)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </Form.Group>
                        </Col>

                        <Col md={6} ref={setFieldRef('decision_maker')}>
                            <Form.Group>
                                <Form.Label>Implementator Employee</Form.Label>
                                <div style={{ border: '1px solid #ced4da', padding: '10px', borderRadius: '4px' }}>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Search employees..." 
                                        value={dmEmpSearch} 
                                        onChange={(e) => setDmEmpSearch(e.target.value)}
                                        className="mb-2"
                                    />
                                    <div style={{ height: '160px', overflowY: 'auto' }}>
                                        {formData.employees.length === 0 ? (
                                            <div className="text-muted">
                                                Please select employee(s) in the top section first.
                                            </div>
                                        ) : eligibleDmEmployees.length > 0 ? (
                                            eligibleDmEmployees.filter(emp => (emp.label || '').toLowerCase().includes(dmEmpSearch.toLowerCase())).map(emp => (
                                                <Form.Check 
                                                    key={`dm-emp-${emp.value}`}
                                                    type="radio"
                                                    id={`dm-emp-${emp.value}`}
                                                    name="decision_maker_employee"
                                                    value={String(emp.user_id)}
                                                    label={emp.user_id ? emp.label : `${emp.label} (No User Account)`}
                                                    checked={String(formData.decision_maker) === String(emp.user_id)}
                                                    onChange={handleChange}
                                                    disabled={!emp.user_id || emp.user_id === 'None'}
                                                />
                                            ))
                                        ) : (
                                            <div className="text-muted">
                                                {!decisionMakerPatternType 
                                                    ? 'Select a pattern type first.' 
                                                    : ['Assign', 'HOD', 'BOD'].includes(decisionMakerPatternType) && decisionMakerEmployees.length === 0
                                                        ? 'Loading employees...' 
                                                        : decisionMakerDepartments.length === 0 && !['Assign', 'HOD', 'BOD'].includes(decisionMakerPatternType)
                                                            ? 'Select department(s) to display employees.'
                                                            : 'No employees found with a higher level than the selected employee(s).'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Form.Group>
                        </Col>
                    </Row>

                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <Button 
                            className="btn-cancel-custom"
                            style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', color: '#ffffff' }}
                            onClick={() => navigate('/repair-part-list')}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit"
                            style={{ backgroundColor: '#0a500f', borderColor: '#0a500f', color: '#ffffff' }}
                        >
                            Submit
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default RepairPartForm;