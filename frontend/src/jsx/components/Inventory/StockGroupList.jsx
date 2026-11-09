import React, { useState, useEffect, Fragment } from 'react';

import { Card, Form } from 'react-bootstrap';
import Swal from 'sweetalert2';
import {
    getStockGroups,
    deleteStockGroup,
    importStockGroupsExcel,
    downloadStockGroupTemplate
} from '../../../services/InventoryService';
import { usePermission } from '../../../hooks/usePermission';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import StockGroupFormModal from './StockGroupFormModal';

const StockGroupList = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const { can } = usePermission();

    const toTitleCase = (str) => {
        if (!str) return '';
        return str.replace(/\b\w/g, char => char.toUpperCase());
    };

    const fileInputRef = React.useRef(null);

    const handleDownloadTemplate = async () => {
        try {
            const response = await downloadStockGroupTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'StockGroup_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to download template' });
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setLoading(true);
            const data = await importStockGroupsExcel(formData);
            if (data.errors && data.errors.length > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Import Completed with Errors',
                    html: `Added: <strong>${data.added}</strong><br>Updated: <strong>${data.updated}</strong><br><br><div style="max-height: 150px; overflow-y: auto; text-align: left; font-size: 13px; color: #d33; background: #fff3f3; padding: 10px; border-radius: 5px; border: 1px solid #ffcaca;">${data.errors.join('<br>')}</div>`,
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Import Successful',
                    text: `Added: ${data.added}, Updated: ${data.updated}`,
                });
            }
            fetchData();
        } catch (error) {
            let errorMsg = 'Failed to import stock groups';
            if (error.response && error.response.data) {
                if (error.response.data.detail) errorMsg = error.response.data.detail;
                if (error.response.data.errors) {
                    errorMsg += '\n' + error.response.data.errors.join('\n');
                }
            }
            Swal.fire({ icon: 'error', title: 'Import Failed', text: errorMsg });
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editGroup, setEditGroup] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getStockGroups();
            setGroups(data);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch stock groups',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleShowModal = (group = null) => {
        setEditGroup(group || null);
        setShowModal(true);
    };

    const handleHideModal = () => {
        setShowModal(false);
        setEditGroup(null);
    };

    const handleSaved = () => {
        fetchData();
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Stock Group?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        });

        if (result.isConfirmed) {
            try {
                await deleteStockGroup(id);
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Stock group deleted successfully', timer: 2000, showConfirmButton: false });
                fetchData();
            } catch (error) {
                let errorMsg = 'Failed to delete stock group';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = error.response.data.detail;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
            }
        }
    };

    const filteredGroups = groups.filter(group =>
        (group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentGroups = filteredGroups.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);

    return (
        <Fragment>

            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <Card.Title className="mb-0">Stock Groups Management</Card.Title>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                <div style={{ minWidth: '180px', flex: '1 1 200px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Stock Group..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '37px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <button 
                                    className="btn btn-secondary" 
                                    onClick={handleDownloadTemplate} 
                                    title="Download Template"
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px' }}
                                >
                                    <i className="fa fa-download me-1"></i> Template
                                </button>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />
                                <button 
                                    className="btn btn-info" 
                                    onClick={() => fileInputRef.current.click()} 
                                    title="Import Excel"
                                    style={{ height: '34px', display: 'flex', alignItems: 'center', fontSize: '13px', color: 'white' }}
                                >
                                    <i className="fa fa-upload me-1"></i> Import
                                </button>
                                <CreateButton
                                    module="stock_group"
                                    onClick={() => handleShowModal()}
                                >
                                    Stock Group
                                </CreateButton>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                 <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px' }}><strong>SL NO</strong></th>
                                                <th><strong>NAME</strong></th>
                                                <th><strong>PARENT GROUP</strong></th>
                                                <th style={{ width: '130px' }}><strong>TYPE</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredGroups.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">
                                                        No entries
                                                    </td>
                                                </tr>
                                            ) : (
                                                 currentGroups.map((group, idx) => (
                                                    <tr key={group.id}>
                                                        <td><strong>{indexOfFirstItem + idx + 1}</strong></td>
                                                        <td>
                                                            <strong>{toTitleCase(group.name)}</strong>
                                                            {group.is_fixed && (
                                                                <span className="badge badge-secondary light ms-2" style={{ fontSize: '11px' }}>
                                                                    <i className="fa fa-lock me-1"></i> Fixed
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {group.parent_group_name ? (
                                                                <span className="badge badge-info light">{toTitleCase(group.parent_group_name)}</span>
                                                            ) : (
                                                                <span className="text-muted">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {group.is_parent_group ? (
                                                                <span
                                                                    className="badge badge-warning light d-inline-flex align-items-center gap-1"
                                                                    title="This group is locked as a Parent Group"
                                                                >
                                                                    <i className="fa fa-shield-alt" style={{ fontSize: '11px' }}></i>
                                                                    Parent Group
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted" style={{ fontSize: '12px' }}>Sub Group</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {group.is_parent_group ? (
                                                                <span
                                                                    className="badge badge-secondary light"
                                                                    title="Parent groups cannot be edited or deleted"
                                                                    style={{ fontSize: '11px', cursor: 'default' }}
                                                                >
                                                                    <i className="fa fa-lock me-1"></i> Locked
                                                                </span>
                                                            ) : can('group', 'edit') || can('group', 'delete') ? (
                                                                <div className="d-flex justify-content-end">
                                                                    <EditButton
                                                                        module="stock_group"
                                                                        onClick={() => handleShowModal(group)}
                                                                        className="me-1"
                                                                    />
                                                                    <DeleteButton
                                                                        module="stock_group"
                                                                        onClick={() => handleDelete(group.id, group.name)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light mt-1">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {filteredGroups.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredGroups.length)} of {filteredGroups.length} entries
                                    </div>
                                            {totalPages > 1 && (
                                                <nav>
                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                            <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                    <i className="la la-angle-left" />
                                                </button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, index) => {
                                                const pageNumber = index + 1;
                                                if (
                                                    pageNumber === 1 ||
                                                    pageNumber === totalPages ||
                                                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}>
                                                            <button type="button" className="page-link" onClick={() => setCurrentPage(pageNumber)} style={{ border: 'none' }}>
                                                                {pageNumber}
                                                            </button>
                                                        </li>
                                                    );
                                                } else if (
                                                    pageNumber === currentPage - 2 ||
                                                    pageNumber === currentPage + 2
                                                ) {
                                                    return (
                                                        <li key={pageNumber} className="page-item disabled">
                                                            <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                                        </li>
                                                    );
                                                }
                                                return null;
                                            })}
                                            <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
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

            <StockGroupFormModal
                show={showModal}
                onHide={handleHideModal}
                onSaved={handleSaved}
                existingGroups={groups}
                editGroup={editGroup}
            />
        </Fragment>
    );
};

export default StockGroupList;
