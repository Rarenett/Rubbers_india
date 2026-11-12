import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import axiosInstance from '../../../services/AxiosInstance';

const TaskForm = ({ onClose, onSaved, existingTask = null }) => {
    const [formData, setFormData] = useState({
        taskName: '',
        description: '',
        plannedDate: new Date().toISOString().split('T')[0],
        plannedStartTime: '10:00',
        expectedHours: 0,
        expectedMinutes: 30,
        expectedEndTime: '10:30',
        priority: 'Medium',
        reminderSystem: 'Duration Based',
        firstReminderMinutes: 30,
        secondReminderMinutes: 15,
        thirdReminderMinutes: '',
        fourthReminderMinutes: '',
        fifthReminderMinutes: ''
    });

    useEffect(() => {
        if (existingTask) {
            // Reverse calculate expected end time based on start time and duration
            const existingStart = new Date(`${existingTask.plannedDate}T${existingTask.plannedStartTime.substring(0, 5)}`);
            const endMs = existingStart.getTime() + ((existingTask.expectedHours * 60) + existingTask.expectedMinutes) * 60000;
            const endObj = new Date(endMs);
            const endHrs = String(endObj.getHours()).padStart(2, '0');
            const endMins = String(endObj.getMinutes()).padStart(2, '0');

            setFormData({
                taskName: existingTask.taskName,
                description: existingTask.description,
                plannedDate: existingTask.plannedDate,
                plannedStartTime: existingTask.plannedStartTime.substring(0, 5), // Assuming HH:MM:SS
                expectedHours: existingTask.expectedHours,
                expectedMinutes: existingTask.expectedMinutes,
                expectedEndTime: `${endHrs}:${endMins}`,
                priority: existingTask.priority,
                reminderSystem: existingTask.reminderSystem,
                firstReminderMinutes: existingTask.firstReminderMinutes || '',
                secondReminderMinutes: existingTask.secondReminderMinutes || '',
                thirdReminderMinutes: existingTask.thirdReminderMinutes || '',
                fourthReminderMinutes: existingTask.fourthReminderMinutes || '',
                fifthReminderMinutes: existingTask.fifthReminderMinutes || ''
            });
        }
    }, [existingTask]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let h = parseInt(formData.expectedHours) || 0;
        let m = parseInt(formData.expectedMinutes) || 0;

        if (formData.reminderSystem === 'End Time Based' && formData.expectedEndTime) {
            const startDatetime = new Date(`${formData.plannedDate}T${formData.plannedStartTime}`);
            let endDatetime = new Date(`${formData.plannedDate}T${formData.expectedEndTime}`);
            // If end time is before start time, assume it ends on the next day
            if (endDatetime < startDatetime) {
                endDatetime = new Date(endDatetime.getTime() + 24 * 60 * 60 * 1000);
            }
            const diffMs = endDatetime.getTime() - startDatetime.getTime();
            h = Math.floor(diffMs / (1000 * 60 * 60));
            m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        }

        const durationStr = `${h}h ${m}m`;
        
        // Deadline calculation
        const startDatetime = new Date(`${formData.plannedDate}T${formData.plannedStartTime}`);
        const deadline = new Date(startDatetime.getTime() + (h * 60 + m) * 60000);
        
        // Format as YYYY-MM-DDTHH:mm:ss in local time to prevent Django from interpreting UTC when USE_TZ=False
        const localDeadlineStr = new Date(deadline.getTime() - (deadline.getTimezoneOffset() * 60000)).toISOString().slice(0, 19);

        const payload = {
            ...formData,
            expectedHours: h,
            expectedMinutes: m,
            expectedDuration: durationStr,
            deadline: localDeadlineStr,
            firstReminderMinutes: formData.firstReminderMinutes || null,
            secondReminderMinutes: formData.secondReminderMinutes || null,
            thirdReminderMinutes: formData.thirdReminderMinutes || null,
            fourthReminderMinutes: formData.fourthReminderMinutes || null,
            fifthReminderMinutes: formData.fifthReminderMinutes || null
        };

        try {
            if (existingTask) {
                await axiosInstance.put(`/api/task-management/tasks/${existingTask.id}/`, payload);
            } else {
                await axiosInstance.post('/api/task-management/tasks/', payload);
            }
            onSaved();
        } catch (error) {
            console.error("Error saving task:", error);
        }
    };

    return (
        <Modal show={true} onHide={onClose} size="lg" centered backdrop="static">
            <Modal.Header closeButton>
                <Modal.Title>{existingTask ? 'Edit Task' : 'Plan Task'}</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row>
                        <Col md={12}>
                            <Row>
                                <Col md={4}>
                                    <Form.Group className="mb-2">
                                        <Form.Label className="mb-1">Task Name *</Form.Label>
                                        <Form.Control type="text" name="taskName" value={formData.taskName} onChange={handleChange} placeholder="Task name" required />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-2">
                                        <Form.Label className="mb-1">Planned Date *</Form.Label>
                                        <Form.Control type="date" name="plannedDate" value={formData.plannedDate} onChange={handleChange} required />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-2">
                                        <Form.Label className="mb-1">Start Time *</Form.Label>
                                        <Form.Control type="time" name="plannedStartTime" value={formData.plannedStartTime} onChange={handleChange} required />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Col>

                        <Col md={12}>
                            <Row>
                                <Col md={4}>
                                    <Form.Group className="mb-2">
                                        <Form.Label className="mb-1">Priority</Form.Label>
                                        <Form.Control as="select" name="priority" value={formData.priority} onChange={handleChange}>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </Form.Control>
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-2">
                                        <Form.Label className="mb-1">Reminder System</Form.Label>
                                        <Form.Control as="select" name="reminderSystem" value={formData.reminderSystem} onChange={handleChange}>
                                            <option value="Duration Based">Duration Based</option>
                                            <option value="End Time Based">End Time Based</option>
                                        </Form.Control>
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    {formData.reminderSystem === 'Duration Based' ? (
                                        <Form.Group className="mb-2">
                                            <Form.Label className="mb-1">Expected Duration</Form.Label>
                                            <div className="d-flex">
                                                <Form.Control type="number" name="expectedHours" value={formData.expectedHours} onChange={handleChange} placeholder="H" min="0" className="mr-2 px-1" />
                                                <span className="align-self-center mr-2">h</span>
                                                <Form.Control type="number" name="expectedMinutes" value={formData.expectedMinutes} onChange={handleChange} placeholder="M" min="0" max="59" className="mr-2 px-1" />
                                                <span className="align-self-center">m</span>
                                            </div>
                                        </Form.Group>
                                    ) : (
                                        <Form.Group className="mb-2">
                                            <Form.Label className="mb-1">Expected End Time</Form.Label>
                                            <Form.Control type="time" name="expectedEndTime" value={formData.expectedEndTime} onChange={handleChange} required />
                                        </Form.Group>
                                    )}
                                </Col>
                            </Row>
                        </Col>

                        <Col md={12}>
                            <Form.Group className="mb-2">
                                <Form.Label className="mb-1">Description</Form.Label>
                                <Form.Control as="textarea" name="description" value={formData.description} onChange={handleChange} placeholder="Brief description" rows={1} />
                            </Form.Group>
                        </Col>

                        <Col md={12}>
                            <div className="mt-2 mb-1" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                {formData.reminderSystem === 'Duration Based' ? 'Reminders (Mins After Start)' : 'Reminders (Mins Before Deadline)'}
                            </div>
                            <Row>
                                {['Low', 'Medium', 'High', 'Critical'].indexOf(formData.priority) >= 0 && (
                                    <>
                                        <Col>
                                            <Form.Control type="number" name="firstReminderMinutes" value={formData.firstReminderMinutes} onChange={handleChange} min="0" placeholder="1st" />
                                        </Col>
                                        <Col>
                                            <Form.Control type="number" name="secondReminderMinutes" value={formData.secondReminderMinutes} onChange={handleChange} min="0" placeholder="2nd" />
                                        </Col>
                                    </>
                                )}
                                {['Medium', 'High', 'Critical'].indexOf(formData.priority) >= 0 && (
                                    <Col>
                                        <Form.Control type="number" name="thirdReminderMinutes" value={formData.thirdReminderMinutes} onChange={handleChange} min="0" placeholder="3rd" />
                                    </Col>
                                )}
                                {['High', 'Critical'].indexOf(formData.priority) >= 0 && (
                                    <Col>
                                        <Form.Control type="number" name="fourthReminderMinutes" value={formData.fourthReminderMinutes} onChange={handleChange} min="0" placeholder="4th" />
                                    </Col>
                                )}
                                {formData.priority === 'Critical' && (
                                    <Col>
                                        <Form.Control type="number" name="fifthReminderMinutes" value={formData.fifthReminderMinutes} onChange={handleChange} min="0" placeholder="5th" />
                                    </Col>
                                )}
                            </Row>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        className="mr-2 btn-cancel-custom" 
                        style={{ 
                            backgroundColor: "var(--cancel-btn-color, #dc3545)", borderColor: "var(--cancel-btn-color, #dc3545)", color: "#ffffff", borderRadius: "8px", fontWeight: 500, padding: "8px 22px" 
                        }} 
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" className="btn-save-custom" style={{ borderRadius: "8px", fontWeight: 500, padding: "8px 22px" }}>Save</Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

export default TaskForm;
