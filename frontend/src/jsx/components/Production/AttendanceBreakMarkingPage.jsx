import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Row, Col, Form, Table, Badge, Spinner, Modal } from 'react-bootstrap';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';
import { usePageTitle } from '../../../context/TitleContext';

const swalWithBootstrap = Swal.mixin({
    customClass: {
        popup: 'rounded-4 shadow-lg border-0 p-4',
        title: 'font-w600 text-dark fs-4 mb-2',
        confirmButton: 'btn btn-primary btn-md px-4',
        cancelButton: 'btn btn-light btn-md px-4 ms-2',
        input: 'swal2-input'
    },
    buttonsStyling: false
});

const AttendanceBreakMarkingPage = () => {
    usePageTitle("Attendance-Break Marking");
    const { lineId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const queryParams = new URLSearchParams(location.search);
    const planDate = queryParams.get('date') || new Date().toISOString().split('T')[0];

    const [loadingLine, setLoadingLine] = useState(true);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [saving, setSaving] = useState(false);

    const [productionLine, setProductionLine] = useState(null);
    const [attendanceRecords, setAttendanceRecords] = useState([]);

    // Checkbox selections
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedBreakEmployees, setSelectedBreakEmployees] = useState([]);

    // Input modifications locally
    const [localAttendance, setLocalAttendance] = useState({});
    const [breakTypes, setBreakTypes] = useState([]);
    const [selectedBreakType, setSelectedBreakType] = useState('');

    // Search terms
    const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
    const [breakSearchTerm, setBreakSearchTerm] = useState('');

    // Edit Breaks Modal State
    const [editBreaksModalEmp, setEditBreaksModalEmp] = useState(null);

    // Track which employee's time field is currently focused for editing
    const [editingTimeEmpId, setEditingTimeEmpId] = useState(null);

    useEffect(() => {
        if (lineId) {
            fetchLineDetails();
        }
    }, [lineId]);

    const fetchBreakTypes = async (shiftId) => {
        try {
            const url = shiftId ? `?shift_id=${shiftId}` : '';
            const res = await ProductionService.getBreakTypes(url);
            // Filter only active break types if necessary, assuming all returned are active or handled by backend
            setBreakTypes(res.data);
            if (res.data.length > 0) {
                setSelectedBreakType(res.data[0].id);
            } else {
                setSelectedBreakType('');
            }
        } catch (error) {
            console.error('Failed to fetch break types', error);
        }
    };

    const fetchLineDetails = async () => {
        try {
            setLoadingLine(true);
            const res = await ProductionService.getShiftProductionLine(lineId);
            setProductionLine(res.data);
            if (res.data.shift_id) {
                fetchBreakTypes(res.data.shift_id);
            } else {
                fetchBreakTypes();
            }
            fetchAttendance(res.data);
        } catch (err) {
            console.error("Failed to load production line details:", err);
            swalWithBootstrap.fire('Error', 'Could not load production line details.', 'error');
        } finally {
            setLoadingLine(false);
        }
    };

    const fetchAttendance = async (lineData) => {
        try {
            setLoadingAttendance(true);
            const line = lineData || productionLine;
            // Use the base ProductionLine ID (production_line field), not the ShiftProductionLine URL param (lineId)
            const baseLineId = line?.production_line || lineId;
            const res = await ProductionService.getAttendances(`?production_line_id=${baseLineId}&date=${planDate}`);
            const records = res.data.results || res.data;
            setAttendanceRecords(records);

            // Populate local state
            const local = {};
            // Pre-populate with planned employees defaults
            (line?.employees || []).forEach(emp => {
                const dbRec = records.find(r => r.employee === emp.employee);
                local[emp.employee] = {
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
            swalWithBootstrap.fire('Error', 'Could not load attendance logs.', 'error');
        } finally {
            setLoadingAttendance(false);
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
    const handleBulkCheckIn = async () => {
        if (selectedEmployees.length === 0) {
            swalWithBootstrap.fire('Warning', 'Please select at least one employee.', 'warning');
            return;
        }

        const defaultTime = productionLine?.start_time ? productionLine.start_time.substring(0, 5) : '09:00';

        const { value: formValues } = await swalWithBootstrap.fire({
            title: 'Confirm Check-In',
            html: `
                <div style="text-align: left; margin-bottom: 10px; font-size: 14px;">Enter Actual Check-In Time:</div>
                <input id="swal-input-time" type="time" class="swal2-input" value="${defaultTime}" style="margin: 0 auto; display: block;">
                <div style="text-align: center; margin-top: 15px; display: flex; align-items: center; justify-content: center;">
                    <input type="checkbox" id="swal-input-late" class="form-check-input" style="margin-top: 0; margin-right: 8px; cursor: pointer;">
                    <label for="swal-input-late" style="margin-bottom: 0; cursor: pointer; user-select: none;">Mark as Late</label>
                </div>
            `,
            showCancelButton: true,
            focusConfirm: false,
            preConfirm: () => {
                const time = document.getElementById('swal-input-time').value;
                const isLateChecked = document.getElementById('swal-input-late').checked;
                if (!time) {
                    Swal.showValidationMessage('Please select a time');
                }
                return { time, isLateChecked };
            }
        });

        if (!formValues) return;
        const { time: timeStr, isLateChecked } = formValues;

        try {
            setSaving(true);
            const formattedDateTime = `${planDate}T${timeStr}:00`;
            const payload = {
                shift_day_id: productionLine?.shift_day,
                production_line_id: productionLine?.production_line,
                employee_ids: selectedEmployees,
                action_type: isLateChecked ? 'late_check_in' : 'check_in',
                check_in_time: formattedDateTime
            };
            await ProductionService.bulkMarkAttendance(payload);
            swalWithBootstrap.fire('Success', 'Employees checked in successfully.', 'success');
            setSelectedEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Bulk check-in failed.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
        } finally {
            setSaving(false);
        }
    };

    const handleBulkCheckOut = async () => {
        if (selectedEmployees.length === 0) {
            swalWithBootstrap.fire('Warning', 'Please select at least one employee.', 'warning');
            return;
        }

        const defaultTime = productionLine?.end_time ? productionLine.end_time.substring(0, 5) : '17:00';

        const { value: timeStr } = await swalWithBootstrap.fire({
            title: 'Confirm Check-Out',
            text: 'Enter Actual Check-Out Time:',
            input: 'time',
            inputValue: defaultTime,
            showCancelButton: true,
            inputValidator: (value) => {
                if (!value) {
                    return 'Please select a time';
                }
            }
        });

        if (!timeStr) return;

        try {
            setSaving(true);
            const formattedDateTime = `${planDate}T${timeStr}:00`;
            const payload = {
                shift_day_id: productionLine?.shift_day,
                production_line_id: productionLine?.production_line,
                employee_ids: selectedEmployees,
                action_type: 'check_out',
                check_out_time: formattedDateTime
            };
            await ProductionService.bulkMarkAttendance(payload);
            swalWithBootstrap.fire('Success', 'Employees checked out successfully.', 'success');
            setSelectedEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Bulk check-out failed.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
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
                    shift_day_id: productionLine?.shift_day,
                    production_line_id: productionLine?.production_line,
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
            swalWithBootstrap.fire('Success', 'Attendance records updated successfully.', 'success');
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Failed to save changes.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateSingleAttendance = async (empId) => {
        const info = localAttendance[empId];
        if (!info) return;
        try {
            setSaving(true);
            await ProductionService.bulkMarkAttendance({
                shift_day_id: productionLine?.shift_day,
                production_line_id: productionLine?.production_line,
                employee_ids: [parseInt(empId)],
                action_type: 'update_status',
                status: info.status,
                check_in_time: info.check_in_time ? `${planDate}T${info.check_in_time}:00` : null,
                check_out_time: info.check_out_time ? `${planDate}T${info.check_out_time}:00` : null,
                is_overtime_approved: info.is_overtime_approved,
                remarks: info.remarks
            });
            swalWithBootstrap.fire('Success', 'Attendance updated successfully.', 'success');
            setEditingTimeEmpId(null);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Failed to update.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
        } finally {
            setSaving(false);
        }
    };

    // Break Actions
    const handleStartBreak = async () => {
        if (selectedBreakEmployees.length === 0) {
            swalWithBootstrap.fire('Warning', 'Select at least one checked-in employee.', 'warning');
            return;
        }

        // Filter out employees who have already checked out
        const eligible = selectedBreakEmployees.filter(id => !isCheckedOut(id));
        if (eligible.length === 0) {
            swalWithBootstrap.fire('Warning', 'Cannot start break — all selected employees have already checked out.', 'warning');
            return;
        }
        if (eligible.length < selectedBreakEmployees.length) {
            swalWithBootstrap.fire('Info', `${selectedBreakEmployees.length - eligible.length} employee(s) skipped because they have already checked out.`, 'info');
        }

        try {
            setSaving(true);
            const payload = {
                production_line_id: productionLine?.production_line,
                shift_day_id: productionLine?.shift_day,
                employee_ids: eligible,
                break_type: selectedBreakType,
                start_time: new Date().toISOString()
            };
            await ProductionService.startBreakLog(payload);
            swalWithBootstrap.fire('Success', 'Break started successfully.', 'success');
            setSelectedBreakEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Could not start break.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
        } finally {
            setSaving(false);
        }
    };

    const handleEndBreak = async () => {
        if (selectedBreakEmployees.length === 0) {
            swalWithBootstrap.fire('Warning', 'Select at least one employee on break.', 'warning');
            return;
        }

        // Filter out employees who have already checked out
        const eligible = selectedBreakEmployees.filter(id => !isCheckedOut(id));
        if (eligible.length === 0) {
            swalWithBootstrap.fire('Warning', 'Cannot end break — all selected employees have already checked out.', 'warning');
            return;
        }
        if (eligible.length < selectedBreakEmployees.length) {
            swalWithBootstrap.fire('Info', `${selectedBreakEmployees.length - eligible.length} employee(s) skipped because they have already checked out.`, 'info');
        }

        try {
            setSaving(true);
            const payload = {
                production_line_id: productionLine?.production_line,
                shift_day_id: productionLine?.shift_day,
                employee_ids: eligible,
                end_time: new Date().toISOString()
            };
            await ProductionService.endBreakLog(payload);
            swalWithBootstrap.fire('Success', 'Break ended successfully.', 'success');
            setSelectedBreakEmployees([]);
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Could not end break.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
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
        // Sum directly from the breaks array to include all break types regardless of reduce_from_total_hours
        const completedBreaks = (record.breaks || []).filter(b => b.end_time);
        return {
            total: completedBreaks.reduce((sum, b) => sum + (b.duration_minutes || 0), 0),
            exceeded: completedBreaks.reduce((sum, b) => sum + (b.exceeded_minutes || 0), 0)
        };
    };

    // Get overtime data from server-calculated fields
    const getOvertimeData = (empId) => {
        const record = attendanceRecords.find(r => r.employee === empId);
        if (!record) return { netWorkMinutes: 0, overtimeMinutes: 0, isOvertimeApproved: false };
        return {
            netWorkMinutes: record.net_work_minutes || 0,
            overtimeMinutes: record.overtime_minutes || 0,
            isOvertimeApproved: record.is_overtime_approved || false,
        };
    };

    // Check if any employee on this line has overtime
    const hasAnyOvertime = attendanceRecords.some(r => (r.overtime_minutes || 0) > 0);

    const handleOvertimeApproval = async (empId, approved) => {
        try {
            setSaving(true);
            await ProductionService.bulkMarkAttendance({
                shift_day_id: productionLine?.shift_day,
                production_line_id: productionLine?.production_line,
                employee_ids: [parseInt(empId)],
                action_type: 'overtime_toggle',
                is_overtime_approved: approved
            });
            fetchAttendance();
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Failed to update overtime approval.';
            swalWithBootstrap.fire('Warning', errMsg, 'warning');
        } finally {
            setSaving(false);
        }
    };

    const fmtMins = (mins) => {
        if (!mins) return '--';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const isCheckedIn = (empId) => {
        const local = localAttendance[empId];
        return local && local.check_in_time;
    };

    const isCheckedOut = (empId) => {
        const local = localAttendance[empId];
        return local && local.check_out_time;
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
        const allIds = (productionLine?.employees || []).map(emp => emp.employee);
        if (selectedEmployees.length === allIds.length) {
            setSelectedEmployees([]);
        } else {
            setSelectedEmployees(allIds);
        }
    };

    const selectAllBreakEmployees = () => {
        const checkedInIds = (productionLine?.employees || [])
            .map(emp => emp.employee)
            .filter(id => isCheckedIn(id));

        if (selectedBreakEmployees.length === checkedInIds.length) {
            setSelectedBreakEmployees([]);
        } else {
            setSelectedBreakEmployees(checkedInIds);
        }
    };

    if (loadingLine) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" variant="success" />
                <p className="mt-2 text-muted">Retrieving line layout...</p>
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <style>{`
                .swal2-popup {
                    border-radius: 12px !important;
                    font-family: inherit !important;
                }
                .swal2-title {
                    font-size: 20px !important;
                    font-weight: 600 !important;
                    color: #1e293b !important;
                }
                .swal2-confirm {
                    border-radius: 6px !important;
                    font-weight: 500 !important;
                    font-size: 13px !important;
                }
                .swal2-cancel {
                    border-radius: 6px !important;
                    font-weight: 500 !important;
                    font-size: 13px !important;
                    background-color: #f1f5f9 !important;
                    color: #475569 !important;
                }
                .swal2-cancel:hover {
                    background-color: #e2e8f0 !important;
                }
                .swal2-input {
                    max-width: 220px !important;
                    margin: 15px auto !important;
                    height: 38px !important;
                    border-radius: 6px !important;
                    border: 1px solid #cbd5e1 !important;
                    font-size: 14px !important;
                    text-align: center !important;
                }
                .custom-search-input {
                    padding-left: 36px !important;
                    height: 36px !important;
                    border-radius: 8px !important;
                    font-size: 13px !important;
                    border: 1px solid #e2e8f0 !important;
                    background-color: #f8fafc !important;
                }
                .custom-search-input:focus {
                    background-color: #fff !important;
                    border-color: #34D574 !important;
                    box-shadow: 0 0 0 0.2rem rgba(52, 213, 116, 0.25) !important;
                }
                .search-icon-wrapper {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    font-size: 16px;
                    z-index: 4;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <h4 className="card-title text-primary font-w600 mb-0">
                                <i className="fa fa-clock text-primary me-2"></i>
                                {productionLine?.production_line_name}
                                {productionLine?.shift_name && (
                                    <span className="text-muted fw-normal mx-2">—</span>
                                )}
                                {productionLine?.shift_name && (
                                    <span className="text-primary">{productionLine.shift_name}</span>
                                )}
                                <span className="text-muted fw-normal ms-2" style={{ fontSize: '14px' }}>
                                | {planDate ? planDate.split('-').reverse().join('-') : ''}
                                </span>
                            </h4>
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => navigate('/production/shift-planning')}
                                style={{ borderRadius: '6px', height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center' }}
                            >
                                <i className="fa fa-arrow-left me-1"></i> Back to Shifts
                            </Button>
                        </Card.Header>
                        <Card.Body style={{ minHeight: '450px' }}>
                            {loadingAttendance ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="success" />
                                    <p className="mt-2 text-muted">Loading attendance activity logs...</p>
                                </div>
                            ) : (
                                <Row>
                                    {/* LEFT COLUMN: Attendance Marking */}
                                    <Col lg={7} md={12} className="border-end pr-3 mt-2">
                                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3">
                                                <h5 className="mb-0 font-w600 text-dark" style={{ fontSize: '15px' }}>
                                                    <span className="badge bg-success me-2">1</span> Attendance List
                                                </h5>
                                                <div style={{ width: '220px', position: 'relative' }}>
                                                    <i className="flaticon-381-search-2 search-icon-wrapper"></i>
                                                    <Form.Control
                                                        type="text"
                                                        className="custom-search-input"
                                                        placeholder="Search Employee..."
                                                        value={attendanceSearchTerm}
                                                        onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="d-flex gap-1">
                                                {editingTimeEmpId ? (
                                                    <>
                                                        <Button
                                                            variant="success"
                                                            size="xs"
                                                            disabled={saving}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => handleUpdateSingleAttendance(editingTimeEmpId)}
                                                        >
                                                            <i className="fa fa-check me-1"></i> Update
                                                        </Button>
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="xs"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => setEditingTimeEmpId(null)}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="outline-primary" size="xs" onClick={() => handleBulkCheckIn()}>
                                                            Check-In
                                                        </Button>

                                                        <Button variant="outline-danger" size="xs" onClick={() => handleBulkCheckOut()}>
                                                            Check-Out
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="table-responsive" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
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
                                                        <th className="text-center" style={{ width: '70px' }}>Net Hrs</th>
                                                        {hasAnyOvertime && <th className="text-center" style={{ width: '70px', color: '#f59e0b' }}>OT Hrs</th>}
                                                        {hasAnyOvertime && <th className="text-center" style={{ width: '60px', color: '#f59e0b' }}>OT Approved</th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(productionLine?.employees || []).filter(emp =>
                                                        (emp.employee_name || '').toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                                                        (emp.employee_code || emp.employee || '').toString().toLowerCase().includes(attendanceSearchTerm.toLowerCase())
                                                    ).length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="text-center py-4 text-muted">No employees found.</td>
                                                        </tr>
                                                    ) : (
                                                        productionLine.employees.filter(emp =>
                                                            (emp.employee_name || '').toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                                                            (emp.employee_code || emp.employee || '').toString().toLowerCase().includes(attendanceSearchTerm.toLowerCase())
                                                        ).map(emp => {
                                                            const empId = emp.employee;
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
                                                                        <div className="text-muted" style={{ fontSize: '10px' }}>{emp.designation_name || 'No Designation'}</div>
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <Form.Select
                                                                            size="sm"
                                                                            value={local.status}
                                                                            onChange={(e) => handleLocalChange(empId, 'status', e.target.value)}
                                                                            onFocus={() => setEditingTimeEmpId(empId)}
                                                                            onBlur={() => setTimeout(() => setEditingTimeEmpId(prev => prev === empId ? null : prev), 200)}
                                                                            style={{ fontSize: '11px', height: '28px', minWidth: '90px' }}
                                                                        >
                                                                            <option value="ABSENT">Absent</option>
                                                                            <option value="PRESENT">Present</option>
                                                                            <option value="LATE">Late</option>
                                                                        </Form.Select>
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <Form.Control
                                                                            type="time"
                                                                            size="sm"
                                                                            value={local.check_in_time}
                                                                            onChange={(e) => handleLocalChange(empId, 'check_in_time', e.target.value)}
                                                                            onFocus={() => setEditingTimeEmpId(empId)}
                                                                            onBlur={() => setTimeout(() => setEditingTimeEmpId(prev => prev === empId ? null : prev), 200)}
                                                                            disabled={!local.check_in_time}
                                                                            style={{ fontSize: '11px', height: '28px', backgroundColor: !local.check_in_time ? '#f1f5f9' : undefined, cursor: !local.check_in_time ? 'not-allowed' : undefined }}
                                                                            title={!local.check_in_time ? 'Use the Check-In button to check in this employee' : 'Edit check-in time and click Update'}
                                                                        />
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <Form.Control
                                                                            type="time"
                                                                            size="sm"
                                                                            value={local.check_out_time}
                                                                            onChange={(e) => handleLocalChange(empId, 'check_out_time', e.target.value)}
                                                                            onFocus={() => setEditingTimeEmpId(empId)}
                                                                            onBlur={() => setTimeout(() => setEditingTimeEmpId(prev => prev === empId ? null : prev), 200)}
                                                                            disabled={!local.check_in_time}
                                                                            style={{ fontSize: '11px', height: '28px', backgroundColor: !local.check_in_time ? '#f1f5f9' : undefined, cursor: !local.check_in_time ? 'not-allowed' : undefined }}
                                                                            title={!local.check_in_time ? 'Employee must be checked in first' : 'Edit check-out time and click Update'}
                                                                        />
                                                                    </td>
                                                                    {/* Net Worked Hours */}
                                                                    <td className="text-center align-middle">
                                                                        {(() => {
                                                                            const ot = getOvertimeData(empId);
                                                                            return ot.netWorkMinutes > 0
                                                                                ? <span style={{ fontSize: '11px', fontWeight: 600 }}>{fmtMins(ot.netWorkMinutes)}</span>
                                                                                : <span className="text-muted" style={{ fontSize: '11px' }}>--</span>;
                                                                        })()}
                                                                    </td>
                                                                    {/* OT Hours — conditional column */}
                                                                    {hasAnyOvertime && (
                                                                        <td className="text-center align-middle">
                                                                            {(() => {
                                                                                const ot = getOvertimeData(empId);
                                                                                return ot.overtimeMinutes > 0 ? (
                                                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
                                                                                        {fmtMins(ot.overtimeMinutes)}
                                                                                    </span>
                                                                                ) : <span className="text-muted" style={{ fontSize: '11px' }}>--</span>;
                                                                            })()}
                                                                        </td>
                                                                    )}
                                                                    {/* OT Approved checkbox — conditional column */}
                                                                    {hasAnyOvertime && (
                                                                        <td className="text-center align-middle">
                                                                            {(() => {
                                                                                const ot = getOvertimeData(empId);
                                                                                return ot.overtimeMinutes > 0 ? (
                                                                                    <Form.Check
                                                                                        type="checkbox"
                                                                                        checked={ot.isOvertimeApproved}
                                                                                        onChange={(e) => handleOvertimeApproval(empId, e.target.checked)}
                                                                                        title={ot.isOvertimeApproved ? 'Overtime approved — uncheck to revoke' : 'Check to approve overtime'}
                                                                                    />
                                                                                ) : null;
                                                                            })()}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </Table>
                                        </div>

                                    </Col>

                                    {/* RIGHT COLUMN: Break Tracking */}
                                    <Col lg={5} md={12} className="pl-3 mt-2">
                                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-3">
                                                <h5 className="mb-0 font-w600 text-dark" style={{ fontSize: '15px' }}>
                                                    <span className="badge bg-success me-2">2</span> Breaks Tracking
                                                </h5>
                                                <div style={{ width: '180px', position: 'relative' }}>
                                                    <i className="flaticon-381-search-2 search-icon-wrapper"></i>
                                                    <Form.Control
                                                        type="text"
                                                        className="custom-search-input"
                                                        placeholder="Search Employee..."
                                                        value={breakSearchTerm}
                                                        onChange={(e) => setBreakSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center gap-1">
                                                <Form.Select
                                                    size="sm"
                                                    value={selectedBreakType}
                                                    onChange={(e) => setSelectedBreakType(e.target.value)}
                                                    style={{ fontSize: '12px', width: '120px', height: '30px', padding: '2px 8px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                                                >
                                                    {breakTypes.map(bt => (
                                                        <option key={bt.id} value={bt.id}>{bt.name}</option>
                                                    ))}
                                                </Form.Select>
                                                <Button variant="outline-primary" size="xs" onClick={handleStartBreak}>
                                                    Start
                                                </Button>
                                                <Button variant="outline-danger" size="xs" onClick={handleEndBreak}>
                                                    End
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="table-responsive" style={{ border: '1px solid #eee', borderRadius: '8px' }}>
                                            <Table hover size="sm" className="mb-0" style={{ fontSize: '12px' }}>
                                                <thead className="bg-light">
                                                    <tr>
                                                        <th className="text-center" style={{ width: '40px' }}>
                                                            <Form.Check
                                                                type="checkbox"
                                                                checked={selectedBreakEmployees.length > 0 && selectedBreakEmployees.length === (productionLine?.employees || []).filter(e => isCheckedIn(e.employee)).length}
                                                                onChange={selectAllBreakEmployees}
                                                            />
                                                        </th>
                                                        <th>Operator</th>
                                                        <th>Break Status</th>
                                                        <th className="text-center" style={{ width: '100px' }}>Logged Totals</th>
                                                        <th className="text-end" style={{ width: '80px' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(productionLine?.employees || []).filter(emp =>
                                                        (emp.employee_name || '').toLowerCase().includes(breakSearchTerm.toLowerCase()) ||
                                                        (emp.employee_code || emp.employee || '').toString().toLowerCase().includes(breakSearchTerm.toLowerCase())
                                                    ).length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" className="text-center py-4 text-muted">No employees found.</td>
                                                        </tr>
                                                    ) : (
                                                        productionLine.employees.filter(emp =>
                                                            (emp.employee_name || '').toLowerCase().includes(breakSearchTerm.toLowerCase()) ||
                                                            (emp.employee_code || emp.employee || '').toString().toLowerCase().includes(breakSearchTerm.toLowerCase())
                                                        ).map(emp => {
                                                            const empId = emp.employee;
                                                            const activeBreak = getActiveBreak(empId);
                                                            const breakMetrics = getBreakMetrics(empId);
                                                            const checkedIn = isCheckedIn(empId);
                                                            const checkedOut = isCheckedOut(empId);

                                                            return (
                                                                <tr key={empId} className={!checkedIn || checkedOut ? 'bg-light text-muted' : ''}>
                                                                    <td className="text-center align-middle">
                                                                        <Form.Check
                                                                            type="checkbox"
                                                                            checked={selectedBreakEmployees.includes(empId)}
                                                                            onChange={() => toggleSelectBreakEmployee(empId)}
                                                                            disabled={!checkedIn || checkedOut}
                                                                        />
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        <strong>{emp.employee_name}</strong>
                                                                        {!checkedIn && <div className="text-danger" style={{ fontSize: '10px' }}>Not Checked-In</div>}
                                                                    </td>
                                                                    <td className="align-middle">
                                                                        {activeBreak ? (
                                                                            <Badge bg="danger" className="blink">
                                                                                On {activeBreak.break_type_name || activeBreak.break_type}
                                                                            </Badge>
                                                                        ) : isCheckedOut(empId) ? (
                                                                            <span className="text-secondary font-w500">Checked Out</span>
                                                                        ) : checkedIn ? (
                                                                            <span className="text-success font-w500">Working</span>
                                                                        ) : (
                                                                            <span className="text-muted">--</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-center align-middle">
                                                                        <div>
                                                                            <strong style={{ fontSize: '12px' }}>
                                                                                {breakMetrics.total > 0 ? fmtMins(breakMetrics.total) : '--'}
                                                                            </strong>
                                                                        </div>
                                                                        {breakMetrics.exceeded > 0 && (
                                                                            <div className="text-danger" style={{ fontSize: '10px' }}>+{fmtMins(breakMetrics.exceeded)} excess</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="text-end align-middle">
                                                                        <Button
                                                                            variant="outline-primary"
                                                                            size="sm"
                                                                            onClick={() => setEditBreaksModalEmp(emp)}
                                                                            style={{ fontSize: '11px', padding: '3px 8px' }}
                                                                            title="Edit Breaks"
                                                                        >
                                                                            <i className="fa fa-history"></i>
                                                                        </Button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </Table>
                                        </div>

                                        <div className="mt-3 mb-3 p-3 bg-light rounded" style={{ fontSize: '11px', border: '1px solid #e2e8f0' }}>
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
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <EditBreaksModal
                show={!!editBreaksModalEmp}
                onHide={() => setEditBreaksModalEmp(null)}
                employee={editBreaksModalEmp}
                attendanceRecords={attendanceRecords}
                refreshData={fetchAttendance}
                breakTypes={breakTypes}
            />
        </div>
    );
};

const EditBreaksModal = ({ show, onHide, employee, attendanceRecords, refreshData, breakTypes }) => {
    const [editingBreakId, setEditingBreakId] = useState(null);
    const [editData, setEditData] = useState({ start_time: '', end_time: '', break_type: '' });

    if (!employee) return null;

    const record = attendanceRecords.find(r => r.employee === employee.employee);
    const breaks = record?.breaks || [];

    const handleEditClick = (b) => {
        setEditingBreakId(b.id);
        setEditData({
            start_time: b.start_time ? b.start_time.substring(11, 16) : '',
            end_time: b.end_time ? b.end_time.substring(11, 16) : '',
            break_type: b.break_type || ''
        });
    };

    const handleSave = async (b) => {
        try {
            // Need to append the date (use the existing date from the break or today if missing)
            const dateStr = b.start_time ? b.start_time.substring(0, 10) : new Date().toISOString().substring(0, 10);
            const payload = {};
            if (editData.start_time) payload.start_time = `${dateStr}T${editData.start_time}:00`;
            if (editData.end_time) payload.end_time = `${dateStr}T${editData.end_time}:00`;
            if (editData.break_type) payload.break_type = editData.break_type;

            const newStart = new Date(payload.start_time || b.start_time);
            const newEnd = payload.end_time ? new Date(payload.end_time) : (b.end_time ? new Date(b.end_time) : null);

            if (newEnd && newStart >= newEnd) {
                Swal.fire('Warning', 'Start time must be before end time.', 'warning');
                return;
            }

            // Create a hypothetical list of all breaks with the updated times for validation
            const updatedBreaksList = breaks.map(x => {
                if (x.id === b.id) {
                    return { ...x, start_time: payload.start_time || b.start_time, end_time: payload.end_time || b.end_time };
                }
                return x;
            });

            // Sort by start time to enforce chronological order
            updatedBreaksList.sort((x, y) => new Date(x.start_time) - new Date(y.start_time));

            for (let i = 0; i < updatedBreaksList.length - 1; i++) {
                const current = updatedBreaksList[i];
                const next = updatedBreaksList[i + 1];

                if (current.end_time) {
                    if (new Date(next.start_time) < new Date(current.end_time)) {
                        Swal.fire('Warning', 'Overlapping breaks detected. The start time of the next break must be after the end time of the previous break.', 'warning');
                        return;
                    }
                } else {
                    Swal.fire('Warning', 'A previous break has not ended yet. Cannot overlap.', 'warning');
                    return;
                }
            }

            await ProductionService.patchBreakLog(b.id, payload);
            setEditingBreakId(null);
            refreshData();
        } catch (err) {
            Swal.fire('Error', 'Failed to update break', 'error');
        }
    };

    const handleDelete = async (b) => {
        const result = await Swal.fire({
            title: 'Delete Break?',
            text: 'Are you sure you want to delete this break record?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await ProductionService.deleteBreakLog(b.id);
                refreshData();
            } catch (err) {
                Swal.fire('Error', 'Failed to delete break', 'error');
            }
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title className="fs-5">Edit Breaks - {employee.employee_name}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {breaks.length === 0 ? (
                    <div className="text-center py-4 text-muted">No breaks logged for this employee yet.</div>
                ) : (
                    <Table bordered hover responsive size="sm" className="mb-0">
                        <thead className="bg-light">
                            <tr>
                                <th>Type</th>
                                <th>Start Time</th>
                                <th>End Time</th>
                                <th className="text-center">Exceeded (min)</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {breaks.map(b => (
                                <tr key={b.id}>
                                    {editingBreakId === b.id ? (
                                        <>
                                            <td className="align-middle">
                                                <Form.Select
                                                    size="sm"
                                                    value={editData.break_type}
                                                    onChange={e => setEditData({ ...editData, break_type: e.target.value })}
                                                >
                                                    <option value="">Select Break Type</option>
                                                    {breakTypes.map(bt => (
                                                        <option key={bt.id} value={bt.id}>{bt.name}</option>
                                                    ))}
                                                </Form.Select>
                                            </td>
                                            <td className="align-middle">
                                                <Form.Control
                                                    type="time"
                                                    size="sm"
                                                    value={editData.start_time}
                                                    onChange={e => setEditData({ ...editData, start_time: e.target.value })}
                                                />
                                            </td>
                                            <td className="align-middle">
                                                <Form.Control
                                                    type="time"
                                                    size="sm"
                                                    value={editData.end_time}
                                                    onChange={e => setEditData({ ...editData, end_time: e.target.value })}
                                                />
                                            </td>
                                            <td className="text-center align-middle">{b.exceeded_minutes || 0}</td>
                                            <td className="text-end align-middle">
                                                <Button variant="primary" size="sm" className="me-1" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleSave(b)}>
                                                    <i className="fa fa-check"></i>
                                                </Button>
                                                <Button variant="danger" size="sm" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setEditingBreakId(null)}>
                                                    <i className="fa fa-times"></i>
                                                </Button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="align-middle">{b.break_type_name || b.break_type}</td>
                                            <td className="align-middle">{b.start_time ? new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                                            <td className="align-middle">{b.end_time ? new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                                            <td className="text-center align-middle">{b.exceeded_minutes || 0}</td>
                                            <td className="text-end align-middle">
                                                <Button variant="outline-primary" size="sm" className="me-1" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleEditClick(b)}>
                                                    <i className="fa fa-pen"></i>
                                                </Button>
                                                <Button variant="outline-danger" size="sm" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleDelete(b)}>
                                                    <i className="fa fa-trash"></i>
                                                </Button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default AttendanceBreakMarkingPage;
