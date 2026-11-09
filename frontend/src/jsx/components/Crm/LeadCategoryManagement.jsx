import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../services/AxiosInstance';

const LeadCategoryManagement = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await axiosInstance.get('/api/crm/categories/');
            if (res.status === 200) {
                setCategories(res.data);
            }
        } catch (error) {
            console.error("Error fetching categories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await axiosInstance.put(`/api/crm/categories/${editingId}/`, newCategory);
            } else {
                await axiosInstance.post('/api/crm/categories/', newCategory);
            }
            fetchCategories();
            setNewCategory({ name: '', description: '' });
            setEditingId(null);
            alert("Lead Category ecosystem synchronized.");
        } catch (error) {
            console.error("Error saving category", error);
            alert("Synchronization failure. Field validation required.");
        }
    };

    const handleEdit = (cat) => {
        setNewCategory({ name: cat.name, description: cat.description });
        setEditingId(cat.id);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Purge this category from the CRM ecosystem? Leads linked may lose categorization.")) {
            try {
                await axiosInstance.delete(`/api/crm/categories/${id}/`);
                fetchCategories();
            } catch (error) {
                console.error("Error deleting category", error);
            }
        }
    };

    return (
        <div className="crm-category-mgmt">
            <style>{`
                .mgmt-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 2.5rem;
                }

                .mgmt-form-card, .mgmt-list-card {
                    background: var(--crm-card-bg);
                    border-radius: var(--crm-card-radius);
                    border: 1px solid var(--crm-border);
                    box-shadow: var(--crm-shadow);
                    padding: 2rem;
                }

                .cat-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--crm-border);
                    transition: all 0.2s;
                }

                .cat-item:last-child {
                    border-bottom: none;
                }

                .cat-item:hover {
                    background: var(--crm-accent-soft);
                    border-radius: 12px;
                }

                .cat-info h5 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 800;
                    color: var(--crm-text-primary);
                }

                .cat-info p {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--crm-text-secondary);
                }

                .cat-actions {
                    display: flex;
                    gap: 0.75rem;
                }

                /* Standard CRM Form Styles */
                .crm-input-group {
                    margin-bottom: 1.5rem;
                }

                .crm-label {
                    display: block;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    color: var(--crm-text-secondary);
                    letter-spacing: 1px;
                    font-weight: 700;
                    margin-bottom: 0.75rem;
                }

                .crm-input {
                    width: 100%;
                    padding: 0.8rem 1.25rem;
                    background: var(--crm-bg);
                    border: 1px solid var(--crm-border);
                    border-radius: 12px;
                    color: var(--crm-text-primary);
                    font-size: 0.95rem;
                    font-weight: 500;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .crm-input:focus {
                    outline: none;
                    border-color: var(--crm-accent);
                    box-shadow: 0 0 0 4px var(--crm-accent-soft);
                    background: var(--crm-card-bg);
                }

                .crm-textarea {
                    min-height: 100px;
                    resize: vertical;
                }

                .crm-submit-btn {
                    background: var(--crm-accent);
                    color: #fff;
                    border: none;
                    padding: 0.8rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 800;
                    font-size: 0.9rem;
                    box-shadow: 0 10px 20px rgba(0, 209, 255, 0.2);
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    cursor: pointer;
                }

                .crm-submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 30px rgba(0, 209, 255, 0.3);
                }

                .crm-action-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--crm-border);
                    background: var(--crm-card-bg);
                    color: var(--crm-text-secondary);
                    transition: all 0.2s;
                }

                .crm-action-btn:hover {
                    border-color: var(--crm-accent);
                    color: var(--crm-accent);
                    background: var(--crm-accent-soft);
                }
            `}</style>

            <div className="mgmt-grid">
                <div className="mgmt-form-card">
                    <h4 className="fw-800 text-primary mb-4">{editingId ? 'Edit Perspective' : 'Define New Category'}</h4>
                    <form onSubmit={handleSave}>
                        <div className="crm-input-group">
                            <label className="crm-label">Category Name</label>
                            <input 
                                type="text" 
                                className="crm-input" 
                                placeholder="e.g. Vendor, Distributor"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                required
                            />
                        </div>
                        <div className="crm-input-group">
                            <label className="crm-label">Ecosystem Description</label>
                            <textarea 
                                className="crm-input crm-textarea" 
                                placeholder="Contextualize this lead type..."
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                            ></textarea>
                        </div>
                        <div className="d-flex gap-2">
                            <button type="submit" className="crm-submit-btn w-100">
                                {editingId ? 'UPDATE CONFIG' : 'SYNCHRONIZE'}
                            </button>
                            {editingId && (
                                <button type="button" className="btn btn-outline-secondary" onClick={() => {setEditingId(null); setNewCategory({name:'', description:''})}}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mgmt-list-card">
                    <h4 className="fw-800 text-primary mb-4">Lead Category Repository</h4>
                    {loading ? (
                        <div className="text-center py-5 opacity-50">Syncing repository...</div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-5 opacity-50">No categories identified in the ecosystem.</div>
                    ) : (
                        <div className="cat-list">
                            {categories.map(cat => (
                                <div key={cat.id} className="cat-item">
                                    <div className="cat-info">
                                        <h5>{cat.name}</h5>
                                        <p>{cat.description || 'No description provided.'}</p>
                                    </div>
                                    <div className="cat-actions">
                                        <button className="crm-action-btn" onClick={() => handleEdit(cat)} title="Edit Configuration">
                                            <i className="fa fa-pencil"></i>
                                        </button>
                                        <button className="crm-action-btn text-danger" onClick={() => handleDelete(cat.id)} title="Purge Record">
                                            <i className="fa fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadCategoryManagement;
