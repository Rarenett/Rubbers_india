import os

file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import SpotAppointmentView
import_target = "import EntryTagFormModal from './EntryTagFormModal';"
import_replacement = "import EntryTagFormModal from './EntryTagFormModal';\nimport SpotAppointmentView from './SpotAppointmentView';"

if import_target not in content:
    print("ERROR: import_target not found")
    exit(1)

content = content.replace(import_target, import_replacement, 1)

# 2. Add state appointmentModalView
state_target = "const [todayAppointments, setTodayAppointments] = useState([]);"
state_replacement = "const [todayAppointments, setTodayAppointments] = useState([]);\n    const [appointmentModalView, setAppointmentModalView] = useState('list'); // 'list' | 'create'"

if state_target not in content:
    print("ERROR: state_target not found")
    exit(1)

content = content.replace(state_target, state_replacement, 1)

# 3. In handleShowAppointments, reset appointmentModalView to 'list'
handle_target = """    const handleShowAppointments = async () => {
        try {
            setLoadingAppointments(true);
            setShowAppointmentsModal(true);"""

handle_replacement = """    const handleShowAppointments = async () => {
        try {
            setLoadingAppointments(true);
            setAppointmentModalView('list');
            setShowAppointmentsModal(true);"""

if handle_target not in content:
    print("ERROR: handle_target not found")
    exit(1)

content = content.replace(handle_target, handle_replacement, 1)

# 4. Replace Appointments Modal with enhanced version
old_modal = """            {/* Appointments Modal */}
            <Modal
                show={showAppointmentsModal}
                onHide={() => setShowAppointmentsModal(false)}
                centered
                size="lg"
                enforceFocus={false}
                style={{ zIndex: 1060 }}
                className="item-custom-modal"
                backdrop="static"
            >
                <div className="modal-header-custom py-3 px-4">
                    <h5 className="mb-0 fw-bold" style={{ fontSize: '16px', color: '#1e293b' }}>Appointments</h5>
                    <button type="button" className="modal-close-x" onClick={() => setShowAppointmentsModal(false)}>&times;</button>
                </div>
                <Modal.Body className="p-0">
                    {loadingAppointments ? (
                        <div className="text-center p-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="text-muted mt-3 mb-0">Loading appointments...</p>
                        </div>
                    ) : todayAppointments.length === 0 ? (
                        <div className="text-center p-5">
                            <i className="fa fa-calendar-times text-muted fs-1 mb-3"></i>
                            <p className="text-muted mb-0">No appointments scheduled for today.</p>
                        </div>
                    ) : (
                        <ListGroup variant="flush">
                            {todayAppointments.map(app => (
                                <ListGroup.Item 
                                    key={app.id} 
                                    action 
                                    className="d-flex align-items-center p-3 cursor-pointer border-bottom"
                                    onClick={() => {
                                        setShowAppointmentsModal(false);
                                        loadAppointmentData(app.id);
                                    }}
                                >
                                    <div className={`bg-light rounded-circle d-flex align-items-center justify-content-center me-3 text-${app.vehicle_number ? 'success' : 'primary'}`} style={{ width: '45px', height: '45px' }}>
                                        <i className={`fa ${app.vehicle_number ? 'fa-truck' : 'fa-user'} fs-5`}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-1 fw-bold text-dark">{app.vehicle_number ? app.vehicle_number : app.visitor_name}</h6>
                                        <div className="d-flex flex-column gap-1">
                                            <div className="d-flex gap-3 small text-muted">
                                                {app.vehicle_number ? (
                                                    <span><i className="fa fa-car me-1"></i> {app.vehicle_type_name || 'Vehicle'}</span>
                                                ) : (
                                                    <span><i className="fa fa-phone-alt me-1"></i> {app.visitor_phone}</span>
                                                )}
                                                <span><i className="fa fa-clock me-1"></i> {app.appointment_time}</span>
                                            </div>
                                            {(app.contact_person_name || app.contact_number) && (
                                                <div className="d-flex gap-3 small text-secondary">
                                                    {app.contact_person_name && (
                                                        <span><i className="fa fa-id-badge me-1"></i> Contact: {app.contact_person_name}</span>
                                                    )}
                                                    {app.contact_number && (
                                                        <span><i className="fa fa-phone me-1"></i> {app.contact_number}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <Badge bg={app.status === 'approved' ? 'success' : 'warning'}>
                                            {app.status ? app.status.toUpperCase() : 'PENDING'}
                                        </Badge>
                                        <i className="fa fa-chevron-right text-muted small ms-3"></i>
                                    </div>
                                 Antonio
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </Modal.Body>
            </Modal>"""

# Let's check if old_modal exists, or find it more resiliently
new_modal = """            {/* Appointments Modal */}
            <Modal
                show={showAppointmentsModal}
                onHide={() => setShowAppointmentsModal(false)}
                centered
                size="lg"
                enforceFocus={false}
                style={{ zIndex: 1060 }}
                className="item-custom-modal"
                backdrop="static"
            >
                <div className="modal-header-custom py-3 px-4 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: '#e0f2fe', color: '#0284c7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <i className="fa fa-calendar-check" style={{ fontSize: '15px' }}></i>
                        </div>
                        <div>
                            <h5 className="mb-0 fw-bold" style={{ fontSize: '16px', color: '#1e293b' }}>
                                {appointmentModalView === 'create' ? 'Create Spot Appointment' : 'Appointments'}
                            </h5>
                            <small className="text-muted" style={{ fontSize: '11px' }}>
                                {appointmentModalView === 'create' ? 'Register walk-in appointment and link directly to gate entry' : "Today's scheduled appointments"}
                            </small>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {/* View Switcher Pills */}
                        <div className="btn-group p-1" style={{ background: '#f1f5f9', borderRadius: '10px' }}>
                            <button
                                type="button"
                                className={`btn btn-sm ${appointmentModalView === 'list' ? 'bg-white shadow-sm fw-bold text-dark' : 'text-muted'}`}
                                style={{ borderRadius: '8px', fontSize: '12px', padding: '4px 12px', border: 'none' }}
                                onClick={() => setAppointmentModalView('list')}
                            >
                                <i className="fa fa-list me-1"></i> Today's List ({todayAppointments.length})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-sm ${appointmentModalView === 'create' ? 'shadow-sm fw-bold text-white' : 'text-success'}`}
                                style={{
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    padding: '4px 12px',
                                    border: 'none',
                                    background: appointmentModalView === 'create' ? '#2ece8a' : 'transparent'
                                }}
                                onClick={() => setAppointmentModalView('create')}
                            >
                                <i className="fa fa-plus-circle me-1"></i> + Spot Appointment
                            </button>
                        </div>

                        <button type="button" className="modal-close-x" onClick={() => setShowAppointmentsModal(false)}>&times;</button>
                    </div>
                </div>

                <Modal.Body className="p-0">
                    {appointmentModalView === 'create' ? (
                        <SpotAppointmentView
                            initialMode={entryMode}
                            initialSearch={searchMobile}
                            initialVisitor={visitorData}
                            initialVehicle={selectedVehicles?.[0] || null}
                            initialDepartment={formData.department}
                            initialEmployee={formData.employee}
                            initialPurpose={formData.purpose_of_visit}
                            initialCategory={formData.tag_category}
                            categories={categories}
                            isDark={isDark}
                            onSuccess={async (createdApp) => {
                                try {
                                    const appts = await AppointmentService.getTodayAppointments();
                                    setTodayAppointments(appts || []);
                                } catch (_) {}

                                if (createdApp && createdApp.id) {
                                    await loadAppointmentData(createdApp.id);
                                }
                                setShowAppointmentsModal(false);
                            }}
                            onCancel={() => setAppointmentModalView('list')}
                        />
                    ) : loadingAppointments ? (
                        <div className="text-center p-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="text-muted mt-3 mb-0">Loading appointments...</p>
                        </div>
                    ) : todayAppointments.length === 0 ? (
                        <div className="text-center p-5">
                            <i className="fa fa-calendar-times text-muted fs-1 mb-3"></i>
                            <p className="text-muted mb-3">No appointments scheduled for today.</p>
                            <Button
                                variant="success"
                                className="px-3 py-2 fw-bold shadow-sm"
                                style={{ borderRadius: '8px', fontSize: '13px', background: '#2ece8a', borderColor: '#2ece8a' }}
                                onClick={() => setAppointmentModalView('create')}
                            >
                                <i className="fa fa-plus-circle me-2"></i> Create Spot Appointment
                            </Button>
                        </div>
                    ) : (
                        <ListGroup variant="flush">
                            {todayAppointments.map(app => (
                                <ListGroup.Item 
                                    key={app.id} 
                                    action 
                                    className="d-flex align-items-center p-3 cursor-pointer border-bottom"
                                    onClick={() => {
                                        setShowAppointmentsModal(false);
                                        loadAppointmentData(app.id);
                                    }}
                                >
                                    <div className={`bg-light rounded-circle d-flex align-items-center justify-content-center me-3 text-${app.vehicle_number ? 'success' : 'primary'}`} style={{ width: '45px', height: '45px' }}>
                                        <i className={`fa ${app.vehicle_number ? 'fa-truck' : 'fa-user'} fs-5`}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-1 fw-bold text-dark">{app.vehicle_number ? app.vehicle_number : app.visitor_name}</h6>
                                        <div className="d-flex flex-column gap-1">
                                            <div className="d-flex gap-3 small text-muted">
                                                {app.vehicle_number ? (
                                                    <span><i className="fa fa-car me-1"></i> {app.vehicle_type_name || 'Vehicle'}</span>
                                                ) : (
                                                    <span><i className="fa fa-phone-alt me-1"></i> {app.visitor_phone}</span>
                                                )}
                                                <span><i className="fa fa-clock me-1"></i> {app.appointment_time}</span>
                                            </div>
                                            {(app.contact_person_name || app.contact_number) && (
                                                <div className="d-flex gap-3 small text-secondary">
                                                    {app.contact_person_name && (
                                                        <span><i className="fa fa-id-badge me-1"></i> Contact: {app.contact_person_name}</span>
                                                    )}
                                                    {app.contact_number && (
                                                        <span><i className="fa fa-phone me-1"></i> {app.contact_number}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center">
                                        <Badge bg={app.status === 'approved' ? 'success' : 'warning'}>
                                            {app.status ? app.status.toUpperCase() : 'PENDING'}
                                        </Badge>
                                        <i className="fa fa-chevron-right text-muted small ms-3"></i>
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </Modal.Body>
            </Modal>"""

# Find modal range
modal_start = content.find('{/* Appointments Modal */}')
modal_end = content.find('{/* Quick-Add Department Modal */}')

if modal_start == -1 or modal_end == -1:
    print(f"ERROR: modal_start: {modal_start}, modal_end: {modal_end}")
    exit(1)

content = content[:modal_start] + new_modal.strip() + "\n\n            " + content[modal_end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: GateEntryForm.jsx successfully updated!")
