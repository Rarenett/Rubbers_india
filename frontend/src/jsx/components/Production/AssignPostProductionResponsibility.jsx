import React, { useState, useEffect, Fragment, useContext } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Dropdown, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';
import { ThemeContext } from '../../../context/ThemeContext';

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

const getFactoryColor = (index) => {
    return FACTORY_COLORS[index % FACTORY_COLORS.length];
};

const formatTime = (timeString) => {
    if (!timeString) return '';
    const parts = timeString.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return timeString;
};

const AssignPostProductionResponsibility = () => {
    const navigate = useNavigate();
    const { customPrimaryColor } = useContext(ThemeContext) || {};
    const [productionLines, setProductionLines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedFactoryId, setSelectedFactoryId] = useState('');
    const [factories, setFactories] = useState([]);

    useEffect(() => {
        fetchFactories();
        fetchEmployees();
    }, []);

    useEffect(() => {
        fetchProductionLines();
    }, [selectedDate, selectedFactoryId]);

    const fetchFactories = async () => {
        try {
            const res = await ProductionService.getFactories();
            const factList = res.data.results || res.data;
            setFactories(factList);
        } catch (error) {
            console.error("Failed to load factories:", error);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await ProductionService.getEmployees();
            const empList = res.data.results || res.data;
            const productionEmployees = empList.filter(emp => 
                emp.department_name && emp.department_name.toLowerCase().includes('production')
            );
            setEmployees(productionEmployees.map(emp => ({
                value: emp.id,
                label: emp.full_name || emp.user_name || (emp.user && emp.user.username) || 'Unknown Employee'
            })));
        } catch (error) {
            console.error("Failed to load employees:", error);
        }
    };

    const fetchProductionLines = async () => {
        setLoading(true);
        try {
            const params = `?date=${selectedDate}${selectedFactoryId ? `&factory_id=${selectedFactoryId}` : ''}&all_lines=true`;
            const response = await ProductionService.getShiftProductionLines(params);
            setProductionLines(response.data);
        } catch (error) {
            console.error('Error fetching production lines:', error);
            Swal.fire('Error', 'Failed to fetch production plans.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignResponsibility = async (line, selectedOption) => {
        try {
            const employeeId = selectedOption ? selectedOption.value : null;

            // If cleared out and it exists, we might need to delete it. But typically you just change it.
            // If they clear it out, let's just delete the mapping
            if (!employeeId) {
                if (line.post_production_responsibility_id) {
                    await ProductionService.deletePostProductionResponsibility(line.post_production_responsibility_id);
                    const updatedLines = productionLines.map(l => {
                        if (l.id === line.id) {
                            return { ...l, post_production_responsibility_id: null, post_production_responsible_employee_id: null };
                        }
                        return l;
                    });
                    setProductionLines(updatedLines);
                    
                    Swal.fire({
                        title: 'Success!',
                        text: 'Responsibility removed.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
                return;
            }

            const payload = {
                production_line: line.id,
                employee: employeeId
            };

            let response;
            if (line.post_production_responsibility_id) {
                response = await ProductionService.patchPostProductionResponsibility(line.post_production_responsibility_id, payload);
            } else {
                response = await ProductionService.createPostProductionResponsibility(payload);
            }

            // Update local state to reflect the new mapping
            const updatedLines = productionLines.map(l => {
                if (l.id === line.id) {
                    return {
                        ...l,
                        post_production_responsibility_id: response.data.id,
                        post_production_responsible_employee_id: employeeId
                    };
                }
                return l;
            });
            setProductionLines(updatedLines);

            Swal.fire({
                title: 'Success!',
                text: 'Responsibility assigned successfully.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("Failed to assign responsibility:", error);
            // Handle unique constraint error specifically if needed
            Swal.fire('Error', 'Failed to save the assignment. Please try again.', 'error');
        }
    };

    const FactoryFilterDropdown = ({ value, onChange }) => {
        const [ddOpen, setDdOpen] = useState(false);
        const selectedFactory = factories.find(f => String(f.id) === String(value));
        const selectedLabel = selectedFactory ? selectedFactory.name : 'All Factories';
        return (
            <Dropdown show={ddOpen} onToggle={setDdOpen}>
                <Dropdown.Toggle as="button"
                    className="btn btn-sm d-flex align-items-center justify-content-between text-start factory-filter-btn">
                    <span className="d-flex align-items-center gap-1 text-truncate factory-filter-text">
                        <i className="fa fa-industry factory-filter-icon"></i>
                        <span className="text-truncate font-w500">{selectedLabel}</span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="factory-filter-menu">
                    <Dropdown.Item onClick={() => { onChange(''); setDdOpen(false); }}
                        active={!value}
                        className={`factory-filter-item ${!value ? 'is-active' : ''}`}>
                        <span className="factory-dot-all"></span>All Factories
                    </Dropdown.Item>
                    {factories.length > 0 && <Dropdown.Divider />}
                    {factories.map((f, idx) => {
                        const color = getFactoryColor(idx);
                        const isActive = String(f.id) === String(value);
                        return (
                            <Dropdown.Item key={f.id}
                                onClick={() => { onChange(String(f.id)); setDdOpen(false); }}
                                active={isActive}
                                className={`factory-filter-item ${isActive ? 'is-active' : ''}`}>
                                <span className={`factory-dot-item factory-dot-color-${idx % 8}`}></span>
                                {f.name}
                            </Dropdown.Item>
                        );
                    })}
                </Dropdown.Menu>
            </Dropdown>
        );
    };

    const groupedLines = productionLines.reduce((acc, line) => {
        const factory = line.factory_name || 'Unknown Factory';
        const shift = line.shift_name || 'Unknown Shift';
        
        if (!acc[factory]) {
            acc[factory] = {};
        }
        if (!acc[factory][shift]) {
            acc[factory][shift] = [];
        }
        acc[factory][shift].push(line);
        return acc;
    }, {});

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            borderRadius: '6px',
            border: state.isFocused ? `1px solid ${customPrimaryColor || 'var(--cc-primary, #0a500f)'}` : '1px solid #e2e8f0',
            boxShadow: state.isFocused ? `0 0 0 1px ${customPrimaryColor || 'var(--cc-primary, #0a500f)'}` : 'none',
            minHeight: '34px',
            fontSize: '13px'
        }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '13px',
            backgroundColor: state.isSelected ? (customPrimaryColor || 'var(--cc-primary, #0a500f)') : state.isFocused ? 'rgba(10, 80, 15, 0.08)' : 'transparent',
            color: state.isSelected ? '#ffffff' : '#334155',
            '&:active': {
                backgroundColor: customPrimaryColor || 'var(--cc-primary, #0a500f)',
                color: '#ffffff'
            }
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 })
    };

    return (
        <div className="container-fluid">
            <style>{`
                .factory-filter-btn {
                    width: 175px;
                    height: 34px;
                    font-size: 13px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0 !important;
                    background-color: #ffffff !important;
                    color: #475569 !important;
                    box-shadow: none !important;
                }
                .factory-filter-btn:hover,
                .factory-filter-btn:focus,
                .factory-filter-btn:active,
                .factory-filter-btn.show,
                .show > .factory-filter-btn.dropdown-toggle {
                    background-color: #f8fafc !important;
                    border-color: var(--cc-primary, #0a500f) !important;
                    color: #1e293b !important;
                    box-shadow: 0 0 0 2px rgba(10, 80, 15, 0.1) !important;
                }
                .factory-filter-text {
                    max-width: 145px;
                }
                .factory-filter-icon {
                    font-size: 11px;
                    color: var(--cc-primary, #0a500f) !important;
                    flex-shrink: 0;
                }
                .factory-filter-menu {
                    min-width: 175px;
                    padding: 6px;
                }
                .factory-filter-item {
                    font-size: 12px;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-weight: 400;
                }
                .factory-filter-item.is-active,
                .factory-filter-item.active {
                    background-color: var(--cc-primary, #0a500f) !important;
                    color: #ffffff !important;
                    font-weight: 600;
                }
                .factory-dot-all {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 2px;
                    background-color: #94a3b8;
                    margin-right: 8px;
                }
                .factory-dot-item {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 8px;
                }
                .factory-dot-color-0 { background-color: #818CF8; }
                .factory-dot-color-1 { background-color: #FB923C; }
                .factory-dot-color-2 { background-color: #4ADE80; }
                .factory-dot-color-3 { background-color: #C084FC; }
                .factory-dot-color-4 { background-color: #FB7185; }
                .factory-dot-color-5 { background-color: #38BDF8; }
                .factory-dot-color-6 { background-color: #FACC15; }
                .factory-dot-color-7 { background-color: #94A3B8; }
                .date-filter-control {
                    width: 180px;
                    height: 34px;
                    font-size: 13px;
                    border-radius: 6px;
                }
                .date-filter-control:focus {
                    border-color: var(--cc-primary, #0a500f) !important;
                    box-shadow: 0 0 0 2px rgba(10, 80, 15, 0.15) !important;
                }
                .app-table-header {
                    background-color: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }
                .app-th-line {
                    width: 15%;
                    padding: 12px 16px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .app-th-item {
                    width: 25%;
                    padding: 12px 16px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .app-th-timing {
                    width: 15%;
                    padding: 12px 16px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .app-th-emp {
                    width: 45%;
                    padding: 12px 16px;
                    font-size: 11px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .app-td-cell {
                    padding: 12px 16px;
                }
                .app-item-title {
                    font-size: 15px;
                }
                .app-item-sub {
                    font-size: 12px;
                }
                .app-timing-text {
                    font-size: 15px;
                    font-weight: 500;
                }
                .app-empty-icon {
                    font-size: 48px;
                    color: #cbd5e1;
                }
                .app-table-container {
                    border: 1px solid #f1f5f9;
                    border-radius: 10px;
                    overflow: visible;
                }
                .app-table-row {
                    border-bottom: 1px solid #f1f5f9;
                }
                .app-factory-title {
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 10px;
                }
                [data-theme-version="dark"] .factory-filter-btn {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #cbd5e1 !important;
                }
                [data-theme-version="dark"] .factory-filter-btn:hover,
                [data-theme-version="dark"] .factory-filter-btn:focus,
                [data-theme-version="dark"] .factory-filter-btn.show,
                [data-theme-version="dark"] .show > .factory-filter-btn.dropdown-toggle {
                    background-color: #374151 !important;
                    border-color: var(--cc-primary, #0a500f) !important;
                    color: #ffffff !important;
                }
                [data-theme-version="dark"] .spm-dropdown-btn {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #a0aec0 !important;
                }
                [data-theme-version="dark"] .app-factory-title {
                    border-bottom-color: #3d464e !important;
                    color: #ffffff !important;
                }
                [data-theme-version="dark"] .app-table-header {
                    background-color: #24292D !important;
                    border-bottom: 1px solid #3d464e !important;
                }
                [data-theme-version="dark"] .app-table-container {
                    border-color: #3d464e !important;
                }
                [data-theme-version="dark"] .app-table-row {
                    border-bottom-color: #3d464e !important;
                }
                [data-theme-version="dark"] .app-factory-title {
                    border-bottom-color: #3d464e !important;
                }
                [data-theme-version="dark"] .react-select__control {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__menu {
                    background-color: #2F363E !important;
                }
                [data-theme-version="dark"] .react-select__option {
                    background-color: transparent !important;
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__option:hover {
                    background-color: #3d464e !important;
                }
                [data-theme-version="dark"] .react-select__single-value {
                    color: #fff !important;
                }
                [data-theme-version="dark"] .react-select__input-container {
                    color: #fff !important;
                }
            `}</style>
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                            <Card.Title className="mb-0">Assign Entry Responsibility</Card.Title>
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                <Form.Control
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="date-filter-control"
                                />
                                {factories.length > 1 && (
                                    <FactoryFilterDropdown value={selectedFactoryId} onChange={setSelectedFactoryId} />
                                )}
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                    <p className="mt-2 text-muted">Loading production lines...</p>
                                </div>
                            ) : productionLines.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="fa fa-calendar-times-o mb-3 app-empty-icon"></i>
                                    <h5>No production lines found</h5>
                                    <p>Select a different date or factory to view production lines.</p>
                                </div>
                            ) : (
                                <div>
                                    {Object.entries(groupedLines).map(([factoryName, shifts], fIdx) => (
                                        <div key={factoryName} className="mb-5">
                                            <h5 className="font-w600 mb-3 app-factory-title">
                                                <i className="fa fa-industry me-2 text-primary"></i>
                                                {factoryName}
                                            </h5>
                                            
                                            {Object.entries(shifts).map(([shiftName, lines], sIdx) => (
                                                <div key={shiftName} className="mb-4">
                                                    <div className="d-flex align-items-center mb-3">
                                                        <h6 className="mb-0 font-w600">{shiftName}</h6>
                                                        <Badge bg="secondary" className="ms-2 rounded-pill">
                                                            {lines.length} Lines
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="table-responsive app-table-container">
                                                        <table className="table mb-0 align-middle">
                                                            <thead className="app-table-header">
                                                                <tr>
                                                                    <th className="app-th-line">LINE</th>
                                                                    <th className="app-th-item">ITEM</th>
                                                                    <th className="app-th-timing">TIMING</th>
                                                                    <th className="app-th-emp">RESPONSIBLE EMPLOYEE</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {lines.map((line, lIdx) => (
                                                                    <tr key={line.id} className={lIdx !== lines.length - 1 ? 'app-table-row' : ''}>
                                                                        <td className="app-td-cell">
                                                                            <span className="font-w500">{line.production_line_name}</span>
                                                                        </td>
                                                                        <td className="app-td-cell">
                                                                            <div className="d-flex flex-column">
                                                                                <span className="font-w500 text-primary app-item-title">{line.stock_item_name}</span>
                                                                                <span className="text-muted app-item-sub">
                                                                                    Planned: {parseFloat(line.planned_quantity)} {line.stock_item_base_unit_name}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="app-td-cell">
                                                                            <span className="app-timing-text">
                                                                                {formatTime(line.start_time)} - {formatTime(line.end_time)}
                                                                            </span>
                                                                        </td>
                                                                        <td className="app-td-cell">
                                                                            <Select
                                                                                classNamePrefix="react-select"
                                                                                options={employees}
                                                                                styles={customSelectStyles}
                                                                                placeholder="Select Employee..."
                                                                                isClearable
                                                                                menuPortalTarget={document.body}
                                                                                menuPosition={'fixed'}
                                                                                value={employees.find(e => e.value === line.post_production_responsible_employee_id) || null}
                                                                                onChange={(selected) => handleAssignResponsibility(line, selected)}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AssignPostProductionResponsibility;
