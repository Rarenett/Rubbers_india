import React, { useState, useEffect, useContext } from 'react';
import { Form, Button, Card, Row, Col } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import SalesService from '../../../services/SalesService';
import CompanyDatePicker from '../Common/CompanyDatePicker';
import { ThemeContext } from '../../../context/ThemeContext';

const DailyEntryForm = ({ entryData = null, isEditing = false, onSave, onCancel }) => {
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [entryDate, setEntryDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [totalSales, setTotalSales] = useState('0.00');
    const [totalOutstanding, setTotalOutstanding] = useState('0.00');
    const [totalSalesDisplay, setTotalSalesDisplay] = useState('0');
    const [totalOutstandingDisplay, setTotalOutstandingDisplay] = useState('0');

    const formatIndianNumber = (val) => {
        if (val === undefined || val === null || val === '') return '';
        const num = parseFloat(val);
        if (isNaN(num)) return '';
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    };
    const [productionItems, setProductionItems] = useState([
        { product: '', quantity: '', sales_quantity: '' }
    ]);
    const [stockItems, setStockItems] = useState([]);
    const [loadingStock, setLoadingStock] = useState(false);

    // Sales quantities cache for selected date
    const [dateSalesQuantities, setDateSalesQuantities] = useState({});
    const [loadingSalesQuantities, setLoadingSalesQuantities] = useState(false);

    // Fetch stock items for dropdown selection
    useEffect(() => {
        const loadStock = async () => {
            setLoadingStock(true);
            try {
                const res = await SalesService.getStockItems();
                const itemsList = Array.isArray(res.data) ? res.data : res.data?.results || [];
                // Show all stock / finished items in dropdown
                setStockItems(itemsList);
            } catch (err) {
                console.error('Failed to load stock items:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to fetch stock items for selection.'
                });
            } finally {
                setLoadingStock(false);
            }
        };
        loadStock();
    }, []);

    // Fetch sales quantities for the selected entryDate
    useEffect(() => {
        if (!entryDate) {
            setDateSalesQuantities({});
            return;
        }
        const fetchSalesQuantities = async () => {
            setLoadingSalesQuantities(true);
            try {
                const res = await SalesService.getProductSalesQuantities(entryDate);
                setDateSalesQuantities(res.data || {});
            } catch (err) {
                console.error('Failed to load sales quantities for date:', err);
                setDateSalesQuantities({});
            } finally {
                setLoadingSalesQuantities(false);
            }
        };
        fetchSalesQuantities();
    }, [entryDate]);

    const [shouldFocusNewRow, setShouldFocusNewRow] = useState(false);

    useEffect(() => {
        if (shouldFocusNewRow) {
            setShouldFocusNewRow(false);
            setTimeout(() => {
                const selects = document.querySelectorAll('input[id^="react-select-"]');
                if (selects.length > 0) {
                    const lastSelect = selects[selects.length - 1];
                    if (lastSelect) lastSelect.focus();
                }
            }, 50);
        }
    }, [productionItems.length, shouldFocusNewRow]);

    // Set initial values when editing
    useEffect(() => {
        if (entryData) {
            setEntryDate(entryData.entry_date || '');
            setTotalSales(entryData.total_sales || '0.00');
            setTotalOutstanding(entryData.total_outstanding || '0.00');
            setTotalSalesDisplay(formatIndianNumber(entryData.total_sales || '0.00'));
            setTotalOutstandingDisplay(formatIndianNumber(entryData.total_outstanding || '0.00'));
            if (entryData.production_items && entryData.production_items.length > 0) {
                setProductionItems(
                    entryData.production_items.map(item => {
                        const sq = item.sales_quantity;
                        const cleanSq = (sq !== undefined && sq !== null && parseFloat(sq) > 0) ? String(sq) : '';
                        return {
                            product: item.product,
                            quantity: item.quantity,
                            sales_quantity: cleanSq
                        };
                    })
                );
            } else {
                setProductionItems([{ product: '', quantity: '', sales_quantity: '' }]);
            }
        } else {
            setTotalSales('0.00');
            setTotalOutstanding('0.00');
            setTotalSalesDisplay('0');
            setTotalOutstandingDisplay('0');
            setEntryDate(new Date().toLocaleDateString('en-CA'));
            setProductionItems([{ product: '', quantity: '', sales_quantity: '' }]);
        }
    }, [entryData]);

    const handleSalesFocus = () => {
        setTotalSalesDisplay(totalSales === '0.00' || parseFloat(totalSales) === 0 ? '' : totalSales);
    };

    const handleSalesChange = (e) => {
        const rawVal = e.target.value;
        if (rawVal === '' || /^\d*\.?\d*$/.test(rawVal)) {
            setTotalSales(rawVal);
            setTotalSalesDisplay(rawVal);
        }
    };

    const handleSalesBlur = () => {
        const formatted = formatIndianNumber(totalSales);
        setTotalSalesDisplay(formatted || '0');
    };

    const handleOutstandingFocus = () => {
        setTotalOutstandingDisplay(totalOutstanding === '0.00' || parseFloat(totalOutstanding) === 0 ? '' : totalOutstanding);
    };

    const handleOutstandingChange = (e) => {
        const rawVal = e.target.value;
        if (rawVal === '' || /^\d*\.?\d*$/.test(rawVal)) {
            setTotalOutstanding(rawVal);
            setTotalOutstandingDisplay(rawVal);
        }
    };

    const handleOutstandingBlur = () => {
        const formatted = formatIndianNumber(totalOutstanding);
        setTotalOutstandingDisplay(formatted || '0');
    };

    const handleAddRow = () => {
        setProductionItems([...productionItems, { product: '', quantity: '', sales_quantity: '' }]);
        setShouldFocusNewRow(true);
    };

    const handleRemoveRow = (idx) => {
        const next = [...productionItems];
        next.splice(idx, 1);
        setProductionItems(next.length === 0 ? [{ product: '', quantity: '', sales_quantity: '' }] : next);
    };

    const handleRowChange = (idx, field, val) => {
        const next = [...productionItems];
        if (field === 'product') {
            if (!val) {
                // Automatically delete this row if it is not the only row
                if (productionItems.length > 1) {
                    handleRemoveRow(idx);
                    return;
                }
            }
            const rawSales = dateSalesQuantities[val];
            const autoSalesQty = (rawSales !== undefined && rawSales !== null && parseFloat(rawSales) > 0) ? String(rawSales) : '';
            next[idx] = { ...next[idx], product: val, sales_quantity: autoSalesQty };
        } else {
            next[idx] = { ...next[idx], [field]: val };
        }
        setProductionItems(next);
    };

    const handleInputKeyDown = (e, idx, field) => {
        if (e.key === 'Enter') {
            const target = e.target;

            if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') {
                return;
            }

            // If react-select dropdown menu is open, Enter selects the item!
            if (target.getAttribute('aria-expanded') === 'true') {
                return;
            }

            const currentItem = (idx !== undefined && idx !== null) ? productionItems[idx] : null;

            e.preventDefault();

            // When Enter is pressed on Total Sales Qty (sales_quantity field):
            if (field === 'sales_quantity') {
                if (idx === productionItems.length - 1) {
                    if (currentItem && currentItem.product) {
                        // Product is selected -> Add a new row!
                        handleAddRow();
                    } else {
                        // No product selected -> remove this empty row if multiple rows exist & focus Save button
                        if (productionItems.length > 1 && (!currentItem || !currentItem.product)) {
                            handleRemoveRow(idx);
                        }
                        setTimeout(() => {
                            const submitBtn = document.querySelector('button[type="submit"]');
                            if (submitBtn) submitBtn.focus();
                        }, 50);
                    }
                } else {
                    // Move to next row's product dropdown
                    setTimeout(() => {
                        const selects = document.querySelectorAll('input[id^="react-select-"]');
                        if (selects[idx + 1]) selects[idx + 1].focus();
                    }, 50);
                }
                return;
            }

            const form = target.closest('form');
            if (!form) return;

            const focusable = Array.from(
                form.querySelectorAll(
                    'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
                )
            ).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && el.tabIndex !== -1;
            });

            const index = focusable.indexOf(target);
            if (index > -1 && index < focusable.length - 1) {
                focusable[index + 1].focus();
            }
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!entryDate) {
            Swal.fire({ icon: 'warning', title: 'Validation Warning', text: 'Please select an entry date.' });
            return;
        }

        const today = new Date().toLocaleDateString('en-CA');
        if (entryDate > today) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Warning',
                text: 'Future (post-dated) entry dates are not allowed.'
            });
            return;
        }

        const salesNum = parseFloat(totalSales);
        if (isNaN(salesNum) || salesNum < 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Warning', text: 'Please enter a valid Total Sales amount.' });
            return;
        }

        const outstandingNum = parseFloat(totalOutstanding);
        if (isNaN(outstandingNum) || outstandingNum < 0) {
            Swal.fire({ icon: 'warning', title: 'Validation Warning', text: 'Please enter a valid Total Outstanding amount.' });
            return;
        }

        // Filter out empty rows
        const filteredProductionItems = productionItems.filter(row => row.product !== '');
        if (filteredProductionItems.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Validation Warning',
                text: 'Please select a product for at least one row.'
            });
            return;
        }

        // Visually update the state to discard empty rows
        setProductionItems(filteredProductionItems);

        const validProductionItems = [];
        for (const row of filteredProductionItems) {
            const qtyNum = parseFloat(row.quantity);
            if (isNaN(qtyNum) || qtyNum <= 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Warning',
                    text: 'All selected products must have a valid quantity greater than 0.'
                });
                return;
            }
            const salesQtyNum = parseFloat(row.sales_quantity || 0);
            if (isNaN(salesQtyNum) || salesQtyNum < 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Validation Warning',
                    text: 'Total Sales Qty must be a valid non-negative number.'
                });
                return;
            }
            validProductionItems.push({
                product: row.product,
                quantity: qtyNum,
                sales_quantity: salesQtyNum
            });
        }

        const submissionData = {
            entry_date: entryDate,
            total_sales: salesNum,
            total_outstanding: outstandingNum,
            production_items: validProductionItems
        };

        onSave(submissionData);
    };

    // Prepare react-select options
    const selectOptions = stockItems.map(item => ({
        value: item.id,
        label: item.name + (item.base_unit?.uqc_code ? ` (${item.base_unit.uqc_code})` : '')
    }));

    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused 
                ? 'var(--cc-primary, #0a500f)' 
                : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '38px',
            height: '38px',
            borderRadius: '6px',
            boxShadow: 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'var(--cc-primary, #0a500f)' : (isDark ? '#636363' : '#ececec'),
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            height: '38px',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
            fontSize: '14px',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? '#888888' : '#7e7e7e',
            fontSize: '14px',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderColor: isDark ? '#636363' : '#ececec',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 9999
        }),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--cc-primary, #0a500f)'
                : state.isFocused
                    ? (isDark ? '#383F47' : '#f8f9fa')
                    : 'transparent',
            color: state.isSelected
                ? '#ffffff'
                : (isDark ? '#ffffff' : '#2f3f50'),
            fontSize: '14px',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: 'var(--cc-primary, #0a500f)',
                color: '#ffffff'
            }
        }),
        input: (provided) => ({
            ...provided,
            margin: '0px',
            padding: '0px',
            color: isDark ? '#ffffff' : '#2f3f50',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: isDark ? '#636363' : '#a0a0a0',
            padding: '4px 8px',
            '&:hover': {
                color: isDark ? '#ffffff' : '#2f3f50',
            }
        }),
        clearIndicator: (provided) => ({
            ...provided,
            color: isDark ? '#636363' : '#a0a0a0',
            padding: '4px 8px',
        })
    };


    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <Card.Title className="mb-0">
                    {isEditing ? 'Edit Daily Entry Summary' : 'New Daily Entry Summary'}
                </Card.Title>
            </Card.Header>
            <Card.Body>
                <Form onSubmit={handleSubmit} onKeyDown={handleInputKeyDown}>

                    {/* ── Top Section: Date + Sales + Outstanding ── */}
                    <div className="p-3 mb-4 rounded bg-light" style={{ border: '1px solid #e9ecef' }}>
                        <h6 className="fw-bold text-secondary mb-3" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Summary Information
                        </h6>
                        <Row className="g-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-secondary small mb-1">
                                        Entry Date
                                    </Form.Label>
                                    <CompanyDatePicker
                                        name="entryDate"
                                        className="form-control"
                                        value={entryDate}
                                        onChange={(e, val) => setEntryDate(val || e.target.value)}
                                        disabled={isEditing}
                                        maxDate={new Date()}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '0.9rem' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-secondary small mb-1">
                                        Total Sales Amount (₹)
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="0"
                                        value={totalSalesDisplay}
                                        onChange={handleSalesChange}
                                        onFocus={handleSalesFocus}
                                        onBlur={handleSalesBlur}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '0.9rem' }}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold text-secondary small mb-1">
                                        Total Outstanding Amount (₹)
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="0"
                                        value={totalOutstandingDisplay}
                                        onChange={handleOutstandingChange}
                                        onFocus={handleOutstandingFocus}
                                        onBlur={handleOutstandingBlur}
                                        style={{ height: '38px', borderRadius: '6px', fontSize: '0.9rem' }}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </div>

                    {/* ── Bottom Section: Production Items ── */}
                    <div className="rounded overflow-hidden mb-4" style={{ border: '1px solid #e9ecef' }}>
                        {/* Section Header */}
                        <div
                            className="px-3 py-2"
                            style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}
                        >
                            <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Today's Production Details
                            </h6>
                        </div>


                        {/* Table Header */}
                        <div
                            className="d-none d-md-flex px-3 py-2"
                            style={{ background: '#f1f3f9', borderBottom: '1px solid #e9ecef' }}
                        >
                            <div style={{ flex: '1 1 0', fontWeight: 600, fontSize: '0.8rem', color: '#6c757d', textTransform: 'uppercase' }}>
                                Finished Good (Stock Item)
                            </div>
                            <div style={{ width: '180px', fontWeight: 600, fontSize: '0.8rem', color: '#6c757d', textTransform: 'uppercase', marginLeft: '12px' }}>
                                Produced Qty
                            </div>
                            <div style={{ width: '180px', fontWeight: 600, fontSize: '0.8rem', color: '#6c757d', textTransform: 'uppercase', marginLeft: '12px' }}>
                                Total Sales Qty
                            </div>
                            <div style={{ width: '100px', fontWeight: 600, fontSize: '0.8rem', color: '#6c757d', textTransform: 'uppercase', textAlign: 'center', marginLeft: '12px' }}>
                                Action
                            </div>
                        </div>

                        {/* Production Rows */}
                        <div style={{ background: '#fff' }}>
                            {productionItems.map((item, idx) => {
                                const selectedOption = selectOptions.find(opt => opt.value === item.product) || null;

                                return (
                                    <div
                                        key={idx}
                                        className="d-flex flex-wrap flex-md-nowrap align-items-center px-3 py-2 gap-2"
                                        style={{
                                            borderBottom: idx < productionItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                                            background: idx % 2 === 0 ? '#fff' : '#fafbfc'
                                        }}
                                    >
                                        {/* Product Selector */}
                                        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                                            <Form.Label className="d-md-none small text-muted mb-1">Finished Good</Form.Label>
                                            <Select
                                                options={selectOptions}
                                                value={selectedOption}
                                                onChange={(opt) => {
                                                    const val = opt ? opt.value : '';
                                                    handleRowChange(idx, 'product', val);
                                                    if (val) {
                                                        setTimeout(() => {
                                                            const qtyInput = document.getElementById(`qty-input-${idx}`);
                                                            if (qtyInput) qtyInput.focus();
                                                        }, 100);
                                                    }
                                                }}
                                                placeholder="Search and select product..."
                                                isClearable
                                                isLoading={loadingStock}
                                                styles={customSelectStyles}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                                openMenuOnFocus={true}
                                                onKeyDown={(e) => handleInputKeyDown(e, idx, 'product')}
                                            />
                                        </div>

                                        {/* Quantity Input */}
                                        <div style={{ width: '180px', minWidth: '130px' }}>
                                            <Form.Label className="d-md-none small text-muted mb-1">Qty</Form.Label>
                                            <Form.Control
                                                id={`qty-input-${idx}`}
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="Enter quantity"
                                                value={item.quantity}
                                                onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                                onKeyDown={(e) => handleInputKeyDown(e, idx, 'quantity')}
                                                style={{ height: '38px', borderRadius: '6px', fontSize: '0.9rem' }}
                                            />
                                        </div>

                                        {/* Sales Quantity Input */}
                                        <div style={{ width: '180px', minWidth: '130px' }}>
                                            <Form.Label className="d-md-none small text-muted mb-1">Total Sales Qty</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                placeholder="Enter sales quantity"
                                                value={(item.sales_quantity === '0.000' || item.sales_quantity === '0' || item.sales_quantity === 0) ? '' : item.sales_quantity}
                                                onChange={(e) => handleRowChange(idx, 'sales_quantity', e.target.value)}
                                                onKeyDown={(e) => handleInputKeyDown(e, idx, 'sales_quantity')}
                                                style={{ height: '38px', borderRadius: '6px', fontSize: '0.9rem' }}
                                            />
                                        </div>

                                        {/* Row Action Buttons */}
                                        <div style={{ width: '100px', flexShrink: 0 }} className="d-flex gap-1 justify-content-center">
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={handleAddRow}
                                                style={{ borderRadius: '6px', width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Add row"
                                            >
                                                <i className="fa fa-plus"></i>
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleRemoveRow(idx)}
                                                style={{ borderRadius: '6px', width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                title="Remove row"
                                                disabled={productionItems.length === 1}
                                            >
                                                <i className="fa fa-trash"></i>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Empty state */}
                        {productionItems.length === 0 && (
                            <div className="text-center py-4 text-muted">
                                <p className="mb-0">No production rows. Click "Add Row" to begin.</p>
                            </div>
                        )}
                    </div>

                    {/* ── Actions ── */}
                    <div className="d-flex justify-content-end gap-2">
                        <Button
                            className="btn-universal-close btn-cancel-custom"
                            style={{ backgroundColor: "var(--cancel-btn-color, #dc3545)", borderColor: "var(--cancel-btn-color, #dc3545)", color: "#ffffff" }}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="btn-universal-save"
                            type="submit"
                        >
                            <i className="fa fa-check me-1"></i> {isEditing ? 'Update Entry' : 'Save Entry'}
                        </Button>
                    </div>

                </Form>
            </Card.Body>
        </Card>
    );

};

export default DailyEntryForm;
