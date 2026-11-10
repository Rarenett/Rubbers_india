import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import Select, { components } from 'react-select';
import Swal from 'sweetalert2';
import {
    getStockJournalTypes,
    getStockJournalPrefixConfigs,
    createStockJournal,
    updateStockJournal,
} from '../../../services/FinanceService';
import { getStockItems } from '../../../services/InventoryService';
import ConsumptionComponent from './ConsumptionComponent';
import ProductionComponent from './ProductionComponent';
import { emptyRow } from './emptyRow';
import InventoryService from '../../../services/InventoryService';

const CustomOption = (props) => {
    const { onMouseMove, onMouseOver, ...otherInnerProps } = props.innerProps;
    return (
        <components.Option {...props} innerProps={otherInnerProps} />
    );
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * StockJournalFormModal
 *
 * Props:
 *   show        - boolean
 *   onHide      - () => void
 *   onSaved     - () => void  (refresh parent list)
 *   editItem    - full journal object to edit, or null for create
 */
const StockJournalFormModal = ({ show, onHide, onSaved, editItem }) => {
    const isEdit = !!editItem;
    const typeSelectRef = useRef(null);
    const [isKeyboard, setIsKeyboard] = useState(false);

    useEffect(() => {
        if (!show) return;
        const handleKeyDown = (e) => {
            if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                setIsKeyboard(prev => {
                    if (!prev) return true;
                    return prev;
                });
            }
        };
        const handleMouseMove = () => {
            setIsKeyboard(prev => {
                if (prev) return false;
                return prev;
            });
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [show]);

    // ─── Master Data ──────────────────────────────────────────────────────────
    const [journalTypes, setJournalTypes] = useState([]);
    const [prefixConfigs, setPrefixConfigs] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [productConfig, setProductConfig] = useState(null);
    const [loadingMaster, setLoadingMaster] = useState(true);

    // ─── Form State ───────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        journal_no: '',           // PrefixConfiguration id
        journal_date: todayStr(),
        stock_journal_type: '',   // StockJournalType id
        narration: '',
    });
    const [selectedType, setSelectedType] = useState(null);  // full type object
    const [numberPreview, setNumberPreview] = useState('');   // e.g. SJ-0001
    const [consumptionRows, setConsumptionRows] = useState([emptyRow()]);
    const [productionRows, setProductionRows] = useState([emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const journalTypeOptions = useMemo(() => journalTypes.map(t => ({
        value: t.id,
        label: `${t.stock_journal_type} (${t.movement_type === 'IN' ? 'Production' : t.movement_type === 'OUT' ? 'Consumption' : 'Production/Consumption'})`,
        original: t
    })), [journalTypes]);

    // ─── Load master data on open ─────────────────────────────────────────────
    useEffect(() => {
        if (!show) return;
        Promise.allSettled([
            getStockJournalTypes(),
            getStockJournalPrefixConfigs(),
            getStockItems(),
            InventoryService.getProductConfigurations(),
        ]).then(([typesRes, configsRes, itemsRes, pcRespRes]) => {
            const types = typesRes.status === 'fulfilled' ? typesRes.value : [];
            const configs = configsRes.status === 'fulfilled' ? configsRes.value : [];
            const items = itemsRes.status === 'fulfilled' ? itemsRes.value : [];
            const pcResp = pcRespRes.status === 'fulfilled' ? pcRespRes.value : null;

            setJournalTypes(Array.isArray(types) ? types : types?.results || []);
            setPrefixConfigs(Array.isArray(configs) ? configs : configs?.results || []);
            setStockItems(Array.isArray(items) ? items : items?.results || []);

            // Find product config for Stock Journal (try code 'SJ' or name match)
            const allConfigs = pcResp?.data || [];
            const sjConfig = allConfigs.find(
                pc =>
                    pc.voucher_type_code === 'SJ' ||
                    (pc.voucher_type_name || '').toLowerCase().includes('stock journal')
            ) || null;
            setProductConfig(sjConfig);
        }).catch((err) => {
            console.error('Failed to load stock journal master data', err);
        }).finally(() => setLoadingMaster(false));
    }, [show]);

    // ─── Reset form on open (for Create) or basic pre-fill (for Edit) ─────────
    useEffect(() => {
        if (!show) return;
        if (editItem) {
            setForm({
                journal_no: editItem.journal_no || '',
                journal_date: editItem.journal_date || todayStr(),
                stock_journal_type: editItem.stock_journal_type || '',
                narration: editItem.narration || '',
            });
            setNumberPreview(editItem.journal_no_display || '');
        } else {
            // Reset for create
            setForm({ journal_no: '', journal_date: todayStr(), stock_journal_type: '', narration: '' });
            setSelectedType(null);
            setNumberPreview('');
            setConsumptionRows([emptyRow()]);
            setProductionRows([emptyRow()]);
            setErrors({});
        }
    }, [show, editItem]);

    // ─── Pre-fill detailed rows and type when editing and master data is loaded 
    useEffect(() => {
        if (!show || !editItem || journalTypes.length === 0 || stockItems.length === 0) return;

        const fullType = journalTypes.find(t => t.id === editItem.stock_journal_type) || null;
        setSelectedType(fullType);

        const allDetails = editItem.details || [];
        const movement = fullType?.movement_type;

        const groupDetails = (detailsList) => {
            const grouped = {};
            detailsList.forEach(d => {
                const key = `${d.stock_item}_${d.rate}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        _key: d.id + '-' + Math.random(),
                        stock_item: d.stock_item || '',
                        stock_item_obj: stockItems.find(s => s.id === d.stock_item) || null,
                        quantity: 0,
                        rate: d.rate || '',
                        amount: 0,
                        entry_type: d.entry_type || 'IN',
                        splits: []
                    };
                }
                
                const qty = parseFloat(d.quantity) || 0;
                grouped[key].quantity += qty;
                grouped[key].amount += parseFloat(d.amount) || 0;
                
                grouped[key].splits.push({
                    _id: d.id + '-' + Math.random(),
                    warehouse: d.warehouse || null,
                    batch_number: d.batch_number || '',
                    expiry_date: d.expiry_date || null,
                    manufacture_date: d.manufacture_date || null,
                    quantity: String(qty),
                });
            });

            return Object.values(grouped).map(row => {
                row.quantity = String(row.quantity);
                row.amount = parseFloat(row.amount.toFixed(2));
                
                if (row.splits.length === 1) {
                    const first = row.splits[0];
                    row.warehouse = first.warehouse;
                    row.batch_number = first.batch_number;
                    row.expiry_date = first.expiry_date;
                    row.manufacture_date = first.manufacture_date;
                } else {
                    row.warehouse = null;
                    row.batch_number = '';
                    row.expiry_date = null;
                    row.manufacture_date = null;
                }
                return row;
            });
        };

        if (movement === 'IN & OUT') {
            const cons = groupDetails(allDetails.filter(d => d.entry_type === 'OUT'));
            const prod = groupDetails(allDetails.filter(d => d.entry_type === 'IN'));
            setConsumptionRows(cons.length > 0 ? cons : [emptyRow()]);
            setProductionRows(prod.length > 0 ? prod : [emptyRow()]);
        } else if (movement === 'IN') {
            const prod = groupDetails(allDetails);
            setProductionRows(prod.length > 0 ? prod : [emptyRow()]);
            setConsumptionRows([emptyRow()]);
        } else { // 'OUT'
            const cons = groupDetails(allDetails);
            setConsumptionRows(cons.length > 0 ? cons : [emptyRow()]);
            setProductionRows([emptyRow()]);
        }
    }, [show, editItem, journalTypes, stockItems]);

    // ─── Auto-select prefix config for new entries ────────────────────────────
    useEffect(() => {
        if (!show || isEdit) return;
        if (prefixConfigs.length > 0) {
            let sjPrefixConfig = null;
            if (selectedType) {
                sjPrefixConfig = prefixConfigs.find(
                    c => (c.prefix_type_name || '').toLowerCase().includes('stock journal') &&
                         c.sub_type === selectedType.stock_journal_type
                );
            }
            if (!sjPrefixConfig) {
                sjPrefixConfig = prefixConfigs.find(
                    c => (c.prefix_type_name || '').toLowerCase().includes('stock journal') &&
                         !c.sub_type
                ) || prefixConfigs.find(
                    c => (c.prefix_type_name || '').toLowerCase().includes('stock journal')
                ) || prefixConfigs[0];
            }
            if (sjPrefixConfig) {
                setForm(prev => ({ ...prev, journal_no: sjPrefixConfig.id }));
            }
        }
    }, [show, isEdit, prefixConfigs, selectedType]);

    // ─── Update number preview when prefix config changes ─────────────────────
    useEffect(() => {
        if (!form.journal_no) { setNumberPreview(''); return; }
        const config = prefixConfigs.find(c => String(c.id) === String(form.journal_no));
        if (config) {
            setNumberPreview(config.next_number_preview || '');
        }
    }, [form.journal_no, prefixConfigs]);

    // ─── Autofocus Journal Date on Modal Show ─────────────────────────────────
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                const dateInput = document.querySelector('input[name="journal_date"]');
                if (dateInput) dateInput.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [show]);

    // ─── Handlers ─────────────────────────────────────────────────────────────
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        if (name === 'stock_journal_type') {
            const t = journalTypes.find(jt => String(jt.id) === String(value));
            setSelectedType(t || null);
            setConsumptionRows([emptyRow()]);
            setProductionRows([emptyRow()]);
        }
    };

    const validate = () => {
        const errs = {};
        if (!form.journal_no) errs.journal_no = 'Journal number prefix is required.';
        if (!form.journal_date) errs.journal_date = 'Date is required.';
        if (!form.stock_journal_type) errs.stock_journal_type = 'Journal type is required.';

        const movement = selectedType?.movement_type;
        if (movement === 'IN') {
            const valid = productionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            if (valid.length === 0) errs.rows = 'At least one production item with quantity is required.';
        } else if (movement === 'OUT') {
            const valid = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            if (valid.length === 0) errs.rows = 'At least one consumption item with quantity is required.';
        } else if (movement === 'IN & OUT') {
            const validCons = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            const validProd = productionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            if (validCons.length === 0) errs.rows = 'At least one consumption item is required.';
            if (validProd.length === 0) errs.rows = (errs.rows ? errs.rows + ' ' : '') + 'At least one production item is required.';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const buildPayload = () => {
        const movement = selectedType?.movement_type;
        let finalDetails = [];

        const mapRow = (r, type) => {
            if (Array.isArray(r.splits) && r.splits.length > 0) {
                return r.splits.map(split => {
                    const qty = parseFloat(split.quantity) || 0;
                    const rate = parseFloat(r.rate) || 0;
                    return {
                        stock_item: parseInt(r.stock_item),
                        quantity: qty,
                        rate: rate,
                        amount: +(qty * rate).toFixed(2),
                        warehouse: split.warehouse ? parseInt(split.warehouse) : null,
                        batch_number: split.batch_number || '',
                        expiry_date: split.expiry_date || null,
                        manufacture_date: split.manufacture_date || null,
                        entry_type: type,
                    };
                });
            } else {
                return [{
                    stock_item: parseInt(r.stock_item),
                    quantity: parseFloat(r.quantity),
                    rate: parseFloat(r.rate) || 0,
                    amount: parseFloat(r.amount) || 0,
                    warehouse: r.warehouse ? parseInt(r.warehouse) : null,
                    batch_number: r.batch_number || '',
                    expiry_date: r.expiry_date || null,
                    manufacture_date: r.manufacture_date || null,
                    entry_type: type,
                }];
            }
        };

        if (movement === 'IN') {
            const valid = productionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            finalDetails = valid.flatMap(r => mapRow(r, 'IN'));
        } else if (movement === 'OUT') {
            const valid = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            finalDetails = valid.flatMap(r => mapRow(r, 'OUT'));
        } else if (movement === 'IN & OUT') {
            const validCons = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            const validProd = productionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
            finalDetails = [
                ...validCons.flatMap(r => mapRow(r, 'OUT')),
                ...validProd.flatMap(r => mapRow(r, 'IN')),
            ];
        }

        return {
            journal_no: isEdit ? form.journal_no : parseInt(form.journal_no),
            journal_date: form.journal_date,
            stock_journal_type: parseInt(form.stock_journal_type),
            narration: form.narration || '',
            details: finalDetails,
        };
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        const active = document.activeElement;

        // From narration, if i press enter, it should save the form
        if (active && active.name === 'narration') {
            e.preventDefault();
            handleSubmit(e);
            return;
        }

        // If react-select dropdown is open, let react-select handle option selection natively
        const menuOpen = !!document.querySelector('.react-select__menu');
        if (menuOpen) return;


        // Empty Stock Item select Enter -> delete row and focus narration
        const trEl = active ? active.closest('tr') : null;
        if (active && trEl && active.closest('.item-select')) {
            const rowIdx = parseInt(trEl.getAttribute('data-row-idx'));
            const isCons = !!active.closest('.consumption-sec');
            const rows = isCons ? consumptionRows : productionRows;
            const row = rows[rowIdx];
            if (!row || !row.stock_item) {
                e.preventDefault();
                if (active && typeof active.blur === 'function') {
                    active.blur();
                }
                if (isCons) {
                    setConsumptionRows(prev => prev.filter((_, i) => i !== rowIdx));
                } else {
                    setProductionRows(prev => prev.filter((_, i) => i !== rowIdx));
                }
                setTimeout(() => {
                    const narrationInput = document.querySelector('textarea[name="narration"]') || document.getElementById('narration');
                    if (narrationInput) narrationInput.focus();
                }, 200);
                return;
            }
            // Row has data — just stop propagation so no extra navigation happens
            e.preventDefault();
            return;
        }

        if (document.activeElement.tagName === 'TEXTAREA') return;

        // Date field -> focus and open Type react-select dropdown
        if (active && active.name === 'journal_date') {
            e.preventDefault();
            if (typeSelectRef.current) {
                typeSelectRef.current.focus();
                typeSelectRef.current.openMenu();
            }
            return;
        }

        const formEl = e.currentTarget;
        const focusable = Array.from(
            formEl.querySelectorAll(
                'input[name="journal_date"], .react-select__control, tbody input.qty-input, tbody input.rate-input, textarea[name="narration"], .btn-save-custom'
            )
        ).filter(el => el.offsetParent !== null && !el.disabled && el.getAttribute('readonly') === null);

        const currentEl = active.closest('.react-select__control') || active;
        const index = focusable.indexOf(currentEl);
        if (index > -1 && index < focusable.length - 1) {
            e.preventDefault();
            const next = focusable[index + 1];
            if (next.classList.contains('react-select__control')) {
                next.querySelector('input')?.focus();
            } else {
                next.focus();
            }
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = buildPayload();
            if (isEdit) {
                await updateStockJournal(editItem.id, payload);
            } else {
                await createStockJournal(payload);
            }
            Swal.fire({
                icon: 'success',
                title: isEdit ? 'Updated' : 'Saved',
                text: `Stock journal ${isEdit ? 'updated' : 'created'} successfully.`,
                timer: 2000,
                showConfirmButton: false,
            });
            onSaved();
            onHide();
        } catch (err) {
            const msg =
                err?.response?.data?.detail ||
                JSON.stringify(err?.response?.data) ||
                'An error occurred';
            Swal.fire({ icon: 'error', title: 'Error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    // ─── Derived values ───────────────────────────────────────────────────────
    const movementType = selectedType?.movement_type;
    const totalConsumption = movementType === 'IN' ? 0 : consumptionRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalProduction = movementType === 'OUT' ? 0 : productionRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalAmount = totalConsumption + totalProduction;
    const totalItemsCount =
        (movementType === 'IN' ? 0 : consumptionRows.filter(r => r.stock_item).length) +
        (movementType === 'OUT' ? 0 : productionRows.filter(r => r.stock_item).length);

    const errorText = (field) => errors[field]
        ? <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '3px' }}><i className="fas fa-exclamation-circle me-1" />{errors[field]}</div>
        : null;

    return (
        <>
            <style>{`
                @media (min-width: 1200px) {
                    .item-custom-modal.modal-wide {
                        max-width: 90% !important;
                    }
                }
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                    background: #fff;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #0a500f;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    line-height: 1;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 75vh;
                    overflow-y: auto;
                    background-color: #f8fafc;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #dc3545 !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #bb2d3b !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #0a500f !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-save-custom:hover {
                    background-color: #073d0b !important;
                }
                .journal-header-box {
                    background: #fff;
                    border-radius: 12px;
                    padding: 20px 24px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 20px;
                }
                .items-table-box {
                    background: #fff;
                    border-radius: 12px;
                    padding: 20px 24px;
                    border: 1px solid #e2e8f0;
                }
                .journal-section-head {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 16px;
                    flex: 1;
                }
                .journal-section-icon {
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    flex-shrink: 0;
                }
                .journal-section-icon svg {
                    width: 15px;
                    height: 15px;
                }
                .journal-icon-consumption {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                }
                .journal-icon-production {
                    background: linear-gradient(135deg, #10b981, #059669);
                }
                .journal-section-head > span {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1e293b;
                    white-space: nowrap;
                }
                .journal-section-line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(to right, #e2e8f0, transparent);
                }
            `}</style>

            <Modal
                show={show}
                onHide={onHide}
                dialogClassName={`item-custom-modal ${movementType === 'IN & OUT' ? 'modal-wide' : ''}`}
                size="xl"
                centered
                backdrop="static"
                scrollable
            >
                {/* Header */}
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                                {isEdit ? 'Edit Stock Journal' : 'Create Stock Journal'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter stock journal header details and items
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={onHide}>
                        &times;
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body-custom">
                    {loadingMaster ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <div className="mt-2 text-muted">Loading form data…</div>
                        </div>
                    ) : (
                        <Form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                            {/* Header Section */}
                            <div className="journal-header-box">
                                <h5 className="font-w600 mb-3" style={{ fontSize: '14px', color: '#334155' }}>
                                    Journal Header
                                </h5>
                                <Row className="g-3">
                                    {/* Journal Number (Disabled) */}
                                    <Col md={4}>
                                        <Form.Label className="form-label-custom">Journal Number <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={numberPreview || (loadingMaster ? 'Loading...' : '—')}
                                            disabled
                                            className="form-control-custom"
                                            style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                                        />
                                        {errorText('journal_no')}
                                    </Col>

                                    {/* Date */}
                                    <Col md={4}>
                                        <Form.Label className="form-label-custom">Journal Date <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="date"
                                            name="journal_date"
                                            value={form.journal_date}
                                            onChange={handleFormChange}
                                            className="form-control-custom"
                                            required
                                        />
                                        {errorText('journal_date')}
                                    </Col>

                                    {/* Journal Type */}
                                    <Col md={4}>
                                        <Form.Label className="form-label-custom">Stock Journal Type <span className="text-danger">*</span></Form.Label>
                                        <Select
                                            ref={typeSelectRef}
                                            components={{ Option: CustomOption }}
                                            options={journalTypeOptions}
                                            value={journalTypeOptions.find(o => String(o.value) === String(form.stock_journal_type)) || null}
                                            onChange={(opt) => {
                                                const val = opt ? opt.value : '';
                                                if (String(val) === String(form.stock_journal_type)) return;
                                                setForm(prev => ({ ...prev, stock_journal_type: val }));
                                                const t = opt ? opt.original : null;
                                                setSelectedType(t);
                                                setConsumptionRows([emptyRow()]);
                                                setProductionRows([emptyRow()]);
                                                
                                                // After selection, auto-focus the first item dropdown inside the newly appeared component
                                                setTimeout(() => {
                                                    const firstItemInput = document.querySelector('.item-select input');
                                                    if (firstItemInput) {
                                                        firstItemInput.focus();
                                                    }
                                                }, 200);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const menuOpen = !!document.querySelector('.react-select__menu');
                                                    if (menuOpen) {
                                                        e.stopPropagation();
                                                    }
                                                }
                                            }}
                                            placeholder="— Select Type —"
                                            isClearable
                                            openMenuOnFocus={true}
                                            classNamePrefix="react-select"
                                            menuPortalTarget={document.body}
                                            styles={{
                                                control: (base, state) => ({
                                                    ...base,
                                                    minHeight: '38px',
                                                    fontSize: '13px',
                                                    borderRadius: '10px',
                                                    borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
                                                    boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15,0.15)' : 'none',
                                                    '&:hover': { borderColor: '#0a500f' },
                                                }),
                                                menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
                                                menuPortal: base => ({ ...base, zIndex: 99999 }),
                                                singleValue: (base, state) => ({
                                                    ...base,
                                                    opacity: state.selectProps.inputValue ? 0 : 1,
                                                }),
                                                option: (base, state) => ({
                                                    ...base,
                                                    backgroundColor: state.isSelected
                                                        ? '#0a500f'
                                                        : (state.isFocused && isKeyboard)
                                                            ? '#f0fdf4'
                                                            : 'white',
                                                    color: state.isSelected ? 'white' : '#334155',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        backgroundColor: state.isSelected ? '#0a500f' : '#f0fdf4',
                                                        color: state.isSelected ? 'white' : '#334155',
                                                    }
                                                }),
                                            }}
                                        />
                                        {selectedType && (
                                            <div style={{ fontSize: '11px', color: '#0a500f', marginTop: '4px', fontWeight: 600 }}>
                                                {selectedType.movement_type === 'IN' ? '↑ Production' : selectedType.movement_type === 'OUT' ? '↓ Consumption' : '⇅ Production/Consumption'}
                                            </div>
                                        )}
                                        {errorText('stock_journal_type')}
                                    </Col>
                                </Row>
                            </div>

                            {/* Items Section */}
                            {!selectedType ? (
                                <div
                                    style={{
                                        background: '#fff',
                                        borderRadius: '12px',
                                        padding: '40px',
                                        textAlign: 'center',
                                        color: '#94a3b8',
                                        border: '1.5px dashed #cbd5e1',
                                    }}
                                >
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mb-2" style={{ color: '#cbd5e1' }}>
                                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
                                    </svg>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Select Stock Journal Type to Add Items</div>
                                </div>
                            ) : (
                                <div>
                                    {errors.rows && (
                                        <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '13px', borderRadius: '8px' }}>
                                            {errors.rows}
                                        </div>
                                    )}

                                    {movementType === 'IN' && (
                                        <div className="items-table-box">
                                            <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '16px' }}>
                                                <div className="journal-section-head" style={{ marginBottom: 0 }}>
                                                    <div className="journal-section-icon journal-icon-production">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                                            <polyline points="17 6 23 6 23 12"></polyline>
                                                        </svg>
                                                    </div>
                                                    <span>Production Details</span>
                                                    <div className="journal-section-line"></div>
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                    Total Amount: <span style={{ color: '#0a500f' }}>{totalAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="production-sec">
                                                <ProductionComponent
                                                    rows={productionRows}
                                                    onRowsChange={setProductionRows}
                                                    stockItems={stockItems}
                                                    productConfig={productConfig}
                                                    isEdit={isEdit}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {movementType === 'OUT' && (
                                        <div className="items-table-box">
                                            <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '16px' }}>
                                                <div className="journal-section-head" style={{ marginBottom: 0 }}>
                                                    <div className="journal-section-icon journal-icon-consumption">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                                                            <polyline points="17 18 23 18 23 12"></polyline>
                                                        </svg>
                                                    </div>
                                                    <span>Consumption Details</span>
                                                    <div className="journal-section-line"></div>
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                    Total Amount: <span style={{ color: '#0a500f' }}>{totalAmount.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="consumption-sec">
                                                <ConsumptionComponent
                                                    rows={consumptionRows}
                                                    onRowsChange={setConsumptionRows}
                                                    stockItems={stockItems}
                                                    productConfig={productConfig}
                                                    isEdit={isEdit}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {movementType === 'IN & OUT' && (
                                        <Row className="g-4">
                                            <Col lg={6}>
                                                <div className="items-table-box h-100">
                                                    <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '16px' }}>
                                                        <div className="journal-section-head" style={{ marginBottom: 0 }}>
                                                            <div className="journal-section-icon journal-icon-consumption">
                                                                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                                                                    <polyline points="17 18 23 18 23 12"></polyline>
                                                                </svg>
                                                            </div>
                                                            <span>Consumption Details</span>
                                                            <div className="journal-section-line"></div>
                                                        </div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                            Subtotal: <span style={{ color: '#0a500f' }}>{totalConsumption.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="consumption-sec">
                                                        <ConsumptionComponent
                                                            rows={consumptionRows}
                                                            onRowsChange={setConsumptionRows}
                                                            stockItems={stockItems}
                                                            productConfig={productConfig}
                                                            isEdit={isEdit}
                                                        />
                                                    </div>
                                                </div>
                                            </Col>
                                            <Col lg={6}>
                                                <div className="items-table-box h-100">
                                                    <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '16px' }}>
                                                        <div className="journal-section-head" style={{ marginBottom: 0 }}>
                                                            <div className="journal-section-icon journal-icon-production">
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                                                    <polyline points="17 6 23 6 23 12"></polyline>
                                                                </svg>
                                                            </div>
                                                            <span>Production Details</span>
                                                            <div className="journal-section-line"></div>
                                                        </div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                            Subtotal: <span style={{ color: '#0a500f' }}>{totalProduction.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="production-sec">
                                                        <ProductionComponent
                                                            rows={productionRows}
                                                            onRowsChange={setProductionRows}
                                                            stockItems={stockItems}
                                                            productConfig={productConfig}
                                                            autoFocus={false}
                                                            isEdit={isEdit}
                                                        />
                                                    </div>
                                                </div>
                                            </Col>
                                        </Row>
                                    )}
                                </div>
                            )}

                            {/* Narration (placed after components/tables, as the last field) */}
                            <div className="mt-4" style={{ background: '#fff', borderRadius: '12px', padding: '20px 24px', border: '1px solid #e2e8f0' }}>
                                <Form.Label className="form-label-custom">Narration</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    name="narration"
                                    value={form.narration}
                                    onChange={handleFormChange}
                                    placeholder="Enter narration"
                                    className="form-control-custom"
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                        </Form>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer-custom">
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                        {totalItemsCount} Item(s) | Total Amount: <span style={{ color: '#0a500f', fontWeight: 600 }}>{totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="d-flex gap-2">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={onHide}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="btn-save-custom"
                            onClick={handleSubmit}
                            disabled={saving || loadingMaster}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default StockJournalFormModal;
