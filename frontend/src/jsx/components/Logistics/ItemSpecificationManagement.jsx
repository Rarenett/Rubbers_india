import React, { useState, useEffect, useCallback, Fragment } from 'react';
import swal from 'sweetalert';
import { Modal, Card, Form } from 'react-bootstrap';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import LogisticsService from '../../../services/LogisticsService';
import SalesService from '../../../services/SalesService'; // To get StockItems
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import ItemSpecificationForm from './ItemSpecificationForm';
import { usePageTitle } from '../../../context/TitleContext';

const ItemSpecificationManagement = ({ currentUser, embedded }) => {
    usePageTitle('Product Dimensions');
    const [managementData, setManagementData] = useState([]);
    const [stockItems, setStockItems]         = useState([]);
    const [packageTypes, setPackageTypes]     = useState([]);
    const [loading, setLoading]               = useState(false);
    const [showModal, setShowModal]           = useState(false);
    const [isEditing, setIsEditing]           = useState(false);
    const [selectedId, setSelectedId]         = useState(null);
    const [searchTerm, setSearchTerm]         = useState('');
    const [formData, setFormData]             = useState({ 
        stock_item: '', 
        package_type: '', 
        items_per_case: 1, 
        volume_per_case: 0, 
        case_weight: 0 
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [specRes, itemsRes, packRes] = await Promise.all([
                LogisticsService.getItemSpecifications(),
                SalesService.getStockItems(),
                LogisticsService.getPackageTypes()
            ]);
            setManagementData(Array.isArray(specRes.data) ? specRes.data : []);
            setStockItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
            setPackageTypes(Array.isArray(packRes.data) ? packRes.data : []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredData = managementData.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            (item.stock_item_name || '').toLowerCase().includes(term) ||
            (item.package_type_name || '').toLowerCase().includes(term) ||
            String(item.items_per_case || '').toLowerCase().includes(term) ||
            String(item.volume_per_case || '').toLowerCase().includes(term) ||
            String(item.case_weight || '').toLowerCase().includes(term)
        );
    });

    const handleEdit = (item) => {
        setIsEditing(true);
        setSelectedId(item.id);
        setFormData({
            stock_item: item.stock_item || '',
            package_type: item.package_type || '',
            items_per_case: item.items_per_case || 1,
            volume_per_case: item.volume_per_case || 0,
            case_weight: item.case_weight || 0
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing && selectedId) {
                await LogisticsService.updateItemSpecification(selectedId, formData);
            } else {
                await LogisticsService.createItemSpecification(formData);
            }
            setShowModal(false);
            setFormData({ stock_item: '', package_type: '', items_per_case: 1, volume_per_case: 0, case_weight: 0 });
            setSelectedId(null);
            await fetchData();
            swal(
                'Success!',
                `Item specification ${isEditing ? 'updated' : 'created'} successfully!`,
                'success'
            );
        } catch (err) {
            const errData = err.response?.data;
            let errorMsg = 'Error saving item specification.';
            if (errData) {
                if (typeof errData === 'string')    errorMsg = errData;
                else if (errData.detail)            errorMsg = errData.detail;
                else                                errorMsg = JSON.stringify(errData);
            }
            swal('Error', errorMsg, 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await swal({
            title: 'Delete Item Specification?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            buttons: ['Cancel', 'Delete'],
            dangerMode: true,
        });
        if (!confirmed) return;
        try {
            await LogisticsService.deleteItemSpecification(id);
            await fetchData();
            swal('Deleted!', 'Item specification has been removed.', 'success');
        } catch (err) {
            const msg = err.response?.data?.detail || 'Could not delete this specification.';
            swal('Error', msg, 'error');
        }
    };



    return (
        <Fragment>
            <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            <div className="container-fluid">
            <div className="row">
                <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                            <Card.Title className="mb-0">Product Dimension Management</Card.Title>
                            <div className="d-flex align-items-center gap-2">
                                <div style={{ width: '300px', position: 'relative' }}>
                                    <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                    <Form.Control
                                        type="text"
                                        placeholder="Search Item Specification..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                    />
                                </div>
                                <CreateButton
                                    module="item_specification"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setSelectedId(null);
                                        setFormData({ stock_item: '', package_type: '', items_per_case: 1, volume_per_case: 0, case_weight: 0 });
                                        setShowModal(true);
                                    }}
                                >
                                    Specification
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
                                                <th><strong>SL NO</strong></th>
                                                <th><strong>STOCK ITEM</strong></th>
                                                <th><strong>PACKAGE TYPE</strong></th>
                                                <th><strong>ITEMS/CASE</strong></th>
                                                <th><strong>VOLUME/CASE (m³)</strong></th>
                                                <th><strong>WEIGHT/CASE (kg)</strong></th>
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-4 text-muted">
                                                        No Item Specifications Found
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredData.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td><strong>{index + 1}</strong></td>
                                                        <td><strong>{item.stock_item_name}</strong></td>
                                                        <td><span className="badge badge-success light">{item.package_type_name}</span></td>
                                                        <td>{item.items_per_case}</td>
                                                        <td>{parseFloat(item.volume_per_case).toFixed(4)}</td>
                                                        <td>{parseFloat(item.case_weight).toFixed(2)}</td>
                                                        <td className="text-end">
                                                            <div className="d-flex justify-content-end gap-2">
                                                                <EditButton
                                                                    module="item_specification"
                                                                    onClick={() => handleEdit(item)}
                                                                />
                                                                <DeleteButton
                                                                    module="item_specification"
                                                                    onClick={() => handleDelete(item.id)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
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

            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)}
                backdrop="static"
                keyboard={false}
                centered
                size="lg"
                dialogClassName="custom-modal-fade"
                contentClassName="border-0 shadow-lg"
                style={{ borderRadius: '16px', overflow: 'hidden' }}
            >
                <div style={{ padding: '24px 32px' }}>
                    <ItemSpecificationForm
                        formData={formData}
                        setFormData={setFormData}
                        onSave={handleSubmit}
                        onCancel={() => setShowModal(false)}
                        isEditing={isEditing}
                        stockItems={stockItems}
                        packageTypes={packageTypes}
                    />
                </div>
            </Modal>
        </Fragment>
    );
};

export default ItemSpecificationManagement;
