import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Table, Form, Spinner, Row, Col } from 'react-bootstrap';
import { toast } from 'react-toastify';
import Select from 'react-select';
import { getStockItems, getRecipes, createRecipe, deleteRecipe, updateRecipe } from '../../../services/InventoryService';

const RecipeForm = ({ stockItem, onCancel, mode, onSaveSuccess }) => {
    const [recipes, setRecipes] = useState([]);
    const [allItems, setAllItems] = useState([]);
    const [bomItems, setBomItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editRecipeId, setEditRecipeId] = useState(null);
    // Used when no stockItem prop is provided (global create mode)
    const [selectedStockItemId, setSelectedStockItemId] = useState('');
    const [isDuplicating, setIsDuplicating] = useState(false);

    const [formData, setFormData] = useState({
        recipe_name: '',
        applicable_date: new Date().toISOString().split('T')[0],
        unit_of_manufacture: 1,
    });

    const [ingredients, setIngredients] = useState([
        { stock_item: '', quantity: 1, unit: '', unit_name: '' }
    ]);

    const finishedGoodsRef = useRef(null);
    const recipeNameRef = useRef(null);
    const selectRefs = useRef([]);
    const [pendingFocusIndex, setPendingFocusIndex] = useState(null);

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            minHeight: '38px',
            fontSize: '13px',
            borderRadius: '10px',
            borderColor: state.isFocused ? '#0a500f' : '#cbd5e1',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(10, 80, 15, 0.15)' : 'none',
            '&:hover': { borderColor: '#0a500f' },
        }),
        menu: base => ({ ...base, zIndex: 9999, fontSize: '13px' }),
        singleValue: (base, state) => ({
            ...base,
            opacity: state.selectProps.inputValue ? 0 : 1,
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.data.isDivider
                ? 'white'
                : state.isSelected
                    ? '#0a500f'
                    : state.isFocused
                        ? '#f0fdf4'
                        : 'white',
            color: state.data.isDivider ? '#94a3b8' : state.isSelected ? 'white' : '#334155',
            cursor: state.data.isDivider ? 'default' : 'pointer',
            textAlign: state.data.isDivider ? 'center' : 'left',
            letterSpacing: state.data.isDivider ? '0.1em' : 'normal',
            fontSize: state.data.isDivider ? '11px' : '13px',
            pointerEvents: state.data.isDivider ? 'none' : 'auto',
            '&:hover': {
                backgroundColor: state.data.isDivider
                    ? 'white'
                    : state.isSelected
                        ? '#0a500f'
                        : '#f0fdf4',
                color: state.data.isDivider ? '#94a3b8' : state.isSelected ? 'white' : '#334155',
            }
        }),
        menuPortal: base => ({ ...base, zIndex: 9999 }),
    };

    const focusNextElement = (currentElement) => {
        const container = document.querySelector('.recipe-form-container');
        if (!container) return;

        // Query only input and select fields (excluding hidden inputs/buttons/divs/react-select containers)
        // This ensures each focusable field appears exactly once in the navigation path
        const elements = Array.from(
            container.querySelectorAll('input:not([disabled]):not([type="hidden"]), select:not([disabled])')
        ).filter(el => {
            // Always keep react-select search/focus inputs
            if (el.classList && (el.classList.contains('react-select__input') || (el.className && typeof el.className === 'string' && el.className.includes('react-select__input')))) {
                return true;
            }
            if (el.tagName === 'INPUT' && el.style.opacity === '0') return false;
            if (el.classList.contains('react-select__dummy-input')) return false;
            return el.offsetParent !== null;
        });

        const currentIdx = elements.findIndex(el => el === currentElement || el.contains(currentElement));

        if (currentIdx > -1 && currentIdx < elements.length - 1) {
            const nextEl = elements[currentIdx + 1];
            nextEl?.focus();
            if (nextEl?.select && typeof nextEl.select === 'function') {
                nextEl.select();
            }
        } else if (currentIdx === elements.length - 1) {
            const saveBtn = container.querySelector('.btn-save-custom');
            saveBtn?.focus();
        }
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            focusNextElement(e.target);
        }
    };

    const handleSelectKeyDown = (e, index = null) => {
        if (e.key === 'Enter') {
            const menuOpen = !!document.querySelector('.react-select__menu');
            const focusedOption = document.querySelector('.react-select__option--is-focused');
            const isTyping = e.target && e.target.value && e.target.value.trim().length > 0;
            const isSelectingRealItem = menuOpen && focusedOption && !focusedOption.textContent.includes('---------------');

            // If they are actively selecting a real item or typing a search, 
            // let react-select handle the Enter key to confirm the selection.
            if (isSelectingRealItem || isTyping) {
                return;
            }

            e.preventDefault();

            // If it is in the ingredients table and no stock item is selected, delete the row
            if (index !== null) {
                const currentIngredient = ingredients[index];
                if (!currentIngredient.stock_item) {
                    selectRefs.current[index]?.blur();
                    if (ingredients.length > 1) {
                        removeIngredientRow(index);
                    }
                    setTimeout(() => {
                        const container = document.querySelector('.recipe-form-container');
                        const saveBtn = container?.querySelector('.btn-save-custom');
                        saveBtn?.focus();
                    }, 50);
                    return;
                }
            }

            // Otherwise, navigate to the next form field
            focusNextElement(e.target);
        }
    };

    const handleQuantityKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index === ingredients.length - 1) {
                addIngredientRow();
                setPendingFocusIndex(ingredients.length);
            } else {
                focusNextElement(e.target);
            }
        }
    };

    // Autofocus Recipe Name on component load / edit mode activation
    useEffect(() => {
        if (mode === 'create' || editRecipeId || isDuplicating) {
            const timeout = setTimeout(() => {
                if (recipeNameRef.current) {
                    recipeNameRef.current.focus();
                }
            }, 300);
            return () => clearTimeout(timeout);
        }
    }, [editRecipeId, isDuplicating, mode]);

    // Autofocus newly added ingredient row's stock item dropdown
    useEffect(() => {
        if (pendingFocusIndex !== null) {
            const timeout = setTimeout(() => {
                const selectEl = selectRefs.current[pendingFocusIndex];
                if (selectEl) {
                    selectEl.focus();
                    selectEl.openMenu();
                }
                setPendingFocusIndex(null);
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [pendingFocusIndex]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [recipesRes, itemsRes] = await Promise.all([
                getRecipes(),
                getStockItems()
            ]);
            setBomItems(itemsRes);
            setAllItems(itemsRes);
            if (stockItem) {
                setRecipes(recipesRes.filter(r => r.stock_item === stockItem.id));
            } else {
                setRecipes([]);
            }
        } catch (error) {
            console.error("Error fetching data", error);
            toast.error("Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, [stockItem]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleIngredientChange = (index, field, value) => {
        const newIngredients = [...ingredients];
        newIngredients[index][field] = value;

        if (field === 'stock_item') {
            // Auto fill unit
            const selectedItem = allItems.find(item => item.id.toString() === value.toString());
            if (selectedItem) {
                newIngredients[index].unit = selectedItem.base_unit;
                newIngredients[index].unit_name = selectedItem.base_unit_name;
            } else {
                newIngredients[index].unit = '';
                newIngredients[index].unit_name = '';
            }
        }

        setIngredients(newIngredients);
    };

    const addIngredientRow = () => {
        setIngredients([...ingredients, { stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
    };

    const removeIngredientRow = (index) => {
        const newIngredients = ingredients.filter((_, i) => i !== index);
        setIngredients(newIngredients);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.recipe_name || !formData.applicable_date || !formData.unit_of_manufacture) {
            toast.error("Please fill all recipe details.");
            return;
        }

        // Determine which stock item to use.
        // When duplicating, always use the dropdown selection (user may have changed the finished good).
        // When creating from scratch without a stockItem prop, also use the dropdown.
        // Only use the stockItem prop directly when editing or creating normally.
        const resolvedStockItemId = isDuplicating
            ? parseInt(selectedStockItemId)
            : (stockItem ? stockItem.id : parseInt(selectedStockItemId));
        if (!resolvedStockItemId) {
            toast.error("Please select a Finished Good.");
            return;
        }

        const validIngredients = ingredients.filter(i => i.stock_item && i.quantity > 0);
        if (validIngredients.length === 0) {
            toast.error("Please add at least one valid ingredient.");
            return;
        }

        const payload = {
            ...formData,
            stock_item: resolvedStockItemId,
            recipe_details: validIngredients.map(i => ({
                stock_item: parseInt(i.stock_item),
                quantity: parseFloat(i.quantity),
                unit: parseInt(i.unit)
            }))
        };

        try {
            setSaving(true);
            if (editRecipeId) {
                await updateRecipe(editRecipeId, payload);
                toast.success("Recipe updated successfully!");
            } else {
                // Both 'create' and 'duplicate' modes always create a new recipe.
                // For duplicate, the finished good dropdown determines which item it's filed under.
                await createRecipe(payload);
                toast.success("Recipe created successfully!");
            }
            
            // Reset form
            setEditRecipeId(null);
            setIsDuplicating(false);

            setFormData({
                recipe_name: '',
                applicable_date: new Date().toISOString().split('T')[0],
                unit_of_manufacture: 1,
            });
            setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
            
            // Refresh list
            await fetchData();

            // After saving, find the stock item object so the parent can switch to view mode
            // showing the correct item's recipes. When stockItem prop is set (and not duplicating),
            // that item is already known by the parent — pass null to use default handling.
            // When creating/duplicating without a stockItem prop, resolve from allItems.
            const savedItem = (stockItem && !isDuplicating)
                ? null  // Parent already has the item as selectedItem
                : allItems.find(i => i.id === resolvedStockItemId) || null;
            if (onSaveSuccess) onSaveSuccess(savedItem);
        } catch (error) {
            console.error("Error saving recipe", error);
            toast.error(error.response?.data?.detail || "Failed to save recipe.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this recipe?")) return;
        try {
            setLoading(true);
            await deleteRecipe(id);
            toast.success("Recipe deleted.");
            if (editRecipeId === id) {
                setEditRecipeId(null);
                setFormData({
                    recipe_name: '',
                    applicable_date: new Date().toISOString().split('T')[0],
                    unit_of_manufacture: 1,
                });
                setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
            }
            fetchData();
        } catch (error) {
            console.error("Error deleting recipe", error);
            toast.error("Failed to delete recipe.");
            setLoading(false);
        }
    };

    const handleEdit = (recipe) => {
        setEditRecipeId(recipe.id);
        setIsDuplicating(false);
        setSelectedStockItemId(recipe.stock_item ? recipe.stock_item.toString() : '');
        setFormData({
            recipe_name: recipe.recipe_name,
            applicable_date: recipe.applicable_date,
            unit_of_manufacture: recipe.unit_of_manufacture,
        });
        if (recipe.recipe_details && recipe.recipe_details.length > 0) {
            setIngredients(recipe.recipe_details.map(detail => {
                const item = allItems.find(i => i.id === detail.stock_item);
                return {
                    stock_item: detail.stock_item,
                    quantity: detail.quantity,
                    unit: detail.unit,
                    unit_name: item ? item.base_unit_name : ''
                };
            }));
        } else {
            setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
        }
    };

    const handleDuplicate = (recipe) => {
        setEditRecipeId(null);
        setIsDuplicating(true);
        // Remember the source so we can decide create vs update on save

        // Pre-fill form with source recipe data
        setFormData({
            recipe_name: recipe.recipe_name + ' (Copy)',
            applicable_date: new Date().toISOString().split('T')[0],
            unit_of_manufacture: recipe.unit_of_manufacture,
        });
        // Pre-select the same finished good in the dropdown
        setSelectedStockItemId(recipe.stock_item.toString());
        if (recipe.recipe_details && recipe.recipe_details.length > 0) {
            setIngredients(recipe.recipe_details.map(detail => {
                const item = allItems.find(i => i.id === detail.stock_item);
                return {
                    stock_item: detail.stock_item,
                    quantity: detail.quantity,
                    unit: detail.unit,
                    unit_name: item ? item.base_unit_name : ''
                };
            }));
        } else {
            setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
        }
    };

    const currentBaseUnitName = (stockItem && !isDuplicating)
        ? (stockItem.base_unit_name || allItems.find(i => String(i.id) === String(stockItem.id))?.base_unit_name || '')
        : (allItems.find(i => String(i.id) === String(selectedStockItemId))?.base_unit_name || bomItems.find(i => String(i.id) === String(selectedStockItemId))?.base_unit_name || '');

    return (
        <div className="recipe-form-container">
            {loading && recipes.length === 0 ? (
                            <div className="d-flex justify-content-center">
                                <Spinner animation="border" variant="primary" />
                            </div>
                        ) : (
                            <>
                                {mode === 'view' && !editRecipeId && (
                                        <div className="items-table-box mb-4">
                                            <h5 className="font-w600 mb-3" style={{ fontSize: '14px', color: '#334155' }}>
                                                Existing Recipes
                                            </h5>
                                            {recipes.length > 0 ? (
                                                <Table responsive hover size="sm" className="mb-0">
                                                    <thead className="table-custom-header">
                                                        <tr>
                                                            <th>Recipe Name</th>
                                                            <th>Applicable Date</th>
                                                            <th>Unit of Manufacture</th>
                                                            <th>Created By</th>
                                                            <th>Ingredients</th>
                                                            <th className="text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {recipes.map(recipe => (
                                                            <tr key={recipe.id}>
                                                                <td className="align-middle">{recipe.recipe_name}</td>
                                                                <td className="align-middle">{recipe.applicable_date}</td>
                                                                <td className="align-middle">{recipe.unit_of_manufacture} {recipe.primary_unit_name}</td>
                                                                <td className="align-middle">{recipe.created_by_name || '-'}</td>
                                                                <td className="align-middle">{recipe.recipe_details?.length || 0} items</td>
                                                                <td className="text-center">
                                                                    <button type="button" className="btn-edit-row me-2" onClick={() => handleEdit(recipe)} title="Edit">
                                                                        <i className="fas fa-pencil-alt"></i>
                                                                    </button>
                                                                    <button type="button" className="btn-duplicate-row me-2" onClick={() => handleDuplicate(recipe)} title="Duplicate">
                                                                        <i className="fa fa-copy"></i>
                                                                    </button>
                                                                    <button type="button" className="btn-remove-row" onClick={() => handleDelete(recipe.id)} title="Delete">
                                                                        <i className="fa fa-trash"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            ) : (
                                                <div className="text-center py-4 text-muted">
                                                    No recipes found for this item.
                                                </div>
                                            )}
                                        </div>
                                )}

                                {(mode === 'create' || editRecipeId || isDuplicating) && (
                                <Form onSubmit={handleSubmit}>
                                    <div className="journal-header-box">
                                       
                                        <Row className="mb-3 g-3">
                                        <Form.Group as={Col} md={6}>
                                            <Form.Label className="form-label-custom">Recipe Name <span className="text-danger">*</span></Form.Label>
                                            <Form.Control
                                                ref={recipeNameRef}
                                                type="text"
                                                name="recipe_name"
                                                value={formData.recipe_name}
                                                onChange={handleFormChange}
                                                onKeyDown={handleInputKeyDown}
                                                onFocus={(e) => e.target.select()}
                                                className="form-control-custom"
                                                required
                                            />
                                        </Form.Group>
                                        <Form.Group as={Col} md={6}>
                                            <Form.Label className="form-label-custom">Applicable Date <span className="text-danger">*</span></Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="applicable_date"
                                                value={formData.applicable_date}
                                                onChange={handleFormChange}
                                                onKeyDown={handleInputKeyDown}
                                                className="form-control-custom"
                                                required
                                            />
                                        </Form.Group>
                                    </Row>

                                    <Row className="mb-3 align-items-end g-3">
                                        <Form.Group as={Col} md={6}>
                                            <Form.Label className="form-label-custom">Finished Goods <span className="text-danger">*</span></Form.Label>
                                            {(stockItem && !isDuplicating) ? (
                                                <Form.Control
                                                    type="text"
                                                    value={stockItem.name}
                                                    className="form-control-custom"
                                                    readOnly
                                                    disabled
                                                />
                                            ) : (
                                                <Select
                                                    ref={finishedGoodsRef}
                                                    options={[
                                                        { value: '', label: '---------------', isDivider: true },
                                                        ...bomItems.map(item => ({ value: item.id, label: item.name }))
                                                    ]}
                                                    value={[
                                                        { value: '', label: '---------------', isDivider: true },
                                                        ...bomItems.map(item => ({ value: item.id, label: item.name }))
                                                    ].find(o => String(o.value) === String(selectedStockItemId)) || null}
                                                    onChange={(opt) => {
                                                        setSelectedStockItemId(opt ? opt.value : '');
                                                        // Automatically focus and select Unit of Manufacture after selection
                                                        setTimeout(() => {
                                                            const container = document.querySelector('.recipe-form-container');
                                                            if (container) {
                                                                const unitInput = container.querySelector('input[name="unit_of_manufacture"]');
                                                                unitInput?.focus();
                                                                unitInput?.select();
                                                            }
                                                        }, 50);
                                                    }}
                                                    onKeyDown={handleSelectKeyDown}
                                                    placeholder="Select Finished Good..."
                                                    isClearable
                                                    openMenuOnFocus={true}
                                                    styles={selectStyles}
                                                    isOptionDisabled={(opt) => !!opt.isDivider}
                                                    classNamePrefix="react-select"
                                                    menuPortalTarget={document.body}
                                                />
                                            )}
                                        </Form.Group>
                                        <Form.Group as={Col} md={6}>
                                            <Form.Label className="form-label-custom">Unit of Manufacture <span className="text-danger">*</span></Form.Label>
                                            <div style={{ position: 'relative' }}>
                                                <Form.Control
                                                    type="number"
                                                    name="unit_of_manufacture"
                                                    value={formData.unit_of_manufacture}
                                                    onChange={handleFormChange}
                                                    onKeyDown={handleInputKeyDown}
                                                    onFocus={(e) => e.target.select()}
                                                    className="form-control-custom"
                                                    min="1"
                                                    style={{ paddingRight: currentBaseUnitName ? '80px' : undefined }}
                                                    required
                                                />
                                                {currentBaseUnitName && (
                                                    <span className="unit-badge">
                                                        {currentBaseUnitName}
                                                    </span>
                                                )}
                                            </div>
                                        </Form.Group>
                                    </Row>
                                </div>

                                <div className="items-table-box mb-4">
                                    <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '16px' }}>
                                        <div className="journal-section-head" style={{ marginBottom: 0 }}>
                                            <div className="journal-section-icon journal-icon-ingredients">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                                    <polyline points="2 12 12 17 22 12"></polyline>
                                                    <polyline points="2 17 12 22 22 17"></polyline>
                                                </svg>
                                            </div>
                                            <span>Ingredients</span>
                                            <div className="journal-section-line"></div>
                                        </div>
                                    </div>
                                    <div className="recipe-table-wrapper" style={{ overflowX: 'auto' }}>
                                        <Table className="mb-0 recipe-ingredients-table" style={{ background: '#fff' }}>
                                            <thead>
                                                <tr>
                                                    <th width="5%">#</th>
                                                    <th width="45%">Stock Item <span className="text-danger">*</span></th>
                                                    <th width="20%">Quantity <span className="text-danger">*</span></th>
                                                    <th width="20%">Rate () / Unit</th>
                                                    <th width="10%" className="text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ingredients.map((ingredient, index) => (
                                                    <tr key={index}>
                                                        <td style={{ color: '#94a3b8', fontSize: '13px', verticalAlign: 'middle' }}>{index + 1}</td>
                                                        <td>
                                                            <Select
                                                                ref={(el) => { selectRefs.current[index] = el; }}
                                                                options={[
                                                                    { value: '', label: '---------------', isDivider: true },
                                                                    ...allItems.map(item => ({ value: item.id, label: item.name }))
                                                                ]}
                                                                value={[
                                                                    { value: '', label: '---------------', isDivider: true },
                                                                    ...allItems.map(item => ({ value: item.id, label: item.name }))
                                                                ].find(o => String(o.value) === String(ingredient.stock_item)) || null}
                                                                onChange={(opt) => {
                                                                    const val = (opt && !opt.isDivider) ? opt.value : '';
                                                                    handleIngredientChange(index, 'stock_item', val);
                                                                    // Only auto-focus and select quantity when a real item is selected
                                                                    if (val) {
                                                                        setTimeout(() => {
                                                                            const container = document.querySelector('.recipe-form-container');
                                                                            if (container) {
                                                                                const quantityInputs = Array.from(container.querySelectorAll('input[type="number"]'));
                                                                                // unit_of_manufacture is index 0; ingredient qty inputs start at index 1
                                                                                const targetQtyInput = quantityInputs[index + 1];
                                                                                targetQtyInput?.focus();
                                                                                targetQtyInput?.select();
                                                                            }
                                                                        }, 50);
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => handleSelectKeyDown(e, index)}
                                                                placeholder="Select Item..."
                                                                isClearable
                                                                openMenuOnFocus={true}
                                                                styles={selectStyles}
                                                                isOptionDisabled={(opt) => !!opt.isDivider}
                                                                classNamePrefix="react-select"
                                                                menuPortalTarget={document.body}
                                                            />
                                                        </td>
                                                        <td className="align-middle">
                                                            <Form.Control
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={ingredient.quantity}
                                                                onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                                                                onKeyDown={(e) => handleQuantityKeyDown(e, index)}
                                                                onFocus={(e) => e.target.select()}
                                                                className="form-control-custom"
                                                                required
                                                            />
                                                        </td>
                                                        <td className="align-middle">
                                                            {ingredient.unit_name || '-'}
                                                        </td>
                                                        <td className="align-middle text-center">
                                                            <button 
                                                                type="button" 
                                                                className="btn-remove-row" 
                                                                onClick={() => removeIngredientRow(index)}
                                                                disabled={ingredients.length === 1}
                                                            >
                                                                &times;
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </Table>
                                </div>
                                    
                                    <div className="mt-3">
                                        <button type="button" className="btn-add-row" onClick={addIngredientRow}>
                                            + Add Item Row
                                        </button>
                                    </div>
                                </div>

                                    <div className="modal-footer-custom mt-4">
                                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                            {ingredients.filter(i => i.stock_item).length} Item(s)
                                        </div>
                                        <div className="d-flex gap-2">
                                            {editRecipeId && (
                                                <button type="button" className="btn btn-outline-custom" style={{ backgroundColor: "white", color: "var(--cancel-btn-color, #dc3545)", border: "1px solid var(--cancel-btn-color, #dc3545)", borderRadius: '8px', padding: '8px 20px', fontWeight: 500 }} onClick={() => {
                                                    setEditRecipeId(null);
                                                    setFormData({
                                                        recipe_name: '',
                                                        applicable_date: new Date().toISOString().split('T')[0],
                                                        unit_of_manufacture: 1,
                                                    });
                                                    setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
                                                }} disabled={saving}>
                                                    Cancel Edit
                                                </button>
                                            )}
                                            {isDuplicating && (
                                                <button type="button" className="btn btn-outline-custom" style={{ backgroundColor: "white", color: "var(--cancel-btn-color, #dc3545)", border: "1px solid var(--cancel-btn-color, #dc3545)", borderRadius: '8px', padding: '8px 20px', fontWeight: 500 }} onClick={() => {
                                                    setIsDuplicating(false);
                                                    setSelectedStockItemId('');
                                                    setFormData({
                                                        recipe_name: '',
                                                        applicable_date: new Date().toISOString().split('T')[0],
                                                        unit_of_manufacture: 1,
                                                    });
                                                    setIngredients([{ stock_item: '', quantity: 1, unit: '', unit_name: '' }]);
                                                }} disabled={saving}>
                                                    Cancel
                                                </button>
                                            )}
                                            <button type="button" className="btn-close-custom" onClick={onCancel} disabled={saving}>
                                                {(editRecipeId || isDuplicating) ? 'Close' : 'Cancel'}
                                            </button>
                                            <button type="submit" className="btn-save-custom" disabled={saving}>
                                                {saving
                                                    ? 'Saving...'
                                                    : editRecipeId
                                                        ? 'Update Recipe'
                                                        : isDuplicating
                                                            ? 'Save'
                                                            : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                </Form>
                                )}
                            </>
                        )}
        </div>
    );
};

const styles = `
    .item-custom-modal .btn-outline-custom {
        background-color: white !important;
        border: 1px solid var(--cancel-btn-color, #dc3545) !important; color: var(--cancel-btn-color, #dc3545) !important;
        border-radius: 8px !important;
        padding: 8px 20px !important;
        font-weight: 500;
    }
    .item-custom-modal .btn-outline-custom:hover {
        background-color: var(--cancel-btn-color, #dc3545) !important;
        color: white !important;
    }
    .item-custom-modal .btn-close-custom {
        background-color: var(--cancel-btn-color, #dc3545) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 8px 20px !important;
        font-weight: 500;
    }
    .item-custom-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
    .item-custom-modal .btn-save-custom {
        background-color: var(--save-btn-color, #0a500f) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 8px 20px !important;
        font-weight: 500;
    }
    .item-custom-modal .btn-save-custom:hover, .btn-save-custom:active, .btn-save-custom:focus { background-color: var(--save-btn-color, #0a500f) !important; border-color: var(--save-btn-color, #0a500f) !important; opacity: 1 !important; box-shadow: none !important; }
    .item-custom-modal .btn-save-custom:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .unit-badge {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        background: #f1f5f9;
        color: #475569;
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        pointer-events: none;
        border: 1px solid #e2e8f0;
    }
    [data-theme-version="dark"] .unit-badge {
        color: #c4b5fd !important;
        background: rgba(122, 112, 186, 0.25) !important;
        border-color: rgba(122, 112, 186, 0.5) !important;
    }
`;

export default function RecipeFormWithStyles(props) {
    return (
        <>
            <style>{styles}</style>
            <RecipeForm {...props} />
        </>
    );
}

