import os
import re

file_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Search logic
search_block_old = """
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
                    Swal.fire({
"""
search_block_new = """
            if (Array.isArray(data) && data.length > 1) {
                // Not expected for exact vehicle number, but just in case
                selectVehicle(data[0]);
            } else {
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (vehicle) {
                    selectVehicle(vehicle);
                    setSearchMobile('');
                } else {
                    Swal.fire({
"""
if search_block_old.strip() in content:
    content = content.replace(search_block_old.strip(), search_block_new.strip())
else:
    # Try regex
    content = re.sub(r'setVehicleData\(data\[0\]\);\s*selectVehicle\(data\[0\]\);', r'selectVehicle(data[0]);', content)

# Fix 2: remove setVehicleData(null) from handleSearchVehicle
content = re.sub(r'setVehicleData\(null\);', r'', content)

# Fix 3: handleSubmitVehicle
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
content = re.sub(re.escape(submit_vehicle_old.strip()).replace(r'\ ', r'\s*').replace(r'\n', r'\s*'), submit_vehicle_new.strip(), content)

# Fix 4: reset in handleSubmitVehicle
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
content = re.sub(r'setVehicleData\(null\);\s*setSearchMobile\(\'\'\);', r'setSelectedVehicles([]);\n            setSearchMobile(\'\');', content)

# Fix 5: UI block (the root cause of the crash)
# Let's find the start and end of the block
ui_start = r"\{vehicleData && entryMode === 'vehicle' && \("
ui_end = r"<i className=\"fa fa-times me-1\"></i>Reset\s*</Button>\s*</Col>\s*</Row>\s*</div>\s*\)\}"

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

content = re.sub(ui_start + r".*?" + ui_end, ui_new.strip(), content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated GateEntryForm.jsx successfully via Regex")
