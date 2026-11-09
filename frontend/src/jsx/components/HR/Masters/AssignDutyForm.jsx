import React, { useState, useEffect, Fragment, useRef } from 'react';
import { Card, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import {
    getDutyNames,
    getResponsibilities,
    createAssignDuty,
    updateAssignDuty,
    getDepartments,
    getAllEmployeeDutyStatuses
} from '../../../../services/HRManagementService';
import { getEmployeesByDepartment } from '../../../../services/MachineManagementService';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEnterTraversal } from '../../../../hooks/useEnterTraversal';

const AssignDutyForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const editData = location.state?.editData || null;
    const [loading, setLoading] = useState(false);
    
    const { handleFormKeyDown } = useEnterTraversal('.assign-duty-form-container');
    
    const [duties, setDuties] = useState([]);
    const [allResponsibilities, setAllResponsibilities] = useState([]);
    const [filteredResponsibilities, setFilteredResponsibilities] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [activeStatuses, setActiveStatuses] = useState([]);
    const [hasEndDate, setHasEndDate] = useState(false);
    const dutySelectRef = useRef(null);

    const todayDate = new Date();
    const today = todayDate.toISOString().split('T')[0];
    const tenYearsDate = new Date(todayDate);
    tenYearsDate.setFullYear(tenYearsDate.getFullYear() + 10);
    const tenYears = tenYearsDate.toISOString().split('T')[0];
    
    const [formData, setFormData] = useState({
        dutyname: '',
        responsibility: [],
        department_name: [],
        person_name: [],
        start_date: today,
        end_date: tenYears
    });

    // Auto-open the Duty Name dropdown on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (dutySelectRef.current) {
                try {
                    dutySelectRef.current.focus();
                    dutySelectRef.current.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    if (dutySelectRef.current.showPicker) {
                        dutySelectRef.current.showPicker();
                    }
                } catch (e) {}
            }
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [dutyRes, respRes, deptRes, statusRes] = await Promise.all([
                    getDutyNames(),
                    getResponsibilities(),
                    getDepartments(),
                    getAllEmployeeDutyStatuses()
                ]);
                
                const fetchedDuties = dutyRes.results || dutyRes;
                const fetchedResp = respRes.results || respRes;
                const fetchedDepts = (deptRes.results || deptRes).map(d => ({ value: d.id, label: d.name }));
                const statuses = statusRes.results || statusRes;
                
                setDuties(fetchedDuties);
                setAllResponsibilities(fetchedResp);
                setDepartments(fetchedDepts);
                setActiveStatuses(statuses.filter(s => s.is_active));

                if (editData) {
                    setFormData({
                        dutyname: editData.dutyname || '',
                        responsibility: editData.responsibility || [],
                        department_name: Array.isArray(editData.department_name) ? editData.department_name : (editData.department_name ? [editData.department_name] : []),
                        person_name: editData.person_name || [],
                        start_date: editData.start_date || today,
                        end_date: editData.end_date || tenYears
                    });
                    // If we have an editData and its end_date is not exactly 10 years from start_date, we might want to check the box.
                    // But to keep it simple, we can assume if they are editing, they might want to leave it inactive unless they actively change it.
                    // Let's just set hasEndDate(false) so it's inactive by default, but holds the value.
                    setHasEndDate(false);

                    if (editData.dutyname) {
                        setFilteredResponsibilities(fetchedResp.filter(r => r.dutyname === parseInt(editData.dutyname)));
                    }
                    if (editData.department_name) {
                        const deptIds = Array.isArray(editData.department_name) ? editData.department_name : [editData.department_name];
                        let allEmps = [];
                        for (const dept of deptIds) {
                            try {
                                const emps = await getEmployeesByDepartment(dept);
                                allEmps = [...allEmps, ...emps];
                            } catch (err) {}
                        }
                        setEmployees(allEmps);
                    }
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch initial data.' });
            }
        };
        loadInitial();
    }, [editData]);

    const handleDutyChange = (e) => {
        const val = e.target.value;
        setFormData({ ...formData, dutyname: val, responsibility: [] });
        if (val) {
            setFilteredResponsibilities(allResponsibilities.filter(r => r.dutyname === parseInt(val)));
        } else {
            setFilteredResponsibilities([]);
        }
    };

    const handleDeptChange = async (deptId, isChecked) => {
        setFormData(prev => {
            const newDepts = isChecked
                ? [...prev.department_name, deptId]
                : prev.department_name.filter(id => id !== deptId);
            
            // Re-fetch employees for all currently selected departments
            const fetchEmps = async () => {
                let allEmps = [];
                for (const dId of newDepts) {
                    try {
                        const emps = await getEmployeesByDepartment(dId);
                        allEmps = [...allEmps, ...emps];
                    } catch (err) {}
                }
                setEmployees(allEmps);
                
                // Remove employees from person_name if they no longer belong to selected departments
                setFormData(current => ({
                    ...current,
                    person_name: current.person_name.filter(empId => allEmps.some(e => parseInt(e.value) === empId))
                }));
            };
            fetchEmps();
            
            return { ...prev, department_name: newDepts };
        });
    };

    const handleCheckboxChange = (e, field) => {
        const { value, checked } = e.target;
        const numValue = parseInt(value);
        
        if (field === 'department_name') {
            handleDeptChange(numValue, checked);
            return;
        }

        if (checked) {
            if (field === 'person_name') {
                for (let respId of formData.responsibility) {
                    const conflict = activeStatuses.find(s => s.employee === numValue && s.responsibility === respId && s.is_active);
                    if (conflict && (!editData || conflict.assignment !== editData.id)) {
                        Swal.fire('Error', `Responsibility '${conflict.responsibility_name}' is already assigned and active for ${conflict.employee_name}.`, 'error');
                        return;
                    }
                }
            } else if (field === 'responsibility') {
                for (let empId of formData.person_name) {
                    const conflict = activeStatuses.find(s => s.employee === empId && s.responsibility === numValue && s.is_active);
                    if (conflict && (!editData || conflict.assignment !== editData.id)) {
                        Swal.fire('Error', `Responsibility '${conflict.responsibility_name}' is already assigned and active for ${conflict.employee_name}.`, 'error');
                        return;
                    }
                }
            }
        }
        
        setFormData(prev => {
            if (checked) {
                return { ...prev, [field]: [...prev[field], numValue] };
            } else {
                return { ...prev, [field]: prev[field].filter(id => id !== numValue) };
            }
        });
    };

    const [deptSearch, setDeptSearch] = useState('');
    const [empSearch, setEmpSearch] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.dutyname) return Swal.fire('Warning', 'Please select a duty', 'warning');
        if (formData.responsibility.length === 0) return Swal.fire('Warning', 'Please select at least one responsibility', 'warning');
        if (formData.department_name.length === 0) return Swal.fire('Warning', 'Please select at least one department', 'warning');
        if (formData.person_name.length === 0) return Swal.fire('Warning', 'Please select at least one employee', 'warning');

        const payload = { ...formData };
        if (!payload.start_date) delete payload.start_date;
        if (!payload.end_date) {
            delete payload.end_date;
            payload.end_date = null; // some backends expect null for clearing
        }

        try {
            setLoading(true);
            if (editData) {
                await updateAssignDuty(editData.id, payload);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Duty assignment updated successfully!' });
            } else {
                await createAssignDuty(payload);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Duty assigned successfully!' });
            }
            navigate('/assign-duty-list');
        } catch (error) {
            let errorMsg = 'Failed to save duty.';
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'string') errorMsg = data;
                else if (data.non_field_errors) errorMsg = data.non_field_errors[0];
                else if (data.message) errorMsg = data.message;
                else if (Array.isArray(data)) errorMsg = data[0];
                else if (Object.values(data).length > 0) {
                    const firstError = Object.values(data)[0];
                    errorMsg = Array.isArray(firstError) ? firstError[0] : firstError;
                }
            }
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-xl-12">
                    <Card className="repair-part-form-container">
                        <style>{`
                            .repair-part-form-container .form-label {
                                font-weight: 600;
                                margin-bottom: 0.25rem;
                                color: #64748b;
                                font-size: 0.9rem;
                            }
                            .repair-part-form-container .form-control,
                            .repair-part-form-container .form-select {
                                border: 1.5px solid #e2e8f0;
                                border-radius: 8px;
                                padding: 10px 14px;
                                font-size: 0.9rem;
                                color: #1e293b;
                                background: #fff;
                                transition: all 0.2s ease;
                            }
                            .repair-part-form-container .form-control:focus,
                            .repair-part-form-container .form-select:focus {
                                border-color: #06b6d4;
                                outline: none;
                                box-shadow: 0 0 0 3px rgba(6,182,212,0.15);
                            }
                            .repair-part-form-container .react-select__control {
                                border: 1.5px solid #e2e8f0 !important;
                                border-radius: 8px !important;
                                min-height: 43px;
                                box-shadow: none !important;
                                transition: all 0.2s ease;
                            }
                            .repair-part-form-container .react-select__control--is-focused {
                                border-color: #06b6d4 !important;
                                box-shadow: 0 0 0 3px rgba(6,182,212,0.15) !important;
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
                            .repair-part-form-container .btn-close-custom { background-color: #7A70BA !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                            .repair-part-form-container .btn-close-custom:hover { background-color: #6357a7 !important; }
                            .repair-part-form-container .btn-save-custom { background-color: #2ece8a !important; color: white !important; border-radius: 8px !important; font-weight: 500 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; cursor: pointer; transition: background-color 0.2s; }
                            .repair-part-form-container .btn-save-custom:hover { background-color: #26b277 !important; }
                        `}</style>
                        <Card.Header>
                            <Card.Title>{editData ? 'Edit Duty And Responsibility' : 'Assign Duty and Responsibility'}</Card.Title>
                        </Card.Header>
                        <Card.Body className="assign-duty-form-container">
                            <Form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                                <div className="row mb-4">
                                    <div className="col-xl-6 col-md-6 mb-3">
                                        <Form.Group>
                                            <Form.Label>Duty Name <span className="text-danger">*</span></Form.Label>
                                            <Form.Select
                                                ref={dutySelectRef}
                                                value={formData.dutyname}
                                                onChange={handleDutyChange}
                                                required
                                                size={duties.length > 0 ? Math.min(duties.length + 1, 8) : 3}
                                            >
                                                <option value="">Select Duty...</option>
                                                {duties.map(duty => (
                                                    <option key={duty.id} value={duty.id}>{duty.name}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </div>

                                    <div className="col-xl-12 col-md-12 mb-3">
                                        <Form.Group>
                                            <Form.Label>Select Responsibilities <span className="text-danger">*</span></Form.Label>
                                            <div className="border p-3 rounded" style={{ maxHeight: '200px', overflowY: 'auto', borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }}>
                                                {filteredResponsibilities.length > 0 ? (
                                                    <div className="row">
                                                        {[...filteredResponsibilities].sort((a, b) => {
                                                            const aSelected = formData.responsibility.includes(a.id);
                                                            const bSelected = formData.responsibility.includes(b.id);
                                                            if (aSelected && !bSelected) return -1;
                                                            if (!aSelected && bSelected) return 1;
                                                            return 0;
                                                        }).map(resp => (
                                                            <div className="col-md-4 mb-2" key={resp.id}>
                                                                <div className="form-check custom-checkbox mb-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        id={`resp-${resp.id}`}
                                                                        value={resp.id}
                                                                        checked={formData.responsibility.includes(resp.id)}
                                                                        onChange={(e) => handleCheckboxChange(e, 'responsibility')}
                                                                    />
                                                                    <label className="form-check-label" htmlFor={`resp-${resp.id}`}>
                                                                        {resp.name}
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>Select a duty to view responsibilities.</p>
                                                )}
                                            </div>
                                        </Form.Group>
                                    </div>

                                    <div className="col-xl-6 col-md-6 mb-3">
                                        <Form.Group>
                                            <Form.Label>Start Date</Form.Label>
                                            <div className="sof-input-box">
                                                <span className="sof-field-icon">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px', height: '18px'}}>
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                </span>
                                                <input
                                                    type="date"
                                                    className="sof-input form-control border-0 bg-transparent pl-0"
                                                    value={formData.start_date || ''}
                                                    onChange={(e) => {
                                                        const newStartDate = e.target.value;
                                                        let newEndDate = formData.end_date;
                                                        if (newStartDate && !hasEndDate) {
                                                            const dateObj = new Date(newStartDate);
                                                            if (!isNaN(dateObj.getTime())) {
                                                                dateObj.setFullYear(dateObj.getFullYear() + 10);
                                                                newEndDate = dateObj.toISOString().split('T')[0];
                                                            }
                                                        }
                                                        setFormData({ ...formData, start_date: newStartDate, end_date: newEndDate });
                                                    }}
                                                    onDoubleClick={e => e.target.classList.add('sof-input-edit-segments')}
                                                    onBlur={e => e.target.classList.remove('sof-input-edit-segments')}
                                                    onClick={e => {
                                                        try { e.target.showPicker(); } catch (err) {}
                                                    }}
                                                />
                                            </div>
                                        </Form.Group>
                                    </div>
                                    <div className="col-xl-6 col-md-6 mb-3">
                                        <Form.Group>
                                            <Form.Label className="d-flex align-items-center gap-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={hasEndDate}
                                                    onChange={(e) => {
                                                        setHasEndDate(e.target.checked);
                                                        if (!e.target.checked) {
                                                            const baseDate = formData.start_date ? new Date(formData.start_date) : new Date();
                                                            if (!isNaN(baseDate.getTime())) {
                                                                baseDate.setFullYear(baseDate.getFullYear() + 10);
                                                                const newEndDate = baseDate.toISOString().split('T')[0];
                                                                setFormData({ ...formData, end_date: newEndDate });
                                                            }
                                                        }
                                                    }}
                                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                /> 
                                                Custom End Date
                                            </Form.Label>
                                            <div className="sof-input-box" style={{ opacity: hasEndDate ? 1 : 0.6 }}>
                                                <span className="sof-field-icon">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px', height: '18px'}}>
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                </span>
                                                <input
                                                    type="date"
                                                    disabled={!hasEndDate}
                                                    className="sof-input form-control border-0 bg-transparent pl-0"
                                                    value={formData.end_date || ''}
                                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                    onDoubleClick={e => { if (hasEndDate) e.target.classList.add('sof-input-edit-segments'); }}
                                                    onBlur={e => e.target.classList.remove('sof-input-edit-segments')}
                                                    onClick={e => {
                                                        if (hasEndDate) {
                                                            try { e.target.showPicker(); } catch (err) {}
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </Form.Group>
                                    </div>

                                    <div className="col-xl-6 col-md-6 mb-3">
                                        <Form.Group>
                                            <Form.Label>Targeted Departments <span className="text-danger">*</span></Form.Label>
                                            <div className="border rounded p-2" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="Search departments..."
                                                    value={deptSearch}
                                                    onChange={(e) => setDeptSearch(e.target.value)}
                                                    className="mb-2"
                                                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                                />
                                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                    {departments.filter(d => d.label.toLowerCase().includes(deptSearch.toLowerCase()))
                                                        .sort((a, b) => {
                                                            const aSelected = formData.department_name.includes(a.value);
                                                            const bSelected = formData.department_name.includes(b.value);
                                                            if (aSelected && !bSelected) return -1;
                                                            if (!aSelected && bSelected) return 1;
                                                            return a.label.localeCompare(b.label);
                                                        })
                                                        .map(dept => (
                                                        <div className="form-check custom-checkbox mb-2 ml-1" key={dept.value}>
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                id={`dept-${dept.value}`}
                                                                value={dept.value}
                                                                checked={formData.department_name.includes(dept.value)}
                                                                onChange={(e) => handleCheckboxChange(e, 'department_name')}
                                                            />
                                                            <label className="form-check-label" htmlFor={`dept-${dept.value}`}>
                                                                {dept.label}
                                                            </label>
                                                        </div>
                                                    ))}
                                                    {departments.filter(d => d.label.toLowerCase().includes(deptSearch.toLowerCase())).length === 0 && (
                                                        <p className="text-muted small ml-1 mt-2">No departments found.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Form.Group>
                                    </div>

                                    <div className="col-xl-6 col-md-6 mb-3">
                                        <Form.Group>
                                            <Form.Label>Employees <span className="text-danger">*</span></Form.Label>
                                            <div className="border rounded p-2" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                                <Form.Control
                                                    type="text"
                                                    placeholder="Search employees..."
                                                    value={empSearch}
                                                    onChange={(e) => setEmpSearch(e.target.value)}
                                                    className="mb-2"
                                                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                                />
                                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                    {employees.length > 0 ? (
                                                        employees.filter(e => e.label.toLowerCase().includes(empSearch.toLowerCase()))
                                                            .sort((a, b) => {
                                                                const aSelected = formData.person_name.includes(parseInt(a.value));
                                                                const bSelected = formData.person_name.includes(parseInt(b.value));
                                                                if (aSelected && !bSelected) return -1;
                                                                if (!aSelected && bSelected) return 1;
                                                                
                                                                // Group by department name (extracted from label e.g., "Name (Department)")
                                                                const deptA = a.label.includes('(') ? a.label.split('(').pop() : '';
                                                                const deptB = b.label.includes('(') ? b.label.split('(').pop() : '';
                                                                const deptCompare = deptA.localeCompare(deptB);
                                                                
                                                                if (deptCompare !== 0) return deptCompare;
                                                                return a.label.localeCompare(b.label);
                                                            })
                                                            .map(emp => (
                                                            <div className="form-check custom-checkbox mb-2 ml-1" key={emp.value}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    id={`emp-${emp.value}`}
                                                                    value={emp.value}
                                                                    checked={formData.person_name.includes(parseInt(emp.value))}
                                                                    onChange={(e) => handleCheckboxChange(e, 'person_name')}
                                                                />
                                                                <label className="form-check-label" htmlFor={`emp-${emp.value}`}>
                                                                    {emp.label}
                                                                </label>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-muted mb-0 small mt-2">Select department(s) to display employees.</p>
                                                    )}
                                                    {employees.length > 0 && employees.filter(e => e.label.toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                                                        <p className="text-muted small ml-1 mt-2">No employees match search.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Form.Group>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-end gap-2 mt-4">
                                    <Button type="button" className="btn-close-custom" onClick={() => navigate(-1)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="btn-save-custom" disabled={loading}>
                                        {loading ? 'Submitting...' : 'Submit'}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AssignDutyForm;
