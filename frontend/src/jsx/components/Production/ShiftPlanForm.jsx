import React, { useState, useEffect, useContext } from 'react';
import { Row, Col, Card, Form, Button, Table, Spinner, Badge, Tabs, Tab, Modal } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import ProductionService from '../../../services/ProductionService';
import MainSweetAlert from 'sweetalert2';
import { usePageTitle } from '../../../context/TitleContext';
import { ThemeContext } from '../../../context/ThemeContext';
import ShiftEmployeeModal from './ShiftEmployeeModal';

// ── Exclude Dates Modal ──────────────────────────────────────────────────────
const ExcludeDatesModal = ({ show, onHide, datesList, shifts, activeShiftDates, onSave }) => {
    const [tempActive, setTempActive] = useState({});

    useEffect(() => {
        if (show) {
            const clone = {};
            shifts.forEach(s => {
                clone[s.id] = [...(activeShiftDates[s.id] || [])];
            });
            setTempActive(clone);
        }
    }, [show, activeShiftDates, shifts]);

    const handleToggle = (date, shiftId) => {
        setTempActive(prev => {
            const current = prev[shiftId] || [];
            const next = current.includes(date)
                ? current.filter(d => d !== date)
                : [...current, date];
            return { ...prev, [shiftId]: next };
        });
    };

    const handleToggleAllForShift = (shiftId, selectAll) => {
        setTempActive(prev => ({
            ...prev,
            [shiftId]: selectAll ? [...datesList] : []
        }));
    };

    const handleSave = () => {
        onSave(tempActive);
        onHide();
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title className="font-w600" style={{ fontSize: '18px', color: '#1e293b' }}>
                    Configure Shift Active Dates
                </Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '450px', overflowY: 'auto' }}>
                <p className="text-muted mb-4" style={{ fontSize: '13px' }}>
                    Select which calendar dates each shift is scheduled to run. Deselect shifts for dates they do not apply to (e.g. no Night Shift on Fridays or no Morning Shift on Sundays).
                </p>
                <div className="table-responsive">
                    <Table bordered hover align="middle" className="mb-0">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th>Date</th>
                                {shifts.map(s => (
                                    <th key={s.id} className="text-center">
                                        <div>{s.name}</div>
                                        <div className="d-flex gap-1 justify-content-center mt-1">
                                            <Button
                                                variant="outline-secondary"
                                                size="xs"
                                                style={{ fontSize: '10px', padding: '1px 4px' }}
                                                onClick={() => handleToggleAllForShift(s.id, true)}
                                            >
                                                All
                                            </Button>
                                            <Button
                                                variant="outline-secondary"
                                                size="xs"
                                                style={{ fontSize: '10px', padding: '1px 4px' }}
                                                onClick={() => handleToggleAllForShift(s.id, false)}
                                            >
                                                None
                                            </Button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {datesList.map(date => {
                                const parts = date.split('-');
                                const formatted = new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                });
                                return (
                                    <tr key={date}>
                                        <td><strong>{formatted}</strong></td>
                                        {shifts.map(s => {
                                            const isChecked = (tempActive[s.id] || []).includes(date);
                                            return (
                                                <td key={s.id} className="text-center" style={{ cursor: 'pointer' }} onClick={() => handleToggle(date, s.id)}>
                                                    <Form.Check
                                                        type="checkbox"
                                                        id={`chk-${s.id}-${date}`}
                                                        checked={isChecked}
                                                        onChange={() => { }}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Confirm Schedule</Button>
            </Modal.Footer>
        </Modal>
    );
};

// ── Main Shift Plan Form ─────────────────────────────────────────────────────
const ShiftPlanForm = () => {
    usePageTitle("Shift Plan");
    const { saveBtnColor, cancelBtnColor } = useContext(ThemeContext) || {};
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [loadingMasters, setLoadingMasters] = useState(true);

    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayStr();

    // Header
    const [planName, setPlanName] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [factoryId, setFactoryId] = useState('');

    // Masters
    const [shifts, setShifts] = useState([]);
    const [factories, setFactories] = useState([]);
    const [productionLines, setProductionLines] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [employeeGroups, setEmployeeGroups] = useState([]);

    // Custom state for day-by-day planning
    const [activeDay, setActiveDay] = useState('template'); // 'template' or date string
    const [datesList, setDatesList] = useState([]); // All dates in range
    const [activeDates, setActiveDates] = useState([]); // Selected dates (with at least one active shift)
    const [checkedDates, setCheckedDates] = useState([]); // Dates checked to receive copy
    const [activeShiftDates, setActiveShiftDates] = useState({}); // shiftId -> list of active date strings
    const [lastSelectedRange, setLastSelectedRange] = useState('');
    const [scheduleData, setScheduleData] = useState({
        template: {} // shiftId -> list of product lines
    });

    const [activeShiftTab, setActiveShiftTab] = useState('');
    const [copyTargetShift, setCopyTargetShift] = useState('all'); // 'all' or shiftId string

    // Automatically check all active dates except the active date tab on load or active tab changes
    useEffect(() => {
        setCheckedDates(activeDates.filter(d => d !== activeDay));
    }, [activeDay, activeDates]);

    // Modals State
    const [showModal, setShowModal] = useState(false);
    const [showExcludeModal, setShowExcludeModal] = useState(false);
    const [activeModalData, setActiveModalData] = useState(null); // { shiftId, lineIndex, employeeGroupId, planDate, startTime, endTime }

    useEffect(() => {
        fetchMasters();
    }, []);

    const getDatesInRange = (startStr, endStr) => {
        if (!startStr || !endStr) return [];
        const start = new Date(startStr);
        const end = new Date(endStr);
        const dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    };

    // Calculate dates list and trigger exclude modal when date range changes
    useEffect(() => {
        if (fromDate && toDate && shifts.length > 0) {
            const rangeKey = `${fromDate}_${toDate}`;
            if (rangeKey !== lastSelectedRange) {
                const list = getDatesInRange(fromDate, toDate);
                setDatesList(list);
                setLastSelectedRange(rangeKey);

                // Initialize active shift dates (All dates checked by default)
                const initialActiveShiftDates = {};
                shifts.forEach(s => {
                    initialActiveShiftDates[s.id] = list;
                });
                setActiveShiftDates(initialActiveShiftDates);
                setActiveDates(list);

                // Set first date of range as the default active day
                if (list.length > 0) {
                    setActiveDay(list[0]);
                } else {
                    setActiveDay('template');
                }

                // Initialize scheduleData structure
                setScheduleData(prev => {
                    const next = { ...prev };
                    list.forEach(d => {
                        if (!next[d]) {
                            next[d] = {};
                            shifts.forEach(s => {
                                next[d][s.id] = [];
                            });
                        }
                    });
                    return next;
                });

                // Automatically open date-shift configuration modal
                setShowExcludeModal(true);
            }
        } else {
            setDatesList([]);
            setActiveDates([]);
            setActiveShiftDates({});
            setActiveDay('template');
            setLastSelectedRange('');
        }
    }, [fromDate, toDate, shifts, lastSelectedRange]);

    useEffect(() => {
        if (shifts.length > 0 && !activeShiftTab) {
            setActiveShiftTab(shifts[0].id.toString());
        }
    }, [shifts, activeShiftTab]);

    // Handle shift tabs active fallback when switching activeDay or modifying schedule
    useEffect(() => {
        if (activeDay !== 'template' && activeShiftTab && shifts.length > 0) {
            const isCurrentTabActive = (activeShiftDates[activeShiftTab] || []).includes(activeDay);
            if (!isCurrentTabActive) {
                const firstActive = shifts.find(s => (activeShiftDates[s.id] || []).includes(activeDay));
                if (firstActive) {
                    setActiveShiftTab(firstActive.id.toString());
                }
            }
        }
    }, [activeDay, activeShiftDates, activeShiftTab, shifts]);

    const fetchMasters = async () => {
        setLoadingMasters(true);
        try {
            const [resFactories, resLines, resItems, resGroups] = await Promise.all([
                ProductionService.getFactories(),
                ProductionService.getProductionLines(),
                ProductionService.getStockItems('?has_bom=true'),
                ProductionService.getEmployeeGroups()
            ]);

            setFactories(resFactories.data.results || resFactories.data);
            setProductionLines(resLines.data.results || resLines.data);
            setStockItems(resItems.data.results || resItems.data);
            setEmployeeGroups(resGroups.data.results || resGroups.data);
        } catch (error) {
            console.error("Error fetching masters:", error);
            MainSweetAlert.fire('Error', 'Failed to load master data.', 'error');
        } finally {
            setLoadingMasters(false);
        }
    };

    // Load Plan details for editing
    useEffect(() => {
        if (id && factories.length > 0) {
            const loadPlanForEditing = async () => {
                try {
                    setLoadingMasters(true);
                    const planRes = await ProductionService.getShiftPlan(id);
                    const plan = planRes.data;

                    setPlanName(plan.plan_name);
                    setFromDate(plan.from_date);
                    setToDate(plan.to_date);
                    setRemarks(plan.remarks || '');
                    setFactoryId(plan.factory ? String(plan.factory) : '');

                    // Fetch shifts for this factory (guard against null factory)
                    const params = plan.factory ? `?factory_id=${plan.factory}` : '';
                    const shiftsRes = await ProductionService.getShifts(params);
                    const shiftsList = shiftsRes.data.results || shiftsRes.data;
                    setShifts(shiftsList);
                    if (shiftsList.length > 0) {
                        setActiveShiftTab(shiftsList[0].id.toString());
                    }

                    // Build dates list
                    const list = getDatesInRange(plan.from_date, plan.to_date);
                    setDatesList(list);
                    setLastSelectedRange(`${plan.from_date}_${plan.to_date}`);

                    // Initialize activeShiftDates mapping
                    const loadedActiveShiftDates = {};
                    shiftsList.forEach(s => {
                        loadedActiveShiftDates[s.id] = [];
                    });

                    // Build scheduleData and activeShiftDates from plan.days
                    const loadedSchedule = { template: {} };
                    shiftsList.forEach(s => {
                        loadedSchedule.template[s.id] = [];
                    });

                    list.forEach(d => {
                        loadedSchedule[d] = {};
                        shiftsList.forEach(s => {
                            loadedSchedule[d][s.id] = [];
                        });
                    });

                    (plan.days || []).forEach(day => {
                        const dateStr = day.plan_date;
                        const shiftId = day.shift?.id || day.shift;

                        if (shiftId && loadedActiveShiftDates[shiftId] !== undefined) {
                            if (!loadedActiveShiftDates[shiftId].includes(dateStr)) {
                                loadedActiveShiftDates[shiftId].push(dateStr);
                            }
                        }

                        const lines = (day.production_lines || []).map(line => ({
                            production_line_id: line.production_line,
                            stock_item_id: line.stock_item,
                            planned_quantity: line.planned_quantity,
                            start_time: line.start_time ? line.start_time.substring(0, 5) : '',
                            end_time: line.end_time ? line.end_time.substring(0, 5) : '',
                            employee_group_id: line.employee_group,
                            employees: (line.employees || []).map(emp => emp.employee)
                        }));

                        if (loadedSchedule[dateStr] && shiftId) {
                            loadedSchedule[dateStr][shiftId] = lines;
                        }
                    });

                    setActiveShiftDates(loadedActiveShiftDates);

                    // Build activeDates (dates with at least one active shift)
                    const uniqueActiveDates = [];
                    list.forEach(d => {
                        const hasActiveShift = shiftsList.some(s => (loadedActiveShiftDates[s.id] || []).includes(d));
                        if (hasActiveShift) {
                            uniqueActiveDates.push(d);
                        }
                    });
                    setActiveDates(uniqueActiveDates);
                    setScheduleData(loadedSchedule);

                    if (uniqueActiveDates.length > 0) {
                        setActiveDay(uniqueActiveDates[0]);
                    } else {
                        setActiveDay('template');
                    }

                } catch (err) {
                    console.error("Error loading plan details for editing:", err);
                    console.error("Response data:", err?.response?.data);
                    const msg = err?.response?.data?.detail || err?.message || 'Failed to load plan details.';
                    MainSweetAlert.fire('Error', msg, 'error');
                } finally {
                    setLoadingMasters(false);
                }
            };
            loadPlanForEditing();
        }
    }, [id, factories]);

    // Reload shifts when factory changes
    const fetchShiftsByFactory = async (fId) => {
        if (!fId) {
            setShifts([]);
            setScheduleData({ template: {} });
            return;
        }
        try {
            const res = await ProductionService.getShifts(`?factory_id=${fId}`);
            const shiftsList = res.data.results || res.data;
            setShifts(shiftsList);
            const initialTemplate = {};
            shiftsList.forEach(s => {
                initialTemplate[s.id] = [];
            });
            setScheduleData({ template: initialTemplate });
            if (shiftsList.length > 0) {
                setActiveShiftTab(shiftsList[0].id.toString());
            }
        } catch {
            MainSweetAlert.fire('Error', 'Failed to load shifts for this factory.', 'error');
        }
    };

    const applyTemplateToAllDays = () => {
        if (datesList.length === 0) {
            MainSweetAlert.fire('Warning', 'No active scheduling dates selected.', 'warning');
            return;
        }

        if (checkedDates.length === 0) {
            MainSweetAlert.fire('Warning', 'Please check at least one target date to copy shifts to.', 'warning');
            return;
        }

        setScheduleData(prev => {
            const next = { ...prev };
            const sourceKey = activeDay;
            const sourceDayData = prev[sourceKey] || {};

            datesList.forEach(d => {
                // If copying from a specific day, do not overwrite the source day itself!
                if (sourceKey !== 'template' && d === sourceKey) {
                    return;
                }

                // Copy only to checked dates
                if (!checkedDates.includes(d)) {
                    return;
                }

                // Initialize the day object if it doesn't exist, else create a shallow copy to prevent clearing other shifts
                next[d] = next[d] ? { ...next[d] } : {};

                shifts.forEach(shift => {
                    const shiftIdStr = shift.id.toString();
                    
                    if (copyTargetShift === 'all') {
                        // When "All Shifts" is selected, duplicate the currently active shift's lines to all shifts
                        const isActive = (activeShiftDates[shift.id] || []).includes(d);
                        if (isActive) {
                            next[d][shift.id] = (sourceDayData[activeShiftTab] || []).map(line => ({
                                ...line,
                                employees: [...(line.employees || [])]
                            }));
                        } else {
                            next[d][shift.id] = [];
                        }
                    } else if (copyTargetShift === shiftIdStr) {
                        // When a specific shift is selected, copy only that shift to its corresponding target shift
                        const isActive = (activeShiftDates[shift.id] || []).includes(d);
                        if (isActive) {
                            next[d][shift.id] = (sourceDayData[shift.id] || []).map(line => ({
                                ...line,
                                employees: [...(line.employees || [])]
                            }));
                        } else {
                            next[d][shift.id] = [];
                        }
                    }
                });
            });
            return next;
        });

        const label = copyTargetShift === 'all' ? 'All shifts' : shifts.find(s => s.id.toString() === copyTargetShift)?.name;
        const sourceLabel = activeDay === 'template' ? 'Template Layout' : new Date(activeDay.split('-')[0], activeDay.split('-')[1] - 1, activeDay.split('-')[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        MainSweetAlert.fire('Success', `Layout for ${label} copied from ${sourceLabel} to checked dates.`, 'success');
    };

    const getCopyButtonLabel = () => {
        const label = copyTargetShift === 'all' ? 'All shifts' : shifts.find(s => s.id.toString() === copyTargetShift)?.name;
        if (activeDay === 'template') {
            return `Copy ${label} to Selected Days`;
        } else {
            const dateParts = activeDay.split('-');
            const dateStr = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `Copy ${label} from ${dateStr}`;
        }
    };

    const addProductionLine = (shiftId) => {
        const newLine = {
            production_line_id: '',
            stock_item_id: '',
            planned_quantity: '',
            start_time: '',
            end_time: '',
            employee_group_id: '',
            employees: [],
            remarks: ''
        };

        setScheduleData(prev => {
            const dayData = prev[activeDay] || {};
            const shiftLines = dayData[shiftId] || [];
            return {
                ...prev,
                [activeDay]: {
                    ...dayData,
                    [shiftId]: [...shiftLines, newLine]
                }
            };
        });
    };

    const updateProductionLine = (shiftId, index, field, value) => {
        setScheduleData(prev => {
            const dayData = prev[activeDay] || {};
            const shiftLines = [...(dayData[shiftId] || [])];
            shiftLines[index] = {
                ...shiftLines[index],
                [field]: value
            };
            if (field === 'employee_group_id') {
                shiftLines[index].employees = [];
            }
            return {
                ...prev,
                [activeDay]: {
                    ...dayData,
                    [shiftId]: shiftLines
                }
            };
        });
    };

    const removeProductionLine = (shiftId, index) => {
        setScheduleData(prev => {
            const dayData = prev[activeDay] || {};
            const shiftLines = [...(dayData[shiftId] || [])];
            shiftLines.splice(index, 1);
            return {
                ...prev,
                [activeDay]: {
                    ...dayData,
                    [shiftId]: shiftLines
                }
            };
        });
    };

    const openEmployeeModal = (shiftId, index) => {
        const dayData = scheduleData[activeDay] || {};
        const line = (dayData[shiftId] || [])[index];
        if (!line.employee_group_id) {
            MainSweetAlert.fire('Warning', 'Please select an Shift Group first.', 'warning');
            return;
        }
        if (!line.start_time || !line.end_time) {
            MainSweetAlert.fire('Warning', 'Please set Start Time and End Time before assigning employees (needed for conflict checking).', 'warning');
            return;
        }

        const refDate = activeDay === 'template' ? (fromDate || '2026-07-10') : activeDay;

        setActiveModalData({
            shiftId,
            lineIndex: index,
            employeeGroupId: line.employee_group_id,
            planDate: refDate,
            startTime: line.start_time,
            endTime: line.end_time,
            currentEmployees: line.employees || [],
            dayData: dayData,
            productionLines: productionLines
        });
        setShowModal(true);
    };

    const handleUpdateEmployees = (newEmployeesList) => {
        if (!activeModalData) return;
        const { shiftId, lineIndex } = activeModalData;
        updateProductionLine(shiftId, lineIndex, 'employees', newEmployeesList);
        setActiveModalData(prev => ({ ...prev, currentEmployees: newEmployeesList }));
    };

    const handleSave = async (conflictResolution = null) => {
        if (!planName || !fromDate || !toDate) {
            MainSweetAlert.fire('Validation', 'Please fill Plan Name, From Date and To Date', 'warning');
            return;
        }

        const daysPayload = [];
        for (const date of activeDates) {
            const dayShifts = [];
            let dateData = scheduleData[date] || {};
            const hasLines = Object.values(dateData).some(lines => lines.length > 0);

            for (const shift of shifts) {
                const isShiftActive = (activeShiftDates[shift.id] || []).includes(date);
                if (!isShiftActive) continue;

                let lines = dateData[shift.id] || [];
                if (!hasLines && lines.length === 0) {
                    lines = scheduleData['template']?.[shift.id] || [];
                }

                if (lines.length > 0) {
                    // Validation
                    for (let line of lines) {
                        if (!line.production_line_id || !line.stock_item_id || !line.planned_quantity || !line.start_time || !line.end_time) {
                            MainSweetAlert.fire('Validation', `Please fill all required fields in Shift: ${shift.name} for Date: ${date}.`, 'warning');
                            return;
                        }
                    }

                    dayShifts.push({
                        shift_id: shift.id,
                        lines: lines
                    });
                }
            }

            if (dayShifts.length > 0) {
                daysPayload.push({
                    date: date,
                    shifts: dayShifts
                });
            }
        }

        const hasAnyShifts = daysPayload.some(d => d.shifts.length > 0);
        if (!hasAnyShifts) {
            MainSweetAlert.fire('Validation', 'Please add at least one product line to a shift in either the template or an active day.', 'warning');
            return;
        }

        const payload = {
            plan_id: id || null,
            plan_name: planName,
            from_date: fromDate,
            to_date: toDate,
            remarks: remarks,
            factory: factoryId || null,
            days: daysPayload,
            conflict_resolution: conflictResolution
        };

        setLoading(true);
        try {
            await ProductionService.bulkGenerateShiftPlans(payload);
            MainSweetAlert.fire('Success', id ? 'Shift Plan Updated Successfully' : 'Shift Plan Generated Successfully', 'success').then(() => {
                navigate('/production/shift-planning');
            });
        } catch (error) {
            if (error.response && error.response.status === 409) {
                const data = error.response.data;
                if (data.existing_count !== undefined) {
                    MainSweetAlert.fire({
                        title: 'Dates Already Planned',
                        html: `
                            <div class="text-start">
                                <p>${data.message}</p>
                                <ul>
                                    <li><strong>Shifts already planned:</strong> ${data.existing_count}</li>
                                    <li><strong>Available shifts:</strong> ${data.available_count}</li>
                                    <li><strong>Total shifts:</strong> ${data.total_count}</li>
                                </ul>
                            </div>
                        `,
                        icon: 'warning',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: 'Overwrite Existing',
                        denyButtonText: 'Skip Existing',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#d33',
                        denyButtonColor: '#3085d6',
                    }).then((result) => {
                        if (result.isConfirmed) {
                            MainSweetAlert.fire({
                                title: 'Are you sure?',
                                text: 'This will delete the existing shift schedules and regenerate them. This action cannot be undone.',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                confirmButtonText: 'Yes, overwrite them'
                            }).then((confirmResult) => {
                                if (confirmResult.isConfirmed) {
                                    handleSave('overwrite');
                                }
                            });
                        } else if (result.isDenied) {
                            handleSave('skip');
                        }
                    });
                } else {
                    // Employee conflict
                    MainSweetAlert.fire('Conflict Detected', data.message || 'An employee is already assigned to another line during this time.', 'warning');
                }
            } else if (error.response && error.response.data && error.response.data.error) {
                MainSweetAlert.fire('Error', error.response.data.error, 'error');
            } else {
                MainSweetAlert.fire('Error', 'Failed to generate shift plan.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    const currentDayData = scheduleData[activeDay] || {};

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const container = e.currentTarget;
            const elements = Array.from(container.querySelectorAll('input, select, textarea, button.btn-generate-custom')).filter(
                el => !el.disabled && !el.readOnly && el.tabIndex !== -1
            );
            const index = elements.indexOf(e.target);
            if (index > -1 && index < elements.length - 1) {
                e.preventDefault();
                elements[index + 1].focus();
            }
        }
    };

    return (
        <div className="container-fluid pt-0" onKeyDown={handleKeyDown}>
            <style>{`
                .spf-date-list {
                    border: 1px solid #eee;
                    border-radius: 8px;
                }
                [data-theme-version="dark"] .spf-date-list {
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .list-group-item {
                    background-color: #2F363E !important;
                    color: #e2e8f0 !important;
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .list-group-item.active {
                    background-color: #0a500f !important;
                    color: #ffffff !important;
                }
            `}</style>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <Card.Title>{id ? 'Edit Shift Plan' : 'Plan Details'}</Card.Title>
                    {fromDate && toDate && shifts.length > 0 && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setShowExcludeModal(true)}
                            style={{ borderRadius: '6px', padding: '3px 10px', fontSize: '12px', height: '28px', lineHeight: '1.4' }}
                        >
                            <i className="fa fa-calendar-minus-o me-2"></i>Configure Shift Dates
                        </Button>
                    )}
                </Card.Header>
                <Card.Body>
                    <Row className="gy-2 align-items-end">
                        <Col xs={12} sm={6} md={3}>
                            <Form.Group className="mb-0">
                                <Form.Label className="text-nowrap">Factory <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    value={factoryId}
                                    onChange={e => {
                                        setFactoryId(e.target.value);
                                        fetchShiftsByFactory(e.target.value);
                                    }}
                                >
                                    <option value="">Select Factory...</option>
                                    {factories.map(f => (
                                        <option key={f.id} value={String(f.id)}>{f.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col xs={12} sm={6} md={3}>
                            <Form.Group className="mb-0">
                                <Form.Label className="text-nowrap">Plan Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    value={planName}
                                    onChange={(e) => setPlanName(e.target.value)}
                                    placeholder="e.g. July Week 2 Plan"
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <Form.Group className="mb-0">
                                <Form.Label className="text-nowrap">From Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    value={fromDate}
                                    min={todayStr}
                                    onChange={(e) => setFromDate(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={6} sm={4} md={2}>
                            <Form.Group className="mb-0">
                                <Form.Label className="text-nowrap">To Date <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="date"
                                    value={toDate}
                                    min={fromDate || todayStr}
                                    onChange={(e) => setToDate(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={12} sm={4} md={2}>
                            <Form.Group className="mb-0">
                                <Form.Label className="text-nowrap">Remarks</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder="Optional notes"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                </Card.Body>
            </Card>

            <Card>
                <Card.Header>
                    <Card.Title>Shift Configuration</Card.Title>
                </Card.Header>
                <Card.Body>
                    {loadingMasters ? (
                        <div className="text-center p-4"><Spinner animation="border" /></div>
                    ) : shifts.length === 0 ? (
                        <div className="alert alert-warning d-flex align-items-center gap-3" role="alert">
                            <i className="fa fa-exclamation-triangle fa-2x"></i>
                            <div>
                                {!factoryId ? (
                                    <><strong>Select a Factory First</strong>
                                        <p className="mb-0">Please select a factory above to load its configured shifts.</p></>
                                ) : (
                                    <><strong>No Shifts Found</strong>
                                        <p className="mb-0">No shifts are configured for this factory. Add shifts in Production → Shifts.</p></>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Row>
                            {/* Day Navigation Sidebar */}
                            <Col xs={12} md={3} className="border-bottom border-md-bottom-0 border-md-end pb-3 pb-md-0 mb-3 mb-md-0">
                                <h6 className="mb-3 mt-3 font-w600 text-muted" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>CHOOSE DATE TO CUSTOMIZE</h6>
                                <div className="list-group list-group-flush mb-3 spf-date-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    <button
                                        type="button"
                                        className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center border-0 px-3 py-2 ${activeDay === 'template' ? 'active bg-success text-white' : ''}`}
                                        onClick={() => setActiveDay('template')}
                                        style={{ fontSize: '13px' }}
                                    >
                                        <div>
                                            <i className="fa fa-file-text-o me-2"></i>
                                            <strong>Template Layout</strong>
                                        </div>
                                    </button>

                                    {activeDates.length === 0 ? (
                                        <div className="text-center text-muted px-3 py-4" style={{ fontSize: '12px' }}>
                                            <i className="fa fa-calendar fa-2x mb-2 d-block" style={{ opacity: 0.35 }}></i>
                                            No dates available.<br />
                                            <span>Please select <strong>From</strong> &amp; <strong>To</strong> dates above.</span>
                                        </div>
                                    ) : activeDates.map(date => {
                                        const parts = date.split('-');
                                        const formattedDate = new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
                                        const isCustomized = scheduleData[date] && Object.values(scheduleData[date]).some(lines => lines.length > 0);
                                        return (
                                            <div
                                                key={date}
                                                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center border-bottom-0 border-start-0 border-end-0 border-top px-3 py-2 ${activeDay === date ? 'active bg-success text-white' : ''}`}
                                                onClick={() => setActiveDay(date)}
                                                style={{ cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                <div className="d-flex align-items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Form.Check
                                                        type="checkbox"
                                                        id={`check-${date}`}
                                                        checked={checkedDates.includes(date)}
                                                        disabled={activeDay === date}
                                                        onChange={(e) => {
                                                             const isChecked = e.target.checked;
                                                            setCheckedDates(prev => {
                                                                if (isChecked) {
                                                                    return [...prev, date];
                                                                } else {
                                                                    return prev.filter(d => d !== date);
                                                                }
                                                            });
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <span style={{ color: activeDay === date ? 'white' : 'inherit' }}>{formattedDate}</span>
                                                </div>
                                                {isCustomized ? (
                                                    <Badge bg="success">Custom</Badge>
                                                ) : (
                                                    <Badge bg="secondary">Default</Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Copy Target Selector Dropdown */}
                                {fromDate && toDate && shifts.length > 0 && (
                                    <div className="mb-3 px-1">
                                        <Form.Label className="text-muted font-w600 mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                                            COPY TARGET SHIFT
                                        </Form.Label>
                                        <Form.Select
                                            size="sm"
                                            value={copyTargetShift}
                                            onChange={e => setCopyTargetShift(e.target.value)}
                                            style={{ borderRadius: '6px', fontSize: '12px' }}
                                        >
                                            <option value="all">All Shifts</option>
                                            {shifts.map(s => (
                                                <option key={s.id} value={s.id.toString()}>{s.name}</option>
                                            ))}
                                        </Form.Select>
                                    </div>
                                )}

                                <Button
                                    variant="outline-primary"
                                    className="w-100 py-2"
                                    size="sm"
                                    onClick={applyTemplateToAllDays}
                                    disabled={activeDates.length === 0}
                                    style={{ borderRadius: '6px', fontSize: '12px' }}
                                >
                                    <i className="fa fa-copy me-2"></i>{getCopyButtonLabel()}
                                </Button>
                            </Col>

                            {/* Active Day/Template Grid */}
                            <Col xs={12} md={9}>
                                <div className="ps-0 ps-md-2">
                                    <h5 className="mb-3 mt-3 font-w600" style={{ fontSize: '16px' }}>
                                        {activeDay === 'template' ? 'Base Template configuration' : `Configuration for ${new Date(activeDay.split('-')[0], activeDay.split('-')[1] - 1, activeDay.split('-')[2]).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
                                    </h5>

                                    <Tabs activeKey={activeShiftTab} onSelect={k => setActiveShiftTab(k)} className="mb-0">
                                        {shifts.map(shift => {
                                            const isShiftActive = activeDay === 'template' || (activeShiftDates[shift.id] || []).includes(activeDay);
                                            const activeCount = (activeShiftDates[shift.id] || []).length;

                                            return (
                                                <Tab
                                                    eventKey={shift.id.toString()}
                                                    title={`${shift.name} (${shift.start_time.substring(0, 5)} - ${shift.end_time.substring(0, 5)}) ${isShiftActive ? '' : '(Inactive)'}`}
                                                    key={shift.id}
                                                    disabled={!isShiftActive}
                                                >

                                                    <div className="d-flex justify-content-end mb-2 mt-2">
                                                        <Button
                                                            variant="outline-primary"
                                                            size="sm"
                                                            onClick={() => addProductionLine(shift.id)}
                                                            disabled={!isShiftActive}
                                                            style={{ fontSize: '12px', padding: '4px 12px' }}
                                                        >
                                                            <i className="fa fa-plus me-1"></i>Add Product Line
                                                        </Button>
                                                    </div>

                                                    <div className="table-responsive">
                                                        <Table bordered hover className="text-nowrap">
                                                            <thead className="table-light">
                                                            <tr>
                                                                <th>Product Line</th>
                                                                <th>Finished Good</th>
                                                                <th style={{ width: '120px' }}>Quantity</th>
                                                                <th style={{ width: '120px' }}>Start Time</th>
                                                                <th style={{ width: '120px' }}>End Time</th>
                                                                <th style={{ width: '200px' }}>Shift Group</th>
                                                                <th>Employees</th>
                                                                <th>Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {!isShiftActive ? (
                                                                <tr>
                                                                    <td colSpan="8" className="text-center text-muted py-4">
                                                                        This shift has been deactivated for this date. You can re-enable it under "Configure Shift Dates".
                                                                    </td>
                                                                </tr>
                                                            ) : (currentDayData[shift.id] || []).length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="8" className="text-center text-muted py-4">
                                                                        No lines added. Click Add Product Line, or copy from the template.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                (currentDayData[shift.id] || []).map((line, index) => (
                                                                    <tr key={index}>
                                                                        <td>
                                                                            <Form.Select
                                                                                value={line.production_line_id}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'production_line_id', e.target.value)}
                                                                            >
                                                                                <option value="">Select Line...</option>
                                                                                {productionLines.map(pl => (
                                                                                    <option key={pl.id} value={pl.id}>{pl.name}</option>
                                                                                ))}
                                                                            </Form.Select>
                                                                        </td>
                                                                        <td>
                                                                            <Form.Select
                                                                                value={line.stock_item_id}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'stock_item_id', e.target.value)}
                                                                            >
                                                                                <option value="">Select Item...</option>
                                                                                {stockItems.map(item => (
                                                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                                                ))}
                                                                            </Form.Select>
                                                                        </td>
                                                                        <td>
                                                                            <Form.Control
                                                                                type="number"
                                                                                value={line.planned_quantity}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'planned_quantity', e.target.value)}
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <Form.Control
                                                                                type="time"
                                                                                value={line.start_time}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'start_time', e.target.value)}
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <Form.Control
                                                                                type="time"
                                                                                value={line.end_time}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'end_time', e.target.value)}
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <Form.Select
                                                                                value={line.employee_group_id}
                                                                                onChange={(e) => updateProductionLine(shift.id, index, 'employee_group_id', e.target.value)}
                                                                            >
                                                                                <option value="">Select Group...</option>
                                                                                {employeeGroups.map(grp => {
                                                                                    const isUsed = (currentDayData[shift.id] || []).some((l, idx) => {
                                                                                        if (idx === index) return false;
                                                                                        if (String(l.employee_group_id) !== String(grp.id)) return false;
                                                                                        if (line.start_time && line.end_time && l.start_time && l.end_time) {
                                                                                            return line.start_time < l.end_time && line.end_time > l.start_time;
                                                                                        }
                                                                                        return true;
                                                                                    });
                                                                                    return (
                                                                                        <option key={grp.id} value={grp.id} disabled={isUsed}>
                                                                                            {grp.group_name} {isUsed ? '(In Use)' : ''}
                                                                                        </option>
                                                                                    );
                                                                                })}
                                                                            </Form.Select>
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <Button
                                                                                variant="outline-primary"
                                                                                size="sm"
                                                                                onClick={() => openEmployeeModal(shift.id, index)}
                                                                            >
                                                                                <i className="fa fa-users me-1"></i>
                                                                                {(line.employees || []).length}
                                                                            </Button>
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <Button variant="danger" size="sm" onClick={() => removeProductionLine(shift.id, index)}>
                                                                                <i className="fa fa-trash"></i>
                                                                            </Button>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                        </Table>
                                                    </div>

                                                </Tab>
                                            );
                                        })}
                                    </Tabs>
                                </div>
                            </Col>
                        </Row>
                    )}
                </Card.Body>
                <Card.Footer className="d-flex justify-content-end gap-2 flex-wrap">
                    <style>{`
                        .btn-cancel-custom {
                            background-color: var(--cancel-btn-color, #dc3545) !important;
                            border-color: var(--cancel-btn-color, #dc3545) !important;
                            color: white !important;
                            border-radius: 8px !important;
                            font-weight: 500 !important;
                            font-size: 14px !important;
                            padding: 10px 24px !important;
                            border-style: solid !important;
                            border-width: 1px !important;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        }
                        .btn-cancel-custom:hover, 
                        .btn-cancel-custom:active, 
                        .btn-cancel-custom:focus,
                        .btn-cancel-custom:focus-visible { 
                            background-color: var(--cancel-btn-color, #dc3545) !important; 
                            border-color: var(--cancel-btn-color, #dc3545) !important; 
                            color: white !important;
                            opacity: 1 !important; 
                            box-shadow: none !important; 
                        }
                        .btn-generate-custom {
                            background-color: var(--save-btn-color, #0a500f) !important;
                            border-color: var(--save-btn-color, #0a500f) !important;
                            color: white !important;
                            border-radius: 8px !important;
                            font-weight: 500 !important;
                            font-size: 14px !important;
                            padding: 10px 24px !important;
                            border-style: solid !important;
                            border-width: 1px !important;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        }
                        .btn-generate-custom:hover,
                        .btn-generate-custom:active,
                        .btn-generate-custom:focus,
                        .btn-generate-custom:focus-visible {
                            background-color: var(--save-btn-color, #0a500f) !important;
                            border-color: var(--save-btn-color, #0a500f) !important;
                            color: white !important;
                            opacity: 1 !important;
                            box-shadow: none !important;
                        }
                        @media (max-width: 576px) {
                            .btn-cancel-custom,
                            .btn-generate-custom {
                                width: 100% !important;
                            }
                        }
                    `}</style>
                    <button 
                        type="button" 
                        className="btn-cancel-custom btn-universal-close" 
                        style={{
                            backgroundColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                            borderColor: cancelBtnColor || 'var(--cancel-btn-color, #dc3545)',
                            color: '#ffffff'
                        }}
                        onClick={() => navigate('/production/shift-planning')}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button" 
                        className="btn-generate-custom btn-universal-save" 
                        style={{
                            backgroundColor: saveBtnColor || 'var(--save-btn-color, #0a500f)',
                            borderColor: saveBtnColor || 'var(--save-btn-color, #0a500f)',
                            color: '#ffffff'
                        }}
                        onClick={() => handleSave(null)} 
                        disabled={loading}
                    >
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : (id ? 'Save Plan' : 'Generate Plan')}
                    </button>
                </Card.Footer>
            </Card>

            {showExcludeModal && datesList.length > 0 && shifts.length > 0 && (
                <ExcludeDatesModal
                    show={showExcludeModal}
                    onHide={() => setShowExcludeModal(false)}
                    datesList={datesList}
                    shifts={shifts}
                    activeShiftDates={activeShiftDates}
                    onSave={(newActiveShiftDates) => {
                        setActiveShiftDates(newActiveShiftDates);
                        const resolvedActiveDates = datesList.filter(d =>
                            shifts.some(s => (newActiveShiftDates[s.id] || []).includes(d))
                        );
                        setActiveDates(resolvedActiveDates);
                        if (activeDay !== 'template' && !resolvedActiveDates.includes(activeDay)) {
                            setActiveDay(resolvedActiveDates.length > 0 ? resolvedActiveDates[0] : 'template');
                        }
                    }}
                />
            )}

            {showModal && activeModalData && (
                <ShiftEmployeeModal
                    show={showModal}
                    onHide={() => setShowModal(false)}
                    employeeGroupId={activeModalData.employeeGroupId}
                    planDate={activeModalData.planDate}
                    startTime={activeModalData.startTime}
                    endTime={activeModalData.endTime}
                    currentEmployees={activeModalData.currentEmployees}
                    onUpdateEmployees={handleUpdateEmployees}
                    dayData={activeModalData.dayData}
                    currentShiftId={activeModalData.shiftId}
                    currentLineIndex={activeModalData.lineIndex}
                    productionLines={activeModalData.productionLines}
                />
            )}
        </div>
    );
};

export default ShiftPlanForm;
