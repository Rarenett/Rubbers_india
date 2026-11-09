import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Spinner, Form, Button, Pagination } from 'react-bootstrap';
import axiosInstance from '../../../services/axiosInstance';
import { usePageTitle } from '../../../context/TitleContext';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

const MarketingVisitReport = () => {
    usePageTitle("Visit Report - Marketing Connect");
    
    const [loading, setLoading] = useState(false);
    const [visits, setVisits] = useState([]);
    const [filterDate, setFilterDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterDate]);

    useEffect(() => {
        fetchVisits();
    }, [filterDate]);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            let url = `/api/project/marketing/visit_report/`;
            if (filterDate) {
                url += `?date=${filterDate}`;
            }
            const response = await axiosInstance.get(url);
            setVisits(response.data);
        } catch (error) {
            console.error('Error fetching visit report:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredVisits = visits.filter(v => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return (
            (v.shop_name && v.shop_name.toLowerCase().includes(searchLower)) ||
            (v.shop_type && v.shop_type.toLowerCase().includes(searchLower)) ||
            (v.mobile_number && v.mobile_number.toLowerCase().includes(searchLower)) ||
            (v.city && v.city.toLowerCase().includes(searchLower))
        );
    });

    const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredVisits.slice(indexOfFirstItem, indexOfLastItem);

    const getExportData = () => {
        return filteredVisits.map((v, index) => {
            return {
                sl_no: index + 1,
                visited_date: v.visited_date,
                shop_name: v.shop_name,
                shop_type: v.shop_type,
                gst_number: v.gst_number,
                address: v.address,
                city: v.city,
                state: v.state,
                mobile_number: v.mobile_number,
                stock_item_id: v.stock_item_id,
                stock_item_name: v.stock_item_name,
                quantity: v.quantity,
                negotiated_price: v.negotiated_price,
                original_price: v.original_price
            };
        });
    };

    const columns = [
        { header: 'Sl No.', dataKey: 'sl_no' },
        { header: 'Visited Date', dataKey: 'visited_date' },
        { header: 'Shop Name', dataKey: 'shop_name' },
        { header: 'Shop Type', dataKey: 'shop_type' },
        { header: 'GST Number', dataKey: 'gst_number' },
        { header: 'Address', dataKey: 'address' },
        { header: 'City', dataKey: 'city' },
        { header: 'State', dataKey: 'state' },
        { header: 'Mobile Number', dataKey: 'mobile_number' },
        { header: 'Stock Item ID', dataKey: 'stock_item_id' },
        { header: 'Stock Item Name', dataKey: 'stock_item_name' },
        { header: 'Quantity', dataKey: 'quantity' },
        { header: 'Negotiated Price', dataKey: 'negotiated_price' },
        { header: 'Original Price', dataKey: 'original_price' }
    ];

    const handleExportExcel = () => {
        exportToExcel(getExportData(), columns, `Visit_Report_${filterDate || 'All'}.xlsx`);
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), columns, `Visit_Report_${filterDate || 'All'}.pdf`, `Visit Report - ${filterDate || 'All'}`);
    };

    const handlePrint = () => {
        printData(getExportData(), columns, `Visit Report - ${filterDate || 'All'}`);
    };

    return (
        <div className="container-fluid">
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
                `}
            </style>
            <div className="row page-titles mx-0 no-print">
                <div className="col-sm-6 p-md-0">
                    <div className="welcome-text">
                        <h4>Visit Report</h4>
                        <p className="mb-0">View all marketing visit reports and wishlists.</p>
                    </div>
                </div>
            </div>

            <Row>
                <Col lg={12}>
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap">
                            <Card.Title>Visit Records</Card.Title>
                            <div className="d-flex gap-3 align-items-center flex-wrap no-print mt-2 mt-md-0">
                                <Form.Group className="mb-0">
                                    <Form.Control
                                        type="text"
                                        placeholder="Search by shop name, type, city, or mobile..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ minWidth: '250px' }}
                                    />
                                </Form.Group>
                                <Form.Group className="d-flex align-items-center mb-0">
                                    <Form.Control 
                                        type="date" 
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        style={{ maxWidth: '180px' }}
                                    />
                                </Form.Group>

                                
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border" onClick={handleExportPDF} title="Export PDF">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handleExportExcel} title="Export Excel">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                    </button>
                                    <button className="btn btn-sm btn-light border" onClick={handlePrint} title="Print">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                    </button>
                                </div>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : (
                                <>
                                <div className="table-responsive">
                                    <table className="table w-100">
                                        <thead>
                                            <tr>
                                                <th style={{width: '50px'}}><strong>Sl No</strong></th>
                                                <th><strong>Visited Date</strong></th>
                                                <th><strong>Shop Name</strong></th>
                                                <th><strong>Shop Type</strong></th>
                                                <th><strong>GST Number</strong></th>
                                                <th><strong>Address</strong></th>
                                                <th><strong>City</strong></th>
                                                <th><strong>State</strong></th>
                                                <th><strong>Mobile Number</strong></th>
                                                <th><strong>Stock Item ID / Name</strong></th>
                                                <th><strong>Quantity</strong></th>
                                                <th><strong>Negotiated Price</strong></th>
                                                <th><strong>Original Price</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        {currentItems.length > 0 ? (
                                            currentItems.map((item, index) => {
                                                const dateParts = item.visited_date ? item.visited_date.split('-') : [];
                                                const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : item.visited_date;
                                                return (
                                                    <tr key={index}>
                                                        <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                        <td>{formattedDate}</td>
                                                        <td>{item.shop_name}</td>
                                                        <td>{item.shop_type}</td>
                                                        <td>{item.gst_number || '-'}</td>
                                                        <td>{item.address}</td>
                                                        <td>{item.city}</td>
                                                        <td>{item.state}</td>
                                                        <td>{item.mobile_number}</td>
                                                        <td>{item.stock_item_id} / {item.stock_item_name}</td>
                                                        <td>{item.quantity}</td>
                                                        <td>{item.negotiated_price}</td>
                                                        <td>{item.original_price}</td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="13" className="text-center">No visit records found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                        <div className="mb-2">
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredVisits.length)} of {filteredVisits.length} entries
                                        </div>
                                        <nav>
                                <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                    <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                                            <i className="la la-angle-left"></i>
                                        </button>
                                    </li>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                                        </li>
                                    ))}
                                    <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                                            <i className="la la-angle-right"></i>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                                    </div>
                                )}
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default MarketingVisitReport;
