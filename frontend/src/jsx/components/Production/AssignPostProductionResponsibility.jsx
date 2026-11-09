import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Dropdown, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';

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
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-between text-start spm-dropdown-btn"
                    style={{ width: '175px', height: '34px', fontSize: '13px', borderRadius: '6px', borderColor: '#e2e8f0', color: '#475569' }}>
                    <span className="d-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '145px' }}>
                        <i className="fa fa-industry" style={{ fontSize: '11px', color: '#7A70BA', flexShrink: 0 }}></i>
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
                    {factories.map((f, idx) => {
                        const color = getFactoryColor(idx);
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
            border: state.isFocused ? '1px solid #7A70BA' : '1px solid #e2e8f0',
            boxShadow: state.isFocused ? '0 0 0 1px #7A70BA' : 'none',
            minHeight: '34px',
            fontSize: '13px'
        }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '13px'
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 })
    };

    return (
        <div className="container-fluid">
            <style>{`
                .app-table-header {
                    background-color: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
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
                                    style={{ width: '180px', height: '34px', fontSize: '13px', borderRadius: '6px' }}
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
                                    <i className="fa fa-calendar-times-o mb-3" style={{ fontSize: '48px', color: '#cbd5e1' }}></i>
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
                                                                    <th style={{ width: '15%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>LINE</th>
                                                                    <th style={{ width: '25%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>ITEM</th>
                                                                    <th style={{ width: '15%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>TIMING</th>
                                                                    <th style={{ width: '45%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>RESPONSIBLE EMPLOYEE</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {lines.map((line, lIdx) => (
                                                                    <tr key={line.id} className={lIdx !== lines.length - 1 ? 'app-table-row' : ''}>
                                                                        <td style={{ padding: '12px 16px' }}>
                                                                            <span className="font-w500">{line.production_line_name}</span>
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px' }}>
                                                                            <div className="d-flex flex-column">
                                                                                <span className="font-w500 text-primary" style={{ fontSize: '15px' }}>{line.stock_item_name}</span>
                                                                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                                                                    Planned: {parseFloat(line.planned_quantity)} {line.stock_item_base_unit_name}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px' }}>
                                                                            <span style={{ fontSize: '15px', fontWeight: '500' }}>
                                                                                {formatTime(line.start_time)} - {formatTime(line.end_time)}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '12px 16px' }}>
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
