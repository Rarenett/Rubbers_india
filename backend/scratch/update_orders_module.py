import re

filepath = r"c:\Paul@Rarenett\glenda_vite\frontend\src\jsx\components\MarketingConnect\OrdersModule.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. State variables
state_target = """    const [customerLedger, setCustomerLedger] = useState('');
    const [approvedPrices, setApprovedPrices] = useState({});"""
state_replacement = """    const [customerLedger, setCustomerLedger] = useState('');
    const [customerPlace, setCustomerPlace] = useState('');
    const [assignedShops, setAssignedShops] = useState([]);
    const [availableShops, setAvailableShops] = useState([]);
    const [approvedPrices, setApprovedPrices] = useState({});"""
content = content.replace(state_target, state_replacement)

# 2. fetchMasterData 
fetch_target = """                const loadedLedgers = allLedgers.filter(l => approvedCustomerIds.includes(l.id));
                setLedgers(loadedLedgers);"""
fetch_replacement = """                const loadedLedgers = allLedgers.filter(l => approvedCustomerIds.includes(l.id));
                setLedgers(loadedLedgers);

                // Fetch assigned shops for Customer Places dropdown
                try {
                    const assignedRes = await axiosInstance.get('/api/project/marketing/orders/assigned-shops/');
                    let shopsList = [];
                    if (assignedRes.data && assignedRes.data.routes) {
                        assignedRes.data.routes.forEach(r => {
                            if (r.shops) {
                                r.shops.forEach(s => shopsList.push(s));
                            }
                        });
                    }
                    setAssignedShops(shopsList);
                } catch(e) { console.error('Failed to fetch assigned shops', e); }"""
content = content.replace(fetch_target, fetch_replacement)

# 3. useEffect for customerPlace
effect_target = """    useEffect(() => {
        if (!customerLedger) {"""
effect_replacement = """    useEffect(() => {
        if (isDistributor) return;
        if (!customerPlace) {
            setAvailableShops([]);
            setCustomerLedger('');
            return;
        }
        setAvailableShops([]);
        setCustomerLedger('');
        axiosInstance.get(`/api/project/marketing/orders/delivery-location-customers/?delivery_location_id=${customerPlace}`)
            .then(res => setAvailableShops(res.data))
            .catch(err => console.error("Error fetching shops", err));
    }, [customerPlace, isDistributor]);

    useEffect(() => {
        if (!customerLedger) {"""
content = content.replace(effect_target, effect_replacement)

# 4. Clear form logic
clear_target = """            if (window.confirm("Are you sure you want to clear the form?")) {
                setCustomerLedger('');
                setCart({});
            } else {
                setCustomerLedger('');
                setCart({});
            }"""
clear_replacement = """            if (window.confirm("Are you sure you want to clear the form?")) {
                setCustomerPlace('');
                setCustomerLedger('');
                setCart({});
            } else {
                setCustomerPlace('');
                setCustomerLedger('');
                setCart({});
            }"""
content = content.replace(clear_target, clear_replacement)

# 5. Form submission payload
payload_target = """        const payload = {
            order_type: orderType, entry_date: entryDateStr, customer_ledger: parseInt(customerLedger) || null, new_customer_name: newCustomerName,
            gst_ledger_1: orderType === 'INTER_STATE' ? (igstLedger?.id || '') : (cgstLedger?.id || ''),
            gst_amount_1: (orderType === 'INTER_STATE' ? igstTotal : cgstTotal).toFixed(2),
            gst_ledger_2: orderType === 'INTER_STATE' ? '' : (sgstLedger?.id || ''),
            gst_amount_2: (orderType === 'INTER_STATE' ? 0 : sgstTotal).toFixed(2),
            total_amount: grandTotal.toFixed(2),
            narration: `Order created by distributor. Vehicle Type: ${vehicleType}` + (deliveryLocations.length === 0 && deliveryLocation ? ` | Delivery Location: ${deliveryLocation}` : ''),
            is_posted: false, other_reference: 'Distributor App', terms_of_delivery: 'Immediate Delivery',
            dispatch_through: vehicleType, 
            delivery_location: deliveryLocations.length > 0 && deliveryLocation ? parseInt(deliveryLocation) : null,"""
    
payload_replacement = """        const payload = {
            order_type: orderType, entry_date: entryDateStr, customer_ledger: parseInt(customerLedger) || null, new_customer_name: newCustomerName,
            gst_ledger_1: orderType === 'INTER_STATE' ? (igstLedger?.id || '') : (cgstLedger?.id || ''),
            gst_amount_1: (orderType === 'INTER_STATE' ? igstTotal : cgstTotal).toFixed(2),
            gst_ledger_2: orderType === 'INTER_STATE' ? '' : (sgstLedger?.id || ''),
            gst_amount_2: (orderType === 'INTER_STATE' ? 0 : sgstTotal).toFixed(2),
            total_amount: grandTotal.toFixed(2),
            narration: `Order created by distributor. Vehicle Type: ${vehicleType}` + (deliveryLocations.length === 0 && deliveryLocation ? ` | Delivery Location: ${deliveryLocation}` : ''),
            is_posted: false, other_reference: 'Distributor App', terms_of_delivery: 'Immediate Delivery',
            dispatch_through: vehicleType, 
            delivery_location: deliveryLocations.length > 0 && deliveryLocation ? parseInt(deliveryLocation) : (parseInt(customerPlace) || null),"""

if payload_target in content:
    content = content.replace(payload_target, payload_replacement)
    print("Replaced payload_target")
else:
    print("COULD NOT FIND PAYLOAD TARGET")

# 6. UI Dropdowns
ui_target = """                            {/* Customer */}
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
                            </div>"""
ui_replacement = """                            {/* Customer / Customer Places & Shops */}
                            <div style={{ marginBottom: '14px' }}>
                                {isDistributor ? (
                                    <>
                                        <label style={fieldLabel}>Customer <span style={{ color: T.danger }}>*</span></label>
                                        <div style={{ ...fieldBase, background: T.surface, color: T.ink, cursor: 'not-allowed' }}>
                                            {ledgers.find(l => String(l.id) === String(customerLedger))?.name || 'Loading...'}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <label style={fieldLabel}>CUSTOMER PLACES <span style={{ color: T.danger }}>*</span></label>
                                        <select className="dso-select" value={customerPlace} onChange={e => setCustomerPlace(e.target.value)}
                                            style={{ ...fieldBase, color: customerPlace ? T.ink : T.steel, marginBottom: '14px' }}>
                                            <option value="">— Select customer place —</option>
                                            {assignedShops.map(s => <option key={s.shop_id} value={s.shop_id}>{s.shop_name}</option>)}
                                        </select>

                                        <label style={fieldLabel}>SHOPS <span style={{ color: T.danger }}>*</span></label>
                                        <select className="dso-select" value={customerLedger} onChange={e => setCustomerLedger(e.target.value)}
                                            style={{ ...fieldBase, color: customerLedger ? T.ink : T.steel }} disabled={!customerPlace}>
                                            <option value="">— Select shop —</option>
                                            {availableShops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </>
                                )}
                            </div>"""
if ui_target in content:
    content = content.replace(ui_target, ui_replacement)
    print("Replaced UI target")
else:
    print("COULD NOT FIND UI TARGET")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
