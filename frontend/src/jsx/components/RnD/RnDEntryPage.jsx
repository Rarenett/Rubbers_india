import React, { useState, useEffect, Fragment, useContext } from 'react';
import { Card, Button, Spinner, Badge, Row, Col, Tabs, Tab, Form, Dropdown, Nav } from 'react-bootstrap';
import RnDService from '../../../services/RnDService';
import ProductionService from '../../../services/ProductionService';
import Swal from 'sweetalert2';
import RnDEntryModal from './RnDEntryModal';
import { usePageTitle } from '../../../context/TitleContext';
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
    const { customPrimaryColor } = useContext(ThemeContext) || {};

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
                    className="btn btn-sm d-flex align-items-center justify-content-between text-start factory-filter-btn"
                >
                    <span className="d-flex align-items-center gap-1 text-truncate factory-filter-text">
                        <i className="fa fa-industry factory-filter-icon"></i>
                        <span className="text-truncate font-w500">{selectedLabel}</span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu className="factory-filter-menu">
                    <Dropdown.Item
                        onClick={() => { onChange(''); setDdOpen(false); }}
                        active={!value}
                        className={`factory-filter-item ${!value ? 'is-active' : ''}`}
                    >
                        <span className="factory-dot-all"></span>
                        All Factories
                    </Dropdown.Item>
                    {factories.length > 0 && <Dropdown.Divider />}
                    {factories.map((f, idx) => {
                        const isActive = String(f.id) === String(value);
                        return (
                            <Dropdown.Item
                                key={f.id}
                                onClick={() => { onChange(String(f.id)); setDdOpen(false); }}
                                active={isActive}
                                className={`factory-filter-item ${isActive ? 'is-active' : ''}`}
                            >
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
                    width: 160px;
                    height: 34px;
                    font-size: 13px;
                    border-radius: 6px;
                }
                .date-filter-control:focus {
                    border-color: var(--cc-primary, #0a500f) !important;
                    box-shadow: 0 0 0 2px rgba(10, 80, 15, 0.15) !important;
                }
                .all-dates-btn {
                    height: 34px;
                    font-size: 11px;
                    border-radius: 6px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #e2e8f0;
                    color: #475569;
                    background-color: #ffffff;
                }
                .all-dates-btn:hover, .all-dates-btn:focus, .all-dates-btn:active {
                    border-color: var(--cc-primary, #0a500f) !important;
                    color: var(--cc-primary, #0a500f) !important;
                    background-color: #f8fafc !important;
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
                .factory-banner-box {
                    border-style: solid !important;
                    border-width: 1px 1px 1px 4px !important;
                }
                .factory-banner-icon {
                    font-size: 14px;
                }
                .factory-banner-text {
                    font-size: 14px;
                    letter-spacing: 0.3px;
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
                [data-theme-version="dark"] .all-dates-btn {
                    background-color: #2F363E !important;
                    border-color: #4a5568 !important;
                    color: #cbd5e1 !important;
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
                    color: var(--cc-primary, #107548);
                    background-color: #f0fdf4;
                    border-color: #bbf7d0;
                }
                .rnd-main-tabs .nav-link.active {
                    background-color: var(--cc-primary, #0a500f) !important;
                    border-color: var(--cc-primary, #0a500f) !important;
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
                    color: var(--cc-primary, #0a500f) !important;
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
                    background-color: var(--cc-primary, #0a500f) !important;
                    border-color: var(--cc-primary, #0a500f) !important;
                    color: #ffffff !important;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link .tab-counter-badge {
                    background-color: #3d464e;
                    color: #94a3b8;
                }
                [data-theme-version="dark"] .rnd-main-tabs .nav-link.active .tab-counter-badge {
                    background-color: #ffffff !important;
                    color: var(--cc-primary, #0a500f) !important;
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
                                        className="date-filter-control"
                                    />
                                    {selectedDate && (
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => setSelectedDate('')}
                                            className="all-dates-btn"
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
                                                    className={`d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-2 factory-banner-box factory-banner-color-${fIndex % 8}`}
                                                >
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
                                                                                                    className="shadow-sm btn-edit-entry-custom"
                                                                                                    onClick={() => handleAddEntry(line)}
                                                                                                    title="Edit R&D Entry"
                                                                                                >
                                                                                                    <i className="fa fa-pen me-1"></i> Edit
                                                                                                </Button>
                                                                                            ) : (
                                                                                                <Button
                                                                                                    variant="outline-primary"
                                                                                                    size="sm"
                                                                                                    className="shadow-sm btn-entry-custom"
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
                                                                        className="shadow-sm btn-edit-entry-custom"
                                                                        onClick={() => handleAddEntry(item)}
                                                                        title="Edit R&D Entry"
                                                                    >
                                                                        <i className="fa fa-pen me-1"></i> Edit
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        className="shadow-sm btn-entry-custom"
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
