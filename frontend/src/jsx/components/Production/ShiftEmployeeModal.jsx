import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Spinner, Badge, Form } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import MainSweetAlert from 'sweetalert2';

const ShiftEmployeeModal = ({
    show,
    onHide,
    productionLineId,
    employeeGroupId,
    planDate,
    startTime,
    endTime,
    currentEmployees,
    onUpdateEmployees,
    dayData,
    currentShiftId,
    currentLineIndex,
    productionLines
}) => {
    const [employees, setEmployees] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [showAllEmployees, setShowAllEmployees] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (show && employeeGroupId) {
            fetchEmployees();
        } else if (show && !employeeGroupId) {
            setEmployees([]);
        }
    }, [show, employeeGroupId]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            // Get members of the Shift Group
            const response = await ProductionService.getEmployeeGroupMembers(`?group=${employeeGroupId}`);
            let fetched = [];
            if (response.data && response.data.results) {
                fetched = response.data.results;
            } else if (Array.isArray(response.data)) {
                fetched = response.data;
            }
            setEmployees(fetched);

            // Auto-select all group members by default
            const allIds = fetched.map(emp => emp.employee_details ? emp.employee_details.id : emp.employee);
            const newIds = allIds.filter(id => !currentEmployees.includes(id));
            if (newIds.length > 0) {
                onUpdateEmployees([...currentEmployees, ...newIds]);
            }
        } catch (error) {
            console.error("Error fetching employees:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (showAllEmployees && allEmployees.length === 0) {
            fetchAllEmployees();
        }
    }, [showAllEmployees]);

    const fetchAllEmployees = async () => {
        setLoading(true);
        try {
            const response = await ProductionService.getEmployees();
            if (response.data && response.data.results) {
                setAllEmployees(response.data.results);
            } else if (Array.isArray(response.data)) {
                setAllEmployees(response.data);
            }
        } catch (error) {
            console.error("Error fetching all employees:", error);
        } finally {
            setLoading(false);
        }
    };

    const getEmpId = (emp) => showAllEmployees ? emp.id : (emp.employee_details ? emp.employee_details.id : emp.employee);
    const getUserName = (emp) => showAllEmployees ? (emp.full_name || emp.user_name) : (emp.employee_details?.full_name || emp.employee_details?.user_name);
    const getEmpCode = (emp) => showAllEmployees ? emp.emp_id : emp.employee_details?.emp_id;
    const getDesignation = (emp) => showAllEmployees ? emp.designation_title : emp.designation_name;

    const handleToggleEmployee = async (employee) => {
        const empId = getEmpId(employee);
        const isSelected = currentEmployees.includes(empId);

        if (isSelected) {
            onUpdateEmployees(currentEmployees.filter(id => id !== empId));
        } else {
            // 1. Check local unsaved conflict
            if (dayData) {
                let localConflict = false;
                let conflictLineName = 'another line';

                for (const sId in dayData) {
                    const lines = dayData[sId] || [];
                    for (let i = 0; i < lines.length; i++) {
                        if (String(sId) === String(currentShiftId) && i === currentLineIndex) continue;
                        const line = lines[i];
                        if (line.employees && line.employees.includes(empId)) {
                            // Check time overlap
                            if (startTime < line.end_time && endTime > line.start_time) {
                                localConflict = true;
                                if (productionLines) {
                                    const prodLine = productionLines.find(p => String(p.id) === String(line.production_line_id));
                                    if (prodLine) conflictLineName = prodLine.name;
                                }
                                break;
                            }
                        }
                    }
                    if (localConflict) break;
                }

                if (localConflict) {
                    MainSweetAlert.fire('Time Conflict Detected', `Employee is already assigned to ${conflictLineName} in this plan during this time. Please remove them from that line first.`, 'warning');
                    return;
                }
            }

            // 2. Validate against database conflict
            try {
                const response = await ProductionService.validateShiftProductionEmployeeConflict({
                    employee_id: empId,
                    plan_date: planDate,
                    start_time: startTime,
                    end_time: endTime
                });

                if (response.data.conflict) {
                    MainSweetAlert.fire({
                        title: 'Time Conflict Detected',
                        text: `${response.data.message} Do you want to move the employee to this line?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#0a500f',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Yes, Move Employee',
                        cancelButtonText: 'No, Cancel'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Backend handles the actual moving on save, but for the UI state:
                            onUpdateEmployees([...currentEmployees, empId]);
                        }
                    });
                } else {
                    onUpdateEmployees([...currentEmployees, empId]);
                }
            } catch (error) {
                console.error("Conflict validation error:", error);
                MainSweetAlert.fire('Error', 'Failed to validate employee conflict.', 'error');
            }
        }
    };

    const dataSource = showAllEmployees ? allEmployees : employees;

    const filteredEmployees = dataSource.filter(emp => {
        // Display only employees from the production department when showing all employees
        if (showAllEmployees) {
            const deptName = emp.department_name || '';
            if (!deptName.toLowerCase().includes('production')) {
                return false;
            }
        }

        if (!search) return true;
        const name = getUserName(emp) || '';
        const empCode = getEmpCode(emp) || '';
        return name.toLowerCase().includes(search.toLowerCase()) ||
            String(empCode).toLowerCase().includes(search.toLowerCase());
    });

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <style>{`
                .sem-row-selected {
                    background-color: rgba(10, 80, 15, 0.08) !important;
                }
                [data-theme-version="dark"] .sem-row-selected {
                    background-color: rgba(10, 80, 15, 0.15) !important;
                }
            `}</style>
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title>Manage Employees</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <Form.Control
                        type="text"
                        placeholder="Search employee by name or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: '300px' }}
                    />
                    <Form.Check
                        type="switch"
                        id="show-all-employees-switch"
                        label="Show all available employees"
                        checked={showAllEmployees}
                        onChange={(e) => setShowAllEmployees(e.target.checked)}
                        className="ms-3"
                    />
                </div>

                {loading ? (
                    <div className="text-center p-5">
                        <Spinner animation="border" variant="primary" />
                    </div>
                ) : (
                    <Table hover responsive bordered className="mb-0">
                        <thead className="table-light">
                            <tr>
                                <th style={{ width: '50px' }}>Action</th>
                                <th>Employee Name</th>
                                <th>Designation</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => {
                                const empId = getEmpId(emp);
                                const isSelected = currentEmployees.includes(empId);
                                const name = getUserName(emp) || 'N/A';
                                const code = getEmpCode(emp);
                                const designation = getDesignation(emp) || 'N/A';

                                return (
                                    <tr key={empId} className={isSelected ? 'sem-row-selected' : ''}>
                                        <td className="text-center">
                                            <Form.Check
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleEmployee(emp)}
                                            />
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center text-white bg-primary me-2"
                                                    style={{ width: '32px', height: '32px', fontSize: '14px', fontWeight: 'bold' }}
                                                >
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h6 className="mb-0" style={{ fontSize: '14px' }}>
                                                        {name}
                                                    </h6>
                                                    {code && <small className="text-muted">{code}</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{designation}</td>
                                        <td>
                                            {isSelected ? (
                                                <Badge bg="success">Assigned</Badge>
                                            ) : (
                                                <Badge bg="secondary">Unassigned</Badge>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-4 text-muted">
                                        No employees found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </Modal.Body>
            <Modal.Footer className="border-0">
                <Button variant="secondary" onClick={onHide}>Save</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ShiftEmployeeModal;
