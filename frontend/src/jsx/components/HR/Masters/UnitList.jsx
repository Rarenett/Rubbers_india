import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Modal, Form, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getUnits,
    createUnit,
    updateUnit,
    deleteUnit,
} from '../../../../services/PayheadService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import EditButton from '../../../../components/permissions/EditButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';

const EMPTY_UNIT = {
    id: null,
    name: '',
    abbreviation: ''
};

const UnitList = () => {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [current, setCurrent] = useState({ ...EMPTY_UNIT });
    const { can } = usePermission();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getUnits();
            setUnits(data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch units.' });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (unit = null) => {
        if (unit) {
            setCurrent({ ...unit });
            setEditMode(true);
        } else {
            setCurrent({ ...EMPTY_UNIT });
            setEditMode(false);
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrent({ ...EMPTY_UNIT });
        setEditMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode && current.id) {
                await updateUnit(current.id, current);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Unit updated successfully!' });
            } else {
                await createUnit(current);
                Swal.fire({ icon: 'success', title: 'Success', text: 'Unit created successfully!' });
            }
            handleCloseModal();
            fetchData();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to save unit.' });
        }
    };

    const handleDelete = async (id) => {
        try {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                await deleteUnit(id);
                Swal.fire('Deleted!', 'Unit has been deleted.', 'success');
                fetchData();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete unit.' });
        }
    };

    // Filter data
    const filteredUnits = units.filter(unit => {
        return unit.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between flex-wrap border-0 pb-0">
                            <div>
                                <h4 className="fs-20 mb-1">Units Management</h4>
                                <span>Manage production units</span>
                            </div>
                            <div className="d-flex align-items-center mb-2">
                                <Form.Control
                                    type="text"
                                    placeholder="Search..."
                                    className="me-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '250px' }}
                                />
                                <CreateButton
                                    module="hr"
                                    onClick={() => handleShowModal()}
                                    className="btn btn-primary"
                                >
                                    + Add Unit
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="sr-only">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-responsive-md table-hover">
                                        <thead>
                                            <tr>
                                                <th><strong>SL No</strong></th>
                                                <th><strong>Name</strong></th>
                                                <th><strong>Abbreviation</strong></th>
                                                <th><strong>Action</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUnits.length > 0 ? (
                                                filteredUnits.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{index + 1}</td>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <h6 className="mb-0 fs-14">{item.name}</h6>
                                                            </div>
                                                        </td>
                                                        <td>{item.abbreviation}</td>
                                                        <td>
                                                            <div className="d-flex">
                                                                <EditButton 
                                                                    module="hr"
                                                                    className="btn btn-primary shadow btn-xs sharp me-1"
                                                                    onClick={() => handleShowModal(item)}
                                                                >
                                                                    <i className="fa fa-pencil"></i>
                                                                </EditButton>
                                                                <DeleteButton 
                                                                    module="hr"
                                                                    className="btn btn-danger shadow btn-xs sharp"
                                                                    onClick={() => handleDelete(item.id)}
                                                                >
                                                                    <i className="fa fa-trash"></i>
                                                                </DeleteButton>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center">No units found</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{editMode ? 'Edit Unit' : 'Add Unit'}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Unit Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Pieces, Dozens, Kilograms"
                                value={current.name}
                                onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Abbreviation <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Pcs, Dz, Kg"
                                value={current.abbreviation}
                                onChange={(e) => setCurrent({ ...current, abbreviation: e.target.value })}
                                required
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="danger" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit">
                            {editMode ? 'Update' : 'Save'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
};

export default UnitList;
