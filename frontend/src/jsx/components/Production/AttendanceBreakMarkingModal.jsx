import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Form, Table, Badge, Spinner } from 'react-bootstrap';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';

const AttendanceBreakMarkingModal = ({ show, onHide, productionLine, planDate }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    
    // Checkbox selections
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedBreakEmployees, setSelectedBreakEmployees] = useState([]);
    
    // Input modifications locally
    const [localAttendance, setLocalAttendance] = useState({});
    const [breakTypes, setBreakTypes] = useState([]);
    const [selectedBreakType, setSelectedBreakType] = useState('');

    useEffect(() => {
        if (show && productionLine?.id) {
            fetchAttendance();
            fetchBreakTypes();
            setSelectedEmployees([]);
            setSelectedBreakEmployees([]);
        }
    }, [show, productionLine]);

    const fetchBreakTypes = async () => {
        try {
            const res = await ProductionService.getBreakTypes();
            setBreakTypes(res.data);
            if (res.data.length > 0) {
                setSelectedBreakType(res.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch break types', error);
        }
    };

    const fetchAttendance = async () => {
        try {
            setLoading(true);
            const res = await ProductionService.getAttendances(`?production_line_id=${productionLine.id}`);
            const records = res.data.results || res.data;
            setAttendanceRecords(records);
            
            // Populate local state
            const local = {};
            // Pre-populate with planned employees defaults
            (productionLine.employees || []).forEach(emp => {
                const dbRec = records.find(r => r.employee === emp.employee_id || r.employee === emp.id);
                local[emp.employee_id || emp.id] = {
                    status: dbRec ? dbRec.status : 'ABSENT',
                    check_in_time: dbRec?.check_in_time ? extractTimeStr(dbRec.check_in_time) : '',
                    check_out_time: dbRec?.check_out_time ? extractTimeStr(dbRec.check_out_time) : '',
                    is_overtime_approved: dbRec ? dbRec.is_overtime_approved : false,
                    remarks: dbRec ? dbRec.remarks || '' : ''
                };
            });
            setLocalAttendance(local);
        } catch (err) {
            console.error("Failed to load attendance records:", err);
            Swal.fire('Error', 'Could not load attendance logs.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const extractTimeStr = (dateTimeStr) => {
        if (!dateTimeStr) return '';
        const parts = dateTimeStr.split('T');
        if (parts.length === 2) {
            return parts[1].substring(0, 5); // "HH:MM"
        }
        return '';
    };

    // Attendance Bulk Actions
    const handleBulkCheckIn = async (isLate = false) => {
        if (selectedEmployees.length === 0) {
            Swal.fire('Warning', 'Please select at least one employee.', 'warning');
            return;
        }
        
        const defaultTime = isLate 
            ? new Date().toTimeString().substring(0, 5) 
            : (productionLine.start_time ? productionLine.start_time.substring(0, 5) : '09:00');

        const { value: timeStr } = await Swal.fire({
            title: isLate ? 'Confirm Late Check-In' : 'Confirm Check-In',
            text: 'Enter Actual Check-In Time (HH:MM):',
            input: 'text',
            inputValue: defaultTime,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || !/^\d{2}:\d{2}$/.test(value)) {
                    return 'Please enter time in HH:MM format';
                }
            }
        });

        if (!timeStr) return;

        try {
            setSaving(true);
            const formattedDateTime = `${planDate}T${timeStr}:00`;
            const payload = {
                shift_day_id: productionLine.shift_day,
                production_line_id: productionLine.production_line,
                employee_ids: selectedEmployees,
                action_type: isLate ? 'late_check_in' : 'check_in',
                check_in_time: formattedDateTime
            };
            await ProductionService.bulkMarkAttendance(payload);
            Swal.fire('Success', 'Employees checked in successfully.', 'success');
            setSelectedEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Bulk check-in failed.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkCheckOut = async () => {
        if (selectedEmployees.length === 0) {
            Swal.fire('Warning', 'Please select at least one employee.', 'warning');
            return;
        }
        
        const defaultTime = productionLine.end_time ? productionLine.end_time.substring(0, 5) : '17:00';

        const { value: timeStr } = await Swal.fire({
            title: 'Confirm Check-Out',
            text: 'Enter Actual Check-Out Time (HH:MM):',
            input: 'text',
            inputValue: defaultTime,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value || !/^\d{2}:\d{2}$/.test(value)) {
                    return 'Please enter time in HH:MM format';
                }
            }
        });

        if (!timeStr) return;

        try {
            setSaving(true);
            const formattedDateTime = `${planDate}T${timeStr}:00`;
            const payload = {
                shift_day_id: productionLine.shift_day,
                production_line_id: productionLine.production_line,
                employee_ids: selectedEmployees,
                action_type: 'check_out',
                check_out_time: formattedDateTime
            };
            await ProductionService.bulkMarkAttendance(payload);
            Swal.fire('Success', 'Employees checked out successfully.', 'success');
            setSelectedEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Bulk check-out failed.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleLocalChange = (empId, field, value) => {
        setLocalAttendance(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [field]: value
            }
        }));
    };

    const handleSaveAllAttendance = async () => {
        try {
            setSaving(true);
            const promises = Object.keys(localAttendance).map(empId => {
                const info = localAttendance[empId];
                
                return ProductionService.bulkMarkAttendance({
                    shift_day_id: productionLine.shift_day,
                    production_line_id: productionLine.production_line,
                    employee_ids: [parseInt(empId)],
                    action_type: 'update_status',
                    status: info.status,
                    check_in_time: info.check_in_time ? `${planDate}T${info.check_in_time}:00` : null,
                    check_out_time: info.check_out_time ? `${planDate}T${info.check_out_time}:00` : null,
                    is_overtime_approved: info.is_overtime_approved,
                    remarks: info.remarks
                });
            });

            await Promise.all(promises);
            Swal.fire('Success', 'Attendance records updated successfully.', 'success');
            fetchAttendance();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Failed to save changes.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Break Actions
    const handleStartBreak = async () => {
        if (selectedBreakEmployees.length === 0) {
            Swal.fire('Warning', 'Select at least one checked-in employee.', 'warning');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                production_line_id: productionLine.id,
                employee_ids: selectedBreakEmployees,
                break_type: selectedBreakType,
                start_time: new Date().toISOString()
            };
            await ProductionService.startBreakLog(payload);
            Swal.fire('Success', 'Break started successfully.', 'success');
            setSelectedBreakEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Could not start break.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEndBreak = async () => {
        if (selectedBreakEmployees.length === 0) {
            Swal.fire('Warning', 'Select at least one employee on break.', 'warning');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                production_line_id: productionLine.id,
                employee_ids: selectedBreakEmployees,
                end_time: new Date().toISOString()
            };
            await ProductionService.endBreakLog(payload);
            Swal.fire('Success', 'Break ended successfully.', 'success');
            setSelectedBreakEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Could not end break.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Helper to fetch details about active breaks
    const getActiveBreak = (empId) => {
        const record = attendanceRecords.find(r => r.employee === empId);
        if (!record || !record.breaks) return null;
        return record.breaks.find(b => !b.end_time);
    };

    // Helper to calculate total break minutes and exceeded minutes
    const getBreakMetrics = (empId) => {
        const record = attendanceRecords.find(r => r.employee === empId);
        if (!record) return { total: 0, exceeded: 0 };
        return {
            total: record.total_break_minutes || 0,
            exceeded: record.breaks ? record.breaks.reduce((sum, b) => sum + (b.exceeded_minutes || 0), 0) : 0
        };
    };

    const isCheckedIn = (empId) => {
        const local = localAttendance[empId];
        return local && local.check_in_time;
    };

    const toggleSelectEmployee = (empId) => {
        setSelectedEmployees(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const toggleSelectBreakEmployee = (empId) => {
        setSelectedBreakEmployees(prev =>
            prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
        );
    };

    const selectAllEmployees = () => {
        const allIds = (productionLine?.employees || []).map(emp => emp.employee_id || emp.id);
        if (selectedEmployees.length === allIds.length) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(allIds);
        }
    };

    const selectAllBreakEmployees = () => {
        const checkedInIds = (productionLine?.employees || [])
            .map(emp => emp.employee_id || emp.id)
            .filter(id => isCheckedIn(id));

        if (selectedBreakEmployees.length === checkedInIds.length) {
            setSelectedBreakEmployees([]);
        } else {
            setSelectedBreakEmployees(checkedInIds);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="xl" backdrop="static" centered>
            <Modal.Header closeButton className="bg-light">
                <Modal.Title style={{ fontSize: '18px', color: '#1e293b' }}>
                    <i className="fa fa-clock-o text-success me-2"></i>
                    Attendance & Break Controls — <strong>{productionLine?.production_line_name}</strong> ({planDate})
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ minHeight: '450px' }}>
                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="success" />
                        <p className="mt-2 text-muted">Retrieving line activity logs...</p>
                    </div>
                ) : (
                    <Row>
                        {/* LEFT COLUMN: Attendance Marking */}
                        <Col lg={7} md={12} className="border-end pr-3">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0 font-w600 text-dark" style={{ fontSize: '15px' }}>
                                    <span className="badge bg-primary me-2">1</span> Attendance List
                                </h5>
                                <div className="d-flex gap-1">
                                    <Button variant="outline-primary" size="xs" onClick={() => handleBulkCheckIn(false)}>
                                        Check-In
                                    </Button>
                                    <Button variant="outline-warning" size="xs" onClick={() => handleBulkCheckIn(true)}>
                                        Late In
                                    </Button>
                                    <Button variant="outline-danger" size="xs" onClick={() => handleBulkCheckOut()}>
                                        Check-Out
                                    </Button>
                                </div>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px' }}>
                                <Table hover size="sm" className="mb-0" style={{ fontSize: '12px' }}>
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="text-center" style={{ width: '40px' }}>
                                                <Form.Check 
                                                    type="checkbox"
                                                    checked={selectedEmployees.length > 0 && selectedEmployees.length === (productionLine?.employees || []).length}
                                                    onChange={selectAllEmployees}
                                                />
                                            </th>
                                            <th>Operator</th>
                                            <th style={{ width: '110px' }}>Status</th>
                                            <th style={{ width: '90px' }}>Check-In</th>
                                            <th style={{ width: '90px' }}>Check-Out</th>
                                            <th className="text-center" style={{ width: '60px' }}>OT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(productionLine?.employees || []).length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4 text-muted">No employees assigned to this line.</td>
                                            </tr>
                                        ) : (
                                            productionLine.employees.map(emp => {
                                                const empId = emp.employee_id || emp.id;
                                                const local = localAttendance[empId] || {
                                                    status: 'ABSENT', check_in_time: '', check_out_time: '', is_overtime_approved: false
                                                };
                                                return (
                                                    <tr key={empId}>
                                                        <td className="text-center align-middle">
                                                            <Form.Check 
                                                                type="checkbox"
                                                                checked={selectedEmployees.includes(empId)}
                                                                onChange={() => toggleSelectEmployee(empId)}
                                                            />
                                                        </td>
                                                        <td className="align-middle">
                                                            <div><strong>{emp.employee_name}</strong></div>
                                                            <div className="text-muted" style={{ fontSize: '10px' }}>ID: {emp.employee_code || empId}</div>
                                                        </td>
                                                        <td className="align-middle">
                                                            <Form.Select 
                                                                size="sm" 
                                                                value={local.status}
                                                                onChange={(e) => handleLocalChange(empId, 'status', e.target.value)}
                                                                style={{ fontSize: '11px', height: '28px', padding: '2px 6px' }}
                                                            >
                                                                <option value="PRESENT">Present</option>
                                                                <option value="ABSENT">Absent</option>
                                                                <option value="LATE">Late</option>
                                                                <option value="HALF_DAY">Half Day</option>
                                                                <option value="LEAVE">Leave</option>
                                                            </Form.Select>
                                                        </td>
                                                        <td className="align-middle">
                                                            <Form.Control 
                                                                type="time" 
                                                                size="sm"
                                                                value={local.check_in_time}
                                                                onChange={(e) => handleLocalChange(empId, 'check_in_time', e.target.value)}
                                                                style={{ fontSize: '11px', height: '28px' }}
                                                            />
                                                        </td>
                                                        <td className="align-middle">
                                                            <Form.Control 
                                                                type="time" 
                                                                size="sm"
                                                                value={local.check_out_time}
                                                                onChange={(e) => handleLocalChange(empId, 'check_out_time', e.target.value)}
                                                                style={{ fontSize: '11px', height: '28px' }}
                                                            />
                                                        </td>
                                                        <td className="text-center align-middle">
                                                            <Form.Check 
                                                                type="checkbox"
                                                                checked={local.is_overtime_approved}
                                                                onChange={(e) => handleLocalChange(empId, 'is_overtime_approved', e.target.checked)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                            <div className="text-end mt-3">
                                <Button 
                                    variant="success" 
                                    size="sm" 
                                    onClick={handleSaveAllAttendance}
                                    disabled={saving}
                                >
                                    {saving ? <Spinner size="sm" animation="border" /> : <><i className="fa fa-save me-1"></i> Save Attendance Details</>}
                                </Button>
                            </div>
                        </Col>

                        {/* RIGHT COLUMN: Break Tracking */}
                        <Col lg={5} md={12} className="pl-3 mt-4 mt-lg-0">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0 font-w600 text-dark" style={{ fontSize: '15px' }}>
                                    <span className="badge bg-success me-2">2</span> Breaks Tracking
                                </h5>
                                <div className="d-flex align-items-center gap-1">
                                    <Form.Select 
                                        size="sm" 
                                        value={selectedBreakType}
                                        onChange={(e) => setSelectedBreakType(e.target.value)}
                                        style={{ fontSize: '11px', width: '90px', height: '26px', padding: '2px 4px' }}
                                    >
                                        {breakTypes.map(bt => (
                                            <option key={bt.id} value={bt.id}>{bt.name}</option>
                                        ))}
                                    </Form.Select>
                                    <Button variant="outline-success" size="xs" onClick={handleStartBreak}>
                                        Start
                                    </Button>
                                    <Button variant="outline-danger" size="xs" onClick={handleEndBreak}>
                                        End
                                    </Button>
                                </div>
                            </div>

                            <div className="table-responsive" style={{ maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px' }}>
                                <Table hover size="sm" className="mb-0" style={{ fontSize: '12px' }}>
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="text-center" style={{ width: '40px' }}>
                                                <Form.Check 
                                                    type="checkbox"
                                                    checked={selectedBreakEmployees.length > 0 && selectedBreakEmployees.length === (productionLine?.employees || []).filter(e => isCheckedIn(e.employee_id || e.id)).length}
                                                    onChange={selectAllBreakEmployees}
                                                />
                                            </th>
                                            <th>Operator</th>
                                            <th>Break Status</th>
                                            <th className="text-center" style={{ width: '100px' }}>Logged Totals</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(productionLine?.employees || []).length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="text-center py-4 text-muted">No employees.</td>
                                            </tr>
                                        ) : (
                                            productionLine.employees.map(emp => {
                                                const empId = emp.employee_id || emp.id;
                                                const activeBreak = getActiveBreak(empId);
                                                const breakMetrics = getBreakMetrics(empId);
                                                const checkedIn = isCheckedIn(empId);

                                                return (
                                                    <tr key={empId} className={!checkedIn ? 'bg-light text-muted' : ''}>
                                                        <td className="text-center align-middle">
                                                            <Form.Check 
                                                                type="checkbox"
                                                                checked={selectedBreakEmployees.includes(empId)}
                                                                onChange={() => toggleSelectBreakEmployee(empId)}
                                                                disabled={!checkedIn}
                                                            />
                                                        </td>
                                                        <td className="align-middle">
                                                            <strong>{emp.employee_name}</strong>
                                                            {!checkedIn && <div className="text-danger" style={{ fontSize: '10px' }}>Not Checked-In</div>}
                                                        </td>
                                                        <td className="align-middle">
                                                            {activeBreak ? (
                                                                <Badge bg="danger" className="blink">
                                                                    On {activeBreak.break_type} ({extractTimeStr(activeBreak.start_time)})
                                                                </Badge>
                                                            ) : checkedIn ? (
                                                                <span className="text-success font-w500">Working</span>
                                                            ) : (
                                                                <span className="text-muted">--</span>
                                                            )}
                                                        </td>
                                                        <td className="text-center align-middle">
                                                            <div><strong>{breakMetrics.total} m</strong></div>
                                                            {breakMetrics.exceeded > 0 && (
                                                                <div className="text-danger" style={{ fontSize: '10px' }}>+{breakMetrics.exceeded}m excess</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                            
                            <div className="mt-3 p-3 bg-light rounded" style={{ fontSize: '11px', border: '1px solid #e2e8f0' }}>
                                <strong>💡 Break Limits Policy info:</strong>
                                <ul className="mb-0 mt-1 pl-3 text-muted">
                                    {breakTypes.map(bt => (
                                        <li key={bt.id}>{bt.name} duration limit: <strong>{bt.duration_minutes} minutes</strong></li>
                                    ))}
                                    <li>Durations are tracked live and any excess time is logged as exceeded break minutes.</li>
                                </ul>
                            </div>
                        </Col>
                    </Row>
                )}
            </Modal.Body>
            <Modal.Footer className="bg-light">
                <Button variant="secondary" onClick={onHide}>Close Dashboard</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AttendanceBreakMarkingModal;
