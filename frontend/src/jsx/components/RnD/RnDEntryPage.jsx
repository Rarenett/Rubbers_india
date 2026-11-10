import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Tabs, Tab, Form, Dropdown, Nav } from 'react-bootstrap';
import RnDService from '../../../services/RnDService';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import RnDEntryModal from './RnDEntryModal';
import { usePageTitle } from '../../../context/TitleContext';

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

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return cleanDate;
    }
    return dateStr;
};

const RnDEntryPage = () => {
    usePageTitle("R&D Entry");

    const [activeTab, setActiveTab] = useState('regular'); // 'regular' | 'adjustments'
    const [productionLines, setProductionLines] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters matching Post Production page
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
            let regularParams = '?no_page=true&production_type=REGULAR';
            let adjParams = '?no_page=true&production_type=ADJUSTMENT';

            if (selectedDate) {
                regularParams += `&date=${selectedDate}`;
                adjParams += `&date=${selectedDate}`;
            }
            if (selectedFactoryId) {
                regularParams += `&factory_id=${selectedFactoryId}`;
            }

            const [regRes, adjRes] = await Promise.all([
                RnDService.getPostProductionRnDEntries(regularParams),
                RnDService.getPostProductionRnDEntries(adjParams)
            ]);

            const regData = regRes.data.results || regRes.data || [];
            const adjData = adjRes.data.results || adjRes.data || [];

            setProductionLines(regData);
            setAdjustments(adjData);
        } catch (error) {
            console.error('Error fetching R&D post-production lines:', error);
            Swal.fire('Error', 'Failed to fetch R&D post-production entries.', 'error');
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
                <Dropdown.Toggle
                    as="button"
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-between text-start spm-dropdown-btn"
                    style={{ width: '175px', height: '34px', fontSize: '13px', borderRadius: '6px', borderColor: '#e2e8f0', color: '#475569' }}
                >
                    <span className="d-flex align-items-center gap-1 text-truncate" style={{ maxWidth: '145px' }}>
                        <i className="fa fa-industry" style={{ fontSize: '11px', color: '#0a500f', flexShrink: 0 }}></i>
                        <span className="text-truncate font-w500">{selectedLabel}</span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu style={{ minWidth: '175px', padding: '6px' }}>
                    <Dropdown.Item
                        onClick={() => { onChange(''); setDdOpen(false); }}
                        active={!value}
                        style={{
                            fontSize: '12px',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontWeight: !value ? '600' : '400'
                        }}
                    >
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#94a3b8', marginRight: '8px' }}></span>
                        All Factories
                    </Dropdown.Item>
                    {factories.length > 0 && <Dropdown.Divider />}
                    {factories.map((f, idx) => {
                        const color = getFactoryColor(idx);
                        const isActive = String(f.id) === String(value);
                        return (
                            <Dropdown.Item
                                key={f.id}
                                onClick={() => { onChange(String(f.id)); setDdOpen(false); }}
                                active={isActive}
                                style={{
                                    fontSize: '12px',
                                    borderRadius: '4px',
                                    padding: '6px 12px',
                                    fontWeight: isActive ? '600' : '400'
                                }}
                            >
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
        setSelectedLine(line);
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setSelectedLine(null);
    };

    const groupedLines = productionLines.reduce((acc, line) => {
        const factory = line.factory_name || 'General Factory';
        const shift = line.shift_name || 'General Shift';

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
                    border: 1px solid #0a500f !important;
                    color: #0a500f !important;
                }
                .btn-entry-custom:hover {
                    background-color: #0a500f !important;
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
                .rnd-main-tabs .nav-link {
                    color: #475569;
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s ease;
                }
                .rnd-main-tabs .nav-link:hover {
                    color: #107548;
                    background-color: #f0fdf4;
                    border-color: #bbf7d0;
                }
                .rnd-main-tabs .nav-link.active {
                    background-color: #0a500f !important;
                    border-color: #0a500f !important;
                    color: #ffffff !important;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.25) !important;
                }
                .rnd-main-tabs .nav-link .tab-counter-badge {
                    background-color: #e2e8f0;
                    color: #475569;
                    transition: all 0.2s ease;
                }
                .rnd-main-tabs .nav-link.active .tab-counter-badge {
                    background-color: #ffffff !important;
                    color: #0a500f !important;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link {
                    background-color: #2F363E;
                    border-color: #3d464e;
                    color: #94a3b8;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link:hover {
                    background-color: #38424d;
                    color: #f1f5f9;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link.active {
                    background-color: #0a500f !important;
                    border-color: #0a500f !important;
                    color: #ffffff !important;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link .tab-counter-badge {
                    background-color: #3d464e;
                    color: #94a3b8;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link.active .tab-counter-badge {
                    background-color: #ffffff !important;
                    color: #0a500f !important;
                }
            `}</style>

            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa fa-flask text-primary" style={{ fontSize: '18px' }}></i>
                                <Card.Title className="mb-0">R&D Entries</Card.Title>
                            </div>
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                <div className="d-flex align-items-center gap-1">
                                    <Form.Control
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        style={{ width: '160px', height: '34px', fontSize: '13px', borderRadius: '6px' }}
                                    />
                                    {selectedDate && (
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => setSelectedDate('')}
                                            style={{
                                                height: '34px',
                                                fontSize: '11px',
                                                borderRadius: '6px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                            title="Show all dates"
                                        >
                                            <i className="fa fa-filter me-1"></i> All Dates
                                        </Button>
                                    )}
                                </div>
                                {activeTab === 'regular' && factories.length > 1 && (
                                    <FactoryFilterDropdown value={selectedFactoryId} onChange={setSelectedFactoryId} />
                                )}
                            </div>
                        </Card.Header>

                        <Card.Body>
                            {/* Main Navigation Tabs */}
                            <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
                                <Nav variant="pills" activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="rnd-main-tabs gap-2">
                                    <Nav.Item>
                                        <Nav.Link
                                            eventKey="regular"
                                            className={`d-flex align-items-center gap-2 px-3 py-2 ${activeTab === 'regular' ? 'active' : ''}`}
                                            style={{
                                                borderRadius: '8px',
                                                fontWeight: activeTab === 'regular' ? '600' : '500',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <i className="fa fa-industry"></i>
                                            <span>Regular Production</span>
                                            <span className="badge tab-counter-badge ms-1" style={{ fontSize: '10px' }}>
                                                {productionLines.length}
                                            </span>
                                        </Nav.Link>
                                    </Nav.Item>
                                    <Nav.Item>
                                        <Nav.Link
                                            eventKey="adjustments"
                                            className={`d-flex align-items-center gap-2 px-3 py-2 ${activeTab === 'adjustments' ? 'active' : ''}`}
                                            style={{
                                                borderRadius: '8px',
                                                fontWeight: activeTab === 'adjustments' ? '600' : '500',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <i className="fa fa-sliders"></i>
                                            <span>Production Adjustments</span>
                                            <span className="badge tab-counter-badge ms-1" style={{ fontSize: '10px' }}>
                                                {adjustments.length}
                                            </span>
                                        </Nav.Link>
                                    </Nav.Item>
                                </Nav>
                            </div>

                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : activeTab === 'regular' ? (
                                productionLines.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <i className="fa fa-folder-open-o mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                        <h5>No Post Production Lines Found for R&D.</h5>
                                        <p className="mb-2">There are no entered post production records available for this date.</p>
                                        {selectedDate && (
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => setSelectedDate('')}
                                                style={{ borderRadius: '6px' }}
                                            >
                                                <i className="fa fa-calendar me-1"></i> View All Dates
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    Object.keys(groupedLines).map((factory, fIndex) => {
                                        const fColor = getFactoryColor(fIndex);
                                        const shifts = Object.keys(groupedLines[factory]);
                                        const defaultTab = shifts[0];

                                        return (
                                            <div key={factory} className={fIndex > 0 ? "mt-5" : ""}>
                                                <div
                                                    className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2 factory-banner-box"
                                                    style={{ background: fColor.bg, border: `1px solid ${fColor.border}`, borderLeft: `4px solid ${fColor.border}` }}
                                                >
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
                                                                    {lines.map(line => {
                                                                        const isCompleted = line.status === 'COMPLETED';
                                                                        const mQty = parseFloat(line.manufactured_quantity ?? line.balance_primary ?? 0);
                                                                        const dQty = line.damaged_quantity !== null && line.damaged_quantity !== undefined ? parseFloat(line.damaged_quantity) : 0;
                                                                        const bQty = line.balance_quantity !== null && line.balance_quantity !== undefined ? parseFloat(line.balance_quantity) : mQty;

                                                                        return (
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
                                                                                                <span className="font-w500 text-truncate" style={{ fontSize: '13px', maxWidth: '65%', fontWeight: '500' }} title={line.stock_item_name}>
                                                                                                    {line.stock_item_name}
                                                                                                </span>
                                                                                                <Badge bg="secondary" style={{ fontSize: '10px', padding: '3px 6px' }}>
                                                                                                    {mQty.toFixed(2)} {line.unit_name || 'units'}
                                                                                                </Badge>
                                                                                            </div>
                                                                                            {line.production_date && (
                                                                                                <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                                                                                    <i className="fa fa-calendar me-1"></i>Date: {formatDate(line.production_date)}
                                                                                                </small>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* R&D Information details if completed */}
                                                                                        {isCompleted ? (
                                                                                            <div className="pt-2 border-top mt-2 mb-1" style={{ fontSize: '12px' }}>
                                                                                                <div className="d-flex justify-content-between text-muted mb-1">
                                                                                                    <span>R&D Damaged:</span>
                                                                                                    <span className="font-w600 text-danger">{dQty.toFixed(2)} {line.unit_name || ''}</span>
                                                                                                </div>
                                                                                                <div className="d-flex justify-content-between text-muted">
                                                                                                    <span>R&D Balance:</span>
                                                                                                    <span className="font-w600 text-success">{bQty.toFixed(2)} {line.unit_name || ''}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="pt-2 border-top mt-2 mb-1" style={{ fontSize: '12px' }}>
                                                                                                <div className="d-flex justify-content-between text-muted">
                                                                                                    <span>R&D Status:</span>
                                                                                                    <span className="font-w500 text-warning">Awaiting Entry</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-2">
                                                                                        <div className="d-flex align-items-center">
                                                                                            <Badge
                                                                                                bg={isCompleted ? 'success' : 'light'}
                                                                                                text={isCompleted ? 'light' : 'dark'}
                                                                                                style={{
                                                                                                    fontSize: '10px',
                                                                                                    padding: '4px 8px',
                                                                                                    textTransform: 'capitalize',
                                                                                                    border: !isCompleted ? '1px solid #cbd5e1' : 'none'
                                                                                                }}
                                                                                            >
                                                                                                {isCompleted ? 'completed' : 'pending'}
                                                                                            </Badge>
                                                                                        </div>

                                                                                        <div className="d-flex align-items-center gap-1">
                                                                                            {isCompleted ? (
                                                                                                <Button
                                                                                                    variant="outline-success"
                                                                                                    size="sm"
                                                                                                    className="shadow-sm"
                                                                                                    style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px', borderColor: '#0a500f', color: '#0a500f', backgroundColor: 'transparent' }}
                                                                                                    onClick={() => handleAddEntry(line)}
                                                                                                    title="Edit R&D Entry"
                                                                                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0a500f'; e.currentTarget.style.color = '#fff'; }}
                                                                                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#0a500f'; }}
                                                                                                >
                                                                                                    <i className="fa fa-pen me-1"></i> Edit
                                                                                                </Button>
                                                                                            ) : (
                                                                                                <Button
                                                                                                    variant="outline-primary"
                                                                                                    size="sm"
                                                                                                    className="shadow-sm btn-entry-custom"
                                                                                                    style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
                                                                                                    onClick={() => handleAddEntry(line)}
                                                                                                    title="Add R&D Entry"
                                                                                                >
                                                                                                    <i className="fa fa-plus me-1"></i> Entry
                                                                                                </Button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </Col>
                                                                        );
                                                                    })}
                                                                </Row>
                                                            </Tab>
                                                        );
                                                    })}
                                                </Tabs>
                                            </div>
                                        );
                                    })
                                )
                            ) : (
                                adjustments.length === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <i className="fa fa-sliders mb-3" style={{ fontSize: '40px', opacity: 0.4 }}></i>
                                        <h5>No Production Adjustment Entries Found for R&D.</h5>
                                        <p className="mb-2">There are no entered adjustment post-production records available for this date.</p>
                                        {selectedDate && (
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => setSelectedDate('')}
                                                style={{ borderRadius: '6px' }}
                                            >
                                                <i className="fa fa-calendar me-1"></i> View All Dates
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <Row className="gy-3 mb-3">
                                        {adjustments.map(item => {
                                            const isCompleted = item.status === 'COMPLETED';
                                            const mQty = parseFloat(item.manufactured_quantity ?? item.balance_primary ?? 0);
                                            const dQty = item.damaged_quantity !== null && item.damaged_quantity !== undefined ? parseFloat(item.damaged_quantity) : 0;
                                            const bQty = item.balance_quantity !== null && item.balance_quantity !== undefined ? parseFloat(item.balance_quantity) : mQty;
                                            const unitName = item.unit_name || item.primary_unit_name || 'Case';
                                            const altUnitName = item.alternate_unit_name || 'Nos';
                                            const consumedAlt = item.consumed_alternate_quantity || 0;

                                            return (
                                                <Col xl={3} md={6} key={item.id}>
                                                    <div className="line-schedule-card p-3 shadow-sm d-flex flex-column justify-content-between h-100">
                                                        <div>
                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                <span className="font-w600" style={{ fontSize: '14px' }}>
                                                                    <i className="fa fa-sliders me-1" style={{ color: '#0a500f' }}></i> Adjustment #{item.id}
                                                                </span>
                                                                {item.production_date && (
                                                                    <small className="text-muted" style={{ fontSize: '11px' }}>
                                                                        <i className="fa fa-calendar me-1"></i>{formatDate(item.production_date)}
                                                                    </small>
                                                                )}
                                                            </div>

                                                            <div className="mb-2">
                                                                <div className="d-flex justify-content-between align-items-center">
                                                                    <span className="font-w500 text-truncate" style={{ fontSize: '13px', maxWidth: '65%', fontWeight: '500' }} title={item.stock_item_name}>
                                                                        {item.stock_item_name}
                                                                    </span>
                                                                    <Badge bg="secondary" style={{ fontSize: '10px', padding: '3px 6px' }}>
                                                                        {mQty.toFixed(2)} {unitName}
                                                                    </Badge>
                                                                </div>
                                                                {item.stock_item_code && (
                                                                    <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                                                        Code: {item.stock_item_code}
                                                                    </small>
                                                                )}
                                                                {Number(consumedAlt) > 0 && (
                                                                    <div className="mt-2 py-1 px-2 rounded-1 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#f8fafc', fontSize: '11px', border: '1px dashed #e2e8f0' }}>
                                                                        <span className="text-muted">Consumed Alternate:</span>
                                                                        <strong className="text-dark">{Number(consumedAlt).toFixed(2)} {altUnitName}</strong>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* R&D Information details if completed */}
                                                            {isCompleted ? (
                                                                <div className="pt-2 border-top mt-2 mb-1" style={{ fontSize: '12px' }}>
                                                                    <div className="d-flex justify-content-between text-muted mb-1">
                                                                        <span>R&D Damaged:</span>
                                                                        <span className="font-w600 text-danger">{dQty.toFixed(2)} {unitName}</span>
                                                                    </div>
                                                                    <div className="d-flex justify-content-between text-muted">
                                                                        <span>R&D Balance:</span>
                                                                        <span className="font-w600 text-success">{bQty.toFixed(2)} {unitName}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="pt-2 border-top mt-2 mb-1" style={{ fontSize: '12px' }}>
                                                                    <div className="d-flex justify-content-between text-muted">
                                                                        <span>R&D Status:</span>
                                                                        <span className="font-w500 text-warning">Awaiting Entry</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="pt-2 border-top d-flex justify-content-between align-items-center mt-2">
                                                            <div className="d-flex align-items-center">
                                                                <Badge
                                                                    bg={isCompleted ? 'success' : 'light'}
                                                                    text={isCompleted ? 'light' : 'dark'}
                                                                    style={{
                                                                        fontSize: '10px',
                                                                        padding: '4px 8px',
                                                                        textTransform: 'capitalize',
                                                                        border: !isCompleted ? '1px solid #cbd5e1' : 'none'
                                                                    }}
                                                                >
                                                                    {isCompleted ? 'completed' : 'pending'}
                                                                </Badge>
                                                            </div>

                                                            <div className="d-flex align-items-center gap-1">
                                                                {isCompleted ? (
                                                                    <Button
                                                                        variant="outline-success"
                                                                        size="sm"
                                                                        className="shadow-sm"
                                                                        style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px', borderColor: '#0a500f', color: '#0a500f', backgroundColor: 'transparent' }}
                                                                        onClick={() => handleAddEntry(item)}
                                                                        title="Edit R&D Entry"
                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0a500f'; e.currentTarget.style.color = '#fff'; }}
                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#0a500f'; }}
                                                                    >
                                                                        <i className="fa fa-pen me-1"></i> Edit
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        className="shadow-sm btn-entry-custom"
                                                                        style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px' }}
                                                                        onClick={() => handleAddEntry(item)}
                                                                        title="Add R&D Entry"
                                                                    >
                                                                        <i className="fa fa-plus me-1"></i> Entry
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                )
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {showModal && selectedLine && (
                <RnDEntryModal
                    show={showModal}
                    onHide={handleModalClose}
                    entry={selectedLine}
                    onSuccess={fetchProductionLines}
                />
            )}
        </div>
    );
};

export default RnDEntryPage;
