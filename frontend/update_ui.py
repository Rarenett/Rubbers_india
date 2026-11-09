import os

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrdersModule.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace header
old_header = """                            {/* Section label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '6px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>🚚</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: T.steel, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 1</p>
                                    <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Delivery Details</h2>
                                </div>
                            </div>"""
new_header = """                            {/* Section label */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', marginTop: '6px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: T.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>👤</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: T.steel, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Step 1</p>
                                    <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: T.ink }}>Customer Details</h2>
                                </div>
                            </div>"""
content = content.replace(old_header, new_header)

# State update
old_state = "const [vehicleType, setVehicleType] = useState('');"
new_state = "const [vehicleType, setVehicleType] = useState('');\n    const [newCustomerName, setNewCustomerName] = useState('');"
content = content.replace(old_state, new_state)

# Payload update
old_payload = "customer_ledger: parseInt(customerLedger),"
new_payload = "customer_ledger: parseInt(customerLedger) || null, new_customer_name: newCustomerName,"
content = content.replace(old_payload, new_payload)

# UI Replacement
old_ui = """                            {/* Vehicle + Location */}
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
                            </div>"""

new_ui = """                            {/* New Customer Name */}
                            <div style={{ marginBottom: '14px' }}>
                                <label style={fieldLabel}>New Customer Name <span style={{ textTransform: 'none', fontWeight: '500', color: T.slate }}>(If not in list)</span></label>
                                <input className="dso-input" type="text" placeholder="Enter new customer name..." value={newCustomerName}
                                    onChange={e => setNewCustomerName(e.target.value)} style={{ ...fieldBase }} />
                            </div>"""

content = content.replace(old_ui, new_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Customer Details UI in OrdersModule.jsx")
