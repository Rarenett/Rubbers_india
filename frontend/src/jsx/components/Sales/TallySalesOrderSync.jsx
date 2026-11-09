import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Form, Badge, Table, Modal, Spinner, InputGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import swal from 'sweetalert';
import { usePageTitle } from '../../../context/TitleContext';
import TallyService from '../../../services/TallyService';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

const TallySalesOrderSync = () => {
    usePageTitle('Tally Synchronization');

    // ── State ──────────────────────────────────────────────────────────────
    const [config, setConfig] = useState({
        voucher_type: 'Sales Order',
        auto_push_on_save: false,
        tally_url: 'http://localhost:9000',
        last_sync_at: null,
        total_orders: 0,
        synced_orders: 0,
        pending_orders: 0,
        failed_orders: 0,
        unsynced_total: 0
    });

    const [orders, setOrders] = useState([]);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncingOrderId, setSyncingOrderId] = useState(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState(null); // { connected: bool, message: str }

    const [activeFilter, setActiveFilter] = useState('all'); // all, pending, synced, failed
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const [showEditUrlModal, setShowEditUrlModal] = useState(false);
    const [customUrlInput, setCustomUrlInput] = useState('');

    // Log modal state
    const [selectedOrderLog, setSelectedOrderLog] = useState(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedException, setCopiedException] = useState(false);
    const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);

    // ── Exception Diagnostics Helper ──────────────────────────────────────
    const getExceptionDetails = (errorMsg) => {
        if (!errorMsg) return null;
        const msgLower = errorMsg.toLowerCase();
        if (msgLower.includes('duplicate') || msgLower.includes('already exists')) {
            return {
                category: 'DUPLICATE VOUCHER IN TALLY',
                badgeClass: 'badge badge-warning light',
                title: 'Duplicate Voucher Number',
                explanation: 'A Sales Order voucher with this exact number is already recorded in Tally Prime. Tally prevents duplicate voucher numbers.',
                fix: 'Check your Day Book or Sales Order Register in Tally Prime. If this order is already in Tally, no further action is required. If you need to re-import it, delete the existing voucher in Tally first.'
            };
        }
        if (msgLower.includes('stock item') && msgLower.includes('does not exist')) {
            return {
                category: 'MISSING STOCK ITEM MASTER',
                badgeClass: 'badge badge-danger light',
                title: 'Stock Item Not Found in Tally',
                explanation: 'One or more stock items referenced in this sales order do not exist in your active Tally company.',
                fix: 'In Tally Prime, go to Gateway of Tally > Create / Alter > Stock Item, and create the missing item with the exact name shown above. Then click "Retry Push Now".'
            };
        }
        if (msgLower.includes('ledger') && msgLower.includes('does not exist')) {
            return {
                category: 'MISSING LEDGER MASTER',
                badgeClass: 'badge badge-danger light',
                title: 'Ledger Master Not Found in Tally',
                explanation: 'The customer ledger, sales account, or GST tax ledger does not exist in Tally Prime.',
                fix: 'In Tally Prime, go to Gateway of Tally > Create / Alter > Ledger, and create the missing ledger under the correct group (Sundry Debtors, Sales Accounts, Duties & Taxes).'
            };
        }
        if (msgLower.includes('voucher type') && msgLower.includes('does not exist')) {
            return {
                category: 'VOUCHER TYPE DISABLED',
                badgeClass: 'badge badge-danger light',
                title: 'Sales Order Processing Disabled',
                explanation: 'The "Sales Order" voucher type is not defined or is disabled in your Tally company.',
                fix: 'In Tally Prime, press F11 (Company Features) > enable "Enable Sales Order Processing" to "Yes", save with Ctrl+A, then retry push.'
            };
        }
        if (msgLower.includes('could not find company') || msgLower.includes('no company is currently opened')) {
            return {
                category: 'NO ACTIVE COMPANY IN TALLY',
                badgeClass: 'badge badge-warning light',
                title: 'No Company Opened in Tally Prime',
                explanation: 'Tally Prime is running, but no company is currently open (or Tally is on the Select Company screen).',
                fix: 'In Tally Prime, select and open your company (e.g. "Test Company") until you see "Gateway of Tally". Then click "Retry Push Now".'
            };
        }
        if (msgLower.includes('connect') || msgLower.includes('refused') || msgLower.includes('timeout')) {
            return {
                category: 'CONNECTION FAILED',
                badgeClass: 'badge badge-secondary light',
                title: 'Tally Server Connection Error',
                explanation: 'Unable to establish HTTP socket connection to Tally XML server.',
                fix: 'Verify Tally Prime is running on port 9000 (F12 > Advanced Configuration > Enable ODBC/XML Server), and ensure your company is currently loaded.'
            };
        }
        if (msgLower.includes('unbalanced')) {
            return {
                category: 'UNBALANCED VOUCHER',
                badgeClass: 'badge badge-danger light',
                title: 'Voucher Debit/Credit Imbalance',
                explanation: 'Total debit amount does not match total credit amount in the generated voucher XML.',
                fix: 'Verify the tax ledgers (CGST, SGST, IGST) and item price totals in the sales order.'
            };
        }
        return {
            category: 'TALLY EXCEPTION',
            badgeClass: 'badge badge-danger light',
            title: 'Tally Import Exception',
            explanation: 'Tally rejected the import of this sales order voucher during XML processing.',
            fix: 'Check if Sales Order processing is enabled in Tally Prime (F11), ensure ledger and stock item names match Tally masters, and verify the voucher date is within the active financial year.'
        };
    };

    // ── Fetch Config ───────────────────────────────────────────────────────
    const fetchConfig = useCallback(async () => {
        setLoadingConfig(true);
        try {
            const params = { voucher_type: 'Sales Order' };
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            const data = await TallyService.getTallyConfig(params);
            setConfig(data);
            setCustomUrlInput(data.tally_url || 'http://localhost:9000');
        } catch (err) {
            console.error('Error fetching Tally config:', err);
        } finally {
            setLoadingConfig(false);
        }
    }, [fromDate, toDate]);

    // ── Fetch Orders ───────────────────────────────────────────────────────
    const fetchOrders = useCallback(async () => {
        setLoadingOrders(true);
        try {
            const params = {
                status: activeFilter,
                search: searchTerm
            };
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            const data = await TallyService.getTallySalesOrders(params);
            setOrders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching Tally orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    }, [activeFilter, searchTerm, fromDate, toDate]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // ── Pagination Calculations ───────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
    const indexOfLastItem = currentPage * pageSize;
    const indexOfFirstItem = indexOfLastItem - pageSize;
    const currentOrders = orders.slice(indexOfFirstItem, indexOfLastItem);

    // Reset to first page when filtering or searching
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilter, searchTerm, fromDate, toDate]);

    // Keep page number valid if total order count decreases
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // ── Toggle Auto-Push on Save ──────────────────────────────────────────
    const handleToggleAutoPush = async (e) => {
        const newValue = e.target.checked;
        try {
            const updated = await TallyService.updateTallyConfig({
                voucher_type: 'Sales Order',
                auto_push_on_save: newValue
            });
            setConfig(prev => ({
                ...prev,
                ...updated,
                auto_push_on_save: newValue
            }));

            swal({
                title: newValue ? 'Auto-Push Enabled' : 'Auto-Push Disabled',
                text: newValue
                    ? 'Sales orders will now automatically push to Tally as soon as they are saved.'
                    : 'Sales orders will NOT push to Tally automatically when saved. Use "Push to Tally" to sync manually.',
                icon: newValue ? 'success' : 'info',
                timer: 3000,
                buttons: false
            });
        } catch (err) {
            console.error('Error updating Tally config:', err);
            swal('Error', 'Failed to update auto-push setting.', 'error');
        }
    };

    // ── Test Connection ───────────────────────────────────────────────────
    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            const res = await TallyService.testTallyConnection({ tally_url: config.tally_url });
            setConnectionStatus(res);
            if (res.connected && !res.is_idle) {
                swal('Connection Successful', res.message, 'success');
            } else if (res.connected && res.is_idle) {
                swal('Tally Detected', res.message, 'warning');
            } else {
                swal('Connection Failed', res.message, 'error');
            }
        } catch (err) {
            console.error('Connection test error:', err);
            const msg = err.response?.data?.message || err.message || 'Could not connect to Tally server.';
            setConnectionStatus({ connected: false, message: msg });
            swal('Connection Failed', msg, 'error');
        } finally {
            setTestingConnection(false);
        }
    };

    // ── Update Tally Server URL ────────────────────────────────────────────
    const handleSaveUrl = async (e) => {
        e.preventDefault();
        try {
            const updated = await TallyService.updateTallyConfig({
                voucher_type: 'Sales Order',
                tally_url: customUrlInput
            });
            setConfig(prev => ({ ...prev, ...updated, tally_url: customUrlInput }));
            setShowEditUrlModal(false);
            setConnectionStatus(null);
            swal('Updated', 'Tally server URL updated successfully.', 'success');
        } catch (err) {
            swal('Error', 'Failed to update Tally URL.', 'error');
        }
    };

    // ── Push All Pending Orders (with optional date range) ────────────────
    const handlePushAll = async () => {
        if (fromDate && toDate && fromDate > toDate) {
            swal('Invalid Date Range', 'From Date cannot be later than To Date.', 'warning');
            return;
        }

        const hasDateFilter = Boolean(fromDate || toDate);
        const dateDesc = fromDate && toDate
            ? `dated between ${formatDate(fromDate)} and ${formatDate(toDate)}`
            : fromDate
            ? `dated from ${formatDate(fromDate)} onwards`
            : toDate
            ? `dated up to ${formatDate(toDate)}`
            : '';

        const willPush = await swal({
            title: 'Push Sales Orders to Tally?',
            text: hasDateFilter
                ? `Only un-synced sales orders ${dateDesc} will be pushed to Tally Prime. Continue?`
                : 'All un-synced (pending and failed) sales orders will be pushed to Tally Prime. Continue?',
            icon: 'info',
            buttons: ['Cancel', 'Yes, Push Now'],
        });

        if (!willPush) return;

        setSyncingAll(true);
        try {
            const payload = {};
            if (fromDate) payload.from_date = fromDate;
            if (toDate) payload.to_date = toDate;

            const res = await TallyService.pushSalesOrdersToTally(payload);
            await fetchConfig();
            await fetchOrders();

            const successCount = res.synced_count || 0;
            const failedCount = res.failed_count || 0;
            const total = res.total || 0;

            if (total === 0) {
                swal('All Caught Up', hasDateFilter ? `No un-synced sales orders found ${dateDesc}.` : 'No pending or failed sales orders to push to Tally.', 'info');
            } else if (failedCount === 0) {
                swal('Push Completed!', `Successfully pushed ${successCount} sales order(s) to Tally.`, 'success');
            } else {
                swal(
                    'Push Completed with Issues',
                    `Processed ${total} orders: ${successCount} succeeded, ${failedCount} failed. Check the orders table below for details.`,
                    'warning'
                );
            }
        } catch (err) {
            console.error('Error pushing orders to Tally:', err);
            swal('Error', err.response?.data?.error || 'Failed to push orders to Tally.', 'error');
        } finally {
            setSyncingAll(false);
        }
    };

    // ── Push Single Order ─────────────────────────────────────────────────
    const handlePushSingle = async (order) => {
        setSyncingOrderId(order.id);
        try {
            const res = await TallyService.pushSalesOrdersToTally({ order_id: order.id });
            await fetchConfig();
            await fetchOrders();

            if (res.success) {
                swal('Success', `Sales order ${order.so_no} pushed to Tally successfully!`, 'success');
            } else {
                swal('Sync Failed', res.message || 'Tally returned an error.', 'error');
            }
        } catch (err) {
            console.error('Error pushing single order to Tally:', err);
            swal('Error', err.response?.data?.message || 'Failed to push sales order to Tally.', 'error');
        } finally {
            setSyncingOrderId(null);
        }
    };

    // ── Status Badge Helper ───────────────────────────────────────────────
    const renderSyncBadge = (status, isSynced) => {
        if (isSynced || status === 'synced') {
            return (
                <span className="badge badge-success light d-inline-flex align-items-center gap-1">
                    <i className="fa fa-check-circle"></i> Synced
                </span>
            );
        }
        if (status === 'failed') {
            return (
                <span className="badge badge-danger light d-inline-flex align-items-center gap-1">
                    <i className="fa fa-times-circle"></i> Failed
                </span>
            );
        }
        return (
            <span className="badge badge-warning light d-inline-flex align-items-center gap-1">
                <i className="fa fa-clock-o"></i> Pending
            </span>
        );
    };

    return (
        <div className="container-fluid py-3">
            {/* Header & Breadcrumb */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
                <div>
                    <h3 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        <span>Tally Synchronization</span>
                    </h3>
                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                        Manage sales order voucher synchronization and automatic posting to Tally ERP/Prime
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
                    <Link to="/sales/tally-invoice-sync" className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        Switch to Sales Invoices Sync
                    </Link>
                    <Link to="/sales-orders" className="btn btn-light btn-sm border">
                        <i className="fa fa-arrow-left me-1"></i> Back to Sales Orders
                    </Link>
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                    >
                        {testingConnection ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-1" />
                                Testing...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-plug me-1"></i> Test Tally Connection
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Connection Status Banner (if tested) */}
            {connectionStatus && (
                <div
                    className={`alert ${
                        !connectionStatus.connected
                            ? 'alert-danger light'
                            : connectionStatus.is_idle
                            ? 'alert-warning light'
                            : 'alert-success light'
                    } alert-dismissible fade show d-flex align-items-center justify-content-between mb-4 py-2 px-3 border`}
                    role="alert"
                >
                    <div className="d-flex align-items-center gap-2">
                        <i
                            className={`fa ${
                                !connectionStatus.connected
                                    ? 'fa-exclamation-triangle'
                                    : connectionStatus.is_idle
                                    ? 'fa-info-circle'
                                    : 'fa-check-circle'
                            } fs-5`}
                        ></i>
                        <span>{connectionStatus.message}</span>
                    </div>
                    <button type="button" className="btn-close" onClick={() => setConnectionStatus(null)}></button>
                </div>
            )}

            {/* Main Configuration Card: Module List */}
            <Card className="border shadow-sm mb-4">
                <Card.Header className="bg-white border-bottom py-3 d-flex flex-wrap justify-content-between align-items-center">
                    <div>
                        <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                            <i className="fa fa-cogs text-primary"></i> Tally Voucher Integration Modules
                        </h5>
                        <small className="text-muted">
                            Configure automatic sync per voucher type and initiate manual bulk push
                        </small>
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
                        <span className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: '12px' }}>
                            <i className="fa fa-server me-1"></i> {config.tally_url || 'http://localhost:9000'}
                        </span>
                        <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-primary text-decoration-none"
                            onClick={() => setShowEditUrlModal(true)}
                            title="Edit Tally URL"
                        >
                            <i className="fa fa-pencil"></i>
                        </Button>
                    </div>
                </Card.Header>

                <Card.Body className="p-0">
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead className="bg-light text-muted" style={{ fontSize: '13px' }}>
                                <tr>
                                    <th style={{ width: '25%' }}>Voucher Type</th>
                                    <th style={{ width: '30%' }}>Auto Push on Save</th>
                                    <th style={{ width: '25%' }}>Sync Metrics</th>
                                    <th style={{ width: '20%' }} className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {/* Name Column */}
                                    <td className="py-3">
                                        <div className="d-flex align-items-center">
                                            <div
                                                className="bg-light text-primary border rounded-3 d-flex align-items-center justify-content-center me-3"
                                                style={{ width: '42px', height: '42px', flexShrink: 0 }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                                    <polyline points="10 9 9 9 8 9"></polyline>
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark fs-6">{config.voucher_type}</div>
                                                <small className="text-muted d-block" style={{ fontSize: '12px' }}>
                                                    Sales order voucher sync to Tally
                                                </small>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Toggle Button Column */}
                                    <td className="py-3">
                                        <div className="d-flex flex-column">
                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                <Form.Check
                                                    type="switch"
                                                    id="auto-push-toggle"
                                                    checked={config.auto_push_on_save}
                                                    onChange={handleToggleAutoPush}
                                                    disabled={loadingConfig}
                                                    style={{ transform: 'scale(1.25)', cursor: 'pointer' }}
                                                />
                                                <span
                                                    className={`badge ${config.auto_push_on_save ? 'badge-success light' : 'badge-secondary light'} ms-2`}
                                                    style={{ fontSize: '11px', letterSpacing: '0.5px' }}
                                                >
                                                    {config.auto_push_on_save ? 'ON' : 'OFF'}
                                                </span>
                                            </div>
                                            <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.3' }}>
                                                {config.auto_push_on_save ? (
                                                    <span className="text-success">
                                                        <i className="fa fa-bolt me-1"></i>
                                                        <strong>Enabled:</strong> Pushes instantly to Tally when sales order is saved.
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">
                                                        <i className="fa fa-pause-circle me-1"></i>
                                                        <strong>Disabled:</strong> Won't push instantly. Only pushed when you click <em>Push to Tally</em>.
                                                    </span>
                                                )}
                                            </small>
                                        </div>
                                    </td>

                                    {/* Metrics Column */}
                                    <td className="py-3">
                                        <div className="d-flex flex-wrap gap-1 align-items-center">
                                            <span className="badge badge-warning light px-2 py-1" title="Pending orders waiting to be pushed">
                                                {config.pending_orders || 0} Pending
                                            </span>
                                            <span className="badge badge-success light px-2 py-1" title="Successfully synced orders">
                                                {config.synced_orders || 0} Synced
                                            </span>
                                            {config.failed_orders > 0 && (
                                                <span className="badge badge-danger light px-2 py-1" title="Failed attempts">
                                                    {config.failed_orders} Failed
                                                </span>
                                            )}
                                        </div>
                                        {config.last_sync_at && (
                                            <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                                                Last sync: {formatDateTime(config.last_sync_at)}
                                            </small>
                                        )}
                                    </td>

                                    {/* Action Button: Push to Tally */}
                                    <td className="py-3 text-end pe-4">
                                        <Button
                                            variant="primary"
                                            className="btn btn-primary d-inline-flex align-items-center gap-2 shadow-sm"
                                            style={{ minWidth: '140px' }}
                                            onClick={handlePushAll}
                                            disabled={syncingAll}
                                        >
                                            {syncingAll ? (
                                                <>
                                                    <Spinner animation="border" size="sm" />
                                                    <span>Pushing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="me-2">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="17 8 12 3 7 8"></polyline>
                                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                                    </svg>
                                                    <span>Push to Tally</span>
                                                </>
                                            )}
                                        </Button>
                                        {(fromDate || toDate) && (
                                            <small className="text-primary d-block mt-1 fw-semibold text-end" style={{ fontSize: '11px' }}>
                                                <i className="fa fa-filter me-1"></i>
                                                Syncs: {fromDate ? `from ${fromDate}` : ''} {toDate ? `to ${toDate}` : ''}
                                            </small>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            {/* Sales Orders Status Table */}
            <Card className="border shadow-sm">
                <Card.Header className="bg-white border-bottom py-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        {/* Filter Tabs */}
                        <div
                            className="d-inline-flex align-items-center p-1 rounded-3"
                            style={{
                                backgroundColor: '#f1f3f5',
                                border: '1px solid #e9ecef',
                                gap: '3px'
                            }}
                        >
                            {[
                                { key: 'all', label: 'All Orders', count: config.total_orders },
                                { key: 'pending', label: 'Pending', count: config.pending_orders, dot: '#f59e0b' },
                                { key: 'synced', label: 'Synced', count: config.synced_orders, dot: '#10b981' },
                                { key: 'failed', label: 'Failed', count: config.failed_orders, dot: '#ef4444' }
                            ].map(tab => {
                                const isActive = activeFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className="btn btn-sm d-inline-flex align-items-center border-0 px-3 py-1"
                                        style={{
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            lineHeight: '1.4',
                                            backgroundColor: isActive ? '#ffffff' : 'transparent',
                                            color: isActive ? '#1e293b' : '#64748b',
                                            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                                            fontWeight: isActive ? 600 : 500,
                                            transition: 'all 0.15s ease',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setActiveFilter(tab.key)}
                                    >
                                        {tab.dot && (
                                            <span
                                                className="rounded-circle d-inline-block me-1"
                                                style={{
                                                    width: '7px',
                                                    height: '7px',
                                                    backgroundColor: tab.dot,
                                                    opacity: isActive ? 1 : 0.6
                                                }}
                                            />
                                        )}
                                        <span>{tab.label}</span>
                                        <span
                                            className="ms-2 px-2 d-inline-flex align-items-center justify-content-center"
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                borderRadius: '10px',
                                                minWidth: '20px',
                                                height: '18px',
                                                backgroundColor: isActive ? '#f1f5f9' : '#e2e8f0',
                                                color: isActive ? '#0f172a' : '#64748b',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {tab.count || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Controls: Date Filter + Search + Refresh */}
                        <div className="d-flex flex-wrap align-items-center gap-2">
                            {/* Date Filter */}
                            <div className="d-flex align-items-center gap-1 bg-light p-1 px-2 rounded border">
                                <span className="text-muted small fw-semibold" style={{ fontSize: '12px' }}>
                                    <i className="fa fa-calendar me-1 text-primary"></i>From:
                                </span>
                                <Form.Control
                                    type="date"
                                    size="sm"
                                    style={{ width: '135px', height: '31px', fontSize: '12px' }}
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    title="From Date"
                                />
                                <span className="text-muted small fw-semibold ms-1" style={{ fontSize: '12px' }}>
                                    To:
                                </span>
                                <Form.Control
                                    type="date"
                                    size="sm"
                                    style={{ width: '135px', height: '31px', fontSize: '12px' }}
                                    min={fromDate || undefined}
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    title="To Date"
                                />
                                {(fromDate || toDate) && (
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        style={{ height: '31px', padding: '0 8px', fontSize: '11px' }}
                                        onClick={() => {
                                            setFromDate('');
                                            setToDate('');
                                        }}
                                        title="Clear date filter"
                                    >
                                        <i className="fa fa-times me-1"></i>Clear
                                    </Button>
                                )}
                            </div>

                            {/* Search */}
                            <div className="input-group input-group-sm" style={{ width: '200px' }}>
                                <Form.Control
                                    type="text"
                                    placeholder="Search SO or Customer..."
                                    className="border-start-0"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        className="btn btn-outline-secondary border-start-0"
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                    >
                                        <i className="fa fa-times"></i>
                                    </button>
                                )}
                            </div>

                            {/* Refresh */}
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                className="d-inline-flex align-items-center justify-content-center"
                                style={{ width: '33px', height: '31px', padding: 0 }}
                                onClick={() => {
                                    fetchConfig();
                                    fetchOrders();
                                }}
                                title="Refresh"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10"></polyline>
                                    <polyline points="1 20 1 14 7 14"></polyline>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                            </Button>
                        </div>
                    </div>
                </Card.Header>

                {/* Visual Banner when Date Filter is Active */}
                {(fromDate || toDate) && (
                    <div className="alert alert-light border-bottom mb-0 px-3 py-2 d-flex align-items-center justify-content-between text-muted small rounded-0">
                        <div className="d-flex align-items-center gap-2">
                            <i className="fa fa-filter text-primary"></i>
                            <span>
                                <strong className="text-dark">Date Filter Active:</strong> Showing sales orders {fromDate ? <>from <strong className="text-dark">{formatDate(fromDate)}</strong></> : ''} {toDate ? <>to <strong className="text-dark">{formatDate(toDate)}</strong></> : ''}.
                                <span className="text-muted ms-2 fst-italic">
                                    (Clicking "Push to Tally" will only push pending/failed orders in this selected date range)
                                </span>
                            </span>
                        </div>
                        <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-decoration-none text-danger fw-semibold"
                            onClick={() => {
                                setFromDate('');
                                setToDate('');
                            }}
                        >
                            Reset Date Filter
                        </Button>
                    </div>
                )}

                <Card.Body className="p-0">
                    <div className="table-responsive">
                        <Table hover className="align-middle mb-0">
                            <thead className="bg-light text-muted" style={{ fontSize: '13px' }}>
                                <tr>
                                    <th style={{ width: '60px' }}>S.No</th>
                                    <th>SO Number</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Tally Sync Status</th>
                                    <th>Last Attempt</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingOrders ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-4 text-muted">
                                            <Spinner animation="border" size="sm" className="me-2" />
                                            Loading sales orders...
                                        </td>
                                    </tr>
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="text-center py-4 text-muted">
                                            <i className="fa fa-inbox fs-3 d-block mb-2"></i>
                                            No sales orders found matching filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    currentOrders.map((order, index) => (
                                        <tr key={order.id}>
                                            <td className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                                                {indexOfFirstItem + index + 1}
                                            </td>
                                            <td className="fw-semibold text-dark">
                                                {order.so_no}
                                            </td>
                                            <td className="text-muted" style={{ fontSize: '13px' }}>
                                                {formatDate(order.entry_date)}
                                            </td>
                                            <td>
                                                <span className="fw-medium">{order.customer_name}</span>
                                            </td>
                                            <td className="fw-semibold text-dark">
                                                ₹{parseFloat(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                {renderSyncBadge(order.sync_status, order.is_synced)}
                                            </td>
                                            <td className="text-muted" style={{ fontSize: '12px' }}>
                                                {order.last_attempted_at ? formatDateTime(order.last_attempted_at) : '—'}
                                            </td>
                                            
                                            <td className="text-end pe-4">
                                                <div className="d-flex align-items-center justify-content-end gap-2">
                                                    {/* Push Single Order */}
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        className="py-1 px-2 d-inline-flex align-items-center gap-1"
                                                        style={{ fontSize: '12px' }}
                                                        onClick={() => handlePushSingle(order)}
                                                        disabled={syncingOrderId === order.id || syncingAll}
                                                        title="Push this order to Tally"
                                                    >
                                                        {syncingOrderId === order.id ? (
                                                            <Spinner animation="border" size="sm" />
                                                        ) : (
                                                            <>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                    <polyline points="17 8 12 3 7 8"></polyline>
                                                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                                                </svg>
                                                                <span>Push</span>
                                                            </>
                                                        )}
                                                    </Button>

                                                    {/* View Log Details */}
                                                    {(order.last_attempted_at || order.last_response || order.last_error || (order.sync_history && order.sync_history.length > 0)) && (
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            className="py-1 px-2 d-inline-flex align-items-center gap-1"
                                                            style={{ fontSize: '12px' }}
                                                            onClick={() => {
                                                                setSelectedOrderLog(order);
                                                                setSelectedHistoryIndex(0);
                                                                setShowLogModal(true);
                                                            }}
                                                            title="View Tally Log & Response"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                                <polyline points="10 9 9 9 8 9"></polyline>
                                                            </svg>
                                                            <span>Log</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>

                {/* Pagination Controls */}
                {orders.length > 0 && (
                    <Card.Footer className="bg-white border-top py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                        <div className="text-muted" style={{ fontSize: '13px' }}>
                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, orders.length)} of {orders.length} entries
                        </div>
                        {totalPages > 1 && (
                            <nav>
                                <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button
                                            type="button"
                                            className="page-link"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            style={{ border: 'none', background: 'none' }}
                                            title="Previous Page"
                                        >
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
                                                    <button
                                                        type="button"
                                                        className="page-link"
                                                        onClick={() => setCurrentPage(pageNumber)}
                                                        style={{ border: 'none' }}
                                                    >
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
                                        <button
                                            type="button"
                                            className="page-link"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            style={{ border: 'none', background: 'none' }}
                                            title="Next Page"
                                        >
                                            <i className="la la-angle-right" />
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        )}
                    </Card.Footer>
                )}
            </Card>

            {/* Modal: Edit Tally URL */}
            <Modal show={showEditUrlModal} onHide={() => setShowEditUrlModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fs-6 fw-bold">
                        <i className="fa fa-server text-primary me-2"></i> Configure Tally Server Endpoint
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSaveUrl}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-semibold">Tally HTTP / XML Server URL</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="http://localhost:9000"
                                value={customUrlInput}
                                onChange={(e) => setCustomUrlInput(e.target.value)}
                                required
                            />
                            <Form.Text className="text-muted">
                                Default is <code>http://localhost:9000</code>. Ensure Tally ODBC / XML Server is enabled in Tally configuration (F12 / Advanced Configuration).
                            </Form.Text>
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" size="sm" onClick={() => setShowEditUrlModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save URL
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal: View Tally Log */}
            <Modal show={showLogModal} onHide={() => setShowLogModal(false)} size="lg" centered>
                <Modal.Header closeButton className="border-bottom py-3 px-4 bg-white">
                    <div>
                        <Modal.Title className="fs-6 fw-bold mb-0 text-dark">
                            Tally Sync Log
                        </Modal.Title>
                        <small className="text-muted" style={{ fontSize: '12px' }}>
                            Transmission details and error diagnostics
                        </small>
                    </div>
                </Modal.Header>
                <Modal.Body className="p-4">
                    {selectedOrderLog && (() => {
                        const historyList = selectedOrderLog.sync_history && selectedOrderLog.sync_history.length > 0
                            ? selectedOrderLog.sync_history
                            : null;
                        const activeItem = (historyList && historyList[selectedHistoryIndex])
                            ? historyList[selectedHistoryIndex]
                            : {
                                error_message: selectedOrderLog.last_error,
                                tally_response: selectedOrderLog.last_response,
                                attempted_at: selectedOrderLog.last_attempted_at,
                                status: selectedOrderLog.sync_status,
                                synced_by_name: selectedOrderLog.last_synced_by,
                                push_type: selectedOrderLog.last_push_type
                            };
                        const currentError = activeItem.error_message || selectedOrderLog.last_error;
                        const currentResponse = activeItem.tally_response || selectedOrderLog.last_response;
                        const currentAttemptTime = activeItem.attempted_at || selectedOrderLog.last_attempted_at;
                        const activePushedBy = activeItem.synced_by_name || selectedOrderLog.last_synced_by || null;
                        const activePushType = activeItem.push_type || selectedOrderLog.last_push_type || 'manual';
                        const isAttemptSuccess = (activeItem.status === 'success') || (!currentError && selectedOrderLog.is_synced);
                        const diag = getExceptionDetails(currentError);

                        return (
                            <div>
                                {/* Order Summary Card - Minimal */}
                                <div
                                    className="rounded-2 p-3 mb-3"
                                    style={{
                                        backgroundColor: '#fafafa',
                                        border: '1px solid #eaeaea'
                                    }}
                                >
                                    <div className="row g-3">
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px' }}>
                                                VOUCHER NO
                                            </span>
                                            <span className="text-dark fw-semibold font-monospace" style={{ fontSize: '13px' }}>
                                                {selectedOrderLog.so_no}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px' }}>
                                                ORDER DATE
                                            </span>
                                            <span className="text-dark" style={{ fontSize: '13px' }}>
                                                {formatDate(selectedOrderLog.entry_date)}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px' }}>
                                                CUSTOMER
                                            </span>
                                            <span className="text-dark text-truncate d-block" style={{ fontSize: '13px' }} title={selectedOrderLog.customer_name}>
                                                {selectedOrderLog.customer_name}
                                            </span>
                                        </div>
                                        <div className="col-6 col-md-3">
                                            <span className="text-muted d-block" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px' }}>
                                                TOTAL AMOUNT
                                            </span>
                                            <span className="text-dark fw-semibold" style={{ fontSize: '13px' }}>
                                                ₹{parseFloat(selectedOrderLog.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sync Attempts Navigator - Minimal Pills */}
                                {historyList && historyList.length > 1 && (
                                    <div
                                        className="mb-3 p-2 rounded-2 d-flex flex-wrap align-items-center justify-content-between gap-2"
                                        style={{ backgroundColor: '#fafafa', border: '1px solid #eaeaea' }}
                                    >
                                        <span className="text-muted" style={{ fontSize: '12px', fontWeight: 500 }}>
                                            Sync Attempts ({historyList.length}):
                                        </span>
                                        <div className="d-flex flex-wrap gap-1">
                                            {historyList.map((hist, idx) => {
                                                const isSelected = selectedHistoryIndex === idx;
                                                const isHistSuccess = hist.status === 'success';
                                                return (
                                                    <button
                                                        key={hist.id || idx}
                                                        type="button"
                                                        className="btn btn-sm d-inline-flex align-items-center"
                                                        style={{
                                                            fontSize: '11.5px',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            border: isSelected ? '1px solid #334155' : '1px solid #e2e8f0',
                                                            backgroundColor: isSelected ? '#334155' : '#ffffff',
                                                            color: isSelected ? '#ffffff' : '#475569',
                                                            fontWeight: isSelected ? 600 : 400,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        onClick={() => setSelectedHistoryIndex(idx)}
                                                    >
                                                        <span
                                                            className="rounded-circle d-inline-block me-1.5"
                                                            style={{
                                                                width: '5px',
                                                                height: '5px',
                                                                backgroundColor: isSelected
                                                                    ? '#ffffff'
                                                                    : (isHistSuccess ? '#16a34a' : '#dc2626')
                                                            }}
                                                        />
                                                        {idx === 0 ? 'Latest Attempt' : `Attempt #${historyList.length - idx}`}
                                                        {hist.synced_by_name && (
                                                            <span className="ms-1 fw-medium" style={{ fontSize: '10px', opacity: 0.9 }}>
                                                                by {hist.synced_by_name.split(' ')[0]}
                                                            </span>
                                                        )}
                                                        <span className="ms-1 opacity-75" style={{ fontSize: '10px' }}>
                                                            ({formatDateTime(hist.attempted_at).split(' ')[1] || ''})
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Attempt Timestamp & Pushed By Header */}
                                {currentAttemptTime && (
                                    <div
                                        className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom text-muted gap-2"
                                        style={{ fontSize: '12px' }}
                                    >
                                        <div className="d-flex flex-wrap align-items-center gap-3">
                                            <span>
                                                Attempted at: <strong className="text-dark ms-1">{formatDateTime(currentAttemptTime)}</strong>
                                            </span>
                                            <span className="text-muted border-start ps-3 d-inline-flex align-items-center">
                                                Pushed by:
                                                {activePushedBy ? (
                                                    <>
                                                        <strong className="text-dark ms-1">
                                                            <i className="fa fa-user-circle text-primary me-1"></i>
                                                            {activePushedBy}
                                                        </strong>
                                                        <span className={`badge ${activePushType === 'auto' ? 'badge-info light' : 'badge-primary light'} ms-1.5 px-1.5 py-0.5`} style={{ fontSize: '10px' }}>
                                                            {activePushType === 'auto' ? 'Auto-Push' : 'Manual'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <strong className="text-muted ms-1">—</strong>
                                                )}
                                            </span>
                                        </div>
                                        <div>{renderSyncBadge(activeItem.status || selectedOrderLog.sync_status, isAttemptSuccess)}</div>
                                    </div>
                                )}

                                {/* Exception / Diagnostics - Minimal Accent Container */}
                                {currentError ? (
                                    <div
                                        className="rounded-2 p-3 mb-3 bg-white"
                                        style={{
                                            border: '1px solid #e5e7eb',
                                            borderLeft: '3px solid #dc2626'
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className={diag?.badgeClass || 'badge badge-danger light'} style={{ fontSize: '10.5px' }}>
                                                    {diag?.category || 'EXCEPTION'}
                                                </span>
                                                <strong className="text-dark" style={{ fontSize: '13px' }}>
                                                    {diag?.title || 'Tally Error'}
                                                </strong>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-light border text-muted d-inline-flex align-items-center"
                                                style={{ fontSize: '10px', padding: '1px 6px', lineHeight: '1.2', borderRadius: '3px' }}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(currentError);
                                                    setCopiedException(true);
                                                    setTimeout(() => setCopiedException(false), 2000);
                                                }}
                                            >
                                                {copiedException ? (
                                                    <>
                                                        <i className="fa fa-check text-success me-1" style={{ fontSize: '9px' }}></i>Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa fa-copy me-1" style={{ fontSize: '9px' }}></i>Copy Error
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Exact Exception Message Box */}
                                        <div
                                            className="p-2 rounded font-monospace text-danger mb-2"
                                            style={{
                                                backgroundColor: '#fafafa',
                                                border: '1px solid #f1f5f9',
                                                fontSize: '11.5px',
                                                wordBreak: 'break-word',
                                                lineHeight: '1.5'
                                            }}
                                        >
                                            {currentError}
                                        </div>

                                        {/* Plain-English Explanation & Actionable Fix */}
                                        <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
                                            <div className="mb-1">
                                                <strong className="text-dark">Root Cause: </strong>
                                                <span>{diag?.explanation || 'Tally rejected this voucher.'}</span>
                                            </div>
                                            <div>
                                                <strong className="text-dark">Suggested Resolution: </strong>
                                                <span className="text-muted">{diag?.fix || 'Verify ledger and stock item masters in Tally.'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    isAttemptSuccess && (
                                        <div
                                            className="rounded-2 p-3 mb-3 bg-white d-flex align-items-center gap-2"
                                            style={{
                                                border: '1px solid #e5e7eb',
                                                borderLeft: '3px solid #16a34a'
                                            }}
                                        >
                                            <i className="fa fa-check-circle text-success fs-6"></i>
                                            <div style={{ fontSize: '13px' }}>
                                                <strong className="text-dark d-inline me-1">Successfully Synced:</strong>
                                                <span className="text-muted">This voucher was accepted and recorded in Tally Prime.</span>
                                            </div>
                                        </div>
                                    )
                                )}

                                {/* Raw Tally XML Response - Clean Minimal Code View */}
                                <div className="mt-3">
                                    <div
                                        className="d-flex justify-content-between align-items-center px-3 py-1.5 rounded-top"
                                        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderBottom: '0' }}
                                    >
                                        <span className="text-muted fw-semibold" style={{ fontSize: '11.5px' }}>
                                            Tally XML Response
                                        </span>
                                        {currentResponse && (
                                            <button
                                                type="button"
                                                className="btn btn-light border text-muted d-inline-flex align-items-center"
                                                style={{ fontSize: '10px', padding: '1px 6px', lineHeight: '1.2', borderRadius: '3px' }}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(currentResponse);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                            >
                                                {copied ? (
                                                    <>
                                                        <i className="fa fa-check text-success me-1" style={{ fontSize: '9px' }}></i>Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa fa-copy me-1" style={{ fontSize: '9px' }}></i>Copy XML
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <pre
                                        className="p-3 rounded-bottom mb-0 font-monospace"
                                        style={{
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            fontSize: '11.5px',
                                            lineHeight: '1.5',
                                            whiteSpace: 'pre-wrap',
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            color: '#334155'
                                        }}
                                    >
                                        {currentResponse || 'No raw response received from Tally.'}
                                    </pre>
                                </div>
                            </div>
                        );
                    })()}
                </Modal.Body>
                <Modal.Footer className="d-flex justify-content-between px-4 py-2.5 bg-white border-top">
                    <div>
                        {selectedOrderLog && !selectedOrderLog.is_synced && (
                            <Button
                                variant="primary"
                                size="sm"
                                className="px-3"
                                onClick={() => {
                                    setShowLogModal(false);
                                    handlePushSingle(selectedOrderLog);
                                }}
                            >
                                Retry Push Now
                            </Button>
                        )}
                    </div>
                    <Button
                        variant="light"
                        size="sm"
                        className="border px-3 text-muted"
                        onClick={() => setShowLogModal(false)}
                    >
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default TallySalesOrderSync;
