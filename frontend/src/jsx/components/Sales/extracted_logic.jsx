__CHECKBOX__
const CheckboxOption = (props) => {
    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <label style={{ margin: 0, cursor: 'pointer' }}>{props.label}</label>
            </div>
        </components.Option>
    );
};

__HND__
const handleMonthSelectionChange = (selected) => {
        if (!selected) {
            setSelectedMonths([]);
            return;
        }
        
        const isSelectAll = selected.some(opt => opt.value === 'all');
        const wasSelectAll = selectedMonths.some(opt => opt.value === 'all');

        const allNormalOptions = monthOptions.filter(opt => opt.value !== 'all');

        if (isSelectAll && !wasSelectAll) {
            setSelectedMonths(monthOptions);
        } else if (!isSelectAll && wasSelectAll) {
            setSelectedMonths([]);
        } else if (isSelectAll && wasSelectAll) {
            setSelectedMonths(selected.filter(opt => opt.value !== 'all'));
        } else {
            if (selected.length === allNormalOptions.length && allNormalOptions.length > 0) {
                setSelectedMonths(monthOptions);
            } else {
                setSelectedMonths(selected);
            }
        }
    };

__GRAPH_LOGIC__
// ── Item-Wise Graph Logic ──────────────────────────────────────────────
    const itemMonthlyDataMap = {};
    const itemNamesSet = new Set();
    const itemTotalMap = {};

    filteredData.forEach(order => {
        const dateStr = order.entry_date;
        if (dateStr && order.items && Array.isArray(order.items)) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const monthYear = `${parts[0]}-${parts[1]}`;
                
                if (!itemMonthlyDataMap[monthYear]) {
                    itemMonthlyDataMap[monthYear] = {};
                }

                order.items.forEach(item => {
                    const itemName = item.product_name || 'Unknown Item';
                    itemNamesSet.add(itemName);
                    
                    if (!itemMonthlyDataMap[monthYear][itemName]) {
                        itemMonthlyDataMap[monthYear][itemName] = 0;
                    }
                    if (!itemTotalMap[itemName]) {
                        itemTotalMap[itemName] = 0;
                    }
                    
                    const qty = parseFloat(item.quantity) || 0;
                    itemMonthlyDataMap[monthYear][itemName] += qty;
                    itemTotalMap[itemName] += qty;
                });
            }
        }
    });

    const allAvailableMonths = [];
    if (fromDate && toDate) {
        let start = new Date(fromDate);
        let end = new Date(toDate);
        start = new Date(start.getFullYear(), start.getMonth(), 1);
        end = new Date(end.getFullYear(), end.getMonth(), 1);
        let current = start;
        while (current <= end) {
            const year = current.getFullYear();
            const m = current.getMonth() + 1;
            const monthStr = m < 10 ? `0${m}` : `${m}`;
            allAvailableMonths.push(`${year}-${monthStr}`);
            current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
    } else {
        for (let year = 2025; year <= 2026; year++) {
            for (let m = 1; m <= 12; m++) {
                const monthStr = m < 10 ? `0${m}` : `${m}`;
                allAvailableMonths.push(`${year}-${monthStr}`);
            }
        }
    }

    const filteredItemMonthCategories = selectedMonths.length > 0 
        ? allAvailableMonths.filter(m => selectedMonths.some(sm => sm.value === m))
        : allAvailableMonths;

    const monthOptions = [
        { value: 'all', label: 'Select All' },
        ...allAvailableMonths.map(m => {
            const [year, month] = m.split('-');
            return { value: m, label: `${monthNames[parseInt(month, 10) - 1]} ${year}` };
        })
    ];

    const itemNames = Array.from(itemNamesSet).sort((a, b) => itemTotalMap[b] - itemTotalMap[a]);

    const itemSeries = itemNames.map(itemName => {
        return {
            name: itemName,
            data: filteredItemMonthCategories.map(month => (itemMonthlyDataMap[month] && itemMonthlyDataMap[month][itemName]) || 0)
        };
    });

    const totalQuantityMonthData = filteredItemMonthCategories.map(month => {
        let monthTotal = 0;
        itemNames.forEach(itemName => {
            monthTotal += (itemMonthlyDataMap[month] && itemMonthlyDataMap[month][itemName]) || 0;
        });
        return monthTotal;
    });

    const totalQuantitySeries = [{
        name: 'Total Quantity',
        data: totalQuantityMonthData
    }];

    const itemOptions = itemNames.map(name => ({ label: name, value: name }));
    const filteredItemSeries = selectedItems.length > 0 
        ? itemSeries.filter(s => selectedItems.some(item => item.value === s.name))
        : [];

    const formattedItemMonthCategories = filteredItemMonthCategories.map(m => {
        const [year, month] = m.split('-');
        return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
    });

    const itemChartOptionsBase = {
        chart: {
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: formattedItemMonthCategories,
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { colors: '#64748b', fontSize: '13px', fontWeight: 500 }
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 20, right: 20, bottom: 0, left: 20 }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '13px',
            markers: { radius: 12 }
        },
        tooltip: {
            theme: 'light',
            y: {
                formatter: function (val) {
                    if (val === undefined || val === null) return val;
                    return val.toLocaleString('en-IN') + ' units';
                }
            }
        }
    };

    const itemBarOptions = {
        ...itemChartOptionsBase,
        chart: { ...itemChartOptionsBase.chart, type: 'bar', height: 350 },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        stroke: { show: true, width: 2, colors: ['transparent'] }
    };

    const itemLineOptions = {
        ...itemChartOptionsBase,
        chart: { ...itemChartOptionsBase.chart, type: 'line', height: 350 },
        stroke: { curve: 'smooth', width: 3 },
        markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
        legend: {
            ...itemChartOptionsBase.legend,
            show: selectedItems.length > 0
        }
    };

__JSX__
{activeTab === 'itemGraph' ? (
                            <div className="d-flex align-items-center" style={{ width: '300px', zIndex: 999 }}>
                                <div style={{ width: '100%' }}>
                                    <Select
                                        isMulti
                                        options={monthOptions}
                                        value={selectedMonths}
                                        onChange={handleMonthSelectionChange}
                                        placeholder="All Months"
                                        classNamePrefix="select"
                                        closeMenuOnSelect={false}
                                        hideSelectedOptions={false}
                                        components={{ Option: CheckboxOption }}
                                        styles={{
                                            control: (base) => ({
                                                ...base,
                                                borderRadius: '8px',
                                                borderColor: '#cbd5e1',
                                                minHeight: '40px',
                                                boxShadow: 'none',
                                                '&:hover': { borderColor: '#94a3b8' },
                                                cursor: 'pointer'
                                            }),
                                            valueContainer: (base) => ({
                                                ...base,
                                                maxHeight: '85px',
                                                overflowY: 'auto'
                                            }),
                                            multiValue: (base) => ({
                                                ...base,
                                                backgroundColor: '#eff6ff',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '6px',
                                                minWidth: 'max-content'
                                            }),
                                            multiValueLabel: (base) => ({
                                                ...base,
                                                color: '#1d4ed8',
                                                fontWeight: 600,
                                                fontSize: '12px',
                                                padding: '2px 4px'
                                            }),
                                            multiValueRemove: (base) => ({
                                                ...base,
                                                borderRadius: '4px',
                                                color: '#60a5fa',
                                                '&:hover': {
                                                    backgroundColor: '#ef4444',
                                                    color: 'white'
                                                },
                                                cursor: 'pointer'
                                            }),
                                            menu: (base) => ({
                                                ...base,
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                                                border: '1px solid #e2e8f0',
                                                zIndex: 9999
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'white',
                                                color: state.isSelected ? '#1d4ed8' : '#475569',
                                                cursor: 'pointer',
                                                '&:active': { backgroundColor: '#dbeafe' }
                                            })
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="search-bar-container">
                                <span className="search-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Search report..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="tab-content mt-4 px-4 pb-4">
                        {activeTab === 'list' && (
                            <>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h4 className="mb-0">Report List</h4>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-sm btn-light border" onClick={() => handleExport('pdf')} title="Export PDF">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" onClick={() => handleExport('excel')} title="Export Excel">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                        </button>
                                        <button className="btn btn-sm btn-light border" onClick={() => handleExport('print')} title="Print">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="table-responsive">
                                    <table className="fd-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px' }}>Sl.No</th>
                                                <th>Order No.</th>
                                                <th>Entry Date</th>
                                                <th>Customer Name</th>
                                                <th className="text-end">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading ? (
                                                <tr><td colSpan="5" className="text-center py-4">Loading report...</td></tr>
                                            ) : filteredData.length === 0 ? (
                                                <tr><td colSpan="5" className="text-center py-4 text-muted">No sales orders found for the selected date range.</td></tr>
                                            ) : currentItems.map((order, idx) => (
                                                <tr key={order.id || idx} style={{ cursor: 'pointer' }} onClick={() => { setSelectedSO(order); setShowModal(true); }}>
                                                    <td>{indexOfFirstItem + idx + 1}</td>
                                                    <td>
                                                        <span className="text-primary fw-bold">{order.so_no}</span>
                                                    </td>
                                                    <td>{order.entry_date ? order.entry_date.split('-').reverse().join('-') : '—'}</td>
                                                    <td className="fw-semibold">{order.customer_ledger_name || '—'}</td>
                                                    <td className="text-end fw-bold text-success">
                                                        {order.total_amount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredData.length > 0 && (
                                        <div className="d-flex justify-content-between align-items-center mt-3">
                                            <div className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
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

                            </>
                        )}
                        {activeTab === 'graph' && (
                            <>
                                {/* Summary Tiles */}
                                <div className="row mt-3">
                                    <div className="col-xl-6 col-md-6 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 d-flex align-items-center">
                                                <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                                                    <i className="fa fa-shopping-cart" style={{ fontSize: '1.5rem', color: '#1e40af' }}></i>
                                                </div>
                                                <div className="ms-4">
                                                    <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Sales Orders</p>
                                                    <h3 className="mb-0 fw-bold text-dark">{filteredData.length}</h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-xl-6 col-md-6 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 d-flex align-items-center">
                                                <div className="rounded-circle d-flex justify-content-center align-items-center" style={{ width: '60px', height: '60px', backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                                                    <i className="fa fa-wallet" style={{ fontSize: '1.5rem', color: '#1e40af' }}></i>
                                                </div>
                                                <div className="ms-4">
                                                    <p className="text-muted mb-1 fw-bold text-uppercase tracking-wider" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>Total Revenue</p>
                                                    <h3 className="mb-0 fw-bold text-dark">
                                                        {totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="row mt-1">
                                    <div className="col-xl-8 col-lg-12 mb-4">
                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                        <div className="card-body p-4 p-md-5">
                                            <div className="d-flex flex-wrap justify-content-between align-items-start align-items-md-center mb-5 gap-3">
                                                <div>
                                                    <h4 className="mb-1 fw-bold text-dark">Daily Sales Trend</h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Showing total sales amount grouped by entry date</p>
                                                </div>
                                            </div>
                                            
                                            {categories.length > 0 ? (
                                                <ReactApexChart options={chartOptions} series={series} type="bar" height={400} />
                                            ) : (
                                                <div className="text-center py-5">
                                                    <div className="mb-3">
                                                        <i className="fa fa-chart-bar" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                    </div>
                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see sales trends.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-xl-4 col-lg-12 mb-4">
                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                        <div className="card-body p-4 p-md-5">
                                            <div className="mb-5">
                                                <h4 className="mb-1 fw-bold text-dark">Sales by Customer</h4>
                                                <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Distribution of sales among customers</p>
                                            </div>
                                            
                                            {customerLabels.length > 0 ? (
                                                <div className="d-flex justify-content-center align-items-center h-100" style={{ minHeight: '300px' }}>
                                                    <ReactApexChart options={donutOptions} series={customerSeries} type="donut" width="100%" />
                                                </div>
                                            ) : (
                                                <div className="text-center py-5">
                                                    <div className="mb-3">
                                                        <i className="fa fa-chart-pie" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                    </div>
                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see customer distribution.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="row mt-2">
                                <div className="col-12 mb-4">
                                    <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                        <div className="card-body p-4 p-md-5">
                                            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                                                <div>
                                                    <h4 className="mb-1 fw-bold text-dark">Monthly Sales Trend</h4>
                                                    <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Overview of sales performance over the months</p>
                                                </div>
                                                <div className="d-flex align-items-center">
                                                    <span className="badge bg-light text-dark px-3 py-2" style={{ border: '1px solid #eaebf0', borderRadius: '8px' }}>
                                                        <i className="fa fa-calendar-alt text-muted me-2"></i> Monthly Aggregation
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {monthCategories.length > 0 ? (
                                                <ReactApexChart options={areaOptions} series={areaSeries} type="area" height={350} />
                                            ) : (
                                                <div className="text-center py-5">
                                                    <div className="mb-3">
                                                        <i className="fa fa-chart-area" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                    </div>
                                                    <h5 className="text-muted fw-semibold">No data available</h5>
                                                    <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see monthly trends.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </>
                        )}
                        {activeTab === 'itemGraph' && (
                            <>
                                <div className="row mt-3">
                                    <div className="col-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
                                                    <div>
                                                        <h4 className="mb-1 fw-bold text-dark">Total Sales Quantity (Bar)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly breakdown of total quantities sold</p>
                                                    </div>
                                                </div>
                                                
                                                {formattedItemMonthCategories.length > 0 ? (
                                                    <ReactApexChart options={itemBarOptions} series={totalQuantitySeries} type="bar" height={350} />
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-bar" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No item data available</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Adjust the date filters to see item sales trends.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="row mt-2">
                                    <div className="col-12 mb-4">
                                        <div className="card border-0 h-100" style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                                            <div className="card-body p-4 p-md-5">
                                                <div className="mb-4">
                                                    <div className="mb-3">
                                                        <h4 className="mb-1 fw-bold text-dark">Item-Wise Sales Quantity (Line)</h4>
                                                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Monthly trend of item quantities sold</p>
                                                    </div>
                                                    <div className="p-3 rounded" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                        <label className="form-label fw-semibold mb-2" style={{ fontSize: '13px', color: '#475569' }}>
                                                            <i className="fa fa-filter me-2 text-muted"></i> Select Items to Compare:
                                                        </label>
                                                        <div style={{ zIndex: 10 }}>
                                                            <Select
                                                                isMulti
                                                                options={itemOptions}
                                                                value={selectedItems}
                                                                onChange={setSelectedItems}
                                                                placeholder="Search and select items..."
                                                                classNamePrefix="select"
                                                                styles={{
                                                                    control: (base) => ({
                                                                        ...base,
                                                                        borderRadius: '8px',
                                                                        borderColor: '#cbd5e1',
                                                                        minHeight: '44px',
                                                                        boxShadow: 'none',
                                                                        '&:hover': { borderColor: '#94a3b8' }
                                                                    }),
                                                                    multiValue: (base) => ({
                                                                        ...base,
                                                                        backgroundColor: '#e2e8f0',
                                                                        borderRadius: '6px',
                                                                        padding: '2px 4px'
                                                                    }),
                                                                    multiValueLabel: (base) => ({
                                                                        ...base,
                                                                        color: '#1e293b',
                                                                        fontWeight: 500,
                                                                        fontSize: '13px'
                                                                    }),
                                                                    multiValueRemove: (base) => ({
                                                                        ...base,
                                                                        borderRadius: '4px',
                                                                        color: '#64748b',
                                                                        '&:hover': {
                                                                            backgroundColor: '#ef4444',
                                                                            color: 'white'
                                                                        }
                                                                    })
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {formattedItemMonthCategories.length > 0 && filteredItemSeries.length > 0 ? (
                                                    <ReactApexChart options={itemLineOptions} series={filteredItemSeries} type="line" height={350} />
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <div className="mb-3">
                                                            <i className="fa fa-chart-line" style={{ fontSize: '3rem', color: '#cbd5e1' }}></i>
                                                        </div>
                                                        <h5 className="text-muted fw-semibold">No items selected</h5>
                                                        <p className="text-muted" style={{ fontSize: '14px' }}>Please select items from the dropdown to view their sales trends.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>