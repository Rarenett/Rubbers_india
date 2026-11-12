import React, { useState, useEffect } from 'react';
import { Card, Spinner, Modal } from 'react-bootstrap';
import { getStockItems, getRecipes } from '../../../services/InventoryService';
import RecipeForm from './RecipeForm';
import { toast } from 'react-toastify';
import CreateButton from '../../../components/permissions/CreateButton';

const RecipeList = () => {
    const [stockItems, setStockItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [modalMode, setModalMode] = useState('view');
    const [selectedItem, setSelectedItem] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [allItems, allRecipes] = await Promise.all([
                getStockItems(),
                getRecipes(),
            ]);
            // Only show stock items that already have at least one recipe
            const itemIdsWithRecipes = new Set(allRecipes.map(r => r.stock_item));
            const itemsWithRecipes = allItems.filter(item => itemIdsWithRecipes.has(item.id));
            setStockItems(itemsWithRecipes);
        } catch (error) {
            console.error("Error fetching recipe list", error);
            toast.error("Failed to load recipe list.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenCreate = () => {
        setSelectedItem(null);
        setModalMode('create');
        setShowForm(true);
    };

    const handleOpenView = (item) => {
        setSelectedItem(item);
        setModalMode('view');
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setSelectedItem(null);
        fetchData(); // Refresh list after any modal action
    };

    // We will render the modal unconditionally below, controlled by showForm state

    return (
        <div className="row">
            {/* Inline Styles for Custom Popup matching Mock Image */}
            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: var(--form-icon-color, #0a500f);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(10, 80, 15, 0.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 75vh;
                    overflow-y: auto;
                    background-color: #f8fafc;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 6px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #0a500f;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15);
                }
                .item-custom-modal .form-control-custom::placeholder {
                    color: #94a3b8;
                }
                .item-custom-modal .form-select-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    color: #334155;
                    background-color: #fff;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                    margin: 0 -28px -24px -28px;
                    border-radius: 0 0 16px 16px;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: var(--save-btn-color, #0a500f) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .item-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
                .journal-header-box {
                    background: #fff;
                    border-radius: 12px;
                    padding: 20px 24px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 20px;
                }
                .items-table-box {
                    background: #fff;
                    border-radius: 12px;
                    padding: 20px 24px;
                    border: 1px solid #e2e8f0;
                }
                .journal-section-head {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 16px;
                    flex: 1;
                }
                .journal-section-icon {
                    width: 30px;
                    height: 30px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    flex-shrink: 0;
                }
                .journal-section-icon svg {
                    width: 15px;
                    height: 15px;
                }
                .journal-icon-production {
                    background: linear-gradient(135deg, #10b981, #059669);
                }
                .journal-icon-ingredients {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                }
                .journal-section-head > span {
                    font-size: 14px;
                    font-weight: 700;
                    color: #1e293b;
                    white-space: nowrap;
                }
                .journal-section-line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(to right, #e2e8f0, transparent);
                }
                .btn-add-row {
                    border: 1px dashed #0a500f;
                    color: #0a500f;
                    background: transparent;
                    border-radius: 8px;
                    padding: 8px 16px;
                    font-weight: 500;
                    font-size: 13px;
                    transition: all 0.2s;
                }
                .btn-add-row:hover {
                    background: rgba(10, 80, 15, 0.05);
                }
                .btn-remove-row {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: background 0.15s;
                }
                .btn-remove-row:hover {
                    background: #fef2f2;
                }
                .btn-remove-row:disabled {
                    color: #cbd5e1;
                    cursor: not-allowed;
                }
                .btn-edit-row {
                    background: none;
                    border: none;
                    color: #25e07aff;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: background 0.15s;
                }
                .btn-edit-row:hover {
                    background: #eff6ff;
                }
                .btn-duplicate-row {
                    background: none;
                    border: none;
                    color: #f59e0b;
                    font-size: 15px;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: background 0.15s;
                }
                .btn-duplicate-row:hover {
                    background: #fffbeb;
                }
                .recipe-table-wrapper {
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    margin-bottom: 16px;
                }
                .recipe-ingredients-table th {
                    background: #f8fafc !important;
                    color: #64748b !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.04em;
                    padding: 10px 12px !important;
                    text-transform: uppercase;
                    border-bottom: 1px solid #cbd5e1 !important;
                    white-space: nowrap;
                }
                .recipe-ingredients-table td {
                    padding: 8px 12px !important;
                    vertical-align: middle;
                    border-bottom: 1px solid #f1f5f9;
                }
                .recipe-ingredients-table tbody tr {
                    transition: background-color 0.2s;
                }
                .recipe-ingredients-table tbody tr:hover {
                    background-color: #f1f5f9 !important;
                }
            `}</style>
            <div className="col-12">
                <Card>
                    <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <Card.Title className="mb-0"> Bill of Materials (Recipes)</Card.Title>
                        <CreateButton module="journaltypes" onClick={handleOpenCreate}>
                            Create Recipe
                        </CreateButton>
                    </Card.Header>
                    <Card.Body>
                        {loading ? (
                            <div className="d-flex justify-content-center">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <>
                                <div className="table-responsive">
                                    <table className="table table-responsive-md">
                                        <thead>
                                            <tr>
                                                <th><strong>SL No</strong></th>
                                                <th><strong>ITEM NAME</strong></th>
                                                <th><strong>PRIMARY UNIT</strong></th>
                                                <th className="text-end"><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stockItems.length > 0 ? (
                                                stockItems.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td>{index + 1}</td>
                                                        <td><strong>{item.name}</strong></td>
                                                        <td>{item.base_unit_name || '-'}</td>
                                                        <td className="text-end">
                                                            <button 
                                                                className="btn btn-outline-secondary btn-sm shadow"
                                                                onClick={() => handleOpenView(item)}
                                                                title="View Recipes"
                                                                style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    padding: '0',
                                                                    fontSize: '12px',
                                                                    borderRadius: '6px',
                                                                }}
                                                            >
                                                                <i className="fa fa-eye"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-4 text-muted">
                                                        No recipes found. Click "<i className="fa fa-plus"></i> Create" above to add a new recipe.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {stockItems.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing 1 to {stockItems.length} of {stockItems.length} entries
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card.Body>
                </Card>
            </div>

            {/* Custom Styled Popup Modal */}
            <Modal 
                show={showForm} 
                onHide={handleCloseForm}
                dialogClassName="item-custom-modal"
                size="xl"
                centered
            >
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 10H9v-2h6v2zm3-4H6V8h12v2z" fill="white"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                {modalMode === 'create' ? 'Create Recipe' : 'View Recipes'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                Add raw materials to create a new recipe
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close-x" onClick={handleCloseForm}>
                        &times;
                    </button>
                </div>
                <div className="modal-body-custom p-4">
                    {showForm && (
                        <RecipeForm
                            stockItem={selectedItem}
                            onCancel={handleCloseForm}
                            mode={modalMode}
                            onSaveSuccess={(savedItem) => {
                                // If RecipeForm passes back the saved stock item
                                // (global create / duplicate flow), update selectedItem
                                // so the view table shows that item's recipes.
                                if (savedItem) setSelectedItem(savedItem);
                                setModalMode('view');
                                fetchData();
                            }}
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default RecipeList;
