import React, { useState, useEffect, Fragment, useContext } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Tabs, Tab, Form, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';
import PostProductionEntryModal from './PostProductionEntryModal';
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

const PostProductionEntryPage = () => {
    const navigate = useNavigate();
    const { customPrimaryColor } = useContext(ThemeContext) || {};
    const [productionLines, setProductionLines] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedFactoryId, setSelectedFactoryId] = useState('');
    const [factories, setFactories] = useState([]);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedLine, setSelectedLine] = useState(null);

    useEffect(() => {
        fetchFactories();
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

    const fetchProductionLines = async () => {
        setLoading(true);
        try {
            const params = `?assigned_to_me=true&date=${selectedDate}${selectedFactoryId ? `&factory_id=${selectedFactoryId}` : ''}`;
            const response = await ProductionService.getShiftProductionLines(params);
            setProductionLines(response.data);
        } catch (error) {
            console.error('Error fetching production lines:', error);
            Swal.fire('Error', 'Failed to fetch production plans.', 'error');
        } finally {
            setLoading(false);
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

    const handleAddEntry = (line) => {
        if (line.has_rnd_entry) {
            Swal.fire('Locked', 'This Post Production entry cannot be edited because an R&D entry has already been saved for it.', 'info');
            return;
        }
        setSelectedLine(line);
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setSelectedLine(null);
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
                .btn-entry-custom {
                    background-color: transparent !important;
                    border: 1px solid var(--cc-primary, #0a500f) !important;
                    color: var(--cc-primary, #0a500f) !important;
                    padding: 4px 12px;
                    font-size: 12px;
                    border-radius: 6px;
                }
                .btn-entry-custom:hover {
                    background-color: var(--cc-primary, #0a500f) !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(10, 80, 15, 0.2) !important;
                }
                .btn-edit-entry-custom {
                    padding: 4px 12px;
                    font-size: 12px;
                    border-radius: 6px;
                    border-color: var(--cc-primary, #0a500f) !important;
                    color: var(--cc-primary, #0a500f) !important;
                    background-color: transparent !important;
                    transition: all 0.2s ease-in-out;
                }
                .btn-edit-entry-custom:hover {
                    background-color: var(--cc-primary, #0a500f) !important;
                    color: #ffffff !important;
                }
                .line-name-title {
                    font-size: 14px;
                }
                .line-time-text {
                    font-size: 11px;
                }
                .line-stock-text {
                    font-size: 13px;
                    max-width: 70%;
                    font-weight: 500;
                }
                .line-qty-badge {
                    font-size: 10px;
                    padding: 3px 6px;
                }
                .line-status-badge {
                    font-size: 10px;
                    padding: 4px 8px;
                    text-transform: capitalize;
                }
                .app-empty-folder-icon {
                    font-size: 40px;
                    opacity: 0.4;
                }
                .factory-banner-icon {
                    font-size: 14px;
                }
                .factory-banner-text {
                    font-size: 14px;
                    letter-spacing: 0.3px;
                }
                .factory-banner-box {
                    border-style: solid !important;
                    border-width: 1px 1px 1px 4px !important;
                }
                .factory-banner-color-0 { background: #EEF2FF !important; border-color: #818CF8 !important; color: #4338CA !important; }
                .factory-banner-color-0 .factory-banner-icon, .factory-banner-color-0 .factory-banner-text { color: #4338CA !important; }
                .factory-banner-color-1 { background: #FFF7ED !important; border-color: #FB923C !important; color: #C2410C !important; }
                .factory-banner-color-1 .factory-banner-icon, .factory-banner-color-1 .factory-banner-text { color: #C2410C !important; }
                .factory-banner-color-2 { background: #F0FDF4 !important; border-color: #4ADE80 !important; color: #15803D !important; }
                .factory-banner-color-2 .factory-banner-icon, .factory-banner-color-2 .factory-banner-text { color: #15803D !important; }
                .factory-banner-color-3 { background: #FDF4FF !important; border-color: #C084FC !important; color: #7E22CE !important; }
                .factory-banner-color-3 .factory-banner-icon, .factory-banner-color-3 .factory-banner-text { color: #7E22CE !important; }
                .factory-banner-color-4 { background: #FFF1F2 !important; border-color: #FB7185 !important; color: #BE123C !important; }
                .factory-banner-color-4 .factory-banner-icon, .factory-banner-color-4 .factory-banner-text { color: #BE123C !important; }
                .factory-banner-color-5 { background: #F0F9FF !important; border-color: #38BDF8 !important; color: #0369A1 !important; }
                .factory-banner-color-5 .factory-banner-icon, .factory-banner-color-5 .factory-banner-text { color: #0369A1 !important; }
                .factory-banner-color-6 { background: #FEFCE8 !important; border-color: #FACC15 !important; color: #854D0E !important; }
                .factory-banner-color-6 .factory-banner-icon, .factory-banner-color-6 .factory-banner-text { color: #854D0E !important; }
                .factory-banner-color-7 { background: #F8FAFC !important; border-color: #94A3B8 !important; color: #334155 !important; }
                .factory-banner-color-7 .factory-banner-icon, .factory-banner-color-7 .factory-banner-text { color: #334155 !important; }
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
                [data-theme-version="dark"] .line-schedule-card {
                    background-color: #2F363E;
                    border-color: #3d464e;
                }
                [data-theme-version="dark"] .line-schedule-card:hover {
                    border-color: #4a5568 !important;
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25) !important;
                }
                [data-theme-version="dark"] .spm-dropdown-btn {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #a0aec0 !important;
                }
            `}</style>
            
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                            <Card.Title className="mb-0">Planned Production Lines</Card.Title>
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
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : productionLines.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="fa fa-folder-open-o mb-3 app-empty-folder-icon"></i>
                                    <h5>No Production Lines Found.</h5>
                                    <p className="mb-0">There are no planned production lines available at the moment.</p>
                                </div>
                            ) : (
                                Object.keys(groupedLines).map((factory, fIndex) => {
                                    const fColor = getFactoryColor(fIndex);
                                    const shifts = Object.keys(groupedLines[factory]);
                                    const defaultTab = shifts[0];
                                    
                                    return (
                                        <div key={factory} className={fIndex > 0 ? "mt-5" : ""}>
                                            <div className={`d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2 factory-banner-box factory-banner-color-${fIndex % 8}`}>
                                                <i className="fa fa-industry factory-banner-icon"></i>
                                                <span className="font-w700 factory-banner-text">
                                                    {factory}
                                                </span>
                                            </div>
                                            
                                            <Tabs defaultActiveKey={defaultTab} className="mb-4">
                                                {shifts.map(shift => {
                                                    const lines = groupedLines[factory][shift];
                                                    const sampleLine = lines[0];
                                                    const shiftTitle = sampleLine.start_time && sampleLine.end_time 
                                                        ? `${shift} (${formatTime(sampleLine.start_time)} - ${formatTime(sampleLine.end_time)})`
                                                        : shift;
                                                        
                                                     return (
                                                        <Tab
                                                            eventKey={shift}
                                                            key={shift}
                                                            title={<span className="d-flex align-items-center gap-1">{shiftTitle}</span>}
                                                        >
                                                            <Row className="gy-3 mb-3">
                                                                {lines.map(line => (
                                                                    <Col xl={3} md={6} key={line.id}>
                                                                        <div className="line-schedule-card p-3 shadow-sm d-flex flex-column justify-content-between">
                                                                            <div>
                                                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                                                    <span className="font-w600 line-name-title">{line.production_line_name}</span>
                                                                                    {line.start_time && line.end_time && (
                                                                                        <small className="text-muted line-time-text">
                                                                                            <i className="fa fa-clock me-1"></i>{formatTime(line.start_time)} - {formatTime(line.end_time)}
                                                                                        </small>
                                                                                    )}
                                                                                </div>

                                                                                <div className="mb-2">
                                                                                    <div className="d-flex justify-content-between align-items-center">
                                                                                        <span className="font-w500 text-truncate line-stock-text" title={line.stock_item_name}>
                                                                                            {line.stock_item_name}
                                                                                        </span>
                                                                                        <Badge bg="secondary" className="line-qty-badge">{parseFloat(line.planned_quantity).toFixed(2)} units</Badge>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-2">
                                                                                <div className="d-flex align-items-center">
                                                                                    <Badge
                                                                                        bg={line.status === 'RUNNING' ? 'primary' : line.status === 'COMPLETED' ? 'success' : 'light'}
                                                                                        text={line.status === 'PLANNED' ? 'dark' : 'light'}
                                                                                        className={`line-status-badge ${line.status === 'PLANNED' ? 'is-planned' : ''}`}
                                                                                    >
                                                                                        {line.status ? line.status.toLowerCase() : 'planned'}
                                                                                    </Badge>
                                                                                </div>

                                                                                <div className="d-flex align-items-center gap-1">
                                                                                    {line.status === 'COMPLETED' ? (
                                                                                        !line.has_rnd_entry && (
                                                                                            <Button
                                                                                                variant="outline-success"
                                                                                                size="sm"
                                                                                                className="shadow-sm btn-edit-entry-custom"
                                                                                                onClick={() => handleAddEntry(line)}
                                                                                                title="Edit Entry"
                                                                                            >
                                                                                                <i className="fa fa-pen me-1"></i> Edit
                                                                                            </Button>
                                                                                        )
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant="outline-primary"
                                                                                            size="sm"
                                                                                            className="shadow-sm btn-entry-custom"
                                                                                            onClick={() => handleAddEntry(line)}
                                                                                            title="Add Post Production Entry"
                                                                                        >
                                                                                            <i className="fa fa-plus me-1"></i> Entry
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </Col>
                                                                ))}
                                                            </Row>
                                                        </Tab>
                                                    );
                                                })}
                                            </Tabs>
                                        </div>
                                    );
                                })
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {showModal && (
                <PostProductionEntryModal 
                    show={showModal} 
                    onHide={handleModalClose} 
                    productionLine={selectedLine}
                    onSuccess={fetchProductionLines}
                />
            )}
        </div>
    );
};

export default PostProductionEntryPage;
