import React, { useState, useEffect, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Table, Spinner, Badge, Form } from 'react-bootstrap';
import MainSweetAlert from 'sweetalert2';
import ProductionService from '../../../services/ProductionService';
import PageTitle from '../../layouts/PageTitle';
import { usePageTitle } from '../../../context/TitleContext';
import EmployeeGroupForm from './EmployeeGroupForm';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';

const EmployeeGroupList = () => {
    usePageTitle("Production Team");

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await ProductionService.getEmployeeGroups();
            if (response.data && response.data.results) {
                setGroups(response.data.results);
            } else if (Array.isArray(response.data)) {
                setGroups(response.data);
            }
        } catch (error) {
            console.error('Error fetching Production Teams:', error);
            MainSweetAlert.fire('Error', 'Failed to fetch Production Teams', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (id = null) => {
        setSelectedGroupId(id);
        setShowModal(true);
    };

    const handleDelete = async (id, groupName) => {
        const result = await MainSweetAlert.fire({
            title: 'Delete Production Team?',
            text: `Are you sure you want to delete "${groupName}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await ProductionService.deleteEmployeeGroup(id);
                MainSweetAlert.fire({ icon: 'success', title: 'Deleted', text: 'Production Team deleted successfully', timer: 2000, showConfirmButton: false });
                fetchGroups();
            } catch (error) {
                console.error('Error deleting Production Team:', error);
                MainSweetAlert.fire({ icon: 'error', title: 'Error', text: 'Failed to delete Production Team' });
            }
        }
    };

    const filteredGroups = groups.filter(group =>
        (group.group_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
    const indexOfFirst = (currentPage - 1) * itemsPerPage;
    const indexOfLast = indexOfFirst + itemsPerPage;
    const currentGroups = filteredGroups.slice(indexOfFirst, indexOfLast);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title>Production Teams</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Production Team..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton module="shift_group" onClick={() => handleShowModal(null)}>
                                    Create Team
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <Table responsive hover className="mb-0">
                                    <thead>
                                        <tr>
                                            <th>SL No</th>
                                            <th>Team Name</th>
                                            <th>Description</th>
                                            <th>Members</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGroups.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4 text-muted">
                                                    No Production Teams found.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentGroups.map((group, index) => (
                                                <tr key={group.id}>
                                                    <td>{indexOfFirst + index + 1}</td>
                                                    <td><strong>{group.group_name}</strong></td>
                                                    <td>{group.description || '-'}</td>
                                                    <td>
                                                        <Badge bg="info" pill>
                                                            {group.members ? group.members.length : 0} Members
                                                        </Badge>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
                                                            <EditButton
                                                                module="shift_group"
                                                                onClick={() => handleShowModal(group.id)}
                                                            />
                                                            <DeleteButton
                                                                module="shift_group"
                                                                onClick={() => handleDelete(group.id, group.group_name)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </Table>
                            )}

                            {/* Pagination */}
                            {!loading && filteredGroups.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredGroups.length)} of {filteredGroups.length} entries
                                    </div>
                                    {totalPages > 1 && (
                                        <nav>
                                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-left" />
                                                    </button>
                                                </li>
                                                {Array.from({ length: totalPages }, (_, i) => {
                                                    const page = i + 1;
                                                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                                        return (
                                                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPage(page)} style={{ border: 'none' }}>{page}</button>
                                                            </li>
                                                        );
                                                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                        return (
                                                            <li key={page} className="page-item disabled">
                                                                <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                            </li>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                        <i className="la la-angle-right" />
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    )}
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </div>
            </div>

            <EmployeeGroupForm
                show={showModal}
                onHide={() => setShowModal(false)}
                groupId={selectedGroupId}
                onSuccess={fetchGroups}
            />
        </div>
    );
};

export default EmployeeGroupList;
