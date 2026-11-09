import React, { useState, useEffect, useContext } from 'react';
import { Card, Button, Form, Row, Col, Table, Badge } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { ThemeContext } from '../../../context/ThemeContext';
import { getPayables } from '../../../services/FinanceService';

const PayablesReport = () => {
    const { background } = useContext(ThemeContext);
    // eslint-disable-next-line no-unused-vars
    const isDark = background?.value === 'dark';

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({ total_outstanding: 0, total_parties: 0, ledgers: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedParties, setExpandedParties] = useState({});

    const fetchReport = async () => {
        try {
            setLoading(true);
            const params = {};
            if (searchQuery) params.search = searchQuery;
            const res = await getPayables(params);
            setData(res || { total_outstanding: 0, total_parties: 0, ledgers: [] });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to fetch Payables data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [searchQuery]);

    const toggleParty = (partyId) => {
        setExpandedParties(prev => ({
            ...prev,
            [partyId]: !prev[partyId]
        }));
    };

    const toggleAll = (expandAll) => {
        const next = {};
        if (expandAll && data.ledgers) {
            data.ledgers.forEach(l => { next[l.ledger_id] = true; });
        }
        setExpandedParties(next);
    };

    const formatCurrency = (val) => {
        if (val === null || val === undefined) return '0.00';
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        if (!data || !data.ledgers) return;

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Supplier Name,Account Group,Bill Date,Bill No,Bill Type,Total Amount (Rs),Cleared Amount (Rs),Pending Amount (Rs),Overdue Days\n";

        data.ledgers.forEach(party => {
            csvContent += `"${party.party_name}","${party.account_group}",,,,,"${party.total_pending}",\n`;
            party.bills.forEach(b => {
                csvContent += `,"",${b.bill_date},"${b.bill_no}","${b.bill_type}",${b.total_amount},${b.settled_amount},${b.pending_amount},${b.overdue_days}\n`;
            });
        });

        csvContent += `\n"TOTAL PAYABLE",,,,,,,"${data.total_outstanding}"\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Bills_Payable_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalBillsCount = data.ledgers
        ? data.ledgers.reduce((sum, l) => sum + (l.bills ? l.bills.length : 0), 0)
        : 0;

    return (
        <div className="container-fluid p-3">
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h4 className="mb-1 text-danger fw-bold">
                        <i className="fa fa-file-invoice-dollar me-2"></i>Bills Payable Report
                    </h4>
                    <p className="text-muted mb-0 small">
                        Outstanding balances and bill-wise settlement tracking for Sundry Creditors & Suppliers.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-primary" size="sm" onClick={() => toggleAll(true)}>
                        <i className="fa fa-expand-alt me-1"></i>Expand All
                    </Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => toggleAll(false)}>
                        <i className="fa fa-compress-alt me-1"></i>Collapse All
                    </Button>
                    <Button variant="success" size="sm" onClick={handleExport}>
                        <i className="fa fa-file-excel me-1"></i>Export CSV
                    </Button>
                    <Button variant="primary" size="sm" onClick={handlePrint}>
                        <i className="fa fa-print me-1"></i>Print Report
                    </Button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <Row className="g-3 mb-3">
                <Col md={4}>
                    <Card className="border-0 shadow-sm bg-danger text-white">
                        <Card.Body className="py-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="small text-white-50 fw-semibold">Total Outstanding Payable</div>
                                    <h3 className="mb-0 fw-bold">{formatCurrency(data.total_outstanding)}</h3>
                                </div>
                                <i className="fa fa-receipt fs-1 text-white-50"></i>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm bg-white">
                        <Card.Body className="py-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="small text-muted fw-semibold">Total Suppliers / Creditors</div>
                                    <h3 className="mb-0 fw-bold text-dark">{data.total_parties}</h3>
                                </div>
                                <i className="fa fa-truck fs-1 text-danger text-opacity-25"></i>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-0 shadow-sm bg-white">
                        <Card.Body className="py-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <div className="small text-muted fw-semibold">Total Outstanding Purchase Bills</div>
                                    <h3 className="mb-0 fw-bold text-dark">{totalBillsCount}</h3>
                                </div>
                                <i className="fa fa-file-invoice fs-1 text-primary text-opacity-25"></i>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Main Table Card */}
            <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold text-dark">
                        <i className="fa fa-list me-2 text-danger"></i>Supplier Bill-wise Outstandings
                    </h6>
                    <div style={{ width: '320px' }}>
                        <Form.Control
                            size="sm"
                            type="text"
                            placeholder="Search Supplier Name or Bill No..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="rounded-pill px-3"
                        />
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <i className="fa fa-spinner fa-spin me-2 text-danger fs-3"></i>
                            <p className="mt-2 text-muted fw-semibold">Loading Payables Statement...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle mb-0" style={{ fontSize: '13px' }}>
                                <thead className="table-light text-secondary">
                                    <tr>
                                        <th className="ps-3" style={{ width: '35%' }}>Supplier / Particulars</th>
                                        <th style={{ width: '15%' }}>Bill / Ref No</th>
                                        <th className="text-end pe-3" style={{ width: '15%' }}>Bill Amount ()</th>
                                        <th className="text-end pe-3" style={{ width: '15%' }}>Pending Amount ()</th>
                                        <th className="text-center" style={{ width: '12%' }}>Overdue Status</th>
                                        <th className="text-center" style={{ width: '8%' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.ledgers.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-5 text-muted">
                                                <i className="fa fa-check-circle fs-2 mb-2 text-success"></i>
                                                <div>No outstanding payables found.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        data.ledgers.map(party => {
                                            const isExpanded = expandedParties[party.ledger_id];

                                            return (
                                                <React.Fragment key={party.ledger_id}>
                                                    {/* Party Header Row */}
                                                    <tr
                                                        className="table-light cursor-pointer border-bottom"
                                                        onClick={() => toggleParty(party.ledger_id)}
                                                    >
                                                        <td className="ps-3 fw-bold text-dark">
                                                            <i className={`fa ${isExpanded ? 'fa-chevron-down text-danger' : 'fa-chevron-right text-muted'} me-2`}></i>
                                                            {party.party_name}
                                                            <span className="badge bg-light text-secondary border ms-2">
                                                                {party.account_group}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <Badge bg="secondary" className="px-2 py-1 fw-normal">
                                                                {party.bills.length} Bill{party.bills.length > 1 ? 's' : ''}
                                                            </Badge>
                                                        </td>
                                                        <td className="text-end pe-3 text-muted">-</td>
                                                        <td className="text-end pe-3 font-monospace fw-bold text-danger fs-6">
                                                            {formatCurrency(party.total_pending)}
                                                        </td>
                                                        <td className="text-center">-</td>
                                                        <td className="text-center">
                                                            <Button
                                                                variant="light"
                                                                size="sm"
                                                                className="btn-xs border text-muted"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleParty(party.ledger_id);
                                                                }}
                                                            >
                                                                {isExpanded ? 'Hide' : 'View'}
                                                            </Button>
                                                        </td>
                                                    </tr>

                                                    {/* Bill-Wise Breakdown */}
                                                    {isExpanded && party.bills.map(bill => (
                                                        <tr key={bill.id} className="bg-white border-bottom small">
                                                            <td className="ps-5 text-muted">
                                                                <i className="fa fa-receipt text-danger me-2 opacity-50"></i>
                                                                {bill.bill_date} ({bill.bill_type})
                                                            </td>
                                                            <td className="fw-semibold text-dark">{bill.bill_no}</td>
                                                            <td className="text-end pe-3 font-monospace text-muted">
                                                                {formatCurrency(bill.total_amount)}
                                                            </td>
                                                            <td className="text-end pe-3 font-monospace fw-bold text-dark">
                                                                {formatCurrency(bill.pending_amount)}
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg={bill.overdue_days > 30 ? 'danger' : 'warning'} className="px-2">
                                                                    {bill.overdue_days} Days Overdue
                                                                </Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                <span className="text-muted small">Pending</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
                <Card.Footer className="bg-light py-3 border-top d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                        Showing outstandings for <strong>{data.total_parties}</strong> supplier ledgers.
                    </span>
                    <h5 className="mb-0 fw-bold text-danger">
                        Total Payables: {formatCurrency(data.total_outstanding)}
                    </h5>
                </Card.Footer>
            </Card>
        </div>
    );
};

export default PayablesReport;
