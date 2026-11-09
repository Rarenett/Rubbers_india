import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Spinner, Tabs, Tab, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import ProductionService from '../../../services/ProductionService';
import axiosInstance from '../../../services/AxiosInstance';
import Swal from 'sweetalert2';

const getInitialBatchNumber = (prodLine, existingBatch = '') => {
    if (existingBatch) return existingBatch;
    const dateStr = prodLine?.plan_date || prodLine?.shift_day_plan_date || prodLine?.production_date || '';
    if (dateStr) {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}${parts[1].padStart(2, '0')}${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`;
            }
        }
        return String(dateStr).replace(/[^0-9]/g, '').slice(0, 8);
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
};

const PostProductionEntryModal = ({ show, onHide, productionLine, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('finished_goods');

    const manufacturedQtyRef = useRef(null);
    const damagedQtyRef = useRef(null);
    const damagedUnitRef = useRef(null);
    const saveAndNextBtnRef = useRef(null);

    const [batchNumber, setBatchNumber] = useState('');
    const [expiryAfter, setExpiryAfter] = useState('');
    const [manufacturedQty, setManufacturedQty] = useState('');
    const [damagedQty, setDamagedQty] = useState('');
    const [damagedUnitId, setDamagedUnitId] = useState('');
    
    // Units options derived from productionLine's stock_item
    const [unitOptions, setUnitOptions] = useState([]);

    const [balance, setBalance] = useState(0);
    const [balancePrimary, setBalancePrimary] = useState(0);
    const [balanceAlternate, setBalanceAlternate] = useState(0);

    const [damagedMaterials, setDamagedMaterials] = useState([{ raw_material: '', damaged_quantity: '' }]);
    const [stockItems, setStockItems] = useState([]);

    useEffect(() => {
        const fetchStockItems = async () => {
            try {
                const res = await ProductionService.getStockItems('simple/');
                setStockItems(res.data);
            } catch (error) {
                console.error("Failed to fetch stock items", error);
            }
        };
        fetchStockItems();
    }, []);

    useEffect(() => {
        if (productionLine) {
            setActiveTab('finished_goods');
            const options = [];
            if (productionLine.stock_item_base_unit_id) {
                options.push({
                    id: productionLine.stock_item_base_unit_id,
                    name: productionLine.stock_item_base_unit_name,
                    is_base: true
                });
            }
            if (productionLine.stock_item_alternate_unit_id) {
                options.push({
                    id: productionLine.stock_item_alternate_unit_id,
                    name: productionLine.stock_item_alternate_unit_name,
                    is_base: false
                });
            }
            setUnitOptions(options);

            // Default to base unit
            if (productionLine.stock_item_base_unit_id) {
                setDamagedUnitId(productionLine.stock_item_base_unit_id);
            }

            if (productionLine.post_production_entry_id) {
                fetchExistingEntry(productionLine.post_production_entry_id);
            } else {
                setManufacturedQty('');
                setDamagedQty('');
                setBatchNumber(getInitialBatchNumber(productionLine));
                setExpiryAfter('');
                fetchRecipeMaterials(productionLine.stock_item);
            }

            setTimeout(() => {
                manufacturedQtyRef.current?.focus();
            }, 100);
        }
    }, [productionLine, show]);

    const fetchExistingEntry = async (entryId) => {
        setLoading(true);
        try {
            const res = await ProductionService.getPostProductionEntry(entryId);
            const data = res.data;
            if (data.has_rnd_entry || productionLine?.has_rnd_entry) {
                Swal.fire('Locked', 'This Post Production entry cannot be edited because an R&D entry has already been saved for it.', 'warning');
                onHide();
                return;
            }
            setManufacturedQty(data.manufactured_quantity || '');
            setDamagedQty(data.damaged_quantity || '');
            setBatchNumber(data.batch_number || getInitialBatchNumber(productionLine));
            setExpiryAfter(data.expiry_after !== null && data.expiry_after !== undefined ? data.expiry_after : '');
            if (data.damaged_unit) {
                setDamagedUnitId(data.damaged_unit);
            }
            if (data.damaged_materials && data.damaged_materials.length > 0) {
                setDamagedMaterials(data.damaged_materials.map(m => ({
                    raw_material: m.raw_material,
                    damaged_quantity: m.damaged_quantity
                })));
            } else {
                setDamagedMaterials([{ raw_material: '', damaged_quantity: '' }]);
            }
        } catch (error) {
            console.error('Failed to fetch existing entry', error);
            Swal.fire('Error', 'Failed to load existing entry data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchRecipeMaterials = async (stockItemId) => {
        if (!stockItemId) {
            setDamagedMaterials([{ raw_material: '', damaged_quantity: '' }]);
            return;
        }
        try {
            const res = await axiosInstance.get(`/api/inventory/recipes/?stock_item_id=${stockItemId}`);
            const recipes = res.data.results || res.data;
            if (recipes && recipes.length > 0) {
                const recipe = recipes[0];
                if (recipe.recipe_details && recipe.recipe_details.length > 0) {
                    const materials = recipe.recipe_details.map(detail => ({
                        raw_material: detail.stock_item,
                        damaged_quantity: ''
                    }));
                    setDamagedMaterials(materials);
                } else {
                    setDamagedMaterials([{ raw_material: '', damaged_quantity: '' }]);
                }
            } else {
                setDamagedMaterials([{ raw_material: '', damaged_quantity: '' }]);
            }
        } catch (error) {
            console.error('Failed to fetch recipe', error);
            setDamagedMaterials([{ raw_material: '', damaged_quantity: '' }]);
        }
    };

    // Calculate balance when inputs change
    useEffect(() => {
        let mQty = parseFloat(manufacturedQty) || 0;
        let dQty = parseFloat(damagedQty) || 0;
        const conversionVal = parseFloat(productionLine?.stock_item_conversion_value) || 1;

        if (dQty > 0 && damagedUnitId) {
            // Check if damaged unit is alternate unit
            const isAlternate = damagedUnitId.toString() === (productionLine?.stock_item_alternate_unit_id || '').toString();
            if (isAlternate) {
                // Convert manufactured quantity to alternate unit
                let mQtyAlt = mQty * conversionVal;
                // Subtract damaged quantity (in alternate unit)
                let balanceAltTotal = mQtyAlt - dQty;
                if (balanceAltTotal < 0) balanceAltTotal = 0;
                
                // Convert back to primary unit
                let balancePri = Math.floor(balanceAltTotal / conversionVal);
                let remainderAlt = balanceAltTotal % conversionVal;
                
                // Round remainder to one decimal place
                remainderAlt = Math.round(remainderAlt * 10) / 10;
                
                setBalancePrimary(balancePri);
                setBalanceAlternate(remainderAlt);
                setBalance(balancePri); // fallback for original if needed
            } else {
                const bal = mQty - dQty;
                setBalance(bal > 0 ? bal : 0);
                setBalancePrimary(bal > 0 ? bal : 0);
                setBalanceAlternate(0);
            }
        } else {
            const bal = mQty - dQty;
            setBalance(bal > 0 ? bal : 0);
            setBalancePrimary(bal > 0 ? bal : 0);
            setBalanceAlternate(0);
        }
    }, [manufacturedQty, damagedQty, damagedUnitId, productionLine]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (productionLine?.has_rnd_entry) {
            Swal.fire('Locked', 'This Post Production entry cannot be edited because an R&D entry has already been saved for it.', 'warning');
            return;
        }

        if (!manufacturedQty || parseFloat(manufacturedQty) < 0) {
            Swal.fire('Warning', 'Please enter a valid manufactured quantity.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                production_line: productionLine.id,
                batch_number: batchNumber || getInitialBatchNumber(productionLine),
                expiry_after: expiryAfter !== '' && expiryAfter !== null ? parseInt(expiryAfter, 10) : null,
                manufactured_quantity: manufacturedQty || 0,
                damaged_quantity: damagedQty || 0,
                damaged_unit: damagedUnitId || null,
                balance: balance,
                balance_primary: balancePrimary,
                balance_alternate: balanceAlternate,
                actual_use_quantity: balance,
                rd_rejected_quantity: null,
                damaged_materials: damagedMaterials.filter(m => m.raw_material && parseFloat(m.damaged_quantity) > 0)
            };

            if (productionLine.post_production_entry_id) {
                await ProductionService.updatePostProductionEntry(productionLine.post_production_entry_id, payload);
                Swal.fire('Success', 'Post production entry updated successfully!', 'success');
            } else {
                await ProductionService.createPostProductionEntry(payload);
                Swal.fire('Success', 'Post production entry saved successfully!', 'success');
            }
            if (onSuccess) onSuccess();
            onHide();
        } catch (error) {
            console.error('Error saving post production entry:', error);
            const errData = error.response?.data;
            let errMsg = 'Failed to save post production entry.';
            if (Array.isArray(errData) && errData[0]) {
                errMsg = errData[0];
            } else if (errData?.non_field_errors?.[0]) {
                errMsg = errData.non_field_errors[0];
            } else if (errData?.detail) {
                errMsg = errData.detail;
            } else if (typeof errData === 'string') {
                errMsg = errData;
            }
            Swal.fire('Error', errMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setDamagedMaterials(prev => [...prev, { raw_material: '', damaged_quantity: '' }]);
    };

    const handleRemoveRow = (index) => {
        setDamagedMaterials(prev => prev.filter((_, i) => i !== index));
    };

    const handleMaterialChange = (index, field, value) => {
        const updated = [...damagedMaterials];
        updated[index][field] = value;
        setDamagedMaterials(updated);

        if (field === 'raw_material') {
            if (value) {
                setTimeout(() => {
                    const qtyInput = document.querySelector(`input[data-field="damaged_quantity"][data-row-index="${index}"]`);
                    if (qtyInput) qtyInput.focus();
                }, 50);
            } else {
                if (damagedMaterials.length > 1) {
                    handleRemoveRow(index);
                }
                setTimeout(() => {
                    const saveBtn = document.querySelector('.pl-modal .btn-save-custom');
                    if (saveBtn) saveBtn.focus();
                }, 50);
            }
        }
    };

    const goToDamagedMaterialsTab = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setActiveTab('damaged_materials');
        setTimeout(() => {
            try {
                const firstSelectInput = document.querySelector('.pl-modal .react-select__control input');
                if (firstSelectInput) {
                    firstSelectInput.focus();
                }
            } catch (err) {
                console.error('Focus error:', err);
            }
        }, 100);
    };

    const handleSelectKeyDown = (e, idx) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            if (menuOpen) {
                // Let react-select handle the Enter key to select the option
                return;
            }

            const currentItem = damagedMaterials[idx];
            if (!currentItem.raw_material) {
                e.preventDefault();
                if (damagedMaterials.length > 1) {
                    handleRemoveRow(idx);
                }
                setTimeout(() => {
                    const saveBtn = document.querySelector('.pl-modal .btn-save-custom');
                    if (saveBtn) saveBtn.focus();
                }, 50);
            }
        }
    };

    const handleQtyKeyDown = (e, idx) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentItem = damagedMaterials[idx];

            if (idx === damagedMaterials.length - 1) {
                if (currentItem.raw_material && parseFloat(currentItem.damaged_quantity) > 0) {
                    handleAddRow();
                    setTimeout(() => {
                        const inputs = document.querySelectorAll('.pl-modal .react-select__control input');
                        const lastInput = inputs[inputs.length - 1];
                        if (lastInput) lastInput.focus();
                    }, 100);
                } else {
                    const saveBtn = document.querySelector('.pl-modal .btn-save-custom');
                    if (saveBtn) saveBtn.focus();
                }
            } else {
                const inputs = document.querySelectorAll('.pl-modal .react-select__control input');
                if (inputs[idx + 1]) inputs[idx + 1].focus();
            }
        }
    };

    const selectOptions = [
        { value: '', label: '---------------' },
        ...stockItems.map(si => ({ value: si.id, label: si.name }))
    ];

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            borderRadius: '8px',
            border: state.isFocused ? '1px solid #2ece8a' : '1px solid #e2e8f0',
            boxShadow: state.isFocused ? '0 0 0 1px #2ece8a' : 'none',
            '&:hover': {
                border: state.isFocused ? '1px solid #2ece8a' : '1px solid #cbd5e1'
            },
            minHeight: '40px',
            fontSize: '13px'
        }),
        option: (provided, state) => ({
            ...provided,
            fontSize: '13px'
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 })
    };

    return (
        <>
            <style>{`
                .pl-modal .modal-content { border-radius: 16px !important; border: none !important; box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important; overflow: hidden; }
                .pl-modal .modal-header-custom { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 16px; border-bottom:1px solid #f1f5f9; }
                .pl-modal .modal-icon-circle { width:48px; height:48px; background:#2ece8a; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(46,206,138,.2); }
                .pl-modal .modal-close-x { border:none; background:transparent; font-size:24px; color:#aaa; cursor:pointer; }
                .pl-modal .modal-close-x:hover { color:#555; }
                .pl-modal .modal-body-custom { padding:24px 28px; }
                .pl-modal .modal-footer-custom { display:flex; justify-content:flex-end; padding:20px 28px 24px; border-top:1px solid #f1f5f9; background:#fafbfc; gap:12px; }
                .pl-modal .form-label-custom { font-size:14px; font-weight:500; color:#4a5568; margin-bottom:8px; }
                .pl-modal .form-control-custom { border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; font-size:14px; color:inherit; width:100%; transition:border-color .2s,box-shadow .2s; }
                .pl-modal .form-select-custom { border:1px solid #cbd5e1; border-radius:10px; padding:12px 16px; font-size:14px; color:inherit; width:100%; transition:border-color .2s,box-shadow .2s; }
                .pl-modal .form-control-custom:focus, .pl-modal .form-select-custom:focus { outline:none; border-color:#2ece8a; box-shadow:0 0 0 3px rgba(46,206,138,.15); }
                .pl-modal .btn-close-custom { background:#7A70BA !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .pl-modal .btn-save-custom { background:#2ece8a !important; color:white !important; border-radius:8px !important; font-weight:500 !important; font-size:14px !important; padding:10px 24px !important; border:none !important; cursor:pointer; }
                .pl-modal-table-header { background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                .pl-modal-table-container { border: 1px solid #f1f5f9; border-radius: 10px; overflow: hidden; }
                .pl-modal-table-row { border-bottom: 1px solid #f1f5f9; }
                .unit-badge {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 12px;
                    font-weight: 600;
                    color: #7A70BA;
                    background: #f0eeff;
                    border: 1px solid #d1cdf5;
                    border-radius: 4px;
                    padding: 2px 8px;
                    pointer-events: none;
                    white-space: nowrap;
                }

                /* Dark mode overrides */
                [data-theme-version="dark"] .pl-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .pl-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .pl-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .pl-modal .form-select-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .pl-modal .modal-title { color: #fff !important; }
                [data-theme-version="dark"] .pl-modal .modal-close-x { color: #888; }
                [data-theme-version="dark"] .pl-modal .modal-close-x:hover { color: #ccc; }
                [data-theme-version="dark"] .pl-modal-table-header { background-color: #24292D !important; border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal-table-container { border-color: #3d464e !important; }
                [data-theme-version="dark"] .pl-modal-table-row { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .unit-badge { color: #c4b5fd !important; background: rgba(122, 112, 186, 0.25) !important; border-color: rgba(122, 112, 186, 0.5) !important; }
                [data-theme-version="dark"] .react-select__control { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .react-select__menu { background-color: #2F363E !important; }
                [data-theme-version="dark"] .react-select__option { background-color: transparent !important; color: #fff !important; }
                [data-theme-version="dark"] .react-select__option:hover { background-color: #3d464e !important; }
                [data-theme-version="dark"] .react-select__single-value { color: #fff !important; }
                [data-theme-version="dark"] .react-select__input-container { color: #fff !important; }
            `}</style>
            
            <Modal show={show} onHide={onHide} size="lg" centered dialogClassName="pl-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-industry text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {productionLine?.post_production_entry_id ? 'Edit Post Production Entry' : 'Add Post Production Entry'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Enter post production details for {productionLine?.production_line_name || 'this line'}</p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>
                
                {productionLine ? (
                    <Form onSubmit={handleSubmit}>
                        <div className="modal-body-custom pt-0 pb-0 mt-3">
                            <Tabs id="post-production-tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
                                <Tab eventKey="finished_goods" title="Manufacture Entry">
                                    <Row className="mb-3 mt-2">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Planned Product</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    readOnly 
                                                    className="form-control-custom bg-light"
                                                    value={productionLine.stock_item_name || ''} 
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Planned Quantity</Form.Label>
                                                <div style={{ position: 'relative' }}>
                                                    <Form.Control 
                                                        type="text" 
                                                        readOnly 
                                                        className="form-control-custom bg-light"
                                                        value={productionLine.planned_quantity || ''} 
                                                        style={{ paddingRight: productionLine?.stock_item_base_unit_name ? '72px' : undefined }}
                                                    />
                                                    {productionLine?.stock_item_base_unit_name && (
                                                        <span className="unit-badge">
                                                            {productionLine.stock_item_base_unit_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Batch Number</Form.Label>
                                                <Form.Control 
                                                    type="text" 
                                                    className="form-control-custom"
                                                    placeholder="YYYYMMDD"
                                                    value={batchNumber}
                                                    onChange={(e) => setBatchNumber(e.target.value)}
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Expiry After (Days)</Form.Label>
                                                <Form.Control 
                                                    type="number" 
                                                    min="0"
                                                    className="form-control-custom"
                                                    placeholder="Enter days (e.g. 180)"
                                                    value={expiryAfter}
                                                    onChange={(e) => setExpiryAfter(e.target.value)}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Manufactured Quantity <span className="text-danger">*</span></Form.Label>
                                                <div style={{ position: 'relative' }}>
                                                    <Form.Control 
                                                        ref={manufacturedQtyRef}
                                                        type="number" 
                                                        step="0.001"
                                                        min="0"
                                                        className="form-control-custom"
                                                        placeholder="Enter manufactured qty"
                                                        value={manufacturedQty}
                                                        onChange={(e) => setManufacturedQty(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                damagedQtyRef.current?.focus();
                                                            }
                                                        }}
                                                        style={{ paddingRight: productionLine?.stock_item_base_unit_name ? '72px' : undefined }}
                                                        required
                                                    />
                                                    {productionLine?.stock_item_base_unit_name && (
                                                        <span className="unit-badge">
                                                            {productionLine.stock_item_base_unit_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Damaged Quantity</Form.Label>
                                                <Form.Control 
                                                    ref={damagedQtyRef}
                                                    type="number" 
                                                    step="0.001"
                                                    min="0"
                                                    className="form-control-custom"
                                                    placeholder="Enter damaged qty"
                                                    value={damagedQty}
                                                    onChange={(e) => setDamagedQty(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            damagedUnitRef.current?.focus();
                                                            setTimeout(() => {
                                                                try { damagedUnitRef.current?.showPicker?.(); } catch (err) {}
                                                            }, 50);
                                                        }
                                                    }}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <Form.Group>
                                                <Form.Label className="form-label-custom">Damaged Unit</Form.Label>
                                                <Form.Select 
                                                    ref={damagedUnitRef}
                                                    className="form-select-custom"
                                                    value={damagedUnitId}
                                                    onChange={(e) => {
                                                        setDamagedUnitId(e.target.value);
                                                        setTimeout(() => {
                                                            saveAndNextBtnRef.current?.focus();
                                                        }, 100);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            saveAndNextBtnRef.current?.focus();
                                                        }
                                                    }}
                                                >
                                                    <option value="">Select Unit</option>
                                                    {unitOptions.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.name} {u.is_base ? '(Primary)' : '(Alternate)'}
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        {damagedUnitId && damagedUnitId.toString() === (productionLine?.stock_item_alternate_unit_id || '').toString() ? (
                                            <>
                                                <Col md={3}>
                                                    <Form.Group>
                                                        <Form.Label className="form-label-custom">Balance (Primary)</Form.Label>
                                                        <Form.Control 
                                                            type="text" 
                                                            readOnly 
                                                            value={`${balancePrimary} ${productionLine?.stock_item_base_unit_name || ''}`.trim()} 
                                                            className="form-control-custom bg-light font-weight-bold"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group>
                                                        <Form.Label className="form-label-custom">Balance (Alternate)</Form.Label>
                                                        <Form.Control 
                                                            type="text" 
                                                            readOnly 
                                                            value={`${balanceAlternate} ${productionLine?.stock_item_alternate_unit_name || ''}`.trim()} 
                                                            className="form-control-custom bg-light font-weight-bold"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                            </>
                                        ) : (
                                            <Col md={6}>
                                                <Form.Group>
                                                    <Form.Label className="form-label-custom">Balance (Primary Unit)</Form.Label>
                                                    <Form.Control 
                                                        type="text" 
                                                        readOnly 
                                                        value={balance.toFixed(3)} 
                                                        className="form-control-custom bg-light font-weight-bold"
                                                    />
                                                </Form.Group>
                                            </Col>
                                        )}
                                    </Row>
                                </Tab>
                                
                                <Tab eventKey="damaged_materials" title="Damaged Raw Materials">
                                    <div className="mt-4">
                                        <div className="table-responsive pl-modal-table-container">
                                            <table className="table mb-0 align-middle" style={{ minWidth: '600px' }}>
                                                <thead className="pl-modal-table-header">
                                                    <tr>
                                                        <th style={{ width: '5%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>SL NO</th>
                                                        <th style={{ width: '60%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>RAW MATERIAL</th>
                                                        <th style={{ width: '30%', padding: '12px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px' }}>QUANTITY</th>
                                                        <th style={{ width: '5%', padding: '12px 16px' }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {damagedMaterials.map((item, idx) => (
                                                        <tr key={idx} className={idx !== damagedMaterials.length - 1 ? 'pl-modal-table-row' : ''}>
                                                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '13px' }}>
                                                                {idx + 1}
                                                            </td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                <Select
                                                                    options={selectOptions}
                                                                    styles={customSelectStyles}
                                                                    placeholder="-------------"
                                                                    classNamePrefix="react-select"
                                                                    openMenuOnFocus={true}
                                                                    isClearable
                                                                    menuPortalTarget={document.body}
                                                                    menuPosition={'fixed'}
                                                                    value={selectOptions.find(opt => opt.value === item.raw_material) || null}
                                                                    onChange={(selectedOption) => handleMaterialChange(idx, 'raw_material', selectedOption ? selectedOption.value : '')}
                                                                    onKeyDown={(e) => handleSelectKeyDown(e, idx)}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '12px 16px' }}>
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.001"
                                                                    min="0"
                                                                    data-field="damaged_quantity"
                                                                    data-row-index={idx}
                                                                    className="form-control-custom"
                                                                    style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}
                                                                    placeholder="0.000"
                                                                    value={item.damaged_quantity}
                                                                    onChange={(e) => handleMaterialChange(idx, 'damaged_quantity', e.target.value)}
                                                                    onKeyDown={(e) => handleQtyKeyDown(e, idx)}
                                                                />
                                                            </td>
                                                            <td className="text-center" style={{ padding: '12px 16px' }}>
                                                                <button 
                                                                    type="button"
                                                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '18px', fontWeight: '500', cursor: damagedMaterials.length === 1 ? 'not-allowed' : 'pointer', opacity: damagedMaterials.length === 1 ? 0.3 : 1 }}
                                                                    onClick={() => handleRemoveRow(idx)}
                                                                    disabled={damagedMaterials.length === 1}
                                                                >
                                                                    &times;
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="d-flex justify-content-end mt-3 mb-3">
                                            <Button variant="outline-primary" size="sm" onClick={handleAddRow} className="shadow-sm px-3" style={{ borderRadius: '8px', fontSize: '12px', height: '30px', display: 'flex', alignItems: 'center' }}>
                                                <i className="fa fa-plus me-1"></i> Row
                                            </Button>
                                        </div>
                                    </div>
                                </Tab>
                            </Tabs>
                        </div>
                        <div className="modal-footer-custom">
                            <Button type="button" className="btn-close-custom" onClick={onHide}>
                                Cancel
                            </Button>
                            {activeTab === 'finished_goods' ? (
                                <Button 
                                    ref={saveAndNextBtnRef}
                                    type="button" 
                                    className="btn-save-custom" 
                                    onClick={goToDamagedMaterialsTab}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            goToDamagedMaterialsTab();
                                        }
                                    }}
                                >
                                    Save & Next
                                </Button>
                            ) : (
                                <Button type="submit" className="btn-save-custom" disabled={loading}>
                                    {loading ? 'Saving...' : 'Save'}
                                </Button>
                            )}
                        </div>
                    </Form>
                ) : (
                    <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                    </div>
                )}
            </Modal>
        </>
    );
};

export default PostProductionEntryModal;
