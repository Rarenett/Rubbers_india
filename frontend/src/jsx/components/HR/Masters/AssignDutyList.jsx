import React, { useState, useEffect, Fragment } from 'react';
import { Card, Button, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import {
    getAssignDuties,
    deleteAssignDuty,
} from '../../../../services/HRManagementService';
import { usePermission } from '../../../../hooks/usePermission';
import CreateButton from '../../../../components/permissions/CreateButton';
import DeleteButton from '../../../../components/permissions/DeleteButton';
import EditButton from '../../../../components/permissions/EditButton';

const AssignDutyList = () => {
    const navigate = useNavigate();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { can } = usePermission();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getAssignDuties();
            setAssignments(data.results || data);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch assignments.' });
        } finally {
            setLoading(false);
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
                await deleteAssignDuty(id);
                Swal.fire('Deleted!', 'Assignment has been deleted.', 'success');
                fetchData();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete assignment.' });
        }
    };

    // Filter data
    const filteredAssignments = assignments.filter(assign => {
        const term = searchTerm.toLowerCase();
        return (assign.dutyname_name || '').toLowerCase().includes(term) ||
               (assign.department_name_details || '').toLowerCase().includes(term) ||
               (assign.start_date || '').toLowerCase().includes(term) ||
               (assign.end_date || '').toLowerCase().includes(term) ||
               (assign.responsibility ? assign.responsibility.length.toString() : '0').includes(term) ||
               (assign.person_name ? assign.person_name.length.toString() : '0').includes(term);
    });

    return (
        <div className="container-fluid">
            {/* <div className="d-flex justify-content-end mb-3">
                <button 
                    className="btn btn-outline-primary shadow btn-sm" 
                    onClick={() => window.history.back()} 
                    style={{ borderRadius: '4px', fontSize: '13px', padding: '6px 12px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div> */}
            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between flex-wrap">
                            <div>
                                <h4 className="fs-20 mb-1">Assigned Duties List</h4>
                                <span>Manage employee duty assignments</span>
                            </div>
                            <div className="d-flex align-items-center mb-2">
                                <Form.Control
                                    type="text"
                                    placeholder="Search duty or dept..."
                                    className="me-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '250px' }}
                                />
                                <CreateButton
                                    module="hr"
                                    onClick={() => navigate('/assign-duty')}
                                >
                                    Assign Duty
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
                                                <th><strong>S.No.</strong></th>
                                                <th><strong>Duty Name</strong></th>
                                                <th><strong>Department</strong></th>
                                                <th className="text-center"><strong>Responsibilities Count</strong></th>
                                                <th className="text-center"><strong>Employees Count</strong></th>
                                                <th><strong>Start Date</strong></th>
                                                <th><strong>End Date</strong></th>
                                                <th><strong>Action</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAssignments.length > 0 ? filteredAssignments.map((assign, index) => (
                                                <tr key={assign.id}>
                                                    <td><strong>{index + 1}</strong></td>
                                                    <td>{assign.dutyname_name || '-'}</td>
                                                    <td>{assign.department_name_details || '-'}</td>
                                                    <td className="text-center">
                                                        <span className="badge badge-primary light">
                                                            {assign.responsibility ? assign.responsibility.length : 0}
                                                        </span>
                                                    </td>
                                                    <td className="text-center">
                                                        <span className="badge badge-success light">
                                                            {assign.person_name ? assign.person_name.length : 0}
                                                        </span>
                                                    </td>
                                                    <td>{assign.start_date ? assign.start_date.split('-').reverse().join('/') : '-'}</td>
                                                    <td>{assign.end_date ? assign.end_date.split('-').reverse().join('/') : '-'}</td>
                                                    <td>
                                                        <div className="d-flex gap-2">
                                                            {(() => {
                                                                const hasEnded = assign.ended_statuses && assign.ended_statuses.length > 0;
                                                                return (
                                                                    <>
                                                                        <div title={hasEnded ? "Cannot edit because some responsibilities have ended" : ""}>
                                                                            <EditButton
                                                                                module="hr"
                                                                                onClick={() => navigate('/assign-duty', { state: { editData: assign } })}
                                                                                disabled={hasEnded}
                                                                                style={hasEnded ? { pointerEvents: 'none', opacity: 0.5 } : {}}
                                                                            />
                                                                        </div>
                                                                        <div title={hasEnded ? "Cannot delete because some responsibilities have ended" : ""}>
                                                                            <DeleteButton
                                                                                module="hr"
                                                                                onClick={() => handleDelete(assign.id)}
                                                                                disabled={hasEnded}
                                                                                style={hasEnded ? { pointerEvents: 'none', opacity: 0.5 } : {}}
                                                                            />
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="8" className="text-center">No assignments found</td>
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
        </div>
    );
};

export default AssignDutyList;
