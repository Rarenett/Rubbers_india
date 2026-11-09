import React, { Fragment, useState, useEffect } from 'react';
import { Card, Form } from 'react-bootstrap';
import { usePageTitle } from '../../../context/TitleContext';
import { fetchCompanyFinancialYears } from '../../../services/CompanyService';
const AssetAllocationList = ({
    activeManagement,
    data,
    loading,
    searchTerm,
    onSearchChange,
    onExport,
    onReturn,
    onReallocate,
    onUpdateResponse,
    currentUser,
    onAllocate,
    onShowHistory
}) => {
    const isKey = activeManagement.includes('Key');
    const [activeTab, setActiveTab] = React.useState('Allocated To Me');
    
    // Default to current month
    const currentDate = new Date();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [fromDate, setFromDate] = React.useState(
        localStorage.getItem('active_fy_start') || `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    );
    const [toDate, setToDate] = React.useState(
        localStorage.getItem('active_fy_end') || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
    );

    useEffect(() => {
        const fetchFy = async () => {
            try {
                const companyId = localStorage.getItem('companyId') || 1;
                const res = await fetchCompanyFinancialYears(companyId);
                if (res.data && Array.isArray(res.data)) {
                    const activeFy = res.data.find(fy => fy.is_active);
                    if (activeFy) {
                        setFromDate(activeFy.start_date);
                        setToDate(activeFy.end_date);
                        localStorage.setItem('active_fy_start', activeFy.start_date);
                        localStorage.setItem('active_fy_end', activeFy.end_date);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch financial years", error);
            }
        };
        fetchFy();
    }, []);

    usePageTitle("Allocation Management");
    let filtered = [...(data || [])];

    if (activeManagement === 'Key Allocation' || activeManagement === 'Allocation') {
        const currentUserId = currentUser?.user?.id || currentUser?.id;
        if (activeTab === 'Allocated To Me') {
            filtered = filtered.filter(item => {
                const assignedId = item.assigned_to_details?.id || item.allocated_to_user_details?.id;
                
                // Hide return allocations once they are responded to (Accepted/Rejected)
                if (item.remarks && item.remarks.startsWith('Returned from') && item.holder_response !== 'Pending') {
                    return false;
                }

                return String(assignedId) === String(currentUserId) && item.status !== 'Reallocated' && item.status !== 'Returned';
            });
        } else if (activeTab === 'My Reallocations') {
            filtered = filtered.filter(item => {
                const allocatedById = item.allocated_by_details?.id || item.allocated_by;
                const assignedId = item.assigned_to_details?.id || item.allocated_to_user_details?.id;
                
                const isAllocatedByMe = String(allocatedById) === String(currentUserId);
                const isAcceptedReturnToMe = String(assignedId) === String(currentUserId) && 
                                           item.remarks && item.remarks.startsWith('Returned from') && 
                                           item.holder_response !== 'Pending';

                const isOverdue = item.status === 'Overdue' || (item.due_date && new Date(item.due_date) < new Date() && item.status !== 'Returned' && item.status !== 'Reallocated');

                // Prevent showing duplicates that are already visible in 'Allocated To Me'
                const isCurrentlyAllocatedToMe = String(assignedId) === String(currentUserId) && 
                                                 item.status !== 'Reallocated' && 
                                                 item.status !== 'Returned' && 
                                                 !(item.remarks && item.remarks.startsWith('Returned from') && item.holder_response !== 'Pending');
                                                 
                if (isCurrentlyAllocatedToMe) return false;

                if (!isAllocatedByMe && !isAcceptedReturnToMe && !isOverdue) return false;
                

                
                return true;
            });
        }
    }

    if (activeManagement === 'Report' || activeManagement === 'Key Report') {
        const itemGroups = {};
        filtered.forEach(item => {
            const itemId = activeManagement === 'Report' ? (item.file || item.file_details?.id) : (item.key || item.key_details?.id);
            if (itemId) {
                if (!itemGroups[itemId]) itemGroups[itemId] = [];
                itemGroups[itemId].push(item);
            }
        });

        const groupedData = [];

        Object.values(itemGroups).forEach(records => {
            records.sort((a, b) => new Date(a.allocated_at) - new Date(b.allocated_at));
            
            let currentCycle = [];

            records.forEach(item => {
                if (currentCycle.length === 0) {
                    currentCycle.push(item);
                    return;
                }

                const prevItem = currentCycle[currentCycle.length - 1];
                
                const isReturnToCustodian = item.remarks && item.remarks.startsWith('Returned from');
                const prevAssignedId = prevItem.assigned_to_details?.id || prevItem.allocated_to_user_details?.id;
                const currAllocatedById = item.allocated_by_details?.id || item.allocated_by;
                const isReallocation = String(prevAssignedId) === String(currAllocatedById);

                if (isReturnToCustodian || isReallocation) {
                    currentCycle.push(item);
                } else {
                    const first = currentCycle[0];
                    const last = currentCycle[currentCycle.length - 1];
                    const merged = { ...first };
                    if (last.remarks && last.remarks.startsWith('Returned from')) {
                        merged.returned_at = (last.status === 'Returned' && last.returned_at) ? last.returned_at : last.allocated_at;
                        merged.status = 'Returned';
                    } else if (last.status === 'Returned') {
                        merged.returned_at = last.returned_at;
                        merged.status = 'Returned';
                    } else {
                        merged.returned_at = null;
                        merged.status = last.status;
                    }
                    groupedData.push(merged);
                    currentCycle = [item];
                }
            });

            if (currentCycle.length > 0) {
                const first = currentCycle[0];
                const last = currentCycle[currentCycle.length - 1];
                const merged = { ...first };
                if (last.remarks && last.remarks.startsWith('Returned from')) {
                    merged.returned_at = (last.status === 'Returned' && last.returned_at) ? last.returned_at : last.allocated_at;
                    merged.status = 'Returned';
                } else if (last.status === 'Returned') {
                    merged.returned_at = last.returned_at;
                    merged.status = 'Returned';
                } else {
                    merged.returned_at = null;
                    merged.status = last.status;
                }
                groupedData.push(merged);
            }
        });
        
        groupedData.sort((a, b) => new Date(b.allocated_at) - new Date(a.allocated_at));
        filtered = groupedData;
    }

    if (fromDate || toDate) {
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.allocated_at);
            if (fromDate) {
                const filterFrom = new Date(fromDate);
                filterFrom.setHours(0, 0, 0, 0);
                if (itemDate < filterFrom) return false;
            }
            if (toDate) {
                const filterTo = new Date(toDate);
                filterTo.setHours(23, 59, 59, 999);
                if (itemDate > filterTo) return false;
            }
            return true;
        });
    }

    if (searchTerm) {
        filtered = filtered.filter(item => {
            const custodianName = item.file_details?.rack_custodian_name || item.key_details?.rack_custodian_name || '';
            const roomName = item.file_details?.room_name || item.key_details?.room_name || '';
            const shelfName = item.file_details?.shelf_name || item.key_details?.shelf_name || '';
            const rackName = item.file_details?.rack_name || item.key_details?.rack_name || '';
            
            const isReport = ['Report', 'Key Report'].includes(activeManagement);
            const assignedToFirstName = isReport ? '' : (item.allocated_to_user_name || item.assigned_to_details?.first_name || '');
            const assignedToLastName = isReport ? '' : (item.assigned_to_details?.last_name || '');
            const assignedToEmail = isReport ? '' : (item.allocated_to_user_details?.email || item.assigned_to_details?.email || '');
            
            const allocatedByName = isReport ? '' : (item.allocated_by_name || item.allocated_by_details?.first_name || '');
            const allocatedByLastName = isReport ? '' : (item.allocated_by_details?.last_name || '');
            
            const receivedFrom = isReport ? '' : (item.previous_holder_details?.received_from || 'Admin/Stock');
            const holderResponse = isReport ? '' : (item.holder_response || '');
            
            const searchStr = `${item.file_details?.file_name || ''} ${item.key_details?.key_name || ''} ${item.file_details?.reference_code || ''} ${assignedToFirstName} ${assignedToLastName} ${assignedToEmail} ${allocatedByName} ${allocatedByLastName} ${receivedFrom} ${holderResponse} ${item.status || ''} ${custodianName} ${roomName} ${shelfName} ${rackName}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
    }

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab, fromDate, toDate]);

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    return (
        <Fragment>
            <style dangerouslySetInnerHTML={{__html: `
                .allocation-header-container {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    flex-wrap: wrap !important;
                    gap: 15px !important;
                }
                .allocation-controls-wrapper {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    flex-wrap: wrap !important;
                }
                .allocation-actions-group {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .allocation-search-bar {
                    width: 300px !important;
                }
                .allocation-date-filters {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                .allocation-date-item {
                    display: flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                }
                .allocation-table {
                    margin-bottom: 0 !important;
                }
                .allocation-table th {
                    white-space: nowrap !important;
                    vertical-align: middle !important;
                    font-size: 13px !important;
                }
                .allocation-table td {
                    vertical-align: middle !important;
                }
                .allocation-search-export-row {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }
                @media (max-width: 767px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                    }
                    .allocation-table {
                        min-width: 650px !important;
                    }
                    .allocation-title-group {
                        width: 100% !important;
                    }
                    .allocation-tabs-wrapper {
                        width: 100% !important;
                        display: flex !important;
                        justify-content: space-between !important;
                        padding: 3px !important;
                    }
                    .allocation-tab-btn {
                        flex: 1 1 0% !important;
                        justify-content: center !important;
                        padding: 7px 8px !important;
                        font-size: 12px !important;
                        white-space: nowrap !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        gap: 8px !important;
                    }
                    .allocation-date-filters {
                        width: 100% !important;
                        margin-bottom: 6px !important;
                        order: 0 !important;
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-date-item {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 4px !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 11px !important;
                        font-weight: 600 !important;
                        flex-shrink: 0 !important;
                        margin-right: 2px !important;
                        color: #64748b !important;
                    }
                    .allocation-date-item input {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        width: 100% !important;
                        font-size: 11.5px !important;
                        padding: 4px 4px 4px 6px !important;
                        height: 34px !important;
                        border-radius: 6px !important;
                    }
                    .allocation-actions-group {
                        width: 100% !important;
                        order: 1 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 8px !important;
                    }
                    .allocation-add-btn {
                        flex: 1 1 auto !important;
                        height: 38px !important;
                        font-size: 13px !important;
                        padding: 0 12px !important;
                        justify-content: center !important;
                    }
                    .allocation-export-btn {
                        width: 38px !important;
                        height: 38px !important;
                        flex-shrink: 0 !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                        order: 2 !important;
                        margin-top: 4px !important;
                    }
                    .allocation-search-export-row {
                        width: 100% !important;
                        order: 1 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 8px !important;
                    }
                    .allocation-search-export-row .allocation-search-bar {
                        flex: 1 1 auto !important;
                        width: auto !important;
                        margin-top: 0 !important;
                        min-width: 0 !important;
                    }
                }
                @media (max-width: 480px) {
                    .allocation-date-filters {
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-date-item {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 11px !important;
                        margin-right: 2px !important;
                    }
                    .allocation-date-item input {
                        flex: 1 1 0% !important;
                        min-width: 0 !important;
                        width: 100% !important;
                        font-size: 11px !important;
                        padding: 4px 2px 4px 5px !important;
                    }
                    .allocation-tab-btn {
                        padding: 6px 4px !important;
                        font-size: 11.5px !important;
                        gap: 4px !important;
                    }
                    .allocation-tab-btn svg {
                        width: 13px !important;
                        height: 13px !important;
                    }
                }
                @media (max-width: 400px) {
                    .allocation-table {
                        min-width: 600px !important;
                    }
                    .allocation-search-export-row {
                        gap: 6px !important;
                    }
                }
                @media (max-width: 360px) {
                    .allocation-date-filters {
                        gap: 4px !important;
                    }
                    .allocation-date-item .date-label {
                        font-size: 10px !important;
                    }
                    .allocation-date-item input {
                        font-size: 10px !important;
                        padding: 2px 2px 2px 3px !important;
                    }
                    .allocation-tab-btn {
                        font-size: 10px !important;
                        padding: 5px 2px !important;
                    }
                    .allocation-export-btn {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .allocation-add-btn {
                        height: 32px !important;
                        font-size: 11px !important;
                    }
                }
                @media (min-width: 768px) and (max-width: 850px) {
                    .allocation-search-bar {
                        width: 200px !important;
                    }
                }
                @media (min-width: 540px) and (max-width: 540px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        gap: 6px !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                    }
                }
                @media (min-width: 344px) and (max-width: 344px) {
                    .allocation-header-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 8px !important;
                    }
                    .allocation-tabs-wrapper {
                        width: 100% !important;
                    }
                    .allocation-tab-btn {
                        font-size: 10px !important;
                        padding: 4px 4px !important;
                    }
                    .allocation-controls-wrapper {
                        width: 100% !important;
                        gap: 4px !important;
                    }
                    .allocation-search-bar {
                        width: 100% !important;
                    }
                    .allocation-export-btn {
                        width: 28px !important;
                        height: 28px !important;
                    }
                    .allocation-add-btn {
                        height: 28px !important;
                        font-size: 10px !important;
                        padding: 0 6px !important;
                    }
                }
            `}} />
            <div className="container-fluid">
                <div className="row">
                    <div className="col-lg-12">
                    <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center allocation-header-container">
                            <div className="d-flex flex-column gap-2 allocation-title-group">
                                <Card.Title className="mb-0">{activeManagement} List</Card.Title>
                                {(activeManagement === 'Key Allocation' || activeManagement === 'Allocation') && (
                                    <div className="d-inline-flex p-1 mt-2 allocation-tabs-wrapper" style={{ backgroundColor: '#f1f5f9', borderRadius: '30px' }}>
                                        <button 
                                            className="btn btn-sm border-0 d-flex align-items-center gap-2 allocation-tab-btn"
                                            onClick={() => setActiveTab('Allocated To Me')}
                                            style={{ 
                                                borderRadius: '30px', 
                                                padding: '6px 20px', 
                                                fontWeight: '600',
                                                backgroundColor: activeTab === 'Allocated To Me' ? '#fff' : 'transparent',
                                                color: activeTab === 'Allocated To Me' ? '#1d4ed8' : '#64748b',
                                                boxShadow: activeTab === 'Allocated To Me' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                                transition: 'all 0.2s ease-in-out'
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                            Allocated To Me
                                        </button>
                                        <button 
                                            className="btn btn-sm border-0 d-flex align-items-center gap-2 allocation-tab-btn"
                                            onClick={() => setActiveTab('My Reallocations')}
                                            style={{ 
                                                borderRadius: '30px', 
                                                padding: '6px 20px', 
                                                fontWeight: '600',
                                                backgroundColor: activeTab === 'My Reallocations' ? '#fff' : 'transparent',
                                                color: activeTab === 'My Reallocations' ? '#1d4ed8' : '#64748b',
                                                boxShadow: activeTab === 'My Reallocations' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                                                transition: 'all 0.2s ease-in-out'
                                            }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                            My Reallocations
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="d-flex align-items-center gap-2 allocation-controls-wrapper">
                                {(((activeManagement === 'Key Allocation' || activeManagement === 'Allocation') && activeTab === 'My Reallocations') || activeManagement === 'Report' || activeManagement === 'Key Report') && (
                                    <div className="d-flex align-items-center gap-2 allocation-date-filters">
                                        <div className="d-flex align-items-center allocation-date-item">
                                            <span className="text-muted date-label" style={{ fontSize: '12px', fontWeight: '500' }}>From:</span>
                                            <Form.Control type="date" size="sm" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ height: '34px', borderRadius: '6px', fontSize: '13px' }} />
                                        </div>     
                                        <div className="d-flex align-items-center allocation-date-item">
                                            <span className="text-muted date-label" style={{ fontSize: '12px', fontWeight: '500' }}>To:</span>
                                            <Form.Control type="date" size="sm" value={toDate} onChange={e => setToDate(e.target.value)} style={{ height: '34px', borderRadius: '6px', fontSize: '13px' }} />
                                        </div>
                                    </div>
                                )}
                                {onAllocate ? (
                                    <>
                                        <div className="allocation-actions-group">
                                            <button className="btn shadow-none allocation-add-btn" style={{ backgroundColor: 'rgb(61, 53, 119)', borderColor: 'rgb(61, 53, 119)', color: '#fff', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', borderRadius: '6px', padding: '0 16px' }} onClick={onAllocate}>
                                                + Allocate
                                            </button>
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('pdf')} title="Export PDF">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            </button>
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('excel')} title="Export Excel">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                            </button>
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('print')} title="Print">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                            </button>
                                        </div>
                                        <div className="allocation-search-bar" style={{ position: 'relative' }}>
                                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                            <Form.Control
                                                type="text"
                                                placeholder={`Search ${activeManagement.toLowerCase()}s...`}
                                                value={searchTerm}
                                                onChange={(e) => onSearchChange(e.target.value)}
                                                style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="allocation-search-export-row">
                                        <div className="allocation-search-bar" style={{ position: 'relative' }}>
                                            <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                            <Form.Control
                                                type="text"
                                                placeholder={`Search ${activeManagement.toLowerCase()}s...`}
                                                value={searchTerm}
                                                onChange={(e) => onSearchChange(e.target.value)}
                                                style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('pdf')} title="Export PDF">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            </button>
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('excel')} title="Export Excel">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                            </button>
                                            <button className="btn btn-sm btn-light border allocation-export-btn" style={{ borderRadius: '6px', width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0' }} onClick={() => onExport && onExport('print')} title="Print">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    <table className="table table-responsive-md allocation-table">
                                        <thead>
                                            <tr>
                                                <th><strong>SL.NO</strong></th>
                                                <th><strong>{
                                                    ['Report', 'Allocation'].includes(activeManagement) ? 'FILE NAME' :
                                                    ['Key Report', 'Key Allocation'].includes(activeManagement) ? 'KEY NAME' :
                                                    'ASSET / FILE / KEY'
                                                }</strong></th>
                                                {['Report', 'Key Report'].includes(activeManagement) && <th><strong>{activeManagement === 'Report' ? 'FILE LOCATION' : 'KEY LOCATION'}</strong></th>}
                                                {['Report', 'Key Report'].includes(activeManagement) && <th><strong>CUSTODIAN NAME</strong></th>}
                                                {!['Report', 'Key Report'].includes(activeManagement) && <th><strong>ASSIGNED TO</strong></th>}
                                                {!['Report', 'Key Report'].includes(activeManagement) && <th><strong>ALLOCATED BY</strong></th>}
                                                {!['Report', 'Key Report'].includes(activeManagement) && activeTab === 'My Reallocations' && <th><strong>RECEIVED FROM</strong></th>}
                                                {!['Report', 'Key Report'].includes(activeManagement) && <th className="text-center"><strong>STATUS</strong></th>}
                                                {!['Report', 'Key Report'].includes(activeManagement) && <th className="text-center"><strong>HOLDER RESPONSE</strong></th>}
                                                <th><strong>ALLOCATED DATE</strong></th>
                                                <th><strong>RETURNED DATE</strong></th>
                                                {!['Report', 'Key Report'].includes(activeManagement) && <th><strong>DUE DATE</strong></th>}
                                                <th className="text-end"><strong>ACTIONS</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td colSpan="12" className="text-center py-4 text-muted">
                                                        No allocations found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentItems.map((item, idx) => {
                                                    const assignedUserId = item.assigned_to_details?.id || item.allocated_to_user_details?.id;
                                                    const currentUserId = currentUser?.user?.id || currentUser?.id;
                                                    const isAssignedToMe = assignedUserId && currentUserId && String(assignedUserId) === String(currentUserId);
                                                    const isPending = item.holder_response === 'Pending';
                                                    return (
                                                    <tr key={item.id || idx}>
                                                        <td>{indexOfFirstItem + idx + 1}</td>
                                                        <td>
                                                            {isKey ? (
                                                                <>
                                                                    <strong>{item.key_details?.key_name || '—'}</strong>
                                                                </>
                                                            ) : item.file_details ? (
                                                                <>
                                                                    <strong>{item.file_details.file_name}</strong>
                                                                </>
                                                            ) : (
                                                                <div>
                                                                    {item.items?.map((it, i) => (
                                                                        <div key={i}>
                                                                            <strong>{it.asset_details?.name}</strong>
                                                                            <small className="text-muted ms-1">({it.asset_details?.asset_code})</small>
                                                                        </div>
                                                                    ))}
                                                                    {(!item.items || item.items.length === 0) && '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                        {['Report', 'Key Report'].includes(activeManagement) && (
                                                            <td>
                                                                <div className="d-flex flex-column gap-1">
                                                                    <small>Room: {(activeManagement === 'Report' ? item.file_details?.room_name : item.key_details?.room_name) || '—'}</small>
                                                                    <small>Shelf: {(activeManagement === 'Report' ? item.file_details?.shelf_name : item.key_details?.shelf_name) || '—'}</small>
                                                                    <small>Rack: {(activeManagement === 'Report' ? item.file_details?.rack_name : item.key_details?.rack_name) || '—'}</small>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {['Report', 'Key Report'].includes(activeManagement) && (
                                                            <td>
                                                                {(activeManagement === 'Report' ? item.file_details?.rack_custodian_name : item.key_details?.rack_custodian_name) || '—'}
                                                            </td>
                                                        )}
                                                        {!['Report', 'Key Report'].includes(activeManagement) && (
                                                            <td>
                                                                <strong>{item.allocated_to_user_name || (item.assigned_to_details ? `${item.assigned_to_details.first_name} ${item.assigned_to_details.last_name}` : '—')}</strong>
                                                                <div className="text-muted" style={{ fontSize: '13px' }}>{item.allocated_to_user_details?.email || item.assigned_to_details?.email}</div>
                                                            </td>
                                                        )}
                                                        {!['Report', 'Key Report'].includes(activeManagement) && <td>{item.allocated_by_name || (item.allocated_by_details ? `${item.allocated_by_details.first_name} ${item.allocated_by_details.last_name}` : '—')}</td>}
                                                        {!['Report', 'Key Report'].includes(activeManagement) && activeTab === 'My Reallocations' && (
                                                            <td>
                                                                <div className="d-flex flex-column gap-1">
                                                                    <span>{item.previous_holder_details?.received_from || 'Admin/Stock'}</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {!['Report', 'Key Report'].includes(activeManagement) && (
                                                            <td className="text-center">
                                                                {(() => {
                                                                    let displayStatus = item.status;
                                                                    if (item.remarks && item.remarks.startsWith('Returned from') && item.holder_response !== 'Pending') {
                                                                        displayStatus = 'Returned';
                                                                    }
                                                                    return (
                                                                        <span className={`badge badge-${displayStatus === 'Active' || displayStatus === 'In Use' ? 'success' : displayStatus === 'Returned' ? 'secondary' : displayStatus === 'Overdue' ? 'danger' : 'primary'} light`}>
                                                                            {displayStatus}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                        )}
                                                        {!['Report', 'Key Report'].includes(activeManagement) && (
                                                            <td className="text-center">
                                                                {(() => {
                                                                    if (isPending && isAssignedToMe) {
                                                                        return (
                                                                            <select
                                                                                className="form-select form-select-sm"
                                                                                style={{ minWidth: '110px', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer', margin: '0 auto' }}
                                                                                value="Pending"
                                                                                onChange={(e) => {
                                                                                    if (e.target.value === 'Accepted' || e.target.value === 'Rejected') {
                                                                                        onUpdateResponse(item, e.target.value);
                                                                                    }
                                                                                }}
                                                                            >
                                                                                <option value="Pending" disabled>Respond...</option>
                                                                                <option value="Accepted">Accept</option>
                                                                                <option value="Rejected">Reject</option>
                                                                            </select>
                                                                        );
                                                                    }
                                                                    return item.holder_response ? (
                                                                        <span className={`badge badge-${item.holder_response === 'Accepted' ? 'success' : item.holder_response === 'Rejected' ? 'danger' : 'warning'} light`}>
                                                                            {item.holder_response}
                                                                        </span>
                                                                    ) : <span className="text-muted">—</span>;
                                                                })()}
                                                            </td>
                                                        )}
                                                        <td>{item.allocated_at ? new Date(item.allocated_at).toLocaleDateString() : '—'}</td>
                                                        <td>{item.returned_at ? new Date(item.returned_at).toLocaleDateString() : '—'}</td>
                                                        {!['Report', 'Key Report'].includes(activeManagement) && <td>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</td>}
                                                        <td className="text-end">
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    {['Report', 'Key Report'].includes(activeManagement) && onShowHistory && (item.file_details || item.key_details) && (
                                                                        <button className="btn btn-outline-info" style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '6px' }} onClick={() => onShowHistory(activeManagement === 'Report' ? item.file_details : item.key_details)} title="Allocation History">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                                        </button>
                                                                    )}
                                                                    {!['Report', 'Key Report'].includes(activeManagement) && (() => {
                                                                        const assignedUserId = item.assigned_to_details?.id || item.allocated_to_user_details?.id;
                                                                        const currentUserId = currentUser?.user?.id || currentUser?.id;
                                                                        const isAssignedToMe = assignedUserId && currentUserId && String(assignedUserId) === String(currentUserId);
                                                                        const isSuper = currentUser?.user?.is_superuser;
                                                                        const canManage = isSuper || isAssignedToMe;
                                                                        const isPending = item.holder_response === 'Pending';

                                                                        if (!canManage) return <span className="text-muted">—</span>;

                                                                        return (
                                                                            <>
                                                                                {!isPending && (item.status === 'Active' || item.status === 'Allocated' || item.status === 'In Use' || item.status === 'Overdue') && (
                                                                                    <>
                                                                                        <button className="btn btn-outline-warning" style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '6px' }} title="Return" onClick={() => onReturn(item)}>
                                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z" /></svg>
                                                                                        </button>
                                                                                        {(activeManagement === 'File' || activeManagement === 'Allocation' || activeManagement.startsWith('Key')) && (isSuper || (isAssignedToMe && item.allow_reallocation !== false)) && (
                                                                                            <button className="btn btn-outline-info" style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0', borderRadius: '6px' }} title="Reallocate" onClick={() => onReallocate(item)}>
                                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
                                                                                            </button>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {!loading && filtered.length > 0 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 mb-3 pt-3 border-top">
                                    <div className="text-muted" style={{ fontSize: '13px' }}>
                                        Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} entries
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
                        </Card.Body>
                    </Card>
                    </div>
                </div>
            </div>
        </Fragment>
    );
};

export default AssetAllocationList;