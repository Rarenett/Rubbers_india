import re
path = r'c:\Archana\glenda_vite\frontend\src\jsx\components\AccessPoint\ParkingFee.jsx'
with open(path, 'r', encoding='utf-8') as f:
    code = f.read()

# Remove slots logic
code = re.sub(r'const handleViewSlots = async.*?};', '', code, flags=re.DOTALL)
code = re.sub(r'const \[parentAreas, setParentAreas\] = useState.*?\]\);', '', code, flags=re.DOTALL)
code = re.sub(r'// Fetch parent areas when modal opens.*?\}, \[showModal\]\);', '', code, flags=re.DOTALL)
code = re.sub(r'// Slots State.*?const \[parkingFeeSlots, setParkingFeeSlots\] = useState\(\[\]\);', '', code, flags=re.DOTALL)

# Replace handleSubmit payload
payload = '''const payload = {
                min_minutes: parseInt(formData.min_minutes) || 0,
                max_minutes: formData.max_minutes ? parseInt(formData.max_minutes) : null,
                fee: parseFloat(formData.fee) || 0,
                is_active: formData.is_active
            };'''
code = re.sub(r'const payload = \{.*?\};', payload, code, flags=re.DOTALL)

# Replace validation inside handleSubmit
code = re.sub(r'const trimmedName = \(formData\.name.*?if \(duplicateName\) \{.*?\}', '', code, flags=re.DOTALL)

# Replace filteredAreas
code = re.sub(r'const filteredAreas = parkingFees\.filter\(.*?\];\s*return \(', 'const filteredAreas = parkingFees; return (', code, flags=re.DOTALL)
code = re.sub(r'<div className=\x22search-bar-container.*?</div>\s*<div className=\x22d-flex gap-2', '<div className=\x22d-flex gap-2', code, flags=re.DOTALL)

# Replace Table headers
headers = '''<th><strong>SL NO</strong></th>
                                                <th><strong>DURATION FROM</strong></th>
                                                <th><strong>DURATION TO</strong></th>
                                                <th><strong>FEE (?)</strong></th>
                                                <th><strong>STATUS</strong></th>
                                                <th className=\x22text-end\x22><strong>ACTIONS</strong></th>'''
code = re.sub(r'<th><strong>SL NO</strong></th>.*?<th className=\x22text-end\x22><strong>ACTIONS</strong></th>', headers, code, flags=re.DOTALL)

# Replace Table Body
tbody = '''<td>{index + 1}</td>
                                                        <td>{area.min_minutes} min</td>
                                                        <td>{area.max_minutes ? ${area.max_minutes} min : 'No Limit'}</td>
                                                        <td>?{area.fee}</td>
                                                        <td>
                                                            <span className={adge light badge-}>
                                                                <i className={a fa-circle text- me-1}></i>
                                                                {area.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className=\x22text-end\x22>
                                                            <div className=\x22d-flex justify-content-end align-items-center gap-2\x22>
                                                                {can('parking_fee', 'edit') || can('parking_fee', 'delete') ? (
                                                                    <>
                                                                        <EditButton
                                                                            module=\x22parking_fee\x22
                                                                            onClick={() => handleEdit(area)}
                                                                        />
                                                                        <DeleteButton
                                                                            module=\x22parking_fee\x22
                                                                            onClick={() => handleDelete(area.id, ${area.min_minutes} to )}
                                                                        />
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </td>'''
code = re.sub(r'<td>\{index \+ 1\}.*?</td>\s*</tr>', tbody + '\n                                                    </tr>', code, flags=re.DOTALL)

# Replace Modal form fields
modal_body = '''<Modal.Body className=\x22modal-body-custom\x22>
                        <Form onSubmit={handleSubmit} id=\x22parkingFeeForm\x22>
                            <div className=\x22row\x22>
                                <div className=\x22col-sm-6 mb-3\x22>
                                    <Form.Label className=\x22form-label-custom\x22>Minimum Duration (Minutes) <span className=\x22text-danger\x22>*</span></Form.Label>
                                    <Form.Control
                                        type=\x22number\x22
                                        name=\x22min_minutes\x22
                                        value={formData.min_minutes}
                                        onChange={handleChange}
                                        required
                                        min=\x220\x22
                                        className=\x22form-control-custom\x22
                                    />
                                </div>
                                <div className=\x22col-sm-6 mb-3\x22>
                                    <Form.Label className=\x22form-label-custom\x22>Maximum Duration (Minutes)</Form.Label>
                                    <Form.Control
                                        type=\x22number\x22
                                        name=\x22max_minutes\x22
                                        value={formData.max_minutes}
                                        onChange={handleChange}
                                        min=\x220\x22
                                        placeholder=\x22Leave blank for No Limit\x22
                                        className=\x22form-control-custom\x22
                                    />
                                </div>
                                <div className=\x22col-sm-6 mb-3\x22>
                                    <Form.Label className=\x22form-label-custom\x22>Fee Amount (?) <span className=\x22text-danger\x22>*</span></Form.Label>
                                    <Form.Control
                                        type=\x22number\x22
                                        name=\x22fee\x22
                                        value={formData.fee}
                                        onChange={handleChange}
                                        required
                                        min=\x220\x22
                                        step=\x220.01\x22
                                        className=\x22form-control-custom\x22
                                    />
                                </div>
                                <div className=\x22col-sm-6 mb-3 d-flex align-items-center\x22>
                                    <Form.Check
                                        type=\x22switch\x22
                                        id=\x22is_active\x22
                                        name=\x22is_active\x22
                                        label=\x22Active\x22
                                        checked={formData.is_active}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </Form>
                    </Modal.Body>'''
code = re.sub(r'<Modal\.Body className=\x22modal-body-custom\x22>.*?</Modal\.Body>', modal_body, code, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)

