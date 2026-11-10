import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Spinner, Badge, Form, Tabs, Tab, Row, Col, Dropdown, Collapse, Modal, OverlayTrigger, Tooltip, Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import ProductionService from '../../../services/ProductionService';
import MainSweetAlert from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import ShiftEmployeeModal from './ShiftEmployeeModal';

// Factory color palette – cycles for up to 8 factories
const FACTORY_COLORS = [
    { bg: '#EEF2FF', border: '#818CF8', text: '#4338CA' },
    { bg: '#FFF7ED', border: '#FB923C', text: '#C2410C' },
    { bg: '#F0FDF4', border: '#4ADE80', text: '#15803D' },
    { bg: '#FDF4FF', border: '#C084FC', text: '#7E22CE' },
    { bg: '#FFF1F2', border: '#FB7185', text: '#BE123C' },
    { bg: '#F0F9FF', border: '#38BDF8', text: '#0369A1' },
    { bg: '#FEFCE8', border: '#FACC15', text: '#854D0E' },
    { bg: '#F8FAFC', border: '#94A3B8', text: '#334155' },
];
const getFactoryColor = (factoryId, factoryColorMap) => {
    if (!factoryId) return FACTORY_COLORS[FACTORY_COLORS.length - 1];
    if (factoryColorMap[factoryId] !== undefined) return FACTORY_COLORS[factoryColorMap[factoryId] % FACTORY_COLORS.length];
    return FACTORY_COLORS[0];
};

const ShiftPlanManagement = () => {
    const navigate = useNavigate();
    const [viewType, setViewType] = useState('daily'); // 'daily', 'plan', or 'factory'

    // Daily View state
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [shiftDays, setShiftDays] = useState([]);
    const [loading, setLoading] = useState(true);

    // Plan-Wise View state
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');

    // Factory state
    const [factories, setFactories] = useState([]);
    const [factoryColorMap, setFactoryColorMap] = useState({}); // factoryId -> color index
    const [selectedFactoryId, setSelectedFactoryId] = useState(''); // '' = All (Daily View)
    const [planFactoryFilter, setPlanFactoryFilter] = useState(''); // '' = All (Plan-Wise View)
    const [factoryViewFactoryId, setFactoryViewFactoryId] = useState(''); // Factory View selected factory
    const [factoryViewPlans, setFactoryViewPlans] = useState([]); // Plans for selected factory in Factory View
    const [loadingFactoryView, setLoadingFactoryView] = useState(false);
    const [planDetails, setPlanDetails] = useState(null);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [planSearch, setPlanSearch] = useState('');
    const [expandedDates, setExpandedDates] = useState({});

    const toggleDateExpand = (dateKey) => {
        setExpandedDates(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    // Edit Product Line Schedule Modal state
    const [stockItems, setStockItems] = useState([]);
    const [employeeGroups, setEmployeeGroups] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingLine, setEditingLine] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);

    // Attendance & Break navigation
    const openAttendanceModal = (line, planDate) => {
        navigate(`/production/attendance/${line.id}?date=${planDate}`);
    };

    // HR Report state
    const [hrFromDate, setHrFromDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [hrToDate, setHrToDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });
    const [hrEmployeeId, setHrEmployeeId] = useState('');
    const [hrSummaryData, setHrSummaryData] = useState([]);
    const [hrDailyRecords, setHrDailyRecords] = useState([]);
    const [hrEmployees, setHrEmployees] = useState([]);
    const [loadingHrReport, setLoadingHrReport] = useState(false);

    useEffect(() => {
        if (viewType === 'hr_report') {
            fetchHrReport();
            fetchHrEmployees();
        }
    }, [viewType, hrFromDate, hrToDate, hrEmployeeId]);

    const fetchHrEmployees = async () => {
        try {
            const res = await ProductionService.getEmployees();
            setHrEmployees(res.data.results || res.data);
        } catch (err) {
            console.error("Failed to load employees for report:", err);
        }
    };

    const fetchHrReport = async () => {
        try {
            setLoadingHrReport(true);
            let params = `?from_date=${hrFromDate}&to_date=${hrToDate}`;
            if (hrEmployeeId) {
                params += `&employee_id=${hrEmployeeId}`;
            }
            const res = await ProductionService.getAttendanceHrSummary(params);
            setHrSummaryData(res.data.summary || []);
            setHrDailyRecords(res.data.daily_records || []);
        } catch (err) {
            console.error("Failed to load HR report summary:", err);
            MainSweetAlert.fire('Error', 'Could not load attendance summary.', 'error');
        } finally {
            setLoadingHrReport(false);
        }
    };

    const handleExportSummaryCSV = () => {
        if (hrSummaryData.length === 0) {
            MainSweetAlert.fire('Info', 'No data to export.', 'info');
            return;
        }
        const headers = ["Employee Code", "Employee Name", "Designation", "Days Scheduled", "Days Present", "Days Late", "Days Half Day", "Days Absent", "Total Work Hours", "Total Break Hours", "Net Work Hours", "Approved Overtime Hours"];
        const rows = hrSummaryData.map(s => [
            s.employee_code,
            s.employee_name,
            s.designation,
            s.total_days_scheduled,
            s.days_present,
            s.days_late,
            s.days_half_day,
            s.days_absent,
            (s.total_work_minutes / 60).toFixed(2),
            (s.total_break_minutes / 60).toFixed(2),
            (s.net_work_minutes / 60).toFixed(2),
            (s.approved_overtime_minutes / 60).toFixed(2)
        ]);
        
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `HR_Production_Attendance_Summary_${hrFromDate}_to_${hrToDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        fetchMasters();
    }, []);

    const fetchMasters = async () => {
        try {
            const [resItems, resGroups, resFactories] = await Promise.all([
                ProductionService.getStockItems('?has_bom=true'),
                ProductionService.getEmployeeGroups(),
                ProductionService.getFactories()
            ]);
            setStockItems(resItems.data.results || resItems.data);
            setEmployeeGroups(resGroups.data.results || resGroups.data);
            const factList = resFactories.data.results || resFactories.data;
            setFactories(factList);
            const colorMap = {};
            factList.forEach((f, idx) => { colorMap[f.id] = idx; });
            setFactoryColorMap(colorMap);
            // Auto-select first factory for Factory View
            if (factList.length > 0) {
                setFactoryViewFactoryId(String(factList[0].id));
            }
        } catch (error) {
            console.error("Failed to load masters in management:", error);
        }
    };

    const openEditModal = (line, siblingLines, planDate) => {
        if (line.status?.toUpperCase() === 'COMPLETED') {
            MainSweetAlert.fire('Warning', 'Completed production lines cannot be edited.', 'warning');
            return;
        }
        setEditingLine({
            id: line.id,
            production_line_name: line.production_line_name,
            stock_item: line.stock_item,
            planned_quantity: line.planned_quantity,
            start_time: line.start_time ? line.start_time.substring(0, 5) : '',
            end_time: line.end_time ? line.end_time.substring(0, 5) : '',
            employee_group: line.employee_group || '',
            siblingLines: (siblingLines || []).filter(l => l.id !== line.id),
            plan_date: planDate || '',
            employees: (line.employees || []).map(e => e.employee_id || e.id)
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingLine.stock_item || !editingLine.planned_quantity || !editingLine.start_time || !editingLine.end_time) {
            MainSweetAlert.fire('Validation', 'Please fill all required fields.', 'warning');
            return;
        }

        try {
            setLoading(true);
            await ProductionService.patchShiftProductionLine(editingLine.id, {
                stock_item: editingLine.stock_item,
                planned_quantity: editingLine.planned_quantity,
                start_time: editingLine.start_time,
                end_time: editingLine.end_time,
                employee_group: editingLine.employee_group || null
            });
            MainSweetAlert.fire('Success', 'Schedule updated successfully', 'success');
            setShowEditModal(false);
            refreshData();
        } catch (error) {
            console.error("Error updating schedule:", error);
            const errMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to update schedule.';
            MainSweetAlert.fire('Error', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewType === 'daily') {
            fetchShiftDays();
        }
    }, [selectedDate, viewType]);

    useEffect(() => {
        if (viewType === 'plan' || viewType === 'factory') {
            fetchPlans();
        }
    }, [viewType]);

    useEffect(() => {
        if (viewType === 'factory' && factoryViewFactoryId) {
            fetchFactoryViewPlans();
        }
    }, [viewType, factoryViewFactoryId]);

    useEffect(() => {
        if (viewType === 'plan' && selectedPlanId) {
            fetchPlanDetails();
        }
    }, [viewType, selectedPlanId]);

    const fetchShiftDays = async () => {
        setLoading(true);
        try {
            const response = await ProductionService.getShiftPlanDays(`?plan_date=${selectedDate}`);
            setShiftDays(response.data.results || response.data);
        } catch (error) {
            console.error("Error fetching daily shift plans:", error);
            MainSweetAlert.fire('Error', 'Failed to fetch shift schedules.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const res = await ProductionService.getShiftPlans();
            const plansList = res.data.results || res.data;
            setPlans(plansList);
            if (plansList.length > 0) {
                // Auto-select first plan if none selected
                if (!selectedPlanId || !plansList.some(p => p.id.toString() === selectedPlanId)) {
                    setSelectedPlanId(plansList[0].id.toString());
                }
            } else {
                setSelectedPlanId('');
                setPlanDetails(null);
            }
        } catch {
            console.error("Failed to fetch shift plans");
        } finally {
            setLoading(false);
        }
    };

    const fetchPlanDetails = async () => {
        setLoadingPlan(true);
        try {
            const res = await ProductionService.getShiftPlan(selectedPlanId);
            setPlanDetails(res.data);
        } catch (error) {
            console.error("Error fetching plan details:", error);
            MainSweetAlert.fire('Error', 'Failed to fetch plan details.', 'error');
        } finally {
            setLoadingPlan(false);
        }
    };

    const fetchFactoryViewPlans = async () => {
        if (!factoryViewFactoryId) return;
        setLoadingFactoryView(true);
        try {
            // Fetch the list to get IDs for this factory, then detail each one
            const res = await ProductionService.getShiftPlans(`?factory=${factoryViewFactoryId}`);
            const planList = res.data.results || res.data;
            // Fetch full details (with days + lines) for each plan in parallel
            const detailResponses = await Promise.all(
                planList.map(p => ProductionService.getShiftPlan(p.id))
            );
            setFactoryViewPlans(detailResponses.map(r => r.data));
        } catch (error) {
            console.error('Error fetching factory view plans:', error);
            MainSweetAlert.fire('Error', 'Failed to fetch plans for this factory.', 'error');
        } finally {
            setLoadingFactoryView(false);
        }
    };

    const refreshData = () => {
        if (viewType === 'daily') {
            fetchShiftDays();
        } else if (viewType === 'factory') {
            fetchFactoryViewPlans();
        } else {
            fetchPlanDetails();
        }
    };

    const handleStatusChange = async (lineId, newStatus) => {
        try {
            await ProductionService.patchShiftProductionLine(lineId, {
                status: newStatus
            });
            MainSweetAlert.fire({
                icon: 'success',
                title: 'Status Updated',
                text: `Product line status changed to ${newStatus}.`,
                timer: 1500,
                showConfirmButton: false
            });
            refreshData();
        } catch (error) {
            console.error("Error updating status:", error);
            MainSweetAlert.fire('Error', 'Failed to update status.', 'error');
        }
    };

    const handleDeleteLine = async (lineId, lineName) => {
        const result = await MainSweetAlert.fire({
            title: `Delete schedule for ${lineName}?`,
            text: 'This will remove the product line schedule and its employee assignments from this shift.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await ProductionService.deleteShiftProductionLine(lineId);
                MainSweetAlert.fire('Deleted!', 'Schedule deleted successfully.', 'success');
                refreshData();
            } catch (error) {
                console.error("Error deleting line schedule:", error);
                const errMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to delete schedule.';
                MainSweetAlert.fire('Error', errMsg, 'error');
            }
        }
    };

    const handleDeletePlan = async (id, name) => {
        const result = await MainSweetAlert.fire({
            title: `Delete plan "${name}"?`,
            text: 'This will delete the entire shift plan including all daily schedules and operator assignments. This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await ProductionService.deleteShiftPlan(id);
                MainSweetAlert.fire('Deleted!', 'Shift plan deleted successfully.', 'success');
                fetchPlans();
            } catch (error) {
                console.error("Error deleting plan:", error);
                MainSweetAlert.fire('Error', 'Failed to delete shift plan.', 'error');
            }
        }
    };

    const formatTime = (t) => {
        if (!t) return '-';
        return t.substring(0, 5);
    };

    const formatDatePretty = (dStr) => {
        if (!dStr) return '';
        const parts = dStr.split('-');
        if (parts.length !== 3) return dStr;
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const groupDaysByDate = (days) => {
        const groups = {};
        (days || []).forEach(day => {
            const date = day.plan_date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(day);
        });
        return Object.keys(groups).sort().reduce((acc, key) => {
            acc[key] = groups[key];
            return acc;
        }, {});
    };

    // Group shift-days by factory (for Daily View)
    const groupShiftDaysByFactory = (days) => {
        const groups = {};
        (days || []).forEach(day => {
            const fId = day.factory_id || day.shift?.factory_id || null;
            const fName = day.factory_name || day.shift?.factory_name || 'No Factory';
            const key = fId ? String(fId) : 'none';
            if (!groups[key]) groups[key] = { factoryId: fId, factoryName: fName, days: [] };
            groups[key].days.push(day);
        });
        return groups;
    };

    // Derived: filtered shift-days for Daily View
    const filteredShiftDays = selectedFactoryId
        ? shiftDays.filter(d => String(d.factory_id || d.shift?.factory_id) === selectedFactoryId)
        : shiftDays;

    // Derived: filtered plans for Plan-Wise View
    const filteredPlans = planFactoryFilter
        ? plans.filter(p => String(p.factory) === planFactoryFilter)
        : plans;

    // Auto-select first plan when factory filter changes in Plan-Wise View
    useEffect(() => {
        if (viewType === 'plan') {
            const list = planFactoryFilter ? plans.filter(p => String(p.factory) === planFactoryFilter) : plans;
            if (list.length > 0 && !list.some(p => p.id.toString() === selectedPlanId)) {
                setSelectedPlanId(list[0].id.toString());
            } else if (list.length === 0) {
                setSelectedPlanId('');
                setPlanDetails(null);
            }
        }
    }, [planFactoryFilter, plans]);

    // ── Factory Filter Dropdown ──────────────────────────────────────────────
    const FactoryFilterDropdown = ({ value, onChange }) => {
        const [ddOpen, setDdOpen] = useState(false);
        const selectedFactory = factories.find(f => String(f.id) === String(value));
        const selectedLabel = selectedFactory ? selectedFactory.name : 'All Factories';
        return (
            <Dropdown show={ddOpen} onToggle={setDdOpen}>
                <Dropdown.Toggle as="button"
                    style={{ width: '175px', height: '34px', fontSize: '13px', borderRadius: '6px', borderColor: '#e2e8f0', color: '#475569' }} className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-between text-start spm-dropdown-btn">
                    <span className="d-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '145px' }}>
                        <i className="fa fa-industry" style={{ fontSize: '11px', color: '#0a500f', flexShrink: 0 }}></i>
                        <span className="text-truncate font-w500">{selectedLabel}</span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ minWidth: '175px', padding: '6px' }}>
                    <Dropdown.Item onClick={() => { onChange(''); setDdOpen(false); }}
                        active={!value}
                        style={{
                            fontSize: '12px', borderRadius: '4px', padding: '6px 12px',
                            fontWeight: !value ? '600' : '400'
                        }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#94a3b8', marginRight: '8px' }}></span>All Factories
                    </Dropdown.Item>
                    {factories.length > 0 && <Dropdown.Divider />}
                    {factories.map(f => {
                        const color = getFactoryColor(f.id, factoryColorMap);
                        const isActive = String(f.id) === String(value);
                        return (
                            <Dropdown.Item key={f.id}
                                onClick={() => { onChange(String(f.id)); setDdOpen(false); }}
                                active={isActive}
                                style={{
                                    fontSize: '12px', borderRadius: '4px', padding: '6px 12px',
                                    fontWeight: isActive ? '600' : '400'
                                }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color.border, marginRight: '8px' }}></span>
                                {f.name}
                            </Dropdown.Item>
                        );
                    })}
                </Dropdown.Menu>
            </Dropdown>
        );
    };

    // ── Factory Required Dropdown (Factory View – no "All" option) ───────────
    const FactoryRequiredDropdown = ({ value, onChange }) => {
        const [ddOpen, setDdOpen] = useState(false);
        const selectedFactory = factories.find(f => String(f.id) === String(value));
        const selectedLabel = selectedFactory ? selectedFactory.name : 'Select Factory...';
        const color = selectedFactory ? getFactoryColor(selectedFactory.id, factoryColorMap) : FACTORY_COLORS[FACTORY_COLORS.length - 1];
        return (
            <Dropdown show={ddOpen} onToggle={setDdOpen}>
                <Dropdown.Toggle as="button"
                    className="btn btn-sm d-flex align-items-center justify-content-between text-start font-w600"
                    style={{ width: '185px', height: '34px', fontSize: '13px', borderRadius: '6px', borderColor: color.border, background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
                    <span className="d-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '155px' }}>
                        <i className="fa fa-industry" style={{ fontSize: '11px', flexShrink: 0 }}></i>
                        <span className="text-truncate">{selectedLabel}</span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ minWidth: '185px', padding: '6px' }}>
                    {factories.map(f => {
                        const fColor = getFactoryColor(f.id, factoryColorMap);
                        const isActive = String(f.id) === String(value);
                        return (
                            <Dropdown.Item key={f.id}
                                onClick={() => { onChange(String(f.id)); setDdOpen(false); }}
                                active={isActive}
                                style={{
                                    fontSize: '12px', borderRadius: '4px', padding: '6px 12px',
                                    fontWeight: isActive ? '600' : '400'
                                }}>
                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: fColor.border, marginRight: '8px' }}></span>
                                {f.name}
                            </Dropdown.Item>
                        );
                    })}
                </Dropdown.Menu>
            </Dropdown>
        );
    };

    // ── Factory Section Header (Daily View) ──────────────────────────────────
    const FactorySectionHeader = ({ factoryId, factoryName }) => {
        const color = getFactoryColor(factoryId, factoryColorMap);
        return (
            <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2 factory-banner-box"
                style={{ background: color.bg, border: `1px solid ${color.border}`, borderLeft: `4px solid ${color.border}` }}>
                <i className="fa fa-industry" style={{ color: color.text, fontSize: '14px' }}></i>
                <span className="font-w700" style={{ color: color.text, fontSize: '14px', letterSpacing: '0.3px' }}>
                    {factoryName || 'No Factory'}
                </span>
            </div>
        );
    };

    // Card Renderer Helper for Product Lines
    const renderProductionLinesGrid = (productionLines, planDate) => {
        if (!productionLines || productionLines.length === 0) {
            return (
                <div className="text-center py-4 text-muted spm-empty-state rounded" style={{ border: '1px dashed #cbd5e1' }}>
                    <p className="mb-0 font-w500" style={{ fontSize: '13px' }}>No product lines scheduled.</p>
                </div>
            );
        }

        return (
            <Row className="gy-3 mb-3">
                {productionLines.map(line => (
                    <Col xl={3} md={6} key={line.id}>
                        <div className="line-schedule-card p-3 shadow-sm d-flex flex-column justify-content-between h-100" style={{ minHeight: '170px' }}>
                            <div>
                                {/* Header: Line Name & Time */}
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="font-w600" style={{ fontSize: '14px' }}>{line.production_line_name}</span>
                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                        <i className="fa fa-clock me-1"></i>{formatTime(line.start_time)} - {formatTime(line.end_time)}
                                    </small>
                                </div>

                                {/* Finished Good & Quantity */}
                                <div className="mb-2">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="font-w500 text-truncate" style={{ fontSize: '13px', maxWidth: '70%', fontWeight: '500' }} title={line.stock_item_name}>
                                            {line.stock_item_name}
                                        </span>
                                        <Badge bg="secondary" style={{ fontSize: '10px', padding: '3px 6px' }}>{line.planned_quantity} units</Badge>
                                    </div>
                                </div>

                                {/* Operators */}
                                <div className="mb-2 d-flex align-items-center">
                                    <span className="me-2 text-muted" style={{ fontSize: '11px' }}><i className="fa fa-users me-1"></i>Team:</span>
                                    {(line.employees || []).length === 0 ? (
                                        <span className="text-danger" style={{ fontSize: '11px' }}>
                                            <i className="fa fa-exclamation-circle me-1"></i>No Operators
                                        </span>
                                    ) : (
                                        <div className="d-flex align-items-center">
                                            {line.employees.slice(0, 3).map((emp, idx) => {
                                                const initials = emp.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                                                return (
                                                    <OverlayTrigger
                                                        key={emp.id}
                                                        placement="top"
                                                        overlay={<Tooltip id={`tooltip-${emp.id}`} style={{ fontSize: '11px' }}>{emp.employee_name}</Tooltip>}
                                                    >
                                                        <div
                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white font-w600 shadow-sm"
                                                            style={{
                                                                width: '26px',
                                                                height: '26px',
                                                                fontSize: '10px',
                                                                backgroundColor: '#9b98acff',
                                                                marginLeft: idx > 0 ? '-6px' : '0',
                                                                border: '2px solid transparent',
                                                                cursor: 'pointer',
                                                                zIndex: 3 - idx
                                                            }}
                                                        >
                                                            {initials}
                                                        </div>
                                                    </OverlayTrigger>
                                                );
                                            })}

                                            {line.employees.length > 3 && (
                                                <OverlayTrigger
                                                    placement="top"
                                                    overlay={
                                                        <Tooltip id={`tooltip-more`} style={{ fontSize: '11px' }}>
                                                            {line.employees.slice(3).map(e => e.employee_name).join(', ')}
                                                        </Tooltip>
                                                    }
                                                >
                                                    <div
                                                        className="rounded-circle d-flex align-items-center justify-content-center font-w600 shadow-sm spm-avatar-more"
                                                        style={{
                                                            width: '26px',
                                                            height: '26px',
                                                            fontSize: '10px',
                                                            marginLeft: '-6px',
                                                            border: '2px solid transparent',
                                                            cursor: 'pointer',
                                                            zIndex: 0
                                                        }}
                                                    >
                                                        +{line.employees.length - 3}
                                                    </div>
                                                </OverlayTrigger>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom row: Status badge & Actions */}
                            <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-2">
                                <div className="d-flex align-items-center">
                                    <Badge
                                        bg={line.status === 'RUNNING' ? 'primary' : line.status === 'COMPLETED' ? 'success' : 'light'}
                                        text={line.status === 'PLANNED' ? 'dark' : 'light'}
                                        style={{ fontSize: '10px', padding: '4px 8px', textTransform: 'capitalize', border: line.status === 'PLANNED' ? '1px solid #cbd5e1' : 'none' }}
                                    >
                                        {line.status.toLowerCase()}
                                    </Badge>
                                </div>

                                <div className="d-flex align-items-center gap-1">
                                    <Button
                                        variant="outline-info"
                                        className="shadow btn-attendance-custom"
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0',
                                            fontSize: '12px',
                                            borderRadius: '6px',
                                        }}
                                        onClick={() => openAttendanceModal(line, planDate)}
                                        title="Attendance & Break Control"
                                    >
                                        <i className="fa fa-clock"></i>
                                    </Button>
                                    {line.status?.toUpperCase() !== 'COMPLETED' && (
                                        <>
                                            <EditButton
                                                module="plans"
                                                onClick={() => openEditModal(line, productionLines, planDate)}
                                            />
                                            <DeleteButton
                                                module="plans"
                                                onClick={() => handleDeleteLine(line.id, line.production_line_name)}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Col>
                ))}
            </Row>
        );
    };

    return (
        <div className="container-fluid">
            <style>{`
                .line-schedule-card {
                    transition: all 0.2s ease-in-out;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background-color: #ffffff;
                }
                .line-schedule-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05) !important;
                    border-color: #cbd5e1 !important;
                }
                .btn-delete-plan-custom {
                    background-color: #fff5f5 !important;
                    border: 1px solid #fed7d7 !important;
                    color: #e53e3e !important;
                }
                .btn-delete-plan-custom:hover {
                    background-color: #e53e3e !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.2) !important;
                }
                .btn-attendance-custom:hover i {
                    color: #ffffff !important;
                }
                .spm-header {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                    justify-content: space-between;
                }
                .spm-header-controls {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: nowrap;
                }
                /* Dark mode overrides */
                [data-theme-version="dark"] .line-schedule-card {
                    background-color: #2F363E;
                    border-color: #3d464e;
                }
                [data-theme-version="dark"] .line-schedule-card:hover {
                    border-color: #4a5568 !important;
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25) !important;
                }
                [data-theme-version="dark"] .spm-plan-card {
                    background-color: #2F363E !important;
                }
                [data-theme-version="dark"] .spm-date-row {
                    background-color: #2F363E !important;
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .spm-empty-state {
                    background-color: #24292D !important;
                    border-color: #4a5568 !important;
                }
                [data-theme-version="dark"] .btn-delete-plan-custom {
                    background-color: rgba(229, 62, 62, 0.15) !important;
                    border-color: rgba(229, 62, 62, 0.4) !important;
                }
                [data-theme-version="dark"] .spm-dropdown-btn {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #a0aec0 !important;
                }
                [data-theme-version="dark"] .modal-footer.bg-light {
                    background-color: #24292D !important;
                }
                [data-theme-version="dark"] .spm-avatar-more {
                    background-color: #3d464e !important;
                    color: #a0aec0 !important;
                    border-color: #2F363E !important;
                }
                [data-theme-version="dark"] .spm-employee-avatar {
                    border-color: #2F363E !important;
                }
                @media (max-width: 576px) {
                    .spm-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .spm-header-controls {
                        flex-wrap: wrap;
                        width: 100%;
                    }
                    .spm-view-btns {
                        flex-wrap: wrap;
                    }
                }
            `}</style>


            <div className="row">
                <div className="col-12">
                    <Card>
                    <Card.Header className="spm-header">
                            <div className="d-flex flex-wrap align-items-center gap-2 spm-view-btns">
                                <Button
                                    variant={viewType === 'daily' ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => setViewType('daily')}
                                    style={{ borderRadius: '6px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px' }}
                                >
                                    <i className="fa fa-calendar me-1"></i> Daily View
                                </Button>
                                <Button
                                    variant={viewType === 'plan' ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => setViewType('plan')}
                                    style={{ borderRadius: '6px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px' }}
                                >
                                    <i className="fa fa-folder-open me-1"></i> Plan-Wise View
                                </Button>
                                <Button
                                    variant={viewType === 'factory' ? 'primary' : 'outline-primary'}
                                    size="sm"
                                    onClick={() => setViewType('factory')}
                                    style={{ borderRadius: '6px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px' }}
                                >
                                    <i className="fa fa-industry me-1"></i> Factory View
                                </Button>
                            </div>

                            <div className="spm-header-controls">
                                {/* Date picker + factory filter for Daily View */}
                                {viewType === 'daily' && (
                                    <>
                                        <Form.Control
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            style={{ width: '100%', maxWidth: '180px', height: '34px', fontSize: '13px', borderRadius: '6px' }}
                                        />
                                        {factories.length > 1 && (
                                            <FactoryFilterDropdown value={selectedFactoryId} onChange={setSelectedFactoryId} />
                                        )}
                                    </>
                                )}

                                {/* Factory filter + plan selector for Plan-Wise View */}
                                {viewType === 'plan' && factories.length > 1 && (
                                    <FactoryFilterDropdown value={planFactoryFilter} onChange={setPlanFactoryFilter} />
                                )}

                                {/* Factory selector for Factory View */}
                                {viewType === 'factory' && (
                                    <FactoryRequiredDropdown value={factoryViewFactoryId} onChange={(v) => { setFactoryViewFactoryId(v); }} />
                                )}
                                {viewType === 'plan' && filteredPlans.length > 0 && (() => {
                                    const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
                                        <button
                                            ref={ref}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                onClick(e);
                                            }}
                                            className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-between text-start spm-dropdown-btn"
                                            style={{ width: '220px', height: '34px', fontSize: '13px', borderRadius: '6px', color: '#0a500f', borderColor: '#e2e8f0' }}
                                        >
                                            <span className="text-truncate" style={{ maxWidth: '180px', fontWeight: '500' }}>{children}</span>
                                            <i className="fa fa-chevron-down ms-2" style={{ fontSize: '10px', color: '#94a3b8' }}></i>
                                        </button>
                                    ));

                                    const searchFiltered = filteredPlans.filter(p =>
                                        p.plan_name.toLowerCase().includes(planSearch.toLowerCase())
                                    );

                                    const selectedPlan = filteredPlans.find(p => p.id.toString() === selectedPlanId);
                                    const selectedLabel = selectedPlan ? selectedPlan.plan_name : 'Select Plan...';

                                    return (
                                        <Dropdown onToggle={(isOpen) => { if (!isOpen) setPlanSearch(''); }}>
                                            <Dropdown.Toggle as={CustomToggle}>
                                                {selectedLabel}
                                            </Dropdown.Toggle>

                                            <Dropdown.Menu style={{ minWidth: '220px', maxHeight: '250px', overflowY: 'auto', padding: '8px' }}>
                                                <Form.Control
                                                    autoFocus
                                                    className="mb-2"
                                                    placeholder="Search plan..."
                                                    value={planSearch}
                                                    onChange={(e) => setPlanSearch(e.target.value)}
                                                    size="sm"
                                                    style={{ fontSize: '12px' }}
                                                    onClick={(e) => e.stopPropagation()} // Keep dropdown open on focus/click
                                                />
                                                {searchFiltered.length === 0 ? (
                                                    <div className="text-muted text-center py-2" style={{ fontSize: '12px' }}>No plans found</div>
                                                ) : (
                                                    searchFiltered.map(p => {
                                                        const pColor = getFactoryColor(p.factory, factoryColorMap);
                                                        return (
                                                            <Dropdown.Item
                                                                key={p.id}
                                                                active={p.id.toString() === selectedPlanId}
                                                                onClick={() => setSelectedPlanId(p.id.toString())}
                                                                style={{ fontSize: '12px', borderRadius: '4px', padding: '6px 12px' }}
                                                            >
                                                                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: pColor.border, marginRight: '7px' }}></span>
                                                                {p.plan_name}
                                                            </Dropdown.Item>
                                                        );
                                                    })
                                                )}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    );
                                })()}

                                <CreateButton module="shift_plan" className="text-nowrap" onClick={() => navigate('/production/shift-planning/create')}>
                                    Create Shift Plan
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-3 p-md-4">
                            {/* ── DAILY VIEW CONTAINER ────────────────────────────────── */}
                            {viewType === 'daily' && (
                                <>
                                    {loading ? (
                                        <div className="text-center p-5">
                                            <Spinner animation="border" variant="primary" />
                                        </div>
                                    ) : shiftDays.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-calendar-times-o mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                            <h5>No shifts scheduled for {new Date(selectedDate.split('-')[0], selectedDate.split('-')[1] - 1, selectedDate.split('-')[2]).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</h5>
                                            <p className="mb-4">Generate a plan for this range to start tracking product lines.</p>
                                            
                                        </div>
                                    ) : filteredShiftDays.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-filter mb-3" style={{ fontSize: '36px', opacity: 0.35 }}></i>
                                            <h5>No shifts for <strong>{factories.find(f => String(f.id) === selectedFactoryId)?.name}</strong> on this date.</h5>
                                            <p className="mb-0">Try selecting a different factory or date.</p>
                                        </div>
                                    ) : (() => {
                                        const factoryGroups = groupShiftDaysByFactory(filteredShiftDays);
                                        const factoryKeys = Object.keys(factoryGroups);
                                        const multiFactory = factoryKeys.length > 1;
                                        return (
                                            <>
                                                {factoryKeys.map((fKey, idx) => {
                                                    const group = factoryGroups[fKey];
                                                    const defaultTab = group.days[0]?.id?.toString();
                                                    const fColor = getFactoryColor(group.factoryId, factoryColorMap);
                                                    return (
                                                        <div key={fKey} className={idx > 0 ? 'mt-5' : ''}>
                                                            {multiFactory && <FactorySectionHeader factoryId={group.factoryId} factoryName={group.factoryName} />}
                                                            <Tabs defaultActiveKey={defaultTab} className="mb-4">
                                                                {group.days.map(day => (
                                                                    <Tab
                                                                        eventKey={day.id.toString()}
                                                                        key={day.id}
                                                                        title={
                                                                            <span className="d-flex align-items-center gap-1">
                                                                                {!multiFactory && factories.length > 1 && (
                                                                                    <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: fColor.border, flexShrink: 0 }}></span>
                                                                                )}
                                                                                {`${day.shift_name} (${formatTime(day.shift?.start_time)} - ${formatTime(day.shift?.end_time)})`}
                                                                            </span>
                                                                        }
                                                                    >
                                                                        {renderProductionLinesGrid(day.production_lines, selectedDate)}
                                                                    </Tab>
                                                                ))}
                                                            </Tabs>
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        );
                                    })()}
                                </>
                            )}

                            {/* ── PLAN-WISE VIEW CONTAINER ────────────────────────────── */}
                            {viewType === 'plan' && (
                                <>
                                    {loading ? (
                                        <div className="text-center p-5">
                                            <Spinner animation="border" variant="primary" />
                                        </div>
                                    ) : plans.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-folder-open-o mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                            <h5>No Shift Plans Found.</h5>
                                            <p className="mb-4">Create a new Shift Plan to start managing shift lines.</p>
                                            <Link to="/production/shift-planning/create" className="btn btn-primary btn-sm">
                                                <i className="fa fa-plus me-2"></i>Create New Plan
                                            </Link>
                                        </div>
                                    ) : filteredPlans.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-filter mb-3" style={{ fontSize: '36px', opacity: 0.35 }}></i>
                                            <h5>No plans for <strong>{factories.find(f => String(f.id) === planFactoryFilter)?.name}</strong>.</h5>
                                            <p className="mb-0">Try selecting a different factory or create a new plan for this factory.</p>
                                        </div>
                                    ) : loadingPlan || !planDetails ? (
                                        <div className="text-center p-5">
                                            <Spinner animation="border" variant="primary" />
                                        </div>
                                    ) : (
                                        <div>
                                            {/* Plan Details Metadata Card */}
                                            {(() => {
                                                const planFColor = getFactoryColor(planDetails.factory, factoryColorMap);
                                                return (
                                                    <div className="mb-4 p-4 spm-plan-card d-flex justify-content-between align-items-center flex-wrap gap-3"
                                                        style={{ borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${planDetails.factory ? planFColor.border : '#0a500f'}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,.05)' }}>
                                                        <div>
                                                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                                                <h4 className="mb-0 font-w600 text-dark" style={{ fontSize: '18px' }}>{planDetails.plan_name}</h4>
                                                                {planDetails.factory_name && (
                                                                    <span className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded-2 font-w600"
                                                                        style={{ fontSize: '11px', background: planFColor.bg, color: planFColor.text, border: `1px solid ${planFColor.border}` }}>
                                                                        <i className="fa fa-industry" style={{ fontSize: '10px' }}></i>
                                                                        {planDetails.factory_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-muted mb-0" style={{ fontSize: '13px', fontWeight: '500' }}>
                                                                <i className="fa fa-calendar me-1 text-primary"></i> {formatDatePretty(planDetails.from_date)} <span className="text-muted mx-1">&rarr;</span> {formatDatePretty(planDetails.to_date)}
                                                            </div>
                                                            {planDetails.remarks && planDetails.remarks.toLowerCase() !== 'nil' && (
                                                                <div className="mt-2 text-muted" style={{ fontSize: '13px' }}>
                                                                    <i className="fa fa-comment-o me-1 text-primary"></i> <strong>Remarks:</strong> {planDetails.remarks}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <EditButton module="shift_plan" onClick={() => navigate(`/production/shift-planning/edit/${planDetails.id}`)} />
                                                            <DeleteButton module="shift_plan" onClick={() => handleDeletePlan(planDetails.id, planDetails.plan_name)} />
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Render Plan Days Grouped Chronologically */}
                                            {Object.keys(groupDaysByDate(planDetails.days)).length === 0 ? (
                                                <div className="text-center py-5 text-muted spm-empty-state rounded-3" style={{ border: '1px dashed #cbd5e1' }}>
                                                    <p className="mb-0 font-w500">No shifts scheduled inside this plan.</p>
                                                </div>
                                            ) : (
                                                Object.entries(groupDaysByDate(planDetails.days)).map(([dateKey, dayShifts]) => {
                                                    const isExpanded = !!expandedDates[dateKey];
                                                    const totalLines = dayShifts.reduce((acc, s) => acc + (s.production_lines?.length || 0), 0);
                                                    return (
                                                        <div key={dateKey} className="mb-4 border rounded-3 p-3 spm-date-row">
                                                            {/* Clickable Header */}
                                                            <div
                                                                className="d-flex align-items-center justify-content-between cursor-pointer py-1"
                                                                onClick={() => toggleDateExpand(dateKey)}
                                                                style={{ cursor: 'pointer', userSelect: 'none' }}
                                                            >
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <h5 className="mb-0 text-primary font-w600" style={{ fontSize: '14px' }}>
                                                                        <i className="fa fa-calendar-check-o me-2"></i>
                                                                        {new Date(dateKey.split('-')[0], dateKey.split('-')[1] - 1, dateKey.split('-')[2]).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                                    </h5>
                                                                    <Badge bg="light" className="text-muted border ms-2" style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px' }}>
                                                                        {totalLines} {totalLines === 1 ? 'line' : 'lines'}
                                                                    </Badge>
                                                                </div>
                                                                <i className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-muted`} style={{ fontSize: '12px' }}></i>
                                                            </div>

                                                            {/* Collapsible Content */}
                                                            <Collapse in={isExpanded}>
                                                                <div className="mt-3 pt-3 border-top">
                                                                    {dayShifts.map(day => (
                                                                        <div key={day.id} className="mb-4">
                                                                            {/* Shift header with factory color + badge */}
                                                                            {(() => {
                                                                                const dayFId = day.factory_id || day.shift?.factory_id || null;
                                                                                const dayFName = day.factory_name || day.shift?.factory_name || null;
                                                                                const sColor = getFactoryColor(dayFId, factoryColorMap);
                                                                                return (
                                                                                    <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2"
                                                                                        style={{ background: sColor.bg, border: `1px solid ${sColor.border}22`, borderLeft: `3px solid ${sColor.border}` }}>
                                                                                        <i className="fa fa-clock" style={{ color: sColor.text, fontSize: '13px' }}></i>
                                                                                        <span className="font-w600" style={{ color: sColor.text, fontSize: '13px' }}>
                                                                                            {day.shift_name}&nbsp;
                                                                                            <span className="font-w400" style={{ fontSize: '12px', opacity: 0.85 }}>({formatTime(day.shift?.start_time)} - {formatTime(day.shift?.end_time)})</span>
                                                                                        </span>
                                                                                        {dayFName && (
                                                                                            <span className="ms-auto d-inline-flex align-items-center gap-1 rounded-2"
                                                                                                style={{ fontSize: '10px', fontWeight: '600', background: sColor.bg, color: sColor.text, border: `1px solid ${sColor.border}`, letterSpacing: '0.2px', padding: '2px 8px' }}>
                                                                                                <i className="fa fa-industry" style={{ fontSize: '9px' }}></i>
                                                                                                {dayFName}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            {renderProductionLinesGrid(day.production_lines, dateKey)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </Collapse>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── FACTORY VIEW CONTAINER ───────────────────────────────── */}
                            {viewType === 'factory' && (
                                <>
                                    {loadingFactoryView ? (
                                        <div className="text-center p-5">
                                            <Spinner animation="border" variant="primary" />
                                        </div>
                                    ) : !factoryViewFactoryId ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-industry mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                            <h5>Select a factory to view its shift plans.</h5>
                                        </div>
                                    ) : factoryViewPlans.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fa fa-folder-open-o mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                            <h5>No Shift Plans for <strong>{factories.find(f => String(f.id) === factoryViewFactoryId)?.name}</strong>.</h5>
                                            <p className="mb-4">Create a new Shift Plan for this factory to see it here.</p>
                                            <Link to="/production/shift-planning/create" className="btn btn-primary btn-sm">
                                                <i className="fa fa-plus me-2"></i>Create New Plan
                                            </Link>
                                        </div>
                                    ) : (
                                        <div>
                                            {factoryViewPlans.map((planDetail, planIdx) => {
                                                const planFColor = getFactoryColor(planDetail.factory, factoryColorMap);
                                                return (
                                                    <div key={planDetail.id} className={planIdx > 0 ? 'mt-4' : ''}>
                                                        {/* Plan Header */}
                                                        <div className="mb-3 p-3 spm-plan-card d-flex justify-content-between align-items-center flex-wrap gap-2"
                                                            style={{ borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${planFColor.border}`, boxShadow: '0 2px 4px rgba(0,0,0,.04)' }}>
                                                            <div>
                                                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                                    <h5 className="mb-0 font-w600 text-dark" style={{ fontSize: '16px' }}>{planDetail.plan_name}</h5>
                                                                    <Badge bg="light" className="text-muted border" style={{ fontSize: '11px', padding: '3px 8px' }}>
                                                                        {planDetail.days?.length || 0} day{(planDetail.days?.length || 0) !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                                                    <i className="fa fa-calendar me-1 text-primary"></i>
                                                                    {formatDatePretty(planDetail.from_date)} <span className="mx-1">→</span> {formatDatePretty(planDetail.to_date)}
                                                                    {planDetail.remarks && planDetail.remarks.toLowerCase() !== 'nil' && (
                                                                        <span className="ms-3">
                                                                            <i className="fa fa-comment-o me-1 text-primary"></i>
                                                                            {planDetail.remarks}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <EditButton module="shift_plan" onClick={() => navigate(`/production/shift-planning/edit/${planDetail.id}`)} />
                                                                <DeleteButton module="shift_plan" onClick={() => handleDeletePlan(planDetail.id, planDetail.plan_name)} />
                                                            </div>
                                                        </div>

                                                        {/* Plan Days */}
                                                        {Object.keys(groupDaysByDate(planDetail.days)).length === 0 ? (
                                                            <div className="text-center py-4 text-muted spm-empty-state rounded-3" style={{ border: '1px dashed #cbd5e1' }}>
                                                                <p className="mb-0 font-w500" style={{ fontSize: '13px' }}>No shifts scheduled inside this plan.</p>
                                                            </div>
                                                        ) : (
                                                            Object.entries(groupDaysByDate(planDetail.days)).map(([dateKey, dayShifts]) => {
                                                                const expandKey = `fv_${planDetail.id}_${dateKey}`;
                                                                const isExpanded = !!expandedDates[expandKey];
                                                                const totalLines = dayShifts.reduce((acc, s) => acc + (s.production_lines?.length || 0), 0);
                                                                return (
                                                                    <div key={dateKey} className="mb-3 border rounded-3 p-3 spm-date-row">
                                                                        <div
                                                                            className="d-flex align-items-center justify-content-between"
                                                                            onClick={() => toggleDateExpand(expandKey)}
                                                                            style={{ cursor: 'pointer', userSelect: 'none' }}
                                                                        >
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <h6 className="mb-0 text-primary font-w600" style={{ fontSize: '13px' }}>
                                                                                    <i className="fa fa-calendar-check-o me-2"></i>
                                                                                    {new Date(dateKey.split('-')[0], dateKey.split('-')[1] - 1, dateKey.split('-')[2]).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                                                </h6>
                                                                                <Badge bg="light" className="text-muted border" style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px' }}>
                                                                                    {totalLines} {totalLines === 1 ? 'line' : 'lines'}
                                                                                </Badge>
                                                                            </div>
                                                                            <i className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-muted`} style={{ fontSize: '11px' }}></i>
                                                                        </div>
                                                                        <Collapse in={isExpanded}>
                                                                            <div className="mt-3 pt-3 border-top">
                                                                                {dayShifts.map(day => {
                                                                                    const dayFId = day.factory_id || day.shift?.factory_id || null;
                                                                                    const sColor = getFactoryColor(dayFId, factoryColorMap);
                                                                                    return (
                                                                                        <div key={day.id} className="mb-4">
                                                                                            <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2"
                                                                                                style={{ background: sColor.bg, border: `1px solid ${sColor.border}22`, borderLeft: `3px solid ${sColor.border}` }}>
                                                                                                <i className="fa fa-clock" style={{ color: sColor.text, fontSize: '13px' }}></i>
                                                                                                <span className="font-w600" style={{ color: sColor.text, fontSize: '13px' }}>
                                                                                                    {day.shift_name}&nbsp;
                                                                                                    <span className="font-w400" style={{ fontSize: '12px', opacity: 0.85 }}>({formatTime(day.shift?.start_time)} - {formatTime(day.shift?.end_time)})</span>
                                                                                                </span>
                                                                                            </div>
                                                                                            {renderProductionLinesGrid(day.production_lines, dateKey)}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </Collapse>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
            {/* Edit Product Line Schedule Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="font-w600" style={{ fontSize: '18px', color: '#1e293b' }}>
                        Edit Schedule: {editingLine?.production_line_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editingLine && (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>Finished Good <span className="text-danger">*</span></Form.Label>
                                <Form.Select
                                    value={editingLine.stock_item}
                                    onChange={(e) => setEditingLine({ ...editingLine, stock_item: e.target.value })}
                                >
                                    <option value="">Select Finished Good...</option>
                                    {stockItems.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Planned Quantity <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="number"
                                    value={editingLine.planned_quantity}
                                    onChange={(e) => setEditingLine({ ...editingLine, planned_quantity: e.target.value })}
                                    min="1"
                                />
                            </Form.Group>

                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Start Time <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="time"
                                            value={editingLine.start_time}
                                            onChange={(e) => setEditingLine({ ...editingLine, start_time: e.target.value })}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>End Time <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="time"
                                            value={editingLine.end_time}
                                            onChange={(e) => setEditingLine({ ...editingLine, end_time: e.target.value })}
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>

                            <Form.Group className="mb-3">
                                <Form.Label>Shift Group</Form.Label>
                                <Form.Select
                                    value={editingLine.employee_group}
                                    onChange={(e) => setEditingLine({ ...editingLine, employee_group: e.target.value })}
                                >
                                    <option value="">Select Shift Group...</option>
                                    {employeeGroups.map(grp => {
                                        const isUsed = (editingLine.siblingLines || []).some(l => {
                                            if (String(l.employee_group) !== String(grp.id)) return false;
                                            if (editingLine.start_time && editingLine.end_time && l.start_time && l.end_time) {
                                                return editingLine.start_time < l.end_time && editingLine.end_time > l.start_time;
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
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Assigned Employees</Form.Label>
                                <div>
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => {
                                            if (!editingLine.employee_group) {
                                                MainSweetAlert.fire('Warning', 'Please select an Shift Group first.', 'warning');
                                                return;
                                            }
                                            if (!editingLine.start_time || !editingLine.end_time) {
                                                MainSweetAlert.fire('Warning', 'Please set Start and End Time first.', 'warning');
                                                return;
                                            }
                                            setShowEmployeeModal(true);
                                        }}
                                    >
                                        <i className="fa fa-users me-1"></i>
                                        Manage Employees ({(editingLine.employees || []).length} assigned)
                                    </Button>
                                </div>
                            </Form.Group>
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleSaveEdit} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Save Changes'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {showEmployeeModal && editingLine && (
                <ShiftEmployeeModal
                    show={showEmployeeModal}
                    onHide={() => setShowEmployeeModal(false)}
                    employeeGroupId={editingLine.employee_group}
                    planDate={editingLine.plan_date}
                    startTime={editingLine.start_time}
                    endTime={editingLine.end_time}
                    currentEmployees={editingLine.employees || []}
                    onUpdateEmployees={(newList) => setEditingLine(prev => ({ ...prev, employees: newList }))}
                />
            )}
        </div>
    );
};

export default ShiftPlanManagement;
