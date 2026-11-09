import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import { createDepartment } from '../../../../services/HRManagementService';
import Swal from 'sweetalert2';

const QuickAddDepartmentModal = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const res = await createDepartment({ name: name, is_active: isActive });
            onSave(res); // Pass the created item back to parent
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create department' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
                <Form.Label>Department Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter department name"
                    required
                />
            </Form.Group>
            <Form.Group className="mb-3 d-flex align-items-center gap-2">
                <Form.Check
                    type="checkbox"
                    id="isActiveDept"
                    label="Active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                />
            </Form.Group>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                </Button>
            </div>
        </Form>
    );
};

export default QuickAddDepartmentModal;
