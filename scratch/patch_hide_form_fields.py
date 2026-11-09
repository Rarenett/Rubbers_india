import os

file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add hasAppointment definition
target_state = "const [appointmentFilterNumber, setAppointmentFilterNumber] = useState('');"
replacement_state = """const [appointmentFilterNumber, setAppointmentFilterNumber] = useState('');
    const hasAppointment = Boolean(formData.appointment || selectedAppointmentData || editEntry);"""

if target_state not in content:
    print("ERROR: target_state not found")
    exit(1)

content = content.replace(target_state, replacement_state, 1)

# 2. Update selectVisitor to auto-check appointments
target_select_visitor = """    const selectVisitor = (visitor) => {
        setVisitorData(visitor);
        setFormData(prev => ({
            ...prev,
            visitor: visitor.id,
            department: visitor.department || prev.department
        }));
        setShowSelectionModal(false);

        Swal.fire({
            icon: 'success',
            title: 'Visitor Found',
            text: `${visitor.visitor_name} has been loaded.`,
            timer: 1500,
            showConfirmButton: false
        });

        // Automatically move focus to Arrival Gate
        setTimeout(() => {
            const gateSelect = document.querySelector('.arrival-gate-select input');
            if (gateSelect) gateSelect.focus();
        }, 300);
    };"""

replacement_select_visitor = """    const selectVisitor = async (visitor) => {
        setVisitorData(visitor);
        setFormData(prev => ({
            ...prev,
            visitor: visitor.id,
            department: visitor.department || prev.department
        }));
        setShowSelectionModal(false);

        // Auto-check appointments for this visitor
        try {
            const appts = await AppointmentService.getTodayAppointments(visitor.mobile_no);
            if (Array.isArray(appts) && appts.length === 1) {
                await loadAppointmentData(appts[0].id);
                Swal.fire({
                    icon: 'success',
                    title: 'Appointment Linked',
                    text: `Found scheduled appointment for ${visitor.visitor_name}.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            } else if (Array.isArray(appts) && appts.length > 1) {
                handleShowAppointments(visitor.mobile_no);
                return;
            }
        } catch (_) {}

        Swal.fire({
            icon: 'info',
            title: 'Visitor Loaded',
            text: `${visitor.visitor_name} loaded. Appointment is required for gate admission.`,
            timer: 2000,
            showConfirmButton: false
        });
    };"""

if target_select_visitor not in content:
    print("ERROR: target_select_visitor not found")
    exit(1)

content = content.replace(target_select_visitor, replacement_select_visitor, 1)

# 3. Update selectVehicle to auto-check appointments
target_select_vehicle = """    const selectVehicle = (vehicle) => {
        setSelectedVehicles(prev => {
            if (prev.find(v => v.id === vehicle.id)) return prev;
            return [...prev, vehicle];
        });
        setFormData(prev => ({
            ...prev,
            company: vehicle.company || prev.company,
            driver: prev.driver ? `${prev.driver}, ${vehicle.driver || ''}` : (vehicle.driver || '')
        }));

        Swal.fire({
            icon: 'success',
            title: 'Vehicle Found',
            text: `${vehicle.vehicle_number} details loaded.`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            setTimeout(() => {
                const gateSelect = document.querySelector('.arrival-gate-select input');
                if (gateSelect) gateSelect.focus();
            }, 100);
        });
    };"""

replacement_select_vehicle = """    const selectVehicle = async (vehicle) => {
        setSelectedVehicles(prev => {
            if (prev.find(v => v.id === vehicle.id)) return prev;
            return [...prev, vehicle];
        });
        setFormData(prev => ({
            ...prev,
            company: vehicle.company || prev.company,
            driver: prev.driver ? `${prev.driver}, ${vehicle.driver || ''}` : (vehicle.driver || '')
        }));

        // Auto-check appointments for this vehicle
        try {
            const appts = await AppointmentService.getTodayAppointments(vehicle.vehicle_number);
            if (Array.isArray(appts) && appts.length === 1) {
                await loadAppointmentData(appts[0].id);
                Swal.fire({
                    icon: 'success',
                    title: 'Appointment Linked',
                    text: `Found scheduled appointment for ${vehicle.vehicle_number}.`,
                    timer: 1500,
                    showConfirmButton: false
                });
                return;
            } else if (Array.isArray(appts) && appts.length > 1) {
                handleShowAppointments(vehicle.vehicle_number);
                return;
            }
        } catch (_) {}

        Swal.fire({
            icon: 'info',
            title: 'Vehicle Loaded',
            text: `${vehicle.vehicle_number} loaded. Appointment is required for gate admission.`,
            timer: 2000,
            showConfirmButton: false
        });
    };"""

if target_select_vehicle not in content:
    print("ERROR: target_select_vehicle not found")
    exit(1)

content = content.replace(target_select_vehicle, replacement_select_vehicle, 1)

# 4. In handleSubmit and handleSubmitVehicle, require appointment
target_submit_veh = """    const handleSubmitVehicle = async () => {
        if (selectedVehicles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select at least one registered vehicle first.'
            });
            return;
        }"""

replacement_submit_veh = """    const handleSubmitVehicle = async () => {
        if (selectedVehicles.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select at least one registered vehicle first.'
            });
            return;
        }

        if (!hasAppointment) {
            Swal.fire({
                icon: 'warning',
                title: 'Appointment Required',
                text: 'Cannot admit vehicle without an appointment. Please select or create an appointment.'
            });
            return;
        }"""

if target_submit_veh not in content:
    print("ERROR: target_submit_veh not found")
    exit(1)

content = content.replace(target_submit_veh, replacement_submit_veh, 1)

target_submit_vis = """        if (!formData.visitor || !visitorData) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select a registered visitor first.'
            }).then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }"""

replacement_submit_vis = """        if (!formData.visitor || !visitorData) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Error',
                text: 'Please verify and select a registered visitor first.'
            }).then(() => {
                const mobileInput = document.getElementById('searchMobileInput');
                if (mobileInput) mobileInput.focus();
            });
            return;
        }

        if (!hasAppointment) {
            Swal.fire({
                icon: 'warning',
                title: 'Appointment Required',
                text: 'Cannot admit visitor without an appointment. Please select or create an appointment.'
            });
            return;
        }"""

if target_submit_vis not in content:
    print("ERROR: target_submit_vis not found")
    exit(1)

content = content.replace(target_submit_vis, replacement_submit_vis, 1)

# 5. Conditionally render Entry Information Form
form_start_marker = "{/* Entry Details Form */}\n            <Form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} onFocus={handleFocusField}>"
form_end_marker = "            </Form>\n\n            {/* Multiple Visitor Selection Modal */}"

if form_start_marker not in content:
    print("ERROR: form_start_marker not found")
    exit(1)

if form_end_marker not in content:
    print("ERROR: form_end_marker not found")
    exit(1)

idx_start = content.find(form_start_marker)
idx_end = content.find(form_end_marker) + len("            </Form>")

original_form = content[idx_start:idx_end]

appointment_required_block = """{hasAppointment ? (
""" + original_form + """
            ) : (
                /* Appointment Required State - Hides form fields until appointment is connected */
                <div className="p-4 my-3 rounded-3 text-center border shadow-sm" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-sm"
                        style={{ width: '54px', height: '54px', background: '#fef3c7', color: '#d97706' }}
                    >
                        <i className="fa fa-calendar-check" style={{ fontSize: '24px' }}></i>
                    </div>

                    <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '16px' }}>
                        Appointment Required for Admission
                    </h5>

                    <p className="text-muted small mb-3" style={{ maxWidth: '500px', margin: '0 auto' }}>
                        {visitorData
                            ? `Visitors cannot be admitted without an appointment. Please select an existing appointment for ${visitorData.visitor_name} (${visitorData.mobile_no}) or create a spot appointment to unlock entry details.`
                            : selectedVehicles.length > 0
                                ? `Vehicles cannot be admitted without an appointment. Please select an existing appointment for ${selectedVehicles[0].vehicle_number} or create a spot appointment to unlock entry details.`
                                : 'Visitors and vehicles cannot be admitted without an appointment. Please search for a visitor/vehicle or check scheduled appointments to begin.'
                        }
                    </p>

                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mb-2">
                        <Button
                            variant="warning"
                            className="px-3 py-2 fw-bold text-white shadow-sm d-flex align-items-center gap-2"
                            style={{ borderRadius: '8px', fontSize: '13px' }}
                            onClick={() => handleShowAppointments(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || searchMobile)}
                        >
                            <i className="fa fa-calendar-alt"></i>
                            <span>Check Appointments {visitorData ? `for ${visitorData.visitor_name}` : selectedVehicles.length > 0 ? `for ${selectedVehicles[0].vehicle_number}` : ''}</span>
                        </Button>

                        <Button
                            variant="success"
                            className="px-3 py-2 fw-bold shadow-sm d-flex align-items-center gap-2"
                            style={{ borderRadius: '8px', fontSize: '13px', background: '#2ece8a', borderColor: '#2ece8a' }}
                            onClick={() => {
                                setAppointmentFilterNumber(visitorData?.mobile_no || selectedVehicles?.[0]?.vehicle_number || (searchMobile || '').trim());
                                setAppointmentModalView('create');
                                setShowAppointmentsModal(true);
                            }}
                        >
                            <i className="fa fa-plus-circle"></i>
                            <span>+ Create Spot Appointment</span>
                        </Button>
                    </div>

                    <div className="mt-3 pt-3 border-top d-flex justify-content-end">
                        <Button
                            type="button"
                            variant="light"
                            size="sm"
                            className="px-3 text-secondary border fw-medium"
                            style={{ borderRadius: '6px' }}
                            onClick={() => {
                                if (onClose) onClose();
                                else navigate('/access-point/gate-entries');
                            }}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            )}"""

content = content[:idx_start] + appointment_required_block + content[idx_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: GateEntryForm.jsx successfully updated to hide form fields until appointment is present!")
