import os
import re

file_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update formData initial state
form_data_old = """
        company: '',
        driver: '',
        purpose: '',
        material_details: '',
        parking_location: ''
    });
"""
form_data_new = """
        company: '',
        driver: '',
        purpose: '',
        material_details: '',
        parking_location: '',
        number_of_persons: 1,
        expected_time_of_exit: ''
    });
"""
content = content.replace(form_data_old.strip(), form_data_new.strip())

# 2. Update vehicleData to selectedVehicles
vehicle_data_old = "const [vehicleData, setVehicleData] = useState(null);"
vehicle_data_new = "const [selectedVehicles, setSelectedVehicles] = useState([]);"
content = content.replace(vehicle_data_old, vehicle_data_new)

# 3. History fetch update
history_old = """
            if (!visitorData && !vehicleData) {
                setEngagementHistory([]);
                return;
            }
"""
history_new = """
            if (!visitorData && selectedVehicles.length === 0) {
                setEngagementHistory([]);
                return;
            }
"""
content = content.replace(history_old.strip(), history_new.strip())

history_old2 = """
                } else if (vehicleData && entryMode === 'vehicle') {
                    const response = await getVehicleEntries({ vehicle: vehicleData.id });
                    setEngagementHistory(response.results || response || []);
                }
"""
history_new2 = """
                } else if (selectedVehicles.length > 0 && entryMode === 'vehicle') {
                    // For history, just use the first vehicle selected
                    const response = await getVehicleEntries({ vehicle: selectedVehicles[0].id });
                    setEngagementHistory(response.results || response || []);
                }
"""
content = content.replace(history_old2.strip(), history_new2.strip())

# 4. Dependency array update
content = content.replace("}, [visitorData, vehicleData, entryMode]);", "}, [visitorData, selectedVehicles, entryMode]);")

# 5. Search logic updates
search_vehicle_old = """
            if (Array.isArray(data) && data.length > 1) {
                // Not expected for exact vehicle number, but just in case
                setVehicleData(data[0]);
                selectVehicle(data[0]);
            } else {
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (vehicle) {
                    selectVehicle(vehicle);
                    setSearchMobile('');
                } else {
"""
search_vehicle_new = """
            if (Array.isArray(data) && data.length > 1) {
                // Not expected for exact vehicle number, but just in case
                selectVehicle(data[0]);
            } else {
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (vehicle) {
                    selectVehicle(vehicle);
                    setSearchMobile('');
                } else {
"""
content = content.replace(search_vehicle_old.strip(), search_vehicle_new.strip())

# 6. selectVehicle logic
select_vehicle_old = """
    const selectVehicle = (vehicle) => {
        setVehicleData(vehicle);
        setFormData(prev => ({
            ...prev,
            company: vehicle.company || prev.company,
            driver: vehicle.driver || prev.driver
        }));
"""
select_vehicle_new = """
    const selectVehicle = (vehicle) => {
        setSelectedVehicles(prev => {
            if (prev.find(v => v.id === vehicle.id)) return prev;
            return [...prev, vehicle];
        });
        setFormData(prev => ({
            ...prev,
            company: vehicle.company || prev.company,
            driver: prev.driver ? `${prev.driver}, ${vehicle.driver || ''}` : (vehicle.driver || '')
        }));
"""
content = content.replace(select_vehicle_old.strip(), select_vehicle_new.strip())

# 7. handleSubmitVehicle
submit_vehicle_old = """
    const handleSubmitVehicle = async () => {
        if (!vehicleData) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select a registered vehicle first.'
            });
            return;
        }

        if (!formData.entry_gate) {
            Swal.fire('Validation Error', 'Arrival Gate is required.', 'warning');
            return;
        }
        if (!formData.driver) {
            Swal.fire('Validation Error', 'Driver Name is required.', 'warning');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                vehicle: vehicleData.id,
                driver: formData.driver,
                company: formData.company,
                purpose: formData.purpose_of_visit,
                material_details: formData.material_details,
                parking_location: formData.parking_location,
                entry_gate: formData.entry_gate,
                vehicle_pass: formData.generated_tag || null
            };
"""
submit_vehicle_new = """
    const handleSubmitVehicle = async () => {
        if (selectedVehicles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select at least one registered vehicle first.'
            });
            return;
        }

        if (!formData.entry_gate) {
            Swal.fire('Validation Error', 'Arrival Gate is required.', 'warning');
            return;
        }
        if (!formData.driver) {
            Swal.fire('Validation Error', 'Driver Name is required.', 'warning');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                vehicles: selectedVehicles.map(v => v.id),
                driver: formData.driver,
                company: formData.company,
                purpose: formData.purpose_of_visit,
                material_details: formData.material_details,
                parking_location: formData.parking_location,
                entry_gate: formData.entry_gate,
                vehicle_pass: formData.generated_tag || null,
                number_of_persons: parseInt(formData.number_of_persons) || 1,
                expected_time_of_exit: formData.expected_time_of_exit || null
            };
"""
content = content.replace(submit_vehicle_old.strip(), submit_vehicle_new.strip())

# 8. Reset after vehicle submit
reset_vehicle_old = """
            if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
            // reset
            setVehicleData(null);
            setSearchMobile('');
"""
reset_vehicle_new = """
            if (onSuccess) onSuccess(); else navigate('/access-point/gate-entries');
            // reset
            setSelectedVehicles([]);
            setSearchMobile('');
"""
content = content.replace(reset_vehicle_old.strip(), reset_vehicle_new.strip())

# 9. Modify gate entry submit for visitors (add new fields)
submit_visitor_old = """
            const payload = {
                visitor: visitorData.id,
                entry_gate: formData.entry_gate,
                department: formData.department || null,
                employee: formData.employee || null,
                purpose_of_visit: formData.purpose_of_visit,
                generated_tag: formData.generated_tag || null,
                tag_number: tagValue,
                narration: formData.narration,
                is_permission_required: formData.is_permission_required,
                appointment: formData.appointment || null
            };
"""
submit_visitor_new = """
            const payload = {
                visitor: visitorData.id,
                entry_gate: formData.entry_gate,
                department: formData.department || null,
                employee: formData.employee || null,
                purpose_of_visit: formData.purpose_of_visit,
                generated_tag: formData.generated_tag || null,
                tag_number: tagValue,
                narration: formData.narration,
                is_permission_required: formData.is_permission_required,
                appointment: formData.appointment || null,
                number_of_persons: parseInt(formData.number_of_persons) || 1,
                expected_time_of_exit: formData.expected_time_of_exit || null
            };
"""
content = content.replace(submit_visitor_old.strip(), submit_visitor_new.strip())

# 10. Update onVehicleCreated callback
on_created_old = """
                onVehicleCreated={(created) => {
                    setVehicleData(created);
                    setFormData(prev => ({
"""
on_created_new = """
                onVehicleCreated={(created) => {
                    setSelectedVehicles(prev => [...prev, created]);
                    setFormData(prev => ({
"""
content = content.replace(on_created_old.strip(), on_created_new.strip())

# 11. Add UI fields to the form
# Both Visitor and Vehicle have a "Purpose of Visit" or "Material Details" section.
# We will inject the new fields after Arrival Gate and Company, before Purpose.
form_inputs_old = """
                    <Row className="mb-3">
                        <Col md={6} className="mb-3 mb-md-0">
                            <Form.Group>
                                <Form.Label className="form-label-custom">Driver Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="Driver Name"
                                    name="driver"
                                    value={formData.driver}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Material Details</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="E.G. Steel Pipes, Office Supplies..."
                                    name="material_details"
                                    value={formData.material_details}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
"""
form_inputs_new = """
                    <Row className="mb-3">
                        <Col md={6} className="mb-3 mb-md-0">
                            <Form.Group>
                                <Form.Label className="form-label-custom">Driver Name <span className="text-danger">*</span></Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="Driver Name"
                                    name="driver"
                                    value={formData.driver}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Material Details</Form.Label>
                                <Form.Control
                                    type="text"
                                    className="form-control-custom"
                                    placeholder="E.G. Steel Pipes, Office Supplies..."
                                    name="material_details"
                                    value={formData.material_details}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row className="mb-3">
                        <Col md={6} className="mb-3 mb-md-0">
                            <Form.Group>
                                <Form.Label className="form-label-custom">Number of Persons</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    className="form-control-custom"
                                    name="number_of_persons"
                                    value={formData.number_of_persons}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Expected Time of Exit</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    className="form-control-custom"
                                    name="expected_time_of_exit"
                                    value={formData.expected_time_of_exit}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
"""
content = content.replace(form_inputs_old.strip(), form_inputs_new.strip())

visitor_form_inputs_old = """
                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Purpose of Visit <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            className="form-control-custom"
                            placeholder="Write Detailed Purpose Here..."
                            name="purpose_of_visit"
                            value={formData.purpose_of_visit}
                            onChange={handleChange}
                        />
                    </Form.Group>
"""
visitor_form_inputs_new = """
                    <Row className="mb-3">
                        <Col md={6} className="mb-3 mb-md-0">
                            <Form.Group>
                                <Form.Label className="form-label-custom">Number of Persons</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="1"
                                    className="form-control-custom"
                                    name="number_of_persons"
                                    value={formData.number_of_persons}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="form-label-custom">Expected Time of Exit</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    className="form-control-custom"
                                    name="expected_time_of_exit"
                                    value={formData.expected_time_of_exit}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Form.Group className="mb-3">
                        <Form.Label className="form-label-custom">Purpose of Visit <span className="text-danger">*</span></Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            className="form-control-custom"
                            placeholder="Write Detailed Purpose Here..."
                            name="purpose_of_visit"
                            value={formData.purpose_of_visit}
                            onChange={handleChange}
                        />
                    </Form.Group>
"""
content = content.replace(visitor_form_inputs_old.strip(), visitor_form_inputs_new.strip())


# 12. Displaying multiple vehicles in UI
ui_old = """
                {vehicleData && entryMode === 'vehicle' && (
                    <div className="mt-3 p-3 rounded-3 border border-primary bg-white shadow-sm">
                        <Row className="align-items-center">
                            <Col md={1} className="text-center d-none d-md-block">
                                {vehicleData.vehicle_photo ? (
                                    <Image
                                        src={getFullImageUrl(vehicleData.vehicle_photo)}
                                        roundedCircle
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', border: '2px solid #2ece8a' }}
                                    />
                                ) : (
                                    <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto" style={{ width: '50px', height: '50px' }}>
                                        <i className="fa fa-truck fs-5"></i>
                                    </div>
                                )}
                            </Col>
                            <Col md={9}>
                                <h6 className="mb-1 fw-bold text-dark">{vehicleData.vehicle_number}</h6>
                                <div className="d-flex flex-column gap-1">
                                    <div className="d-flex gap-3 small text-muted">
                                        <span><i className="fa fa-building me-1"></i> {vehicleData.company || 'N/A'}</span>
                                        <span><i className="fa fa-user me-1"></i> {vehicleData.driver || 'N/A'}</span>
                                    </div>
                                    {selectedAppointmentData && (
                                        <div className="d-flex flex-wrap gap-3 small mt-1 pt-1 border-top" style={{ borderColor: '#e2e8f0' }}>
                                            <span className="text-secondary">
                                                <i className="fa fa-clock me-1"></i> {selectedAppointmentData.appointment_time}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Col>
                            <Col md={2} className="text-md-end mt-2 mt-md-0">
                                <Button variant="link" size="sm" className="text-danger p-0 fw-bold text-decoration-none" onClick={() => {
                                    setVehicleData(null);
                                    setFormData(prev => ({ ...prev, company: '', driver: '' }));
                                }}>
                                    <i className="fa fa-times me-1"></i>Reset
                                </Button>
                            </Col>
                        </Row>
                    </div>
                )}
"""

ui_new = """
                {selectedVehicles.length > 0 && entryMode === 'vehicle' && (
                    <div className="mt-3">
                        {selectedVehicles.map(vehicle => (
                            <div key={vehicle.id} className="p-3 mb-2 rounded-3 border border-primary bg-white shadow-sm">
                                <Row className="align-items-center">
                                    <Col md={1} className="text-center d-none d-md-block">
                                        {vehicle.vehicle_photo ? (
                                            <Image
                                                src={getFullImageUrl(vehicle.vehicle_photo)}
                                                roundedCircle
                                                style={{ width: '50px', height: '50px', objectFit: 'cover', border: '2px solid #2ece8a' }}
                                            />
                                        ) : (
                                            <div className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto" style={{ width: '50px', height: '50px' }}>
                                                <i className="fa fa-truck fs-5"></i>
                                            </div>
                                        )}
                                    </Col>
                                    <Col md={9}>
                                        <h6 className="mb-1 fw-bold text-dark">{vehicle.vehicle_number}</h6>
                                        <div className="d-flex flex-column gap-1">
                                            <div className="d-flex gap-3 small text-muted">
                                                <span><i className="fa fa-building me-1"></i> {vehicle.company || 'N/A'}</span>
                                                <span><i className="fa fa-user me-1"></i> {vehicle.driver || 'N/A'}</span>
                                            </div>
                                            {selectedAppointmentData && (
                                                <div className="d-flex flex-wrap gap-3 small mt-1 pt-1 border-top" style={{ borderColor: '#e2e8f0' }}>
                                                    <span className="text-secondary">
                                                        <i className="fa fa-clock me-1"></i> {selectedAppointmentData.appointment_time}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                    <Col md={2} className="text-md-end mt-2 mt-md-0">
                                        <Button variant="link" size="sm" className="text-danger p-0 fw-bold text-decoration-none" onClick={() => {
                                            setSelectedVehicles(prev => prev.filter(v => v.id !== vehicle.id));
                                            if (selectedVehicles.length === 1) {
                                                setFormData(prev => ({ ...prev, company: '', driver: '' }));
                                            }
                                        }}>
                                            <i className="fa fa-times me-1"></i>Remove
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        ))}
                    </div>
                )}
"""
content = content.replace(ui_old.strip(), ui_new.strip())

# 13. Update layout condition
layout_old = """
        <Row>
            <Col lg={(visitorData || vehicleData) ? 8 : 12}>
                {formContent}
            </Col>
            {(visitorData || vehicleData) && (
                <Col lg={4}>
                    {rightColumn}
                </Col>
            )}
        </Row>
"""
layout_new = """
        <Row>
            <Col lg={(visitorData || selectedVehicles.length > 0) ? 8 : 12}>
                {formContent}
            </Col>
            {(visitorData || selectedVehicles.length > 0) && (
                <Col lg={4}>
                    {rightColumn}
                </Col>
            )}
        </Row>
"""
content = content.replace(layout_old.strip(), layout_new.strip())

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated GateEntryForm.jsx successfully")
