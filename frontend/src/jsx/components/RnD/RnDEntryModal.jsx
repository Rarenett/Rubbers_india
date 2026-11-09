import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Row, Col, Spinner, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import RnDService from '../../../services/RnDService';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return cleanDate;
    }
    return dateStr;
};

const RnDEntryModal = ({ show, onHide, entry, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const damagedQtyRef = useRef(null);

    const [damagedQty, setDamagedQty] = useState('');
    const [balanceQty, setBalanceQty] = useState(0);
    const [validationError, setValidationError] = useState('');

    const manufacturedQty = entry ? parseFloat(entry.manufactured_quantity ?? entry.balance_primary ?? 0) : 0;
    const unitName = entry?.unit_name || entry?.base_unit_name || 'Units';

    useEffect(() => {
        if (show && entry) {
            if (entry.damaged_quantity !== null && entry.damaged_quantity !== undefined) {
                setDamagedQty(String(entry.damaged_quantity));
            } else {
                setDamagedQty('');
            }
            setValidationError('');

            setTimeout(() => {
                damagedQtyRef.current?.focus();
            }, 100);
        }
    }, [entry, show]);

    // Recalculate balance whenever damagedQty or manufacturedQty changes
    useEffect(() => {
        if (!entry) return;

        if (damagedQty === '' || damagedQty === null || isNaN(Number(damagedQty))) {
            setBalanceQty(manufacturedQty);
            setValidationError('');
            return;
        }

        const dQty = parseFloat(damagedQty);

        if (dQty < 0) {
            setValidationError('Damaged quantity cannot be negative.');
            setBalanceQty(manufacturedQty);
        } else if (dQty > manufacturedQty) {
            setValidationError(`Damaged quantity cannot exceed manufactured quantity (${manufacturedQty.toFixed(2)}).`);
            setBalanceQty(0);
        } else {
            setValidationError('');
            const bal = manufacturedQty - dQty;
            setBalanceQty(bal >= 0 ? Number(bal.toFixed(2)) : 0);
        }
    }, [damagedQty, manufacturedQty, entry]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (damagedQty === '' || isNaN(Number(damagedQty))) {
            Swal.fire('Validation', 'Please enter a damaged quantity (0 is allowed).', 'warning');
            return;
        }

        const dQty = parseFloat(damagedQty);

        if (dQty < 0) {
            Swal.fire('Validation Error', 'Damaged quantity cannot be negative.', 'error');
            return;
        }

        if (dQty > manufacturedQty) {
            Swal.fire('Validation Error', `Damaged quantity (${dQty}) cannot exceed manufactured quantity (${manufacturedQty.toFixed(2)}).`, 'error');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                post_production_entry: entry.post_production_entry_id || entry.id,
                damaged_quantity: dQty
            };

            if (entry.rnd_entry_id) {
                await RnDService.updateRnDEntry(entry.rnd_entry_id, payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Updated',
                    text: 'R&D entry updated successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                await RnDService.createRnDEntry(payload);
                Swal.fire({
                    icon: 'success',
                    title: 'Saved',
                    text: 'R&D entry created successfully!',
                    timer: 2000,
                    showConfirmButton: false
                });
            }

            if (onSuccess) onSuccess();
            onHide();
        } catch (error) {
            console.error('Error saving R&D entry:', error);
            const errData = error.response?.data;
            let msg = 'Failed to save R&D entry.';
            if (errData?.damaged_quantity?.[0]) {
                msg = errData.damaged_quantity[0];
            } else if (errData?.post_production_entry?.[0]) {
                msg = errData.post_production_entry[0];
            } else if (errData?.detail) {
                msg = errData.detail;
            }
            Swal.fire('Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!entry) return null;

    const isEdit = Boolean(entry.rnd_entry_id);

    return (
        <>
            <style>{`
                .item-custom-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.12) !important;
                    overflow: hidden;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46,206,138,.2);
                }
                .item-custom-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                }
                .item-custom-modal .modal-close-x:hover {
                    color: #555;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 24px 28px;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 20px 28px 24px 28px;
                    border-top: 1px solid #f1f5f9;
                    background-color: #fafbfc;
                    gap: 12px;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 14px;
                    font-weight: 500;
                    color: #4a5568;
                    margin-bottom: 8px;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 10px;
                    padding: 12px 16px;
                    font-size: 14px;
                    color: inherit;
                    width: 100%;
                    transition: border-color .2s, box-shadow .2s;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none;
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46,206,138,.15);
                }
                .item-custom-modal .form-control-readonly {
                    background-color: #f8fafc !important;
                    border-color: #e2e8f0 !important;
                    color: #475569 !important;
                    cursor: not-allowed;
                }
                .item-custom-modal .btn-close-custom {
                    background-color: #7A70BA !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-close-custom:hover {
                    background-color: #6357a7 !important;
                }
                .item-custom-modal .btn-save-custom {
                    background-color: #2ece8a !important;
                    color: white !important;
                    border-radius: 8px !important;
                    font-weight: 500 !important;
                    font-size: 14px !important;
                    padding: 10px 24px !important;
                    border: none !important;
                    cursor: pointer;
                    transition: background-color 0.2s, transform 0.1s;
                }
                .item-custom-modal .btn-save-custom:hover:not(:disabled) {
                    background-color: #26b277 !important;
                }
                .item-custom-modal .btn-save-custom:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .unit-badge-custom {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 12px;
                    font-weight: 600;
                    color: #7A70BA;
                    background: #f0eeff;
                    border: 1px solid #d1cdf5;
                    border-radius: 4px;
                    padding: 2px 8px;
                    pointer-events: none;
                }

                /* Dark mode */
                [data-theme-version="dark"] .item-custom-modal .modal-content { background-color: #2F363E !important; }
                [data-theme-version="dark"] .item-custom-modal .modal-header-custom { border-bottom-color: #3d464e !important; }
                [data-theme-version="dark"] .item-custom-modal .modal-footer-custom { background-color: #24292D !important; border-top-color: #3d464e !important; }
                [data-theme-version="dark"] .item-custom-modal .form-label-custom { color: #a0aec0 !important; }
                [data-theme-version="dark"] .item-custom-modal .form-control-custom { background-color: #24292D !important; border-color: #4a5568 !important; color: #fff !important; }
                [data-theme-version="dark"] .item-custom-modal .form-control-readonly { background-color: #1e2226 !important; border-color: #3d464e !important; color: #cbd5e1 !important; }
                [data-theme-version="dark"] .item-custom-modal .modal-title { color: #fff !important; }
                [data-theme-version="dark"] .item-custom-modal .modal-close-x { color: #888; }
                [data-theme-version="dark"] .item-custom-modal .modal-close-x:hover { color: #ccc; }
            `}</style>

            <Modal show={show} onHide={onHide} size="lg" centered dialogClassName="item-custom-modal">
                <div className="modal-header-custom">
                    <div className="d-flex align-items-center gap-3">
                        <div className="modal-icon-circle">
                            <i className="fa fa-flask text-white" style={{ fontSize: '20px' }}></i>
                        </div>
                        <div>
                            <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px' }}>
                                {isEdit ? 'Edit R&D Entry' : 'Add R&D Entry'}
                            </h4>
                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                {entry.production_line_name} &bull; Production Date: {formatDate(entry.production_date)}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close-x" onClick={onHide}>&times;</button>
                </div>

                <Form onSubmit={handleSubmit}>
                    <div className="modal-body-custom">
                        {/* Row 1: Line & Product info */}
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">Production Date</Form.Label>
                                    <Form.Control
                                        type="text"
                                        readOnly
                                        className="form-control-custom form-control-readonly"
                                        value={formatDate(entry.production_date)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">Production Line</Form.Label>
                                    <Form.Control
                                        type="text"
                                        readOnly
                                        className="form-control-custom form-control-readonly"
                                        value={entry.production_line_name || ''}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">Stock Item / Product</Form.Label>
                                    <Form.Control
                                        type="text"
                                        readOnly
                                        className="form-control-custom form-control-readonly"
                                        value={entry.stock_item_name || ''}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">
                                        Manufactured Quantity <span className="text-muted font-w400">(Read-only)</span>
                                    </Form.Label>
                                    <div style={{ position: 'relative' }}>
                                        <Form.Control
                                            type="text"
                                            readOnly
                                            className="form-control-custom form-control-readonly font-w600"
                                            style={{ paddingRight: '75px' }}
                                            value={manufacturedQty.toFixed(2)}
                                        />
                                        <span className="unit-badge-custom">{unitName}</span>
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>

                        <hr className="my-3" style={{ borderColor: '#e2e8f0' }} />

                        {/* Row 2: R&D Damaged Qty & Balance Qty */}
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">
                                        Damaged Quantity <span className="text-danger">*</span>
                                    </Form.Label>
                                    <div style={{ position: 'relative' }}>
                                        <Form.Control
                                            ref={damagedQtyRef}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={manufacturedQty}
                                            className={`form-control-custom ${validationError ? 'is-invalid' : ''}`}
                                            style={{ paddingRight: '75px' }}
                                            placeholder="Enter damaged quantity"
                                            value={damagedQty}
                                            onChange={(e) => setDamagedQty(e.target.value)}
                                            required
                                        />
                                        <span className="unit-badge-custom">{unitName}</span>
                                    </div>
                                    {validationError ? (
                                        <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                                            <i className="fa fa-exclamation-circle me-1"></i>
                                            {validationError}
                                        </div>
                                    ) : (
                                        <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                            Zero (0) damaged quantity is valid.
                                        </div>
                                    )}
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="form-label-custom">
                                        Balance Quantity <span className="text-muted font-w400">(Auto-calculated)</span>
                                    </Form.Label>
                                    <div style={{ position: 'relative' }}>
                                        <Form.Control
                                            type="text"
                                            readOnly
                                            className="form-control-custom form-control-readonly font-w600"
                                            style={{
                                                color: balanceQty > 0 ? '#15803D' : '#475569',
                                                backgroundColor: balanceQty > 0 ? '#F0FDF4' : undefined,
                                                paddingRight: '75px'
                                            }}
                                            value={balanceQty.toFixed(2)}
                                        />
                                        <span className="unit-badge-custom">{unitName}</span>
                                    </div>
                                    <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                                        <i className="fa fa-calculator me-1"></i>
                                        Balance = Manufactured ({manufacturedQty.toFixed(2)}) - Damaged ({parseFloat(damagedQty || 0).toFixed(2)}) {unitName}
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>
                    </div>

                    <div className="modal-footer-custom">
                        <Button
                            type="button"
                            className="btn-close-custom"
                            onClick={onHide}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="btn-save-custom"
                            disabled={loading || Boolean(validationError)}
                        >
                            {loading ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </Button>
                    </div>
                </Form>
            </Modal>
        </>
    );
};

export default RnDEntryModal;
