import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Form, Row, Col, Badge, InputGroup } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { getEmployees, getDepartments } from '../../../services/HRManagementService.js';
import { getMeetingParticipantRecord, saveMeetingParticipants, checkParticipantConflicts } from '../../../services/MeetingManagementService.js';
import { usePermission } from '../../../hooks/usePermission';

const ParticipantManagement = ({ show, onHide, meetingId, meetingTitle }) => {
 const [employees, setEmployees] = useState([]);
 const [departments, setDepartments] = useState([]);
 const [selectedDept, setSelectedDept] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [existingRecord, setExistingRecord] = useState(null);
 // conflictMap: { [userId]: { name, meeting_title, meeting_time } }
 const [conflictMap, setConflictMap] = useState({});
 const { can } = usePermission();

 useEffect(() => {
 if (show && meetingId) {
 fetchData();
 }
 }, [show, meetingId]);

 const fetchData = async () => {
 try {
 setLoading(true);
 const [empData, deptData, participantRecords] = await Promise.all([
 getEmployees(),
 getDepartments(),
 getMeetingParticipantRecord(meetingId)
 ]);

 setEmployees(Array.isArray(empData) ? empData : []);
 setDepartments(Array.isArray(deptData) ? deptData : []);

 if (Array.isArray(participantRecords) && participantRecords.length > 0) {
 const record = participantRecords[0];
 setExistingRecord(record);
 // record.participant is an array of user IDs
 setSelectedParticipantIds(Array.isArray(record.participant) ? record.participant : []);
 } else {
 setExistingRecord(null);
 setSelectedParticipantIds([]);
 }

 // Fetch conflicts upfront for ALL employees (excluding already-saved ones)
 if (empData.length > 0) {
 const checkedSavedIds = Array.isArray(selectedParticipantIds) ? selectedParticipantIds : []; // Use selectedParticipantIds here
 const allUserIds = empData.map(e => e.user).filter(uid => !checkedSavedIds.includes(uid));
 try {
 const conflictResult = await checkParticipantConflicts(meetingId, allUserIds);
 const map = {};
 (conflictResult.conflicts || []).forEach(c => {
 map[c.id] = c; // { id, name, meeting_title, meeting_time }
 });
 setConflictMap(map);
 } catch {
 setConflictMap({});
 }
 }
 } catch (error) {
 console.error("Error fetching participant data:", error);
 Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load data' });
 } finally {
 setLoading(false);
 }
 };

 const handleCheckboxChange = (userId) => {
 setSelectedParticipantIds(prev => {
 const safePrev = Array.isArray(prev) ? prev : [];
 return safePrev.includes(userId)
 ? safePrev.filter(id => id !== userId)
 : [...safePrev, userId];
 });
 };

 const handleSave = async () => {
 try {
 setLoading(true);

 // ── Conflict check: only check newly added participants ──
 // We don't re-check already-saved participants to avoid blocking edits
 const safeParticipants = Array.isArray(selectedParticipantIds) ? selectedParticipantIds : [];
 const existingParticipants = Array.isArray(existingRecord?.participant) ? existingRecord.participant : [];

 const newlyAdded = safeParticipants.filter(
 id => !existingParticipants.includes(id)
 );

 if (newlyAdded.length > 0) {
 // Double-check using current conflictMap (already loaded on open)
 const conflicted = newlyAdded.filter(id => conflictMap[id]);
 if (conflicted.length > 0) {
 const conflictDetails = conflicted.map(id => conflictMap[id]);
 await Swal.fire({
 icon: 'warning',
 title: 'Scheduling Conflict',
 html: `<div style="text-align:left">
 <p>The following participants are already in an <strong>approved meeting</strong> at the same time:</p>
 <ul style="margin-top:8px;padding-left:20px">
 ${conflictDetails.map(c => `<li><strong>${c.name}</strong> — ${c.meeting_title}${c.meeting_time ? ' (' + c.meeting_time + ')' : ''}</li>`).join('')}
 </ul>
 <p style="margin-top:10px">Please deselect them before saving.</p>
 </div>`,
 confirmButtonText: "OK, I'll fix it",
 });
 setLoading(false);
 return;
 }
 }

 const payload = {
 id: existingRecord ? existingRecord.id : null,
 meeting: meetingId,
 participant: selectedParticipantIds
 };

 await saveMeetingParticipants(payload);
 Swal.fire({ icon: 'success', title: 'Success', text: 'Participants saved successfully', timer: 1500 });
 onHide(true);
 } catch (error) {
 Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save participants' });
 } finally {
 setLoading(false);
 }
 };

 // Filter Logic
 const filteredEmployees = useMemo(() => {
 return employees.filter(emp => {
 const matchesDept = selectedDept === 'All' || emp.department === parseInt(selectedDept);
 const fullName = (emp.user_name || '').toLowerCase();
 const matchesSearch = fullName.includes(searchTerm.toLowerCase());
 return matchesDept && matchesSearch;
 });
 }, [employees, selectedDept, searchTerm]);

 const alreadyAdded = useMemo(() => {
 const safeIds = Array.isArray(selectedParticipantIds) ? selectedParticipantIds : [];
 return employees.filter(emp => safeIds.includes(emp.user));
 }, [employees, selectedParticipantIds]);

 const additionalParticipants = useMemo(() => {
 const safeIds = Array.isArray(selectedParticipantIds) ? selectedParticipantIds : [];
 return filteredEmployees.filter(emp =>
 !safeIds.includes(emp.user) && !conflictMap[emp.user]
 );
 }, [filteredEmployees, selectedParticipantIds, conflictMap]);

 // Booked participants filtered by the same dept/search as the main list
 const bookedParticipants = useMemo(() => {
 return filteredEmployees.filter(emp => conflictMap[emp.user]);
 }, [filteredEmployees, conflictMap]);


 return (
 <Modal show={show} onHide={() => onHide(false)} size="xl" centered scrollable fullscreen="lg-down" className="custom-participant-modal">
 <Modal.Header closeButton className="bg-white border-bottom-0 pt-4 px-4">
 <Modal.Title className="w-100">
 <div className="d-flex justify-content-between align-items-center mb-1">
 <span className="small text-muted fw-normal" style={{ fontSize: '0.85rem' }}>Dashboard / Add Participants</span>
 </div>
 <h4 className="fw-bold text-dark mt-1">Add Participants - <span className="text-primary">{meetingTitle}</span></h4>
 </Modal.Title>
 </Modal.Header>
 <Modal.Body className="px-4 pb-4">
 {/* Department Filtering Tabs */}
 <div className="mb-4 pt-2">
 <h6 className="fw-bold mb-3 text-secondary text-uppercase ls-1" style={{ fontSize: '0.75rem' }}>Departments</h6>
 <div className="d-flex flex-wrap gap-2">
 <button
 className={`btn btn-sm px-3 py-2 rounded-3 transition-all ${selectedDept === 'All' ? 'btn-primary shadow-sm' : 'btn-light border text-muted'}`}
 onClick={() => setSelectedDept('All')}
 >
 <i className="fa fa-th-large me-2"></i>All Departments
 </button>
 {departments.map(dept => (
 <button
 key={dept.id}
 className={`btn btn-sm px-3 py-2 rounded-3 transition-all ${selectedDept === dept.id.toString() ? 'btn-primary shadow-sm' : 'btn-light border text-muted'}`}
 onClick={() => setSelectedDept(dept.id.toString())}
 >
 <i className="fa fa-building-o me-2"></i>{dept.name}
 </button>
 ))}
 </div>
 </div>

 {/* Already Added Section */}
 <div className="mb-5">
 <div className="d-flex justify-content-between align-items-end mb-3">
 <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
 Already added participants
 <Badge pill bg="primary" className="ms-2 opacity-75">{alreadyAdded.length}</Badge>
 <Button variant="link" className="p-0 ms-2 text-primary opacity-50 hover-opacity-100"><i className="fa fa-edit"></i></Button>
 </h6>
 <div className="search-box-container" style={{ width: '320px' }}>
 <InputGroup size="sm" className="shadow-none border rounded-pill px-2 bg-light">
 <InputGroup.Text className="bg-transparent border-0 pe-1">
 <i className="fa fa-search text-muted"></i>
 </InputGroup.Text>
 <Form.Control
 placeholder="Search participants..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="bg-transparent border-0 shadow-none py-2"
 />
 </InputGroup>
 </div>
 </div>

 <Row className="g-3">
 {alreadyAdded.map(emp => (
 <Col key={emp.id} xs={12} sm={6} md={4} lg={3} xl={2}>
 <div
 className="participant-card added shadow-sm border-0 rounded-3 p-3 d-flex align-items-center cursor-pointer h-100 transition-all"
 onClick={() => handleCheckboxChange(emp.user)}
 >
 <div className="custom-check-container me-3">
 <div className={`check-mark ${(Array.isArray(selectedParticipantIds) && selectedParticipantIds.includes(emp.user)) ? 'active' : ''}`}>
 <i className="fa fa-check"></i>
 </div>
 </div>
 <span className="fw-semibold text-dark fs-6" style={{ lineHeight: '1.2', flex: 1 }}>
 {emp.user_name}
 </span>
 </div>
 </Col>
 ))}
 {alreadyAdded.length === 0 && (
 <Col xs={12}>
 <div className="text-center py-4 bg-light rounded-3 text-muted italic">No participants added to this meeting yet.</div>
 </Col>
 )}
 </Row>
 </div>

 {/* Select Additional Participants Section */}
 <div>
 <h6 className="fw-bold mb-3 text-secondary text-uppercase ls-1" style={{ fontSize: '0.75rem' }}>Select Additional Participants</h6>
 <Row className="g-3">
 {loading ? (
 <Col xs={12} className="text-center py-5">
 <div className="spinner-border text-primary opacity-25" role="status"></div>
 </Col>
 ) : additionalParticipants.length === 0 ? (
 <Col xs={12} className="text-center py-5 bg-light rounded-3 border border-dashed">
 <i className="fa fa-users-slash d-block fs-2 mb-2 text-muted opacity-25"></i>
 <span className="text-muted">No additional participants found matching your criteria.</span>
 </Col>
 ) : (
 additionalParticipants.map(emp => {
 const conflict = conflictMap[emp.user];
 const isConflicted = !!conflict;
 const tooltip = isConflicted
 ? `Already in "${conflict.meeting_title}"${conflict.meeting_time ? ' at ' + conflict.meeting_time : ''} (Approved)`
 : '';
 return (
 <Col key={emp.id} xs={12} sm={6} md={4} lg={3} xl={2}>
 <div
 className={`participant-card ${isConflicted ? 'conflicted' : 'available'} shadow-sm border border-light rounded-3 p-3 d-flex align-items-center h-100 transition-all ${isConflicted ? '' : 'cursor-pointer'}`}
 onClick={() => !isConflicted && handleCheckboxChange(emp.user)}
 title={tooltip}
 >
 <div className="custom-check-container me-3">
 {isConflicted
 ? <div className="check-mark conflict"><i className="fa fa-ban"></i></div>
 : <div className="check-mark empty"></div>
 }
 </div>
 <span className="fw-medium fs-6" style={{ lineHeight: '1.2', flex: 1, color: isConflicted ? '#9ca3af' : undefined }}>
 {emp.user_name}
 {isConflicted && <small className="d-block" style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Booked</small>}
 </span>
 </div>
 </Col>
 );
 })
 )}
 </Row>
 </div>

 {/* ── Booked / Unavailable Section ── */}
 {bookedParticipants.length > 0 && (
 <div className="mt-4">
 <h6 className="fw-bold mb-3 text-uppercase ls-1" style={{ fontSize: '0.75rem', color: '#ef4444' }}>
 <i className="fa fa-ban me-1"></i>
 Unavailable — Already Booked
 <span style={{ background: '#fee2e2', color: '#ef4444', borderRadius: 50, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
 {bookedParticipants.length}
 </span>
 </h6>
 <Row className="g-3">
 {bookedParticipants.map(emp => {
 const conflict = conflictMap[emp.user];
 return (
 <Col key={emp.id} xs={12} sm={6} md={4} lg={3} xl={2}>
 <div
 className="participant-card conflicted shadow-sm rounded-3 p-3 d-flex align-items-center h-100"
 title={`Already in "${conflict.meeting_title}"${conflict.meeting_time ? ' at ' + conflict.meeting_time : ''} (Approved)`}
 >
 <div className="custom-check-container me-3">
 <div className="check-mark conflict">
 <i className="fa fa-ban"></i>
 </div>
 </div>
 <span className="fw-medium fs-6" style={{ lineHeight: '1.2', flex: 1, color: '#9ca3af' }}>
 {emp.user_name}
 <small className="d-block" style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
 {conflict.meeting_title}{conflict.meeting_time ? ` · ${conflict.meeting_time}` : ''}
 </small>
 </span>
 </div>
 </Col>
 );
 })}
 </Row>
 </div>
 )}
 </Modal.Body>
 <Modal.Footer className="px-4 py-3 bg-white border-top-0 d-flex justify-content-start gap-3">
 {can('meetings', 'edit') && (
 <Button
 variant="primary"
 onClick={handleSave}
 className="px-5 py-2 fw-bold shadow-sm rounded-3"
 disabled={loading}
 >
 {loading ? 'Processing...' : 'Submit'}
 </Button>
 )}
 <Button
 variant="light"
 onClick={() => onHide(false)}
 className="px-5 py-2 fw-bold border rounded-3"
 >
 Cancel
 </Button>
 </Modal.Footer>

 <style>{`
 .custom-participant-modal .modal-content {
 border: none;
 border-radius: 1rem;
 overflow: hidden;
 box-shadow: 0 20px 50px rgba(0,0,0,0.1);
 }
 .ls-1 { letter-spacing: 1px; }
 .transition-all { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
 .cursor-pointer { cursor: pointer; }
 
 .participant-card {
 background: #fff;
 min-height: 60px;
 }
 .participant-card.added {
 background-color: #f1f8ff;
 border: 1px solid #cce3ff !important;
 }
 .participant-card.available {
 background-color: #fff;
 }
 .participant-card:hover {
 transform: translateY(-2px);
 box-shadow: 0 8px 15px rgba(0,0,0,0.08) !important;
 }
 .participant-card.added:hover {
 background-color: #e5f2ff;
 }
 
 .custom-check-container {
 width: 22px;
 height: 22px;
 flex-shrink: 0;
 }
 .check-mark {
 width: 100%;
 height: 100%;
 border-radius: 6px;
 display: flex;
 align-items: center;
 justify-content: center;
 transition: all 0.2s;
 }
 .check-mark.empty {
 border: 2px solid #ced4da;
 background-color: #f8f9fa;
 }
 .check-mark.active {
 background: linear-gradient(135deg, #0d6efd, #3b82f6);
 color: #fff;
 font-size: 11px;
 border: 2px solid #0d6efd;
 box-shadow: 0 2px 6px rgba(13,110,253,0.35);
 }
 .check-mark.conflict {
 border: 2px solid #fca5a5;
 background: #fef2f2;
 color: #ef4444;
 font-size: 11px;
 }
 .participant-card.conflicted {
 background: repeating-linear-gradient(
 45deg,
 #fef2f2,
 #fef2f2 6px,
 #fff5f5 6px,
 #fff5f5 12px
 ) !important;
 border-color: #fecaca !important;
 cursor: not-allowed;
 opacity: 0.85;
 }
 .participant-card.conflicted:hover {
 transform: none !important;
 box-shadow: 0 1px 4px rgba(0,0,0,0.06) !important;
 }
 .participant-card.available:hover {
 background-color: #f0f7ff !important;
 border-color: #93c5fd !important;
 }
 .participant-card.available:hover .check-mark.empty {
 border-color: #0d6efd;
 background-color: #dbeafe;
 }
 
 .search-box-container .form-control:focus {
 background-color: #fff !important;
 }
 
 .hover-opacity-100:hover { opacity: 1 !important; }
 `}</style>
 </Modal>
 );
};

export default ParticipantManagement;
