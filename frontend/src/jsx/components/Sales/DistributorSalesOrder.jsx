import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import swal from 'sweetalert';
import SalesService from '../../../services/SalesService';
import LogisticsService from '../../../services/LogisticsService';
import InventoryService, { getPriceLists } from '../../../services/InventoryService';
import { getPriceListMappings } from '../../../services/FinanceService';

import { usePageTitle } from '../../../context/TitleContext';

/* ─── Design tokens ──────────────────────────────────────────────────────────
   Palette: deep navy header, clean white cards, royal-blue accent,
   gold detail used once for brand badge. "DM Sans" body, "DM Serif Display"
   for the hero headline – gives a premium editorial feel without being flashy.
─────────────────────────────────────────────────────────────────────────── */
const T = {
    ink: '#0f1624',
    inkMuted: '#3d4a5c',
    slate: '#6b7a90',
    steel: '#a0aec0',
    cloud: '#eef1f6',
    white: '#ffffff',
    surface: '#f5f7fa',

    accent: '#3b5bdb',
    accentSoft: '#e8edfd',
    accentGlow: 'rgba(59,91,219,0.18)',

    gold: '#c9a84c',

    danger: '#dc2626',

    rSm: '8px',
    rMd: '14px',
    rLg: '20px',
    rXl: '28px',

    shSm: '0 1px 3px rgba(15,22,36,0.06), 0 1px 2px rgba(15,22,36,0.04)',
    shMd: '0 4px 16px rgba(15,22,36,0.07), 0 1px 4px rgba(15,22,36,0.05)',
    shAccent: '0 6px 20px rgba(59,91,219,0.30)',
};



const fieldLabel = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: T.slate,
    marginBottom: '6px',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
};

const fieldBase = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: T.rMd,
    border: `1.5px solid ${T.cloud}`,
    background: T.white,
    fontSize: '0.875rem',
    color: T.ink,
    fontWeight: '500',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.18s, box-shadow 0.18s',
    boxSizing: 'border-box',
};



const getAutoSelectLedgerId = (loadedLedgers, user) => {
    if (!user || !loadedLedgers || !loadedLedgers.length) return '';

    // 1. Check if backend already found the matching ledger_id in customer_info
    if (user.customer_info && user.customer_info.ledger_id) {
        const foundById = loadedLedgers.find(l => String(l.id) === String(user.customer_info.ledger_id));
        if (foundById) return String(foundById.id);
    }

    // 2. Match by email (user email or distributor email)
    const emailsToMatch = [
        user.email,
        user.customer_info?.email
    ].filter(Boolean).map(e => e.trim().toLowerCase());

    for (const email of emailsToMatch) {
        const match = loadedLedgers.find(l => (l.email || '').trim().toLowerCase() === email);
        if (match) return String(match.id);
    }

    // 3. Match by name (distributor name, or user full name / username)
    const namesToMatch = [
        user.customer_info?.name,
        user.customer_info?.ledger_name,
        user.name,
        user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : null,
        user.username
    ].filter(Boolean).map(n => n.trim().toLowerCase());

    for (const name of namesToMatch) {
        const match = loadedLedgers.find(l => (l.name || '').trim().toLowerCase() === name);
        if (match) return String(match.id);
    }

    return '';
};

const DistributorSalesOrder = () => {
    usePageTitle("Distributor Order");
    const navigate = useNavigate();

    useEffect(() => {
        const containerFluid = document.querySelector('.container-fluid');
        const contentBody = document.querySelector('.content-body');
        let ogCBg = '', ogCPad = '', ogBBg = '';
        if (containerFluid) {
            ogCBg = containerFluid.style.background || containerFluid.style.backgroundColor;
            ogCPad = containerFluid.style.padding;
            containerFluid.style.setProperty('background', T.surface, 'important');
            containerFluid.style.setProperty('background-color', T.surface, 'important');
            containerFluid.style.setProperty('padding', '0', 'important');
        }
        if (contentBody) {
            ogBBg = contentBody.style.background || contentBody.style.backgroundColor;
            contentBody.style.setProperty('background', T.surface, 'important');
            contentBody.style.setProperty('background-color', T.surface, 'important');
        }
        return () => {
            if (containerFluid) { containerFluid.style.background = ogCBg; containerFluid.style.padding = ogCPad; }
            if (contentBody) { contentBody.style.background = ogBBg; }
        };
    }, []);

    // ── Master data state ────────────────────────────────────────────────────
    const [ledgers, setLedgers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [deliveryLocations, setDeliveryLocations] = useState([]);
    const [stockItems, setStockItems] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [allSalesOrders, setAllSalesOrders] = useState([]);
    const [viewMode, setViewMode] = useState('recent');
    const [priceListMappings, setPriceListMappings] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isDistributor, setIsDistributor] = useState(false);

    // ── Form / cart state ────────────────────────────────────────────────────
    const [customerLedger, setCustomerLedger] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState('');
    const [vehicleType, setVehicleType] = useState('');
    const [selectedDriver, setSelectedDriver] = useState('');
    const [deliveryDateTime, setDeliveryDateTime] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [orderType, setOrderType] = useState('STATE');
    const [cart, setCart] = useState({});
    const [itemGstRates, setItemGstRates] = useState({});

    // ── Top Picks State ──────────────────────────────────────────────────────
    const [topPicks, setTopPicks] = useState([]);
    const [editTopPicksMode, setEditTopPicksMode] = useState(false);

    useEffect(() => {
        if (!customerLedger) {
            setTopPicks([]);
            return;
        }
        SalesService.getDistributorTopPicks(customerLedger)
            .then(res => {
                if (res.data && res.data.products) {
                    setTopPicks(res.data.products.map(String));
                } else {
                    setTopPicks([]);
                }
            })
            .catch(err => {
                console.error("Failed to fetch top picks", err);
                setTopPicks([]);
            });
    }, [customerLedger]);

    // ── Initial fetch ────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchMasterData = async () => {
            setLoading(true);
            try {
                const [ledgersRes, vehiclesRes, driversRes, stockItemsRes, warehousesRes, salesOrdersRes, mappingsData, priceListsData] = await Promise.all([
                    SalesService.getLedgers(),
                    LogisticsService.getVehicles(),
                    LogisticsService.getDrivers(),
                    SalesService.getStockItems(),
                    SalesService.getWarehouses(),
                    SalesService.getSalesOrders(),
                    getPriceListMappings(),
                    getPriceLists(),
                ]);

                const loadedLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
                setLedgers(loadedLedgers);

                try {
                    const userDetailsStr = localStorage.getItem('userDetails');
                    const currentUser = userDetailsStr ? JSON.parse(userDetailsStr).user : null;
                    if (currentUser) {
                        const isDistributorUser = (
                            currentUser.customer_type ||
                            currentUser.customer_info?.customer_type ||
                            currentUser.role?.name ||
                            currentUser.role_name || ''
                        ).toLowerCase() === 'distributor';
                        if (isDistributorUser) {
                            setIsDistributor(true);
                            const autoLedgerId = getAutoSelectLedgerId(loadedLedgers, currentUser);
                            if (autoLedgerId) {
                                setCustomerLedger(autoLedgerId);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error auto-selecting distributor customer:', e);
                }
                setVehicles(Array.isArray(vehiclesRes.data) ? vehiclesRes.data : []);
                setDrivers(Array.isArray(driversRes.data) ? driversRes.data : []);
                setAllSalesOrders(Array.isArray(salesOrdersRes.data) ? salesOrdersRes.data : []);
                setPriceListMappings(Array.isArray(mappingsData) ? mappingsData : []);
                setPriceLists(Array.isArray(priceListsData) ? priceListsData : []);

                const items = Array.isArray(stockItemsRes.data) ? stockItemsRes.data : [];
                setStockItems(items);
                setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : []);

                const gstMap = {};
                items.forEach(item => {
                    const rates = item.item_gst_rates || item.gst_rates || [];
                    let igst = parseFloat(item.gst_percentage) || 0, cgst = 0, sgst = 0;
                    if (rates.length > 0) {
                        const latest = [...rates].sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date))[0];
                        igst = parseFloat(latest?.igst_percent) || igst;
                        cgst = parseFloat(latest?.cgst_percent) || 0;
                        sgst = parseFloat(latest?.sgst_percent) || 0;
                    }
                    gstMap[item.id] = { igst, cgst, sgst };
                });
                setItemGstRates(gstMap);

                const tomorrow = new Date();
                tomorrow.setHours(tomorrow.getHours() + 24);
                const tzOffset = tomorrow.getTimezoneOffset() * 60000;
                const localISO = (new Date(tomorrow.getTime() - tzOffset)).toISOString().slice(0, 16);
                setDeliveryDateTime(localISO);

            } catch (err) {
                console.error('Error fetching distributor data:', err);
                swal('Error', 'Failed to load distributor screen data.', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchMasterData();
    }, []);
 
    // ── Dynamic delivery location ────────────────────────────────────────────
    useEffect(() => {
        if (!customerLedger) { setDeliveryLocations([]); setDeliveryLocation(''); return; }
        SalesService.getDeliveryLocations(customerLedger)
            .then(res => {
                const locations = Array.isArray(res.data) ? res.data : [];
                setDeliveryLocations(locations);
                setDeliveryLocation(locations.length > 0 ? locations[0].delivery_location : '');
            })
            .catch(() => { setDeliveryLocations([]); setDeliveryLocation(''); });

        const selectedLedger = ledgers.find(l => String(l.id) === String(customerLedger));
        if (selectedLedger) {
            const isInterState = selectedLedger.state && selectedLedger.state.toLowerCase() !== 'state';
            setOrderType(isInterState ? 'INTER_STATE' : 'STATE');
        }
    }, [customerLedger, ledgers]);

    // ── Cart ─────────────────────────────────────────────────────────────────
    const updateQuantity = (itemId, change) => {
        setCart(prev => {
            const newQty = Math.max(0, (prev[itemId] || 0) + change);
            const newCart = { ...prev };
            if (newQty === 0) delete newCart[itemId]; else newCart[itemId] = newQty;
            return newCart;
        });
        // When adding an item for the first time, clear search so all items are visible
        // with cart items sorted to the top — makes it easy to keep adding
        if (change > 0 && !cart[itemId]) {
            setSearchQuery('');
            setViewMode('all');
        }
    };

    const setQuantity = (itemId, qty) => {
        setCart(prev => {
            const newCart = { ...prev };
            const parsedQty = parseInt(qty, 10);
            if (isNaN(parsedQty) || parsedQty <= 0) {
                delete newCart[itemId];
            } else {
                newCart[itemId] = parsedQty;
            }
            return newCart;
        });
    };

    const activePriceListId = React.useMemo(() => {
        if (!customerLedger || !priceListMappings.length) return null;
        const todayStr = new Date().toISOString().split('T')[0];
        const ledgerMappings = priceListMappings.filter(m => String(m.ledger) === String(customerLedger) && m.applicable_date <= todayStr);
        const pool = ledgerMappings.length ? ledgerMappings : priceListMappings.filter(m => String(m.ledger) === String(customerLedger));
        if (!pool.length) return null;
        pool.sort((a, b) => new Date(b.applicable_date) - new Date(a.applicable_date));
        return pool[0].price_list;
    }, [customerLedger, priceListMappings]);

    const activePriceList = React.useMemo(() =>
        activePriceListId ? priceLists.find(pl => String(pl.id) === String(activePriceListId)) : null,
        [activePriceListId, priceLists]);

    const priceListRates = React.useMemo(() => {
        const m = {};
        if (activePriceList?.items) activePriceList.items.forEach(it => { m[it.stock_item] = parseFloat(it.rate) || 0; });
        return m;
    }, [activePriceList]);

    const getCartTotalDetails = () => {
        let totalItems = 0, subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
        Object.keys(cart).forEach(itemId => {
            const item = stockItems.find(p => String(p.id) === String(itemId));
            if (!item) return;
            const qty = cart[itemId];
            const rate = priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0);
            const gstRates = itemGstRates[itemId] || { igst: 0, cgst: 0, sgst: 0 };
            const lineAmt = qty * rate;
            totalItems += qty;
            subtotal += lineAmt;
            if (orderType === 'INTER_STATE') igstTotal += (lineAmt * gstRates.igst) / 100;
            else { cgstTotal += (lineAmt * gstRates.cgst) / 100; sgstTotal += (lineAmt * gstRates.sgst) / 100; }
        });
        return { totalItems, subtotal, cgstTotal, sgstTotal, igstTotal, grandTotal: subtotal + cgstTotal + sgstTotal + igstTotal };
    };

    const { totalItems, subtotal, cgstTotal, sgstTotal, igstTotal, grandTotal } = getCartTotalDetails();

    const resetFormFields = () => {
        setCart({});
        setDeliveryLocation('');
        setVehicleType('');
        setSelectedDriver('');
        try {
            const userDetailsStr = localStorage.getItem('userDetails');
            const currentUser = userDetailsStr ? JSON.parse(userDetailsStr).user : null;
            const isDistributor = (
                currentUser?.customer_type ||
                currentUser?.customer_info?.customer_type ||
                currentUser?.role?.name ||
                currentUser?.role_name || ''
            ).toLowerCase() === 'distributor';
            if (!isDistributor) {
                setCustomerLedger('');
            }
        } catch (e) {
            setCustomerLedger('');
        }
    };

    // ── Show confirmation page ───────────────────────────────────────────────
    const handlePlaceOrder = () => {
        if (!customerLedger) { swal('Missing Field', 'Please select a Customer.', 'warning'); return; }
        if (!deliveryDateTime) { swal('Missing Field', 'Please select Delivery Date & Time.', 'warning'); return; }
        if (!vehicleType) { swal('Missing Field', 'Please select a Vehicle.', 'warning'); return; }
        if (!deliveryLocation) { swal('Missing Field', 'Please specify a Delivery Location.', 'warning'); return; }
        if (totalItems === 0) { swal('Empty Cart', 'Add at least one product to continue.', 'warning'); return; }
        setShowConfirmation(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Actual order submission ──────────────────────────────────────────────
    const handleConfirmOrder = async () => {
        const entryDateStr = new Date().toISOString().split('T')[0];
        const defaultWarehouse = warehouses[0]?.id || null;
        const defaultWHName = warehouses[0]?.name || '';
        const cgstLedger = ledgers.find(l => l.name.toLowerCase().includes('cgst'));
        const sgstLedger = ledgers.find(l => l.name.toLowerCase().includes('sgst'));
        const igstLedger = ledgers.find(l => l.name.toLowerCase().includes('igst'));

        const orderItems = Object.keys(cart).map(itemId => {
            const item = stockItems.find(p => String(p.id) === String(itemId));
            const qty = cart[itemId];
            const rate = priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0);
            const gstRates = itemGstRates[itemId] || { igst: 0, cgst: 0, sgst: 0 };
            const amount = qty * rate;
            const cgstAmt = orderType === 'INTER_STATE' ? 0 : (amount * gstRates.cgst) / 100;
            const sgstAmt = orderType === 'INTER_STATE' ? 0 : (amount * gstRates.sgst) / 100;
            const igstAmt = orderType === 'INTER_STATE' ? (amount * gstRates.igst) / 100 : 0;
            const gstPct = orderType === 'INTER_STATE' ? gstRates.igst : (gstRates.cgst + gstRates.sgst);
            return {
                product: item.id, productName: item.name,
                warehouse: defaultWarehouse, warehouseName: defaultWHName,
                quantity: qty.toFixed(2), rate: rate.toFixed(2),
                discount_percent: '0.00', discount_amount: '0.00',
                gst_percent: gstPct.toFixed(2),
                cgst_amount: cgstAmt.toFixed(2), sgst_amount: sgstAmt.toFixed(2), igst_amount: igstAmt.toFixed(2),
                amount: amount.toFixed(2), batch_number: '', manufacture_date: null, expiry_date: null,
            };
        });

        const payload = {
            order_type: orderType, entry_date: entryDateStr, customer_ledger: parseInt(customerLedger),
            gst_ledger_1: orderType === 'INTER_STATE' ? (igstLedger?.id || '') : (cgstLedger?.id || ''),
            gst_amount_1: (orderType === 'INTER_STATE' ? igstTotal : cgstTotal).toFixed(2),
            gst_ledger_2: orderType === 'INTER_STATE' ? '' : (sgstLedger?.id || ''),
            gst_amount_2: (orderType === 'INTER_STATE' ? 0 : sgstTotal).toFixed(2),
            total_amount: grandTotal.toFixed(2),
            narration: `Order created by distributor. Vehicle Type: ${vehicleType}` + (deliveryLocations.length === 0 && deliveryLocation ? ` | Delivery Location: ${deliveryLocation}` : ''),
            is_posted: false, other_reference: 'Distributor App', terms_of_delivery: 'Immediate Delivery',
            dispatch_through: vehicleType, 
            delivery_location: deliveryLocations.length > 0 && deliveryLocation ? parseInt(deliveryLocation) : null,
            driver: selectedDriver || undefined,
            priority: 'Standard', preferred_delivery_date: deliveryDateTime ? deliveryDateTime.replace('T', ' ') : null,
            status: 'Pending', items: orderItems,
            is_distributor_order: true,
        };

        try {
            const res = await SalesService.createSalesOrder(payload);
            setShowConfirmation(false);
            
            if (res && res.data && res.data.approval_status === 'Not Approved') {
                swal({
                    title: 'Order Placed but Not Approved',
                    text: `This order exceeds the allowed credit limit difference. You need to pay ${res.data.rest_amount_to_pay || 0} to make this order approved.`,
                    icon: 'warning',
                    button: 'OK'
                }).then(() => { resetFormFields(); });
            } else {
                swal({ title: 'Order Placed', text: 'Your Sales Order has been submitted.', icon: 'success', button: 'OK' })
                    .then(() => { resetFormFields(); });
            }
        } catch (err) {
            console.error('Failed to create sales order:', err);
            const errData = err.response?.data;
            let errMsg = 'Could not create Sales Order. Please check the fields and try again.';
            if (errData) { 
                if (typeof errData === 'string') errMsg = errData; 
                else if (errData.detail) errMsg = errData.detail; 
                else {
                    const messages = [];
                    for (const [key, value] of Object.entries(errData)) {
                        let formattedKey = key;
                        if (key.startsWith('item_') && key.includes('_')) {
                            const parts = key.split('_');
                            if (parts.length >= 3 && !isNaN(parts[1])) {
                                const index = parseInt(parts[1]) + 1;
                                const field = parts.slice(2).join(' ').replace(/\b\w/g, l => l.toUpperCase());
                                formattedKey = `Row ${index} ${field}`;
                            }
                        } else {
                            formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        }
                        const msgList = Array.isArray(value) ? value.join(', ') : value;
                        messages.push(`${formattedKey}: ${msgList}`);
                    }
                    errMsg = messages.length > 0 ? messages.join('\n') : JSON.stringify(errData);
                }
            }
            swal('Error', errMsg, 'error');
        }
    };

    // ── Recent items ─────────────────────────────────────────────────────────
    const recentStockItems = React.useMemo(() => {
        if (!customerLedger || !allSalesOrders.length || !stockItems.length) return [];
        const sortedOrders = [...allSalesOrders.filter(o => String(o.customer_ledger) === String(customerLedger))]
            .sort((a, b) => new Date(b.created_at || b.entry_date) - new Date(a.created_at || a.entry_date));
        const ids = [];
        sortedOrders.forEach(order => {
            if (Array.isArray(order.items)) order.items.forEach(item => { if (item.product && !ids.includes(item.product)) ids.push(item.product); });
        });
        return ids.slice(0, 5).map(id => stockItems.find(it => String(it.id) === String(id))).filter(Boolean);
    }, [customerLedger, allSalesOrders, stockItems]);

    const topPicksStockItems = React.useMemo(() => {
        return stockItems.filter(item => topPicks.includes(String(item.id)) || topPicks.includes(Number(item.id)));
    }, [stockItems, topPicks]);

    const displayStockItems = React.useMemo(() => {
        if (viewMode === 'top_picks') {
            return editTopPicksMode ? stockItems : topPicksStockItems;
        }
        return viewMode === 'all' ? stockItems : recentStockItems;
    }, [viewMode, stockItems, recentStockItems, topPicksStockItems, editTopPicksMode]);

    const filteredStockItems = React.useMemo(() => {
        const q = searchQuery.toLowerCase();
        const filtered = displayStockItems.filter(item => item.name.toLowerCase().includes(q));
        return [...filtered].sort((a, b) => {
            // While searching: exact / starts-with matches rise above partial matches
            if (q) {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aStarts = aName.startsWith(q);
                const bStarts = bName.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return aName.localeCompare(bName);
            }

            // Top Picks edit mode: picked items float to top
            if (editTopPicksMode) {
                const isPickedA = topPicks.includes(String(a.id)) || topPicks.includes(Number(a.id));
                const isPickedB = topPicks.includes(String(b.id)) || topPicks.includes(Number(b.id));
                if (isPickedA && !isPickedB) return -1;
                if (!isPickedA && isPickedB) return 1;
            }

            // No search: cart items float to top
            const qtyA = cart[a.id] || 0;
            const qtyB = cart[b.id] || 0;
            if (qtyA > 0 && qtyB === 0) return -1;
            if (qtyA === 0 && qtyB > 0) return 1;
            return 0;
        });
    }, [displayStockItems, searchQuery, cart, editTopPicksMode, topPicks]);

    // ── Loading screen ───────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: T.surface, gap: '20px' }}>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
                    @keyframes spin    { to { transform:rotate(360deg) } }
                    @keyframes pulse   { 0%,100%{ opacity:1 } 50%{ opacity:.45 } }
                `}</style>
                <div style={{ width: '48px', height: '48px', border: `3px solid ${T.cloud}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: T.ink, fontWeight: '700', fontSize: '0.95rem', margin: '0 0 4px', fontFamily: "'DM Sans',sans-serif" }}>Preparing your dashboard</p>
                    <p style={{ color: T.slate, fontSize: '0.78rem', margin: 0, fontFamily: "'DM Sans',sans-serif", animation: 'pulse 2s ease infinite' }}>Fetching products & orders…</p>
                </div>
            </div>
        );
    }

    // ── Confirmation page render ─────────────────────────────────────────────
    if (showConfirmation) {
        const selectedCustomer = ledgers.find(l => String(l.id) === String(customerLedger));
        const confirmItems = Object.keys(cart).map(itemId => {
            const item = stockItems.find(p => String(p.id) === String(itemId));
            const qty = cart[itemId];
            const rate = priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0);
            const gstRates = itemGstRates[itemId] || { igst: 0, cgst: 0, sgst: 0 };
            const amount = qty * rate;
            const cgstAmt = orderType === 'INTER_STATE' ? 0 : (amount * gstRates.cgst) / 100;
            const sgstAmt = orderType === 'INTER_STATE' ? 0 : (amount * gstRates.sgst) / 100;
            return { id: itemId, name: item.name, qty, rate, amount, cgstAmt, sgstAmt };
        });

        return (
            <div style={{ maxWidth: '720px', margin: '0 auto', background: T.surface, minHeight: '100vh', fontFamily: "'DM Sans','Inter',sans-serif", paddingBottom: '24px' }}>

                {/* Global CSS */}
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display&display=swap');
                    @keyframes slideUp { from { transform:translateY(10px);opacity:0 } to { transform:translateY(0);opacity:1 } }
                    .conf-confirm-btn:hover { opacity:0.9; transform:translateY(-1px); }
                    .conf-cancel-btn:hover  { background:${T.cloud}!important; }
                `}</style>

                {/* Header */}
                <div style={{
                    background: 'linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)',
                    padding: '28px 20px 32px',
                    borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px',
                    color: T.white, boxShadow: '0 12px 36px rgba(15,30,69,0.22)',
                    position: 'relative', overflow: 'hidden',
                }}>
                    <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '28px', left: '22px', width: '6px', height: '6px', borderRadius: '50%', background: T.gold, opacity: 0.85 }} />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: '20px', padding: '3px 10px', marginBottom: '10px' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
                            <span style={{ fontSize: '0.63rem', fontWeight: '700', letterSpacing: '0.09em', color: T.gold, textTransform: 'uppercase' }}>Order Review</span>
                        </div>
                        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.7rem', fontWeight: '400', margin: '0', letterSpacing: '-0.01em', lineHeight: 1.15, color: T.white }}>
                            Confirm Order
                        </h1>
                        <p style={{ margin: '6px 0 0', fontSize: '0.77rem', color: 'rgba(255,255,255,0.48)', fontWeight: '400' }}>
                            {selectedCustomer?.name} · {totalItems} items · {grandTotal.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 16px 0', animation: 'slideUp 0.22s ease both' }}>

                    {/* Items table card */}
                    <div style={{
                        background: T.white, borderRadius: T.rXl, padding: '22px 20px',
                        boxShadow: T.shMd, border: '1px solid rgba(15,22,36,0.06)',
                        marginBottom: '16px', position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,${T.accent},#7b93f5)`, borderRadius: '20px 20px 0 0' }} />

                        {/* Section title */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', marginTop: '6px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>🧾</div>
                            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Order Summary</h2>
                        </div>

                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 52px 72px 80px',
                            gap: '8px', padding: '8px 10px', marginBottom: '6px',
                            background: T.surface, borderRadius: T.rSm,
                        }}>
                            {['Product', 'Qty', 'Rate', 'Amount'].map(h => (
                                <span key={h} style={{ fontSize: '0.66rem', fontWeight: '700', color: T.steel, letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Product' ? 'left' : 'right' }}>{h}</span>
                            ))}
                        </div>

                        {/* Item rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {confirmItems.map((ci, idx) => (
                                <div key={ci.id} style={{
                                    display: 'grid', gridTemplateColumns: '1fr 52px 72px 80px',
                                    gap: '8px', padding: '11px 10px',
                                    borderRadius: T.rSm,
                                    background: idx % 2 === 0 ? T.white : T.surface,
                                    borderBottom: `1px solid ${T.cloud}`,
                                }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ci.name}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted, textAlign: 'right' }}>{ci.qty}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted, textAlign: 'right' }}>{ci.rate.toFixed(2)}</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: T.accent, textAlign: 'right' }}>{ci.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tax & total card */}
                    <div style={{
                        background: T.white, borderRadius: T.rXl, padding: '22px 20px',
                        boxShadow: T.shMd, border: '1px solid rgba(15,22,36,0.06)',
                        marginBottom: '20px', position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,${T.accent},#7b93f5)`, borderRadius: '20px 20px 0 0' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', marginTop: '6px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>💰</div>
                            <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Tax & Total</h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Subtotal */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', color: T.slate, fontWeight: '500' }}>Subtotal</span>
                                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted }}>{subtotal.toFixed(2)}</span>
                            </div>

                            {orderType === 'INTER_STATE' ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.82rem', color: T.slate, fontWeight: '500' }}>IGST</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted }}>{igstTotal.toFixed(2)}</span>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.82rem', color: T.slate, fontWeight: '500' }}>CGST</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted }}>{cgstTotal.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.82rem', color: T.slate, fontWeight: '500' }}>SGST</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: T.inkMuted }}>{sgstTotal.toFixed(2)}</span>
                                    </div>
                                </>
                            )}

                            <div style={{ borderTop: `1.5px dashed ${T.cloud}`, paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: T.ink }}>Net Amount</span>
                                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: T.accent }}>{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', paddingBottom: '8px' }}>
                        <button
                            className="conf-cancel-btn"
                            onClick={() => { setShowConfirmation(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{
                                flex: 1, padding: '12px 10px',
                                background: T.white, color: T.inkMuted,
                                border: `1.5px solid ${T.cloud}`, borderRadius: T.rMd,
                                fontWeight: '700', fontSize: '0.83rem', cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
                                transition: 'all 0.18s ease', fontFamily: 'inherit',
                            }}>
                            ← Cancel
                        </button>
                        <button
                            className="conf-confirm-btn"
                            onClick={handleConfirmOrder}
                            style={{
                                flex: 2, padding: '12px 10px',
                                background: 'linear-gradient(135deg, #2c4acc 0%, #3b5bdb 100%)',
                                color: '#fff', border: 'none', borderRadius: T.rMd,
                                fontWeight: '700', fontSize: '0.83rem', cursor: 'pointer',
                                boxShadow: '0 6px 20px rgba(59,91,219,0.30)',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                                transition: 'all 0.18s ease', fontFamily: 'inherit', letterSpacing: '0.01em',
                            }}>
                            ✅ Confirm Order
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main render ──────────────────────────────────────────────────────────
    return (
        <div className="dso-wrapper" style={{ maxWidth: '600px', margin: '0 auto', background: T.surface, height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans','Inter',sans-serif", overflow: 'hidden' }}>

            {/* Global CSS */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display&display=swap');
                @keyframes spin    { to { transform:rotate(360deg) } }
                @keyframes slideUp { from { transform:translateY(8px);opacity:0 } to { transform:translateY(0);opacity:1 } }
                .dso-select:focus,.dso-input:focus { border-color:${T.accent}!important; box-shadow:0 0 0 3px ${T.accentGlow}!important; }
                .dso-card  { animation:slideUp 0.22s ease both; }
                .dso-card2 { animation:slideUp 0.28s ease both; }
                .dso-tab-btn  { transition:all 0.18s ease; }
                .dso-add-btn:hover  { background:${T.accent}!important; color:#fff!important; border-color:${T.accent}!important; }
                .dso-checkout-btn:hover { opacity:0.9; transform:translateY(-1px); }
                .dso-back-btn:hover { background:rgba(255,255,255,0.2)!important; }
                .dso-product-row { transition:box-shadow 0.2s ease,border-color 0.2s ease; }
                .dso-product-row:hover { box-shadow:${T.shMd}!important; }
                .dso-no-spinners::-webkit-outer-spin-button,
                .dso-no-spinners::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .dso-no-spinners { -moz-appearance: textfield; }

                /* ── Desktop layout (≥ 900 px) ───────────────────────────── */
                @media (min-width: 900px) {
                    .dso-wrapper {
                        max-width: 100% !important;
                        height: 100vh !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    /* Products left (flex), Form right (fixed 400px) */
                    .dso-body {
                        display: grid !important;
                        grid-template-columns: 1fr 400px !important;
                        gap: 0 !important;
                        flex: 1 !important;
                        overflow: hidden !important;
                        padding: 0 !important;
                    }
                    /* LEFT = products panel — second in DOM, visually first on desktop */
                    .dso-left-panel {
                        display: flex !important;
                        flex-direction: column !important;
                        border-right: 1.5px solid ${T.cloud} !important;
                        overflow: hidden !important;
                        order: 1 !important;
                    }
                    .dso-left-scroll {
                        flex: 1 !important;
                        overflow-y: auto !important;
                        padding: 24px 24px 16px !important;
                    }
                    /* RIGHT = form panel — first in DOM, visually second on desktop */
                    .dso-right-panel {
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                        background: ${T.white} !important;
                        border-left: 1.5px solid ${T.cloud} !important;
                        order: 2 !important;
                    }
                    .dso-right-scroll {
                        flex: 1 !important;
                        overflow-y: auto !important;
                        padding: 24px 20px 8px !important;
                    }
                    /* Checkout footer: on desktop pin to bottom-right of the right panel */
                    .dso-checkout-footer {
                        position: fixed !important;
                        bottom: 0 !important;
                        right: 0 !important;
                        width: 400px !important;
                        border-top-left-radius: 0 !important;
                        border-top-right-radius: 0 !important;
                        border-bottom-left-radius: 0 !important;
                        border-bottom-right-radius: 0 !important;
                        box-shadow: 0 -4px 16px rgba(15,22,36,0.07) !important;
                        padding: 14px 20px 20px !important;
                        z-index: 10 !important;
                    }
                    /* Hide drag handle on desktop */
                    .dso-checkout-footer > div:first-child {
                        display: none !important;
                    }
                    /* Add bottom padding to right-scroll so content isn't hidden behind footer */
                    .dso-right-scroll {
                        padding-bottom: 160px !important;
                    }
                }
                    /* Product catalog card wrapper on desktop */
                    @media (min-width: 900px) {
                        .dso-card2 {
                            background: ${T.white} !important;
                            border-radius: ${T.rXl} !important;
                            padding: 22px 20px !important;
                            box-shadow: 0 4px 16px rgba(15,22,36,0.07), 0 1px 4px rgba(15,22,36,0.05) !important;
                            border: 1px solid rgba(15,22,36,0.06) !important;
                        }
                    }
            `}</style>
            <div style={{
                background: 'linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)',
                padding: '18px 20px 22px',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                color: T.white,
                boxShadow: '0 12px 36px rgba(15,30,69,0.22)',
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
            }}>
                {/* Decorative concentric arcs */}
                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '280px', height: '280px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '180px', height: '180px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.04)', pointerEvents: 'none' }} />


                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    {/* Left: badge + title */}
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: '20px', padding: '3px 10px', marginBottom: '10px' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: T.gold, display: 'inline-block' }} />
                            <span style={{ fontSize: '0.63rem', fontWeight: '700', letterSpacing: '0.09em', color: T.gold, textTransform: 'uppercase' }}>Distributor Connect</span>
                        </div>
                        <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: '1.7rem', fontWeight: '400', margin: '0', letterSpacing: '-0.01em', lineHeight: 1.15, color: T.white }}>
                            Place Your Order
                        </h1>
                    </div>

                    {/* Right: date on top, back button below */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.48)', fontWeight: '400', whiteSpace: 'nowrap' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="dso-back-btn"
                                onClick={() => navigate('/distributor-orders')}
                                style={{
                                    background: 'rgba(59,91,219,0.2)', border: '1px solid rgba(59,91,219,0.4)',
                                    color: '#fff', padding: '7px 14px', borderRadius: '12px',
                                    fontSize: '0.77rem', fontWeight: '600', cursor: 'pointer',
                                    backdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
                                    fontFamily: 'inherit', letterSpacing: '0.01em', transition: 'background 0.18s',
                                }}
                            >📦 My Orders</button>
                        </div>
                    </div>
                </div>

            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="dso-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px' }}>

                {/* ── FORM PANEL — first in DOM = first on mobile, right on desktop ── */}
                <div className="dso-right-panel">
                    <div className="dso-right-scroll">

                        {/* ── Order Details Card ─────────────────────────────────── */}
                        <div className="dso-card" style={{
                            background: T.white, borderRadius: T.rXl, padding: '22px 20px',
                            boxShadow: '0 4px 16px rgba(15,22,36,0.07), 0 1px 4px rgba(15,22,36,0.05)',
                            border: '1px solid rgba(15,22,36,0.06)', marginBottom: '16px',
                            position: 'relative', overflow: 'hidden',
                        }}>
                            {/* Top rule accent */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${T.accent}, #7b93f5)`, borderRadius: '20px 20px 0 0' }} />

                            {/* Section label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '6px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>🚚</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: T.steel, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 1</p>
                                    <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Delivery Details</h2>
                                </div>
                            </div>

                            {/* Customer */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={fieldLabel}>Customer <span style={{ color: T.danger }}>*</span></label>
                                {isDistributor ? (
                                    <div style={{ ...fieldBase, background: T.surface, color: T.ink, cursor: 'not-allowed' }}>
                                        {ledgers.find(l => String(l.id) === String(customerLedger))?.name || 'Loading...'}
                                    </div>
                                ) : (
                                    <select className="dso-select" value={customerLedger} onChange={e => setCustomerLedger(e.target.value)}
                                        style={{ ...fieldBase, color: customerLedger ? T.ink : T.steel }}>
                                        <option value="">— Select customer —</option>
                                        {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Delivery date */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={fieldLabel}>Preferred Delivery Date & Time <span style={{ color: T.danger }}>*</span></label>
                                <input className="dso-input" type="datetime-local" value={deliveryDateTime}
                                    onChange={e => setDeliveryDateTime(e.target.value)} style={{ ...fieldBase }} />
                            </div>

                            {/* Vehicle + Location */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={fieldLabel}>Vehicle <span style={{ color: T.danger }}>*</span></label>
                                    <select className="dso-select" value={vehicleType} onChange={e => {
                                        const selectedName = e.target.value;
                                        setVehicleType(selectedName);
                                        const selectedVehicle = vehicles.find(v => v.vehicle_name === selectedName);
                                        setSelectedDriver(selectedVehicle?.driver ? String(selectedVehicle.driver) : '');
                                    }}
                                        style={{ ...fieldBase, color: vehicleType ? T.ink : T.steel }}>
                                        <option value="">— Select —</option>
                                        {vehicles.length > 0 ? (
                                            vehicles.map(v => <option key={v.id} value={v.vehicle_name}>{v.vehicle_name}{v.vehicle_number ? ` (${v.vehicle_number})` : ''}</option>)
                                        ) : (
                                            <>
                                                <option value="tata xenon">Tata Xenon (TATA1823)</option>
                                                <option value="Tata Ace">Tata Ace (TA23GH132)</option>
                                                <option value="Self Pickup">Self Pickup</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label style={fieldLabel}>Location <span style={{ color: T.danger }}>*</span></label>
                                    {deliveryLocations.length > 0 ? (
                                        <select className="dso-select" value={deliveryLocation} onChange={e => setDeliveryLocation(e.target.value)}
                                            style={{ ...fieldBase, color: deliveryLocation ? T.ink : T.steel }}>
                                            {deliveryLocations.map((dl, i) => <option key={i} value={dl.delivery_location}>{dl.location_name}</option>)}
                                        </select>
                                    ) : (
                                        <input className="dso-input" type="text" placeholder="Enter location" value={deliveryLocation}
                                            onChange={e => setDeliveryLocation(e.target.value)} style={{ ...fieldBase }} />
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>{/* /dso-right-scroll */}
                </div>{/* /dso-right-panel */}

                {/* ── PRODUCTS PANEL — second in DOM = second on mobile, left on desktop ── */}
                <div className="dso-left-panel">
                    <div className="dso-left-scroll">

                        {/* ── Product Catalog ────────────────────────────────────── */}
                        <div className="dso-card2">

                            {/* Catalog header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>🛒</div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: T.steel, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 2</p>
                                        <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Product Catalog</h2>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {/* Edit Top Picks Action Bar */}
                                    {viewMode === 'top_picks' && customerLedger && (
                                        <>
                                            {editTopPicksMode ? (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button type="button" onClick={() => setEditTopPicksMode(false)}
                                                        style={{ background: T.cloud, color: T.ink, border: 'none', padding: '5px 12px', borderRadius: T.rSm, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        Cancel
                                                    </button>
                                                    <button type="button" onClick={() => {
                                                        SalesService.updateDistributorTopPicks(customerLedger, topPicks)
                                                            .then(() => {
                                                                swal('Success', 'Top picks updated successfully.', 'success');
                                                                setEditTopPicksMode(false);
                                                            })
                                                            .catch(err => {
                                                                console.error(err);
                                                                swal('Error', 'Failed to update top picks.', 'error');
                                                            });
                                                    }}
                                                        style={{ background: T.accent, color: T.white, border: 'none', padding: '5px 12px', borderRadius: T.rSm, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                        Save Picks
                                                    </button>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => setEditTopPicksMode(true)}
                                                    style={{ background: T.accentSoft, color: T.accent, border: 'none', padding: '5px 12px', borderRadius: T.rSm, fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    ✎ Edit Picks
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: T.accent, background: T.accentSoft, padding: '4px 10px', borderRadius: '20px', border: `1px solid rgba(59,91,219,0.18)` }}>
                                        {filteredStockItems.length} items
                                    </span>
                                </div>
                            </div>

                            {/* Pill toggle tabs */}
                            <div style={{ display: 'flex', background: T.cloud, borderRadius: T.rMd, padding: '4px', gap: '4px', marginBottom: '14px' }}>
                                {[
                                    { key: 'top_picks', icon: '⭐', label: 'Top Picks', count: customerLedger ? topPicksStockItems.length : null },
                                    { key: 'recent', icon: '⏱', label: 'Recent', count: customerLedger ? recentStockItems.length : null },
                                    { key: 'all', icon: '📦', label: 'All', count: stockItems.length },
                                ].map(({ key, icon, label, count }) => {
                                    const active = viewMode === key;
                                    return (
                                        <button key={key} className="dso-tab-btn" type="button" onClick={() => { setViewMode(key); setEditTopPicksMode(false); }}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: '10px', border: 'none',
                                                background: active ? T.white : 'transparent',
                                                color: active ? T.accent : T.slate,
                                                fontSize: '0.8rem', fontWeight: active ? '700' : '500',
                                                cursor: 'pointer', boxShadow: active ? '0 1px 3px rgba(15,22,36,0.06)' : 'none',
                                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            }}>
                                            <span>{icon} {label}</span>
                                            {count !== null && (
                                                <span style={{ background: active ? T.accentSoft : 'rgba(0,0,0,0.07)', color: active ? T.accent : T.slate, borderRadius: '8px', fontSize: '0.66rem', padding: '1px 6px', fontWeight: '700' }}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>


                            {/* Search bar */}
                            <div style={{ position: 'relative', marginBottom: '14px' }}>
                                <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: T.steel, fontSize: '0.88rem', pointerEvents: 'none' }}>🔍</span>
                                <input className="dso-input" type="text" placeholder="Search products…"
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                    style={{ ...fieldBase, paddingLeft: '38px' }} />
                            </div>

                            {/* Product Layout */}
                            <div style={{
                                display: viewMode === 'top_picks' ? 'grid' : 'flex',
                                gridTemplateColumns: viewMode === 'top_picks' ? 'repeat(auto-fill, minmax(180px, 1fr))' : 'none',
                                flexDirection: viewMode === 'top_picks' ? 'row' : 'column',
                                gap: viewMode === 'top_picks' ? '16px' : '8px'
                            }}>
                                {filteredStockItems.length > 0 ? (
                                    filteredStockItems.map(item => {
                                        const qty = cart[item.id] || 0;
                                        const rate = priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0);
                                        const inCart = qty > 0;
                                        const isPickSelected = topPicks.includes(String(item.id)) || topPicks.includes(Number(item.id));
                                        const isSelected = editTopPicksMode && isPickSelected;

                                        return viewMode === 'top_picks' ? (
                                            <div key={item.id} className="dso-product-card" 
                                                onClick={() => {
                                                    if (editTopPicksMode) {
                                                        if (isPickSelected) {
                                                            setTopPicks(topPicks.filter(id => String(id) !== String(item.id)));
                                                        } else {
                                                            setTopPicks([...topPicks, item.id]);
                                                        }
                                                    }
                                                }}
                                                style={{
                                                background: isSelected ? '#f0f4ff' : (inCart ? '#fafbff' : T.white),
                                                borderRadius: T.rLg, padding: '16px',
                                                boxShadow: inCart ? `0 4px 16px ${T.accentGlow}` : '0 2px 5px rgba(15,22,36,0.06)',
                                                border: isSelected ? `2px solid ${T.accent}` : (inCart ? `1.5px solid rgba(59,91,219,0.28)` : `1px solid rgba(15,22,36,0.08)`),
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                                                position: 'relative', overflow: 'hidden', textAlign: 'center',
                                                cursor: editTopPicksMode ? 'pointer' : 'default',
                                                transition: 'all 0.2s ease',
                                            }}>
                                                {/* Top accent stripe */}
                                                {inCart && <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '3px', background: T.accent }} />}

                                                {/* Thumbnail */}
                                                <div style={{
                                                    width: '84px', height: '84px', borderRadius: '12px', flexShrink: 0,
                                                    background: isSelected || inCart ? T.accentSoft : T.cloud,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                                    border: `1px solid ${isSelected || inCart ? 'rgba(59,91,219,0.16)' : 'transparent'}`,
                                                    marginTop: '4px'
                                                }}>
                                                    {item.image
                                                        ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <span style={{ fontSize: '2rem', opacity: 0.5 }}>📦</span>}
                                                </div>

                                                {/* Info */}
                                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                                    <h3 title={item.name} style={{ fontSize: '0.8rem', fontWeight: '700', color: T.ink, margin: '0 0 4px', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                                                        {item.name}
                                                    </h3>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: T.accent }}>{rate.toFixed(2)}</span>
                                                        <span style={{ fontSize: '0.65rem', color: T.steel, textTransform: 'uppercase ', fontWeight: '600' }}>/ {item.base_unit_name || 'Unit'}</span>
                                                    </div>
                                                </div>

                                                {/* Qty controls or Top Picks Edit */}
                                                {!editTopPicksMode && (
                                                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
                                                    {qty === 0 ? (
                                                        <button className="dso-add-btn" onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1); }}
                                                            style={{
                                                                background: T.accentSoft, color: T.accent, width: '100%',
                                                                border: `1.5px solid rgba(59,91,219,0.22)`, borderRadius: '8px',
                                                                padding: '6px 10px', fontSize: '0.75rem', fontWeight: '700',
                                                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', whiteSpace: 'nowrap',
                                                            }}>+ Add</button>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1,
                                                                background: T.accent, borderRadius: '8px',
                                                                padding: '4px 6px', boxShadow: T.shAccent,
                                                            }}>
                                                                <button onClick={() => updateQuantity(item.id, -1)}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                                                        fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                                                                        padding: '2px 8px', lineHeight: 1, borderRadius: '5px',
                                                                        fontFamily: 'inherit', transition: 'background 0.15s',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                                >−</button>
                                                                <input className="dso-no-spinners" type="number" min="0" value={qty}
                                                                    onChange={(e) => setQuantity(item.id, e.target.value)}
                                                                    style={{
                                                                        width: '32px', background: 'transparent', border: 'none', color: '#fff',
                                                                        fontSize: '0.8rem', fontWeight: '800', textAlign: 'center', fontFamily: 'inherit',
                                                                        outline: 'none'
                                                                    }}
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                                <button onClick={() => updateQuantity(item.id, 1)}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                                                        fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                                                                        padding: '2px 8px', lineHeight: 1, borderRadius: '5px',
                                                                        fontFamily: 'inherit', transition: 'background 0.15s',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                                >+</button>
                                                            </div>
                                                            <button onClick={() => setQuantity(item.id, 0)}
                                                                style={{
                                                                    fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontFamily: 'inherit', transition: 'background 0.15s', paddingBottom: '2px'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.15)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = T.cloud}
                                                            >×</button>
                                                        </div>
                                                    )}
                                                </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div key={item.id} className="dso-product-row" style={{
                                                background: inCart ? '#fafbff' : T.white,
                                                borderRadius: T.rLg, padding: '13px 14px',
                                                boxShadow: inCart ? `0 4px 16px ${T.accentGlow}` : '0 1px 3px rgba(15,22,36,0.06)',
                                                border: inCart ? `1.5px solid rgba(59,91,219,0.28)` : `1px solid rgba(15,22,36,0.07)`,
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                position: 'relative', overflow: 'hidden',
                                            }}>
                                                {/* Left accent stripe */}
                                                {inCart && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: T.accent, borderRadius: '16px 0 0 16px' }} />}

                                                {/* Thumbnail */}
                                                <div style={{
                                                    width: '50px', height: '50px', borderRadius: '12px', flexShrink: 0,
                                                    background: inCart ? T.accentSoft : T.cloud,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                                    border: `1px solid ${inCart ? 'rgba(59,91,219,0.16)' : 'transparent'}`,
                                                }}>
                                                    {item.image
                                                        ? <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <span style={{ fontSize: '1.25rem', opacity: 0.5 }}>📦</span>}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h3 style={{ fontSize: '0.85rem', fontWeight: '600', color: T.ink, margin: '0 0 5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {item.name}
                                                    </h3>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: T.accent }}>{rate.toFixed(2)}</span>
                                                        <span style={{ fontSize: '0.67rem', color: T.steel, textTransform: 'uppercase ', fontWeight: '600' }}>/ {item.base_unit_name || 'Unit'}</span>
                                                        {(itemGstRates[item.id]?.igst || 0) > 0 && (
                                                            <span style={{ fontSize: '0.62rem', color: T.slate, background: T.cloud, padding: '2px 6px', borderRadius: '5px', fontWeight: '600' }}>
                                                                GST {itemGstRates[item.id].igst}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    {inCart && (
                                                        <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: T.accent, fontWeight: '700' }}>
                                                            Subtotal: {(qty * rate).toFixed(2)}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Qty controls */}
                                                <div style={{ flexShrink: 0 }}>
                                                    {qty === 0 ? (
                                                        <button className="dso-add-btn" onClick={() => updateQuantity(item.id, 1)}
                                                            style={{
                                                                background: T.accentSoft, color: T.accent,
                                                                border: `1.5px solid rgba(59,91,219,0.22)`, borderRadius: '10px',
                                                                padding: '7px 14px', fontSize: '0.78rem', fontWeight: '700',
                                                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s', whiteSpace: 'nowrap',
                                                            }}>+ Add</button>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', gap: '2px',
                                                                background: T.accent, borderRadius: '10px',
                                                                padding: '4px 6px', boxShadow: T.shAccent,
                                                            }}>
                                                                <button onClick={() => updateQuantity(item.id, -1)}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                                                        fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                                                                        padding: '2px 7px', lineHeight: 1, borderRadius: '7px',
                                                                        fontFamily: 'inherit', transition: 'background 0.15s',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                                >−</button>
                                                                <input className="dso-no-spinners" type="number" min="0" value={qty}
                                                                    onChange={(e) => setQuantity(item.id, e.target.value)}
                                                                    style={{
                                                                        width: '36px', background: 'transparent', border: 'none', color: '#fff',
                                                                        fontSize: '0.85rem', fontWeight: '800', textAlign: 'center', fontFamily: 'inherit',
                                                                        outline: 'none'
                                                                    }}
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                                <button onClick={() => updateQuantity(item.id, 1)}
                                                                    style={{
                                                                        background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                                                                        fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
                                                                        padding: '2px 7px', lineHeight: 1, borderRadius: '7px',
                                                                        fontFamily: 'inherit', transition: 'background 0.15s',
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                                >+</button>
                                                            </div>
                                                            <button onClick={() => setQuantity(item.id, 0)}
                                                                style={{
                                                                    background: T.cloud, border: 'none', color: T.danger,
                                                                    fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer',
                                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontFamily: 'inherit', transition: 'background 0.15s', paddingBottom: '2px'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.15)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = T.cloud}
                                                            >×</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px 16px', color: T.slate, background: T.white, borderRadius: T.rLg, border: `1.5px dashed ${T.cloud}` }}>
                                        {!customerLedger && viewMode === 'recent' ? (
                                            <>
                                                <p style={{ margin: '0 0 12px', fontSize: '0.83rem', fontWeight: '500' }}>Select a customer to see their recently ordered items.</p>
                                                <button type="button" onClick={() => setViewMode('all')}
                                                    style={{ background: T.accentSoft, color: T.accent, border: 'none', padding: '7px 14px', borderRadius: T.rSm, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    Browse All Items
                                                </button>
                                            </>
                                        ) : customerLedger && viewMode === 'recent' && recentStockItems.length === 0 ? (
                                            <>
                                                <p style={{ margin: '0 0 12px', fontSize: '0.83rem', fontWeight: '500' }}>No recent orders found for this customer.</p>
                                                <button type="button" onClick={() => setViewMode('all')}
                                                    style={{ background: T.accentSoft, color: T.accent, border: 'none', padding: '7px 14px', borderRadius: T.rSm, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                    Show All Items
                                                </button>
                                            </>
                                        ) : (
                                            <p style={{ margin: 0, fontSize: '0.83rem' }}>No products match your search.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>{/* /dso-left-scroll */}
                </div>{/* /dso-left-panel */}

            </div>{/* /dso-body */}

            {/* ── Checkout Footer — direct child of wrapper ─────────────
                Mobile : sits at the bottom of the 100vh flex column (pinned)
                Desktop: CSS repositions it to bottom of the right panel column
            ───────────────────────────────────────────────────────────── */}
            {totalItems > 0 && (
                <div className="dso-checkout-footer" style={{
                    background: T.white,
                    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                    boxShadow: '0 -8px 32px rgba(15,22,36,0.10)',
                    padding: '14px 20px 28px',
                    borderTop: `1px solid ${T.cloud}`,
                    flexShrink: 0,
                }}>
                    {/* Drag handle (mobile only) */}
                    <div style={{ width: '36px', height: '3px', borderRadius: '2px', background: T.cloud, margin: '0 auto 14px' }} />

                    {/* Price breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: T.slate }}>
                            <span>Subtotal ({totalItems} items)</span>
                            <span>{subtotal.toFixed(2)}</span>
                        </div>
                        {orderType === 'INTER_STATE' ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: T.slate }}>
                                <span>IGST</span><span>{igstTotal.toFixed(2)}</span>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: T.slate }}>
                                    <span>CGST</span><span>{cgstTotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: T.slate }}>
                                    <span>SGST</span><span>{sgstTotal.toFixed(2)}</span>
                                </div>
                            </>
                        )}
                        <div style={{ borderBottom: `1px dashed ${T.cloud}`, margin: '5px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '800', color: T.ink }}>
                            <span>Total</span>
                            <span style={{ color: T.accent, fontSize: '1.1rem' }}>{grandTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* CTA button */}
                    <button className="dso-checkout-btn" onClick={handlePlaceOrder}
                        style={{
                            width: '100%', padding: '15px',
                            background: 'linear-gradient(135deg, #2c4acc 0%, #3b5bdb 100%)',
                            color: '#fff', border: 'none', borderRadius: T.rMd,
                            fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
                            boxShadow: '0 6px 20px rgba(59,91,219,0.30)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                            transition: 'all 0.18s ease', fontFamily: 'inherit', letterSpacing: '0.01em',
                        }}>
                        <span>Place Sales Order</span>
                        <span style={{ background: 'rgba(255,255,255,0.18)', padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                            {totalItems} {totalItems === 1 ? 'item' : 'items'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DistributorSalesOrder;