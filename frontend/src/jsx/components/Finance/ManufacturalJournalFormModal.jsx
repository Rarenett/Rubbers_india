import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Button, Form, Row, Col, Spinner } from 'react-bootstrap';
import Select, { components } from 'react-select';
import Swal from 'sweetalert2';
import {
    getManufacturalJournalTypes,
    getManufacturalJournalPrefixConfigs,
    getNextManufacturalJournalNumber,
    createManufacturalJournal,
    updateManufacturalJournal,
} from '../../../services/FinanceService';
import { getStockItems, getRecipes, getWarehouses } from '../../../services/InventoryService';
import ConsumptionComponent from './ConsumptionComponent';
import ProductionComponent from './ProductionComponent';
import { emptyRow } from './emptyRow';
import InventoryService from '../../../services/InventoryService';
import RnDService from '../../../services/RnDService';

const CustomOption = (props) => {
    const { onMouseMove, onMouseOver, ...otherInnerProps } = props.innerProps;
    return (
        <components.Option {...props} innerProps={otherInnerProps} />
    );
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const calculateExpiryDate = (baseDateStr, days) => {
    if (days === null || days === undefined || days === '' || isNaN(days) || !baseDateStr) return null;
    try {
        const d = new Date(baseDateStr);
        if (isNaN(d.getTime())) return null;
        d.setDate(d.getDate() + parseInt(days, 10));
        return d.toISOString().split('T')[0];
    } catch {
        return null;
    }
};

/**
 * ManufacturalJournalFormModal
 */
const ManufacturalJournalFormModal = ({ show, onHide, onSaved, editItem }) => {
    const isEdit = !!editItem;
    const typeSelectRef = useRef(null);
    const productSelectRef = useRef(null);
    const bomSelectRef = useRef(null);
    const warehouseSelectRef = useRef(null);
    const rndSelectRef = useRef(null);
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
    const [recipes, setRecipes] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [rndEntries, setRndEntries] = useState([]);
    const [selectedRndId, setSelectedRndId] = useState(null);
    const [selectedRndExpiryAfter, setSelectedRndExpiryAfter] = useState(null);
    const [productConfig, setProductConfig] = useState(null);
    const [loadingMaster, setLoadingMaster] = useState(true);

    // ─── Form Header State ────────────────────────────────────────────────────
    const [form, setForm] = useState({
        journal_no: '',           // PrefixConfiguration id
        journal_date: todayStr(),
        manufactural_journal_type: '',   // ManufacturalJournalType id
        narration: '',
    });
    const [selectedType, setSelectedType] = useState(null);  // full type object
    const [numberPreview, setNumberPreview] = useState('');   // e.g. MJ-0001
    const [consumptionRows, setConsumptionRows] = useState([emptyRow()]);
    const [productionRows, setProductionRows] = useState([emptyRow()]);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    // ─── Finished Product State ────────────────────────────────────────────────
    const [finishedProduct, setFinishedProduct] = useState(null);
    const [finishedBom, setFinishedBom] = useState('');
    const [finishedWarehouse, setFinishedWarehouse] = useState(null);
    const [finishedQty, setFinishedQty] = useState('');
    const [finishedBatch, setFinishedBatch] = useState('');
    const [finishedMfgDate, setFinishedMfgDate] = useState('');
    const [finishedExpDate, setFinishedExpDate] = useState('');
    const [finishedRate, setFinishedRate] = useState(0);
    const [finishedAmount, setFinishedAmount] = useState(0);

    // Derived values / configurations
    const selectedProductObj = useMemo(() => {
        return stockItems.find(s => s.id === finishedProduct);
    }, [stockItems, finishedProduct]);

    const showWarehouse = productConfig?.maintain_warehouse === true;
    const showBatch = productConfig?.maintain_batch === true;
    const showMfgDate = productConfig?.maintain_manufacture_date === true;
    const showExpDate = productConfig?.maintain_expiry_date === true;
    const unitLabel = selectedProductObj ? (selectedProductObj.base_unit_name || '') : '';

    const journalTypeOptions = useMemo(() =>
        journalTypes
            // Only show the combined Consumption/Production type (not pure IN or pure OUT)
            .filter(t => t.movement_type !== 'IN' && t.movement_type !== 'OUT')
            .map(t => ({
                value: t.id,
                label: t.manufactural_journal_type,   // name already describes the type
                original: t
            }))
    , [journalTypes]);

    // React-select custom styles
    const reactSelectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            fontSize: '13px',
            borderRadius: '10px',
            borderColor: state.isFocused ? '#2ece8a' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46,206,138,0.15)' : 'none',
            '&:hover': { borderColor: '#2ece8a' },
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        menuPortal: base => ({ ...base, zIndex: 99999 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected ? '#f1f5f9' : state.isFocused ? '#f8fafc' : 'white',
            color: state.isSelected ? '#2ece8a' : '#334155',
            fontWeight: state.isSelected ? '600' : 'normal',
            cursor: 'pointer',
        }),
    };

    // ─── Load master data on open ─────────────────────────────────────────────
    useEffect(() => {
        if (!show) return;
        Promise.allSettled([
            getManufacturalJournalTypes(),
            getManufacturalJournalPrefixConfigs(''),
            getStockItems(),
            InventoryService.getProductConfigurations(),
            getRecipes(),
            getWarehouses(),
            RnDService.getRnDEntries('?no_pagination=true'),
        ]).then(([typesRes, configsRes, itemsRes, pcRespRes, recipesRespRes, warehousesRespRes, rndRespRes]) => {
            const types = typesRes.status === 'fulfilled' ? typesRes.value : [];
            const configs = configsRes.status === 'fulfilled' ? configsRes.value : [];
            const items = itemsRes.status === 'fulfilled' ? itemsRes.value : [];
            const pcResp = pcRespRes.status === 'fulfilled' ? pcRespRes.value : null;
            const recipesResp = recipesRespRes.status === 'fulfilled' ? recipesRespRes.value : [];
            const warehousesResp = warehousesRespRes.status === 'fulfilled' ? warehousesRespRes.value : [];
            const rndResp = rndRespRes.status === 'fulfilled' ? rndRespRes.value : [];

            const rndList = Array.isArray(rndResp.data) ? rndResp.data : (rndResp.data?.results || (Array.isArray(rndResp) ? rndResp : []));

            setJournalTypes(Array.isArray(types) ? types : types?.results || []);
            setPrefixConfigs(Array.isArray(configs) ? configs : (configs?.data || configs?.results || []));
            setStockItems(Array.isArray(items) ? items : items?.results || []);
            setRecipes(Array.isArray(recipesResp) ? recipesResp : recipesResp?.results || []);
            setWarehouses(Array.isArray(warehousesResp) ? warehousesResp : warehousesResp?.results || []);
            setRndEntries(rndList);

            // Find product config for Manufactural Journal
            const allConfigs = pcResp?.data || [];
            const sjConfig = allConfigs.find(
                pc =>
                    pc.voucher_type_code === 'MJ' ||
                    (pc.voucher_type_name || '').toLowerCase().includes('manufactural journal') ||
                    (pc.voucher_type_name || '').toLowerCase().includes('manufacturing journal')
            ) || null;
            setProductConfig(sjConfig);
        }).catch((err) => {
            console.error('Failed to load manufactural journal master data', err);
        }).finally(() => setLoadingMaster(false));
    }, [show]);

    // ─── Reset form on open (for Create) or basic pre-fill (for Edit) ─────────
    useEffect(() => {
        if (!show) return;
        if (editItem) {
            setForm({
                journal_no: editItem.journal_no || '',
                journal_date: editItem.journal_date || todayStr(),
                manufactural_journal_type: editItem.manufactural_journal_type || '',
                narration: editItem.narration || '',
            });
            if (editItem.batch_number) {
                setFinishedBatch(editItem.batch_number);
            }
            if (editItem.rnd_entry) {
                setSelectedRndId(editItem.rnd_entry);
            } else {
                setSelectedRndId(null);
            }
            setNumberPreview(editItem.journal_no_display || '');
        } else {
            // Reset for create
            const defaultType = journalTypes.find(t =>
                t.manufactural_journal_type === 'Production/Consumption' ||
                (t.movement_type !== 'IN' && t.movement_type !== 'OUT')
            ) || (journalTypes.length > 0 ? journalTypes[0] : null);
            setForm({
                journal_no: '',
                journal_date: todayStr(),
                manufactural_journal_type: defaultType ? defaultType.id : '',
                narration: '',
            });
            setSelectedType(defaultType);
            setSelectedRndId(null);
            setSelectedRndExpiryAfter(null);
            setNumberPreview('');
            setConsumptionRows([emptyRow()]);
            setProductionRows([emptyRow()]);
            setErrors({});

            setFinishedProduct(null);
            setFinishedBom('');
            setFinishedWarehouse(null);
            setFinishedQty('');
            setFinishedBatch('');
            setFinishedMfgDate('');
            setFinishedExpDate('');
            setFinishedRate(0);
            setFinishedAmount(0);
        }
    }, [show, editItem, journalTypes]);

    // ─── Pre-fill detailed rows and type when editing and master data is loaded 
    useEffect(() => {
        if (!show || !editItem || journalTypes.length === 0 || stockItems.length === 0) return;

        const fullType = journalTypes.find(t => t.id === editItem.manufactural_journal_type) || null;
        setSelectedType(fullType);

        const allDetails = editItem.details || [];

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

        const cons = groupDetails(allDetails.filter(d => d.entry_type === 'OUT'));
        setConsumptionRows(cons.length > 0 ? cons : [emptyRow()]);

        const prodDetails = allDetails.filter(d => d.entry_type === 'IN');
        const prod = groupDetails(prodDetails);
        setProductionRows(prod.length > 0 ? prod : [emptyRow()]);

        const mainProd = prodDetails.length > 0 ? prodDetails[0] : null;
        if (mainProd) {
            setFinishedProduct(mainProd.stock_item);
            setFinishedQty(String(mainProd.quantity));
            setFinishedWarehouse(mainProd.warehouse);
            setFinishedBatch(mainProd.batch_number || editItem.batch_number || '');
            setFinishedMfgDate(mainProd.manufacture_date || '');
            setFinishedExpDate(mainProd.expiry_date || '');
            setFinishedRate(parseFloat(mainProd.rate) || 0);
            setFinishedAmount(parseFloat(mainProd.amount) || 0);

            const itemRecipes = recipes.filter(r => r.stock_item === mainProd.stock_item);
            if (itemRecipes.length > 0) {
                setFinishedBom(String(itemRecipes[0].id));
            } else {
                setFinishedBom('not_applicable');
            }
        }

        if (editItem.rnd_entry) {
            setSelectedRndId(editItem.rnd_entry);
            const matchedRnd = rndEntries.find(r => String(r.id) === String(editItem.rnd_entry));
            if (matchedRnd && matchedRnd.expiry_after) {
                setSelectedRndExpiryAfter(matchedRnd.expiry_after);
            }
        }
    }, [show, editItem, journalTypes, stockItems, recipes, rndEntries]);

    // ─── Auto-select prefix config for new entries ────────────────────────────
    useEffect(() => {
        if (!show || isEdit) return;

        let isMounted = true;
        const updatePrefixAndNextNo = async () => {
            let sjPrefixConfig = null;
            if (prefixConfigs.length > 0) {
                if (selectedType) {
                    const targetSub = (selectedType.manufactural_journal_type || '').toLowerCase().replace(/[\s\/]/g, '');
                    sjPrefixConfig = prefixConfigs.find(c => {
                        const sType = (c.sub_type || c.subvoucher_type_name || '').toLowerCase().replace(/[\s\/]/g, '');
                        const vName = (c.voucher_type_name || c.prefix_type_name || '').toLowerCase();
                        const isMfg = vName.includes('manufactur') || vName.includes('journal');
                        return isMfg && (sType === targetSub || (sType && targetSub.includes(sType)) || (targetSub && sType.includes(targetSub)));
                    });
                }
                if (!sjPrefixConfig) {
                    sjPrefixConfig = prefixConfigs.find(c => {
                        const pName = (c.prefix_type_name || c.voucher_type_name || '').toLowerCase();
                        return pName.includes('manufactur') || pName.includes('journal');
                    }) || prefixConfigs[0];
                }
            }

            const configId = sjPrefixConfig ? String(sjPrefixConfig.id) : (prefixConfigs[0] ? String(prefixConfigs[0].id) : '');
            if (isMounted) {
                if (configId) {
                    setForm(prev => ({ ...prev, journal_no: configId }));
                }
                if (sjPrefixConfig && sjPrefixConfig.next_number_preview) {
                    setNumberPreview(sjPrefixConfig.next_number_preview);
                }
            }

            try {
                const res = await getNextManufacturalJournalNumber(configId);
                if (isMounted && res && res.next_number) {
                    setNumberPreview(res.next_number);
                }
            } catch (err) {
                console.error('Error fetching next manufactural journal number:', err);
            }
        };

        updatePrefixAndNextNo();

        return () => {
            isMounted = false;
        };
    }, [show, isEdit, prefixConfigs, selectedType]);

    // ─── Update number preview when prefix config changes ─────────────────────
    useEffect(() => {
        if (!form.journal_no) return;
        const config = prefixConfigs.find(c => String(c.id) === String(form.journal_no));
        if (config && config.next_number_preview) {
            setNumberPreview(config.next_number_preview);
        }
    }, [form.journal_no, prefixConfigs]);

    // ─── Autofocus first element on Modal Show ───────────────────────────────
    useEffect(() => {
        if (!show) return;
        
        const timer = setTimeout(() => {
            if (productSelectRef.current) {
                productSelectRef.current.focus();
                productSelectRef.current.openMenu();
            } else {
                const dateInput = document.querySelector('input[name="journal_date"]');
                if (dateInput) dateInput.focus();
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [show, selectedType, loadingMaster]);

    const rndEntryOptions = useMemo(() => {
        const options = (rndEntries || [])
            .filter(entry => {
                // When editing an existing journal, keep the R&D entry that is linked to this journal
                if (isEdit && editItem && (String(editItem.rnd_entry) === String(entry.id) || String(selectedRndId) === String(entry.id))) {
                    return true;
                }
                // Exclude any R&D entry that already has a manufacture journal saved
                return !entry.has_manufacture_journal;
            })
            .map(entry => {
                const qty = (parseFloat(entry.balance_quantity) > 0 ? entry.balance_quantity : null)
                    ?? (parseFloat(entry.balance_primary) > 0 ? entry.balance_primary : null)
                    ?? entry.balance_quantity
                    ?? entry.balance_primary
                    ?? 0;
                const itemName = entry.stock_item_name || 'Item';
                const lineName = entry.production_line_name ? ` (${entry.production_line_name})` : '';
                const dateStr = entry.production_date ? ` [${entry.production_date}]` : '';
                return {
                    value: entry.id,
                    label: `${itemName} — ${qty} ${entry.unit_name || ''}`,
                    original: entry,
                };
            });
        if (selectedRndId && !options.some(o => String(o.value) === String(selectedRndId))) {
            const matched = (rndEntries || []).find(e => String(e.id) === String(selectedRndId));
            if (matched) {
                const qty = (parseFloat(matched.balance_quantity) > 0 ? matched.balance_quantity : null)
                    ?? (parseFloat(matched.balance_primary) > 0 ? matched.balance_primary : null)
                    ?? matched.balance_quantity
                    ?? matched.balance_primary
                    ?? 0;
                const itemName = matched.stock_item_name || 'Item';
                options.unshift({
                    value: matched.id,
                    label: `${itemName} — ${qty} ${matched.unit_name || ''}`,
                    original: matched,
                });
            } else {
                options.unshift({
                    value: selectedRndId,
                    label: `R&D Entry #${selectedRndId}`,
                    original: null,
                });
            }
        }
        return options;
    }, [rndEntries, selectedRndId, isEdit, editItem]);

    const handleRndEntrySelect = (opt) => {
        const entry = opt ? opt.original : null;
        setSelectedRndId(entry ? entry.id : null);
        if (!entry) return;

        const stockItemId = entry.stock_item;
        const balanceQty = String(
            (parseFloat(entry.balance_quantity) > 0 ? entry.balance_quantity : null)
            ?? (parseFloat(entry.balance_primary) > 0 ? entry.balance_primary : null)
            ?? entry.balance_quantity
            ?? entry.balance_primary
            ?? ''
        );

        if (stockItemId) {
            setFinishedProduct(stockItemId);
        }
        if (balanceQty) {
            setFinishedQty(balanceQty);
        }

        const defaultWh = finishedWarehouse || (warehouses.length > 0 ? warehouses[0].id : null);
        if (!finishedWarehouse && defaultWh) {
            setFinishedWarehouse(defaultWh);
        }

        // Match recipe / BOM for this stock item
        const itemRecipes = recipes.filter(r => r.stock_item === stockItemId);
        if (itemRecipes.length > 0) {
            const matchedRecipe = itemRecipes[0];
            setFinishedBom(String(matchedRecipe.id));

            const yieldQty = parseFloat(matchedRecipe.unit_of_manufacture) || 1;
            const targetQty = parseFloat(balanceQty) || 0;
            const factor = targetQty / yieldQty;

            let totalConsCost = 0;
            const newCons = (matchedRecipe.recipe_details || []).map(detail => {
                const rawItem = stockItems.find(s => s.id === detail.stock_item);
                const calculatedQty = (parseFloat(detail.quantity) || 0) * factor;
                const rate = rawItem
                    ? (parseFloat(rawItem.sb_rate) || parseFloat(rawItem.opening_rate) || parseFloat(rawItem.ss_rate) || parseFloat(rawItem.mrp) || 0)
                    : 0;
                const amount = parseFloat((calculatedQty * rate).toFixed(2));
                totalConsCost += amount;
                return {
                    _key: detail.id + '-' + Math.random(),
                    stock_item: detail.stock_item,
                    stock_item_obj: rawItem || null,
                    quantity: String(calculatedQty),
                    rate: String(rate),
                    amount: amount,
                    warehouse: defaultWh,
                    batch_number: '',
                    expiry_date: null,
                    manufacture_date: null,
                    entry_type: 'OUT',
                    splits: []
                };
            });

            setConsumptionRows(newCons.length > 0 ? newCons : [emptyRow()]);

            if (targetQty > 0) {
                const itemRate = totalConsCost > 0 ? (totalConsCost / targetQty) : 0;
                setFinishedAmount(totalConsCost);
                setFinishedRate(itemRate);
            }
        } else {
            setFinishedBom('not_applicable');
            setConsumptionRows([emptyRow()]);
            const finishedItem = stockItems.find(s => s.id === stockItemId);
            const fallbackRate = finishedItem
                ? (parseFloat(finishedItem.sb_rate) || parseFloat(finishedItem.opening_rate) || parseFloat(finishedItem.ss_rate) || parseFloat(finishedItem.mrp) || 0)
                : 0;
            const targetQty = parseFloat(balanceQty) || 0;
            setFinishedRate(fallbackRate);
            setFinishedAmount(parseFloat((fallbackRate * targetQty).toFixed(2)));
        }

        const batchNum = entry.batch_number || '';
        if (batchNum) {
            setFinishedBatch(batchNum);
        }

        const expAfter = entry.expiry_after;
        setSelectedRndExpiryAfter(expAfter !== null && expAfter !== undefined ? expAfter : null);

        let calculatedExp = null;
        if (expAfter !== null && expAfter !== undefined && expAfter !== '') {
            calculatedExp = calculateExpiryDate(form.journal_date || todayStr(), expAfter);
            setFinishedExpDate(calculatedExp || '');
        }

        // Autofill production side with stock item, quantity from above, rate from stock item, and calculate amount
        if (stockItemId) {
            const finishedItem = stockItems.find(s => s.id === stockItemId);
            const rate = finishedItem
                ? (parseFloat(finishedItem.sb_rate) || parseFloat(finishedItem.opening_rate) || parseFloat(finishedItem.ss_rate) || parseFloat(finishedItem.mrp) || 0)
                : 0;
            const targetQty = parseFloat(balanceQty) || 0;
            const prodAmount = parseFloat((targetQty * rate).toFixed(2));

            setProductionRows([
                {
                    _key: 'prod-' + stockItemId + '-' + Date.now(),
                    stock_item: stockItemId,
                    stock_item_obj: finishedItem || null,
                    quantity: balanceQty || '',
                    rate: String(rate),
                    amount: prodAmount,
                    warehouse: defaultWh,
                    batch_number: batchNum,
                    expiry_date: calculatedExp || null,
                    manufacture_date: null,
                    entry_type: 'IN',
                    splits: []
                }
            ]);
        }
    };

    useEffect(() => {
        if (selectedRndExpiryAfter !== null && selectedRndExpiryAfter !== undefined && selectedRndExpiryAfter !== '' && form.journal_date) {
            const newExp = calculateExpiryDate(form.journal_date, selectedRndExpiryAfter);
            if (newExp) {
                setFinishedExpDate(newExp);
                setProductionRows(prev => prev.map(row => {
                    if (row.entry_type === 'IN') {
                        return { ...row, expiry_date: newExp };
                    }
                    return row;
                }));
            }
        }
    }, [form.journal_date, selectedRndExpiryAfter]);

    const handleFinishedBatchChange = (val) => {
        setFinishedBatch(val);
        setProductionRows(prev => prev.map(row => {
            if (row.stock_item === finishedProduct || !row.stock_item) {
                return { ...row, batch_number: val };
            }
            return row;
        }));
    };

    // ─── BOM Recipe Filters & Calculations ────────────────────────────────────
    const filteredRecipes = useMemo(() => {
        if (!finishedProduct) return [];
        return recipes.filter(r => r.stock_item === finishedProduct);
    }, [recipes, finishedProduct]);

    const bomOptions = useMemo(() => {
        return [
            { value: 'not_applicable', label: '⬥ Not Applicable' },
            ...filteredRecipes.map(r => ({ value: r.id, label: r.recipe_name, original: r }))
        ];
    }, [filteredRecipes]);

    const handleBOMChange = (selectedRecipe, finishedQuantity) => {
        if (!selectedRecipe || selectedRecipe === 'not_applicable') {
            setConsumptionRows([emptyRow()]);
            return;
        }
        const yieldQty = parseFloat(selectedRecipe.unit_of_manufacture) || 1;
        const targetQty = parseFloat(finishedQuantity) || 0;
        const factor = targetQty / yieldQty;

        const newCons = selectedRecipe.recipe_details.map(detail => {
            const rawItem = stockItems.find(s => s.id === detail.stock_item);
            const qty = (parseFloat(detail.quantity) || 0) * factor;
            const rate = rawItem ? (parseFloat(rawItem.sb_rate) || parseFloat(rawItem.opening_rate) || parseFloat(rawItem.ss_rate) || parseFloat(rawItem.mrp) || 0) : 0;
            const amount = parseFloat((qty * rate).toFixed(2));
            return {
                _key: detail.id + '-' + Math.random(),
                stock_item: detail.stock_item,
                stock_item_obj: rawItem || null,
                quantity: String(qty),
                rate: String(rate),
                amount: amount,
                warehouse: finishedWarehouse || null,
                batch_number: '',
                expiry_date: null,
                manufacture_date: null,
                entry_type: 'OUT',
                splits: []
            };
        });
        setConsumptionRows(newCons.length > 0 ? newCons : [emptyRow()]);
    };

    const scaleBOMQuantities = (qty) => {
        if (!finishedBom || finishedBom === 'not_applicable') return;
        const selectedRecipe = recipes.find(r => r.id === parseInt(finishedBom));
        if (!selectedRecipe) return;

        const yieldQty = parseFloat(selectedRecipe.unit_of_manufacture) || 1;
        const targetQty = parseFloat(qty) || 0;
        const factor = targetQty / yieldQty;

        setConsumptionRows(prev => prev.map(row => {
            const detail = selectedRecipe.recipe_details.find(d => d.stock_item === row.stock_item);
            if (detail) {
                const rawItem = stockItems.find(s => s.id === detail.stock_item);
                const calculatedQty = (parseFloat(detail.quantity) || 0) * factor;
                const rate = parseFloat(row.rate) || (rawItem ? (parseFloat(rawItem.sb_rate) || parseFloat(rawItem.opening_rate) || parseFloat(rawItem.ss_rate) || parseFloat(rawItem.mrp) || 0) : 0);
                const amount = parseFloat((calculatedQty * rate).toFixed(2));
                return {
                    ...row,
                    quantity: String(calculatedQty),
                    rate: String(rate),
                    amount: amount
                };
            }
            return row;
        }));
    };

    // Auto calculate finished product rate and amount
    const totalConsumption = useMemo(() => {
        return consumptionRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    }, [consumptionRows]);

    const totalProduction = useMemo(() => {
        return productionRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    }, [productionRows]);

    const displayProductionCost = useMemo(() => {
        const hasProdRows = productionRows.some(r => r.stock_item && parseFloat(r.quantity) > 0);
        if (hasProdRows) {
            return totalProduction;
        }
        return finishedAmount;
    }, [productionRows, totalProduction, finishedAmount]);

    useEffect(() => {
        const qty = parseFloat(finishedQty) || 0;
        const prodHasFinished = productionRows.some(r => parseInt(r.stock_item) === parseInt(finishedProduct));
        const scrapCost = prodHasFinished ? 0 : totalProduction;
        const netCost = Math.max(0, totalConsumption - scrapCost);
        if (qty > 0) {
            if (netCost > 0) {
                setFinishedAmount(netCost);
                setFinishedRate(netCost / qty);
            } else {
                const sItem = stockItems.find(s => s.id === finishedProduct);
                const sRate = sItem ? (parseFloat(sItem.sb_rate) || parseFloat(sItem.opening_rate) || parseFloat(sItem.ss_rate) || parseFloat(sItem.mrp) || 0) : 0;
                setFinishedRate(sRate);
                setFinishedAmount(parseFloat((sRate * qty).toFixed(2)));
            }
        } else {
            setFinishedAmount(0);
            setFinishedRate(0);
        }
    }, [totalConsumption, totalProduction, finishedQty, stockItems, finishedProduct, productionRows]);

    // ─── Handlers ─────────────────────────────────────────────────────────────
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));

        if (name === 'manufactural_journal_type') {
            const t = journalTypes.find(jt => String(jt.id) === String(value));
            setSelectedType(t || null);
            setConsumptionRows([emptyRow()]);
        }
    };

    const validate = () => {
        const errs = {};
        if (!form.journal_no && !numberPreview) errs.journal_no = 'Journal number prefix is required.';
        if (!form.journal_date) errs.journal_date = 'Date is required.';
        if (!form.manufactural_journal_type) errs.manufactural_journal_type = 'Journal type is required.';

        if (!finishedProduct) errs.finishedProduct = 'Finished product is required.';
        if (showWarehouse && !finishedWarehouse) errs.finishedWarehouse = 'Godown (Warehouse) is required.';
        if (!finishedQty || parseFloat(finishedQty) <= 0) errs.finishedQty = 'Valid quantity is required.';

        const validCons = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
        if (validCons.length === 0) errs.rows = 'At least one consumption item with quantity is required.';

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const buildPayload = () => {
        let finalDetails = [];

        // 1. Map consumption rows
        const validCons = consumptionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
        
        const baseExp = finishedExpDate || (productionRows[0]?.expiry_date) || null;
        const effectiveExp = baseExp || (selectedRndExpiryAfter ? calculateExpiryDate(form.journal_date, selectedRndExpiryAfter) : null);

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
                        expiry_date: split.expiry_date || (type === 'IN' ? effectiveExp : null),
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
                    expiry_date: r.expiry_date || (type === 'IN' ? effectiveExp : null),
                    manufacture_date: r.manufacture_date || null,
                    entry_type: type,
                }];
            }
        };

        finalDetails = validCons.flatMap(r => mapRow(r, 'OUT'));

        // 2. Add finished product as 'IN' detail row only if not already in productionRows
        const prodHasFinished = productionRows.some(r => parseInt(r.stock_item) === parseInt(finishedProduct) && parseFloat(r.quantity) > 0);
        if (!prodHasFinished && finishedProduct && parseFloat(finishedQty) > 0) {
            finalDetails.push({
                stock_item: parseInt(finishedProduct),
                quantity: parseFloat(finishedQty),
                rate: parseFloat(finishedRate) || 0,
                amount: parseFloat(finishedAmount) || 0,
                warehouse: finishedWarehouse ? parseInt(finishedWarehouse) : null,
                batch_number: finishedBatch || '',
                expiry_date: effectiveExp || null,
                manufacture_date: finishedMfgDate || null,
                entry_type: 'IN',
            });
        }

        // 3. Add production rows
        const validProd = productionRows.filter(r => r.stock_item && parseFloat(r.quantity) > 0);
        finalDetails = [
            ...finalDetails,
            ...validProd.flatMap(r => mapRow(r, 'IN'))
        ];

        let finalJournalNo = form.journal_no;
        if (!finalJournalNo && prefixConfigs.length > 0) {
            finalJournalNo = prefixConfigs[0].id;
        }

        return {
            journal_no: isEdit ? form.journal_no : (finalJournalNo && !isNaN(finalJournalNo) ? parseInt(finalJournalNo) : (finalJournalNo || numberPreview || '')),
            journal_date: form.journal_date,
            manufactural_journal_type: parseInt(form.manufactural_journal_type),
            narration: form.narration || '',
            batch_number: finishedBatch || (productionRows[0]?.batch_number) || '',
            expiry_after: selectedRndExpiryAfter !== null && selectedRndExpiryAfter !== undefined ? selectedRndExpiryAfter : null,
            expiry_date: effectiveExp || null,
            rnd_entry: selectedRndId ? parseInt(selectedRndId) : null,
            details: finalDetails,
        };
    };

    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;

        const active = document.activeElement;

        if (active && active.name === 'narration') {
            e.preventDefault();
            handleSubmit(e);
            return;
        }

        const menuOpen = !!document.querySelector('.react-select__menu');
        if (menuOpen) return;

        const trEl = active ? active.closest('tr') : null;
        if (active && trEl && active.closest('.item-select')) {
            const rowIdx = parseInt(trEl.getAttribute('data-row-idx'));
            const isCons = !!active.closest('.consumption-sec');
            if (isCons) {
                const row = consumptionRows[rowIdx];
                if (!row || !row.stock_item) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') {
                        active.blur();
                    }
                    setConsumptionRows(prev => prev.filter((_, i) => i !== rowIdx));
                    setTimeout(() => {
                        const narrationInput = document.querySelector('textarea[name="narration"]') || document.getElementById('narration');
                        if (narrationInput) narrationInput.focus();
                    }, 200);
                    return;
                }
            }
            e.preventDefault();
            return;
        }

        if (document.activeElement.tagName === 'TEXTAREA') return;

        if (active && active.name === 'journal_date') {
            e.preventDefault();
            if (productSelectRef.current) {
                productSelectRef.current.focus();
                productSelectRef.current.openMenu();
            }
            return;
        }

        const formEl = e.currentTarget;
        const focusable = Array.from(
            formEl.querySelectorAll(
                'input[name="journal_date"], .react-select__control, input[name="finished_qty"], input[name="finished_batch"], input[name="finished_mfg_date"], input[name="finished_expiry_date"], tbody input.qty-input, tbody input.rate-input, textarea[name="narration"], .btn-save-custom'
            )
        ).filter(el => {
            if (el.offsetParent === null) return false;
            if (el.disabled) return false;
            if (el.getAttribute('readonly') !== null) return false;
            if (el.classList.contains('react-select__control')) {
                const input = el.querySelector('input');
                if (input && input.disabled) return false;
                if (el.className && el.className.includes('is-disabled')) return false;
            }
            return true;
        });

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
                await updateManufacturalJournal(editItem.id, payload);
            } else {
                await createManufacturalJournal(payload);
            }
            Swal.fire({
                icon: 'success',
                title: isEdit ? 'Updated' : 'Saved',
                text: `Manufactural journal ${isEdit ? 'updated' : 'created'} successfully.`,
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
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
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
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
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
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
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
                    background-color: #26b277 !important;
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
                dialogClassName="item-custom-modal modal-wide"
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
                                {isEdit ? 'Edit Manufactural Journal' : 'Create Manufactural Journal'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Enter manufactural journal header details, finished product, and consumption items
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
                                <Row className="g-3">
                                    {/* Journal Number (Disabled) */}
                                    <Col md={3}>
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
                                    <Col md={3}>
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
                                    <Col md={3}>
                                        <Form.Label className="form-label-custom">Manufactural Journal Type <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={selectedType?.manufactural_journal_type || 'Production/Consumption'}
                                            disabled
                                            className="form-control-custom"
                                            style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }}
                                        />
                                        {errorText('manufactural_journal_type')}
                                    </Col>

                                    {/* R&D Entry Autofill */}
                                    <Col md={3}>
                                        <Form.Label className="form-label-custom">
                                            R&D Entry <span className="text-muted" style={{ fontWeight: 400, fontSize: '11px' }}>(Autofill)</span>
                                        </Form.Label>
                                        <Select
                                            ref={rndSelectRef}
                                            options={rndEntryOptions}
                                            value={rndEntryOptions.find(o => String(o.value) === String(selectedRndId)) || null}
                                            onChange={handleRndEntrySelect}
                                            placeholder="— Select R&D Entry —"
                                            isClearable={true}
                                            openMenuOnFocus={true}
                                            classNamePrefix="react-select"
                                            menuPortalTarget={document.body}
                                            styles={reactSelectStyles}
                                        />
                                    </Col>
                                </Row>
                            </div>

                            {/* Finished Product Section */}
                            {selectedType && (
                                <div className="journal-header-box">
                                    <h5 className="font-w600 mb-3" style={{ fontSize: '14px', color: '#334155' }}>
                                        Finished Product (Production)
                                    </h5>
                                    <Row className="g-3">
                                        {/* Product / Stock Item */}
                                        <Col md={3}>
                                            <Form.Label className="form-label-custom">Name of product <span className="text-danger">*</span></Form.Label>
                                            <Select
                                                ref={productSelectRef}
                                                openMenuOnFocus={true}
                                                options={stockItems.map(item => ({ value: item.id, label: item.name }))}
                                                value={stockItems.map(item => ({ value: item.id, label: item.name })).find(o => o.value === finishedProduct) || null}
                                                onChange={(opt) => {
                                                    const val = opt ? opt.value : null;
                                                    setFinishedProduct(val);
                                                    setFinishedBom('');
                                                    setConsumptionRows([emptyRow()]);
                                                    if (val) {
                                                        const finishedItem = stockItems.find(s => s.id === val);
                                                        const rate = finishedItem
                                                            ? (parseFloat(finishedItem.sb_rate) || parseFloat(finishedItem.opening_rate) || parseFloat(finishedItem.ss_rate) || parseFloat(finishedItem.mrp) || 0)
                                                            : 0;
                                                        const targetQty = parseFloat(finishedQty) || 0;
                                                        const prodAmount = parseFloat((targetQty * rate).toFixed(2));
                                                        setProductionRows([
                                                            {
                                                                _key: 'prod-' + val + '-' + Date.now(),
                                                                stock_item: val,
                                                                stock_item_obj: finishedItem || null,
                                                                quantity: finishedQty || '',
                                                                rate: String(rate),
                                                                amount: prodAmount,
                                                                warehouse: finishedWarehouse || null,
                                                                batch_number: '',
                                                                expiry_date: null,
                                                                manufacture_date: null,
                                                                entry_type: 'IN',
                                                                splits: []
                                                            }
                                                        ]);
                                                    } else {
                                                        setProductionRows([emptyRow()]);
                                                    }
                                                }}
                                                placeholder="— Select Finished Product —"
                                                isClearable
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={reactSelectStyles}
                                            />
                                            {errorText('finishedProduct')}
                                        </Col>

                                        {/* BOM Recipe */}
                                        <Col md={3}>
                                            <Form.Label className="form-label-custom">Name of BOM</Form.Label>
                                            <Select
                                                ref={bomSelectRef}
                                                openMenuOnFocus={true}
                                                options={bomOptions}
                                                value={bomOptions.find(o => o.value === finishedBom) || bomOptions[0]}
                                                onChange={(opt) => {
                                                    const val = opt ? opt.value : '';
                                                    setFinishedBom(val);
                                                    const recipe = recipes.find(r => r.id === parseInt(val));
                                                    handleBOMChange(recipe, finishedQty);
                                                }}
                                                placeholder="Select BOM"
                                                isDisabled={!finishedProduct}
                                                classNamePrefix="react-select"
                                                menuPortalTarget={document.body}
                                                styles={reactSelectStyles}
                                            />
                                        </Col>

                                        {/* Warehouse / Godown */}
                                        {showWarehouse && (
                                            <Col md={2}>
                                                <Form.Label className="form-label-custom">Godown <span className="text-danger">*</span></Form.Label>
                                                <Select
                                                    ref={warehouseSelectRef}
                                                    openMenuOnFocus={true}
                                                    options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                                                    value={warehouses.map(w => ({ value: w.id, label: w.name })).find(o => o.value === finishedWarehouse) || null}
                                                    onChange={(opt) => {
                                                        const val = opt ? opt.value : null;
                                                        setFinishedWarehouse(val);
                                                        setConsumptionRows(prev => prev.map(row => ({ ...row, warehouse: val })));
                                                        setProductionRows(prev => prev.map(row => ({ ...row, warehouse: val })));
                                                    }}
                                                    placeholder="— Select Godown —"
                                                    isClearable
                                                    classNamePrefix="react-select"
                                                    menuPortalTarget={document.body}
                                                    styles={reactSelectStyles}
                                                />
                                                {errorText('finishedWarehouse')}
                                            </Col>
                                        )}

                                        {/* Qty */}
                                        <Col md={2}>
                                            <Form.Label className="form-label-custom">Qty <span className="text-danger">*</span></Form.Label>
                                            <div className="d-flex align-items-center gap-2">
                                                <Form.Control
                                                    type="number"
                                                    step="any"
                                                    name="finished_qty"
                                                    value={finishedQty}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFinishedQty(val);
                                                        scaleBOMQuantities(val);
                                                        setProductionRows(prev => prev.map(row => {
                                                            if (row.stock_item === finishedProduct) {
                                                                const r = parseFloat(row.rate) || 0;
                                                                const q = parseFloat(val) || 0;
                                                                return {
                                                                    ...row,
                                                                    quantity: val,
                                                                    amount: parseFloat((q * r).toFixed(2))
                                                                };
                                                            }
                                                            return row;
                                                        }));
                                                    }}
                                                    placeholder="0.00"
                                                    className="form-control-custom"
                                                    required
                                                />
                                                {unitLabel && (
                                                    <span className="badge badge-secondary light py-2 px-3" style={{ fontSize: '12px' }}>
                                                        {unitLabel}
                                                    </span>
                                                )}
                                            </div>
                                            {errorText('finishedQty')}
                                        </Col>

                                        {/* Batch Name */}
                                        {showBatch && (
                                            <Col md={2}>
                                                <Form.Label className="form-label-custom">Batch name</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="finished_batch"
                                                    value={finishedBatch}
                                                    onChange={(e) => handleFinishedBatchChange(e.target.value)}
                                                    placeholder="Enter batch"
                                                    className="form-control-custom"
                                                />
                                            </Col>
                                        )}

                                        {/* Mfg Date */}
                                        {showMfgDate && (
                                            <Col md={showExpDate ? 3 : 2}>
                                                <Form.Label className="form-label-custom">Mfg date</Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    name="finished_mfg_date"
                                                    value={finishedMfgDate}
                                                    onChange={(e) => setFinishedMfgDate(e.target.value)}
                                                    className="form-control-custom"
                                                />
                                            </Col>
                                        )}

                                        {/* Expiry Date */}
                                        {showExpDate && (
                                            <Col md={3}>
                                                <Form.Label className="form-label-custom">Expiry date</Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    name="finished_expiry_date"
                                                    value={finishedExpDate}
                                                    onChange={(e) => setFinishedExpDate(e.target.value)}
                                                    className="form-control-custom"
                                                />
                                            </Col>
                                        )}
                                    </Row>
                                </div>
                            )}

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
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Select Manufactural Journal Type to Add Items</div>
                                </div>
                            ) : (
                                <div>
                                    {errors.rows && (
                                        <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '13px', borderRadius: '8px' }}>
                                            {errors.rows}
                                        </div>
                                    )}

                                    <Row className="g-4">
                                        {/* Consumption Details */}
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
                                                        Subtotal: <span style={{ color: '#2ece8a' }}>{totalConsumption.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <div className="consumption-sec">
                                                    <ConsumptionComponent
                                                        rows={consumptionRows}
                                                        onRowsChange={setConsumptionRows}
                                                        stockItems={stockItems}
                                                        productConfig={productConfig}
                                                        isEdit={isEdit}
                                                        autoFocus={false}
                                                        isManufacturalJournal={true}
                                                    />
                                                </div>
                                            </div>
                                        </Col>

                                        {/* Production Details */}
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
                                                        Subtotal: <span style={{ color: '#2ece8a' }}>{displayProductionCost.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                <div className="production-sec">
                                                    <ProductionComponent
                                                        rows={productionRows}
                                                        onRowsChange={setProductionRows}
                                                        stockItems={stockItems}
                                                        productConfig={productConfig}
                                                        isEdit={isEdit}
                                                        isManufacturalJournal={true}
                                                        autoFocus={false}
                                                    />
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            )}

                            {/* Narration */}
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
                        Total Consumption Cost: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{totalConsumption.toFixed(2)}</span> | Total Production Cost: <span style={{ color: '#2ece8a', fontWeight: 600 }}>{displayProductionCost.toFixed(2)}</span>
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

export default ManufacturalJournalFormModal;
