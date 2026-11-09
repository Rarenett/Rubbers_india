import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Tabs, Tab, Form, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import PageTitle from '../../layouts/PageTitle';
import PostProductionEntryModal from './PostProductionEntryModal';

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
                    border: 1px solid #7A70BA !important;
                    color: #7A70BA !important;
                }
                .btn-entry-custom:hover {
                    background-color: #7A70BA !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 12px rgba(122, 112, 186, 0.2) !important;
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
                                    style={{ width: '180px', height: '34px', fontSize: '13px', borderRadius: '6px' }}
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
                                    <i className="fa fa-folder-open-o mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
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
                                            <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2 factory-banner-box"
                                                style={{ background: fColor.bg, border: `1px solid ${fColor.border}`, borderLeft: `4px solid ${fColor.border}` }}>
                                                <i className="fa fa-industry" style={{ color: fColor.text, fontSize: '14px' }}></i>
                                                <span className="font-w700" style={{ color: fColor.text, fontSize: '14px', letterSpacing: '0.3px' }}>
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
                                                                                    <span className="font-w600" style={{ fontSize: '14px' }}>{line.production_line_name}</span>
                                                                                    {line.start_time && line.end_time && (
                                                                                        <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                                            <i className="fa fa-clock me-1"></i>{formatTime(line.start_time)} - {formatTime(line.end_time)}
                                                                                        </small>
                                                                                    )}
                                                                                </div>

                                                                                <div className="mb-2">
                                                                                    <div className="d-flex justify-content-between align-items-center">
                                                                                        <span className="font-w500 text-truncate" style={{ fontSize: '13px', maxWidth: '70%', fontWeight: '500' }} title={line.stock_item_name}>
                                                                                            {line.stock_item_name}
                                                                                        </span>
                                                                                        <Badge bg="secondary" style={{ fontSize: '10px', padding: '3px 6px' }}>{parseFloat(line.planned_quantity).toFixed(2)} units</Badge>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-2">
                                                                                <div className="d-flex align-items-center">
                                                                                    <Badge
                                                                                        bg={line.status === 'RUNNING' ? 'primary' : line.status === 'COMPLETED' ? 'success' : 'light'}
                                                                                        text={line.status === 'PLANNED' ? 'dark' : 'light'}
                                                                                        style={{ fontSize: '10px', padding: '4px 8px', textTransform: 'capitalize', border: line.status === 'PLANNED' ? '1px solid #cbd5e1' : 'none' }}
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
                                                                                                className="shadow-sm"
                                                                                                style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px', borderColor: '#2ece8a', color: '#2ece8a', backgroundColor: 'transparent' }}
                                                                                                onClick={() => handleAddEntry(line)}
                                                                                                title="Edit Entry"
                                                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2ece8a'; e.currentTarget.style.color = '#fff'; }}
                                                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#2ece8a'; }}
                                                                                            >
                                                                                                <i className="fa fa-pen me-1"></i> Edit
                                                                                            </Button>
                                                                                        )
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant="outline-primary"
                                                                                            size="sm"
                                                                                            className="shadow-sm btn-entry-custom"
                                                                                            style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
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
