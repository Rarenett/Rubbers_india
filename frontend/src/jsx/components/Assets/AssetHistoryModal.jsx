import React from 'react';

const AssetHistoryModal = ({
    showHistoryModal,
    setShowHistoryModal,
    historyList,
    historyLoading,
    historyItemName,
    historyItemType
}) => {
    if (!showHistoryModal) return null;

    const styles = `
        .scfm-modal .modal-header-custom {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px 28px 16px 28px;
            border-bottom: 1px solid #f1f5f9;
        }
        .scfm-modal .modal-icon-circle {
            width: 48px;
            height: 48px;
            background-color: var(--fd-accent, #0a500f);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(122, 112, 186, 0.2);
        }
        .scfm-modal .modal-close-x {
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
        .scfm-modal .modal-close-x:hover { color: #555; }
        .scfm-modal .modal-body-custom { padding: 24px 28px; }
        .scfm-modal .modal-footer-custom {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 20px 28px 24px 28px;
            border-top: 1px solid #f1f5f9;
            background-color: #fafbfc;
            gap: 12px;
            border-radius: 0 0 16px 16px;
        }
        .scfm-modal .btn-close-custom {
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
        .scfm-modal .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
    `;

    const Icons = {
        Allocated: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', marginTop: '-2px'}}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
        ),
        Reallocated: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', marginTop: '-2px'}}>
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
        ),
        Returned: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', marginTop: '-2px'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        ),
        Ongoing: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px', marginTop: '-2px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        ),
        Calendar: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px', marginTop: '-2px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        ),
        Clock: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px', marginTop: '-2px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        ),
        AlertCircle: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px', marginTop: '-2px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        ),
        User: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px', marginTop: '-2px', color: '#64748b'}}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        )
    };

    return (
        <>
        <style>{styles}</style>
        <div className="fd-modal-overlay" style={{ zIndex: 1050 }}>
            <div className="fd-modal-content" style={{ padding: 0, maxWidth: '800px', width: '90%', borderRadius: '16px', overflow: 'hidden' }}>
                <div className="scfm-modal w-100 h-100 d-flex flex-column">
                    <div className="modal-header-custom bg-white">
                        <div className="d-flex align-items-center gap-3">
                            <div className="modal-icon-circle">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                                    {historyItemType} History
                                </h4>
                                <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                                    {historyItemName}
                                </p>
                            </div>
                        </div>
                        <button type="button" className="modal-close-x" onClick={() => setShowHistoryModal(false)}>&times;</button>
                    </div>

                    <div className="modal-body-custom flex-grow-1" style={{ backgroundColor: '#f8fafc' }}>
                
                {historyLoading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="sr-only">Loading...</span>
                        </div>
                        <p className="mt-2 text-muted">Fetching history details...</p>
                    </div>
                ) : historyList.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-white rounded-3 shadow-sm border border-light">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-muted" style={{ opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <p className="mb-0">No allocation or reallocation history found for this {historyItemType.toLowerCase()}.</p>
                    </div>
                ) : (
                    <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '5px' }}>
                        <div className="timeline-container" style={{ position: 'relative', paddingLeft: '24px' }}>
                            <div style={{ position: 'absolute', left: '6px', top: '24px', bottom: '24px', width: '2px', background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)', borderRadius: '4px' }}></div>
                            
                            {(() => {
                                const events = [];
                                [...historyList].reverse().forEach((entry, idx, arr) => {
                                    // Skip internal "return to custodian" records since the previous record's 'end' event already shows the return action.
                                    if (entry.remarks && entry.remarks.startsWith('Returned from')) {
                                        return;
                                    }
                                    
                                    const isFreshAllocation = idx === 0 || arr[idx - 1].status === 'Returned' || (arr[idx - 1].remarks && arr[idx - 1].remarks.startsWith('Returned from'));
                                    
                                    const custodianName = entry.file_details?.rack_custodian_name || entry.key_details?.rack_custodian_name;

                                    let actorName = entry.allocated_by_name || entry.allocated_by_email || (entry.allocated_by_details ? `${entry.allocated_by_details.first_name} ${entry.allocated_by_details.last_name}` : 'System');
                                    actorName = actorName.trim();
                                    if (custodianName && actorName === custodianName) actorName += ' (Custodian)';

                                    let targetName = entry.assigned_to_details ? `${entry.assigned_to_details.first_name} ${entry.assigned_to_details.last_name}`.trim() || entry.assigned_to_details.email : 'Unknown User';
                                    if (custodianName && targetName === custodianName) targetName += ' (Custodian)';
                                    
                                    let overdueDays = 0;
                                    if (entry.due_date) {
                                        const dueDate = new Date(entry.due_date);
                                        dueDate.setHours(0,0,0,0);
                                        
                                        const compareDate = entry.returned_at ? new Date(entry.returned_at) : new Date();
                                        compareDate.setHours(0,0,0,0);
                                        
                                        const diffTime = compareDate.getTime() - dueDate.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        
                                        if (diffDays > 0) overdueDays = diffDays;
                                    }
                                    
                                    let heldDays = 0;
                                    if (entry.allocated_at) {
                                        const allocDate = new Date(entry.allocated_at);
                                        allocDate.setHours(0,0,0,0);
                                        
                                        const returnDate = entry.returned_at ? new Date(entry.returned_at) : new Date();
                                        returnDate.setHours(0,0,0,0);
                                        
                                        const hDiff = returnDate.getTime() - allocDate.getTime();
                                        heldDays = Math.max(0, Math.ceil(hDiff / (1000 * 60 * 60 * 24)));
                                    }
                                    
                                    events.push({
                                        id: `start-${entry.id}`,
                                        type: isFreshAllocation ? 'Allocated' : 'Reallocated',
                                        date: entry.allocated_at ? new Date(entry.allocated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
                                        actor: actorName,
                                        target: targetName,
                                        targetEmail: entry.assigned_to_details?.email,
                                        remarks: entry.remarks,
                                        color: isFreshAllocation ? '#6366f1' : '#3b82f6',
                                        icon: isFreshAllocation ? Icons.Allocated : Icons.Reallocated,
                                        dueDate: entry.due_date ? new Date(entry.due_date).toLocaleDateString([], { dateStyle: 'medium' }) : null,
                                        returnedDate: entry.returned_at ? new Date(entry.returned_at).toLocaleDateString([], { dateStyle: 'medium' }) : null,
                                        heldDays: heldDays,
                                        overdueDays: overdueDays > 0 ? overdueDays : null
                                    });

                                    if (entry.status === 'Returned') {
                                        events.push({
                                            id: `end-${entry.id}`,
                                            type: 'Returned',
                                            date: entry.returned_at ? new Date(entry.returned_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—',
                                            actor: targetName,
                                            target: custodianName ? `${custodianName} (Custodian)` : 'Custodian',
                                            targetEmail: null,
                                            remarks: entry.return_remarks,
                                            color: '#10b981',
                                            icon: Icons.Returned,
                                            dueDate: null,
                                            overdueDays: null
                                        });
                                    }
                                });

                                return events.map((ev, idx) => {
                                    const isLast = idx === events.length - 1;
                                    const isOngoing = isLast && ev.type !== 'Returned';

                                    return (
                                        <div key={ev.id} className="timeline-item mb-4" style={{ position: 'relative' }}>
                                            {/* Bullet Point */}
                                            <div style={{
                                                position: 'absolute',
                                                left: '-23px',
                                                top: '16px',
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                background: ev.color,
                                                border: '2px solid #fff',
                                                boxShadow: `0 0 0 3px ${ev.color}20`
                                            }}></div>
                                            
                                            {/* Content */}
                                            <div className="card p-4 border-0" style={{ background: '#ffffff', borderRadius: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                    <div>
                                                        <div className="d-flex align-items-center mb-1">
                                                            <span style={{ color: ev.color, display: 'inline-flex', alignItems: 'center', fontWeight: '600', fontSize: '0.85rem' }}>
                                                                {ev.icon}
                                                                {ev.type}
                                                            </span>
                                                        </div>
                                                        <h5 className="mb-0 mt-2" style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b' }}>
                                                            To: {ev.target}
                                                        </h5>
                                                        {ev.targetEmail && (
                                                            <div className="text-muted mt-1" style={{ fontSize: '0.85rem' }}>{ev.targetEmail}</div>
                                                        )}
                                                    </div>
                                                    <div className="text-muted fw-bold bg-light px-2 py-1 rounded" style={{ fontSize: '0.8rem' }}>
                                                        {ev.date}
                                                    </div>
                                                </div>
                                                
                                                <div className="mb-3">
                                                    <p className="mb-0" style={{ fontSize: '0.9rem', color: '#475569' }}>
                                                        {Icons.User} By: <strong className="text-dark">{ev.actor}</strong>
                                                    </p>
                                                </div>
                                                
                                                {(ev.dueDate || ev.overdueDays || ev.returnedDate !== undefined) && (
                                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                                        {ev.dueDate && (
                                                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '500', padding: '6px 10px', fontSize: '0.8rem' }}>
                                                                {Icons.Calendar} Due: {ev.dueDate}
                                                            </span>
                                                        )}
                                                        {ev.returnedDate && (
                                                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '500', padding: '6px 10px', fontSize: '0.8rem' }}>
                                                                {Icons.Calendar} Returned: {ev.returnedDate} <span style={{opacity: 0.7, fontWeight: '400', marginLeft: '4px'}}>({ev.heldDays} day{ev.heldDays !== 1 ? 's' : ''} held)</span>
                                                            </span>
                                                        )}
                                                        {!ev.returnedDate && ev.type !== 'Returned' && (
                                                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '500', padding: '6px 10px', fontSize: '0.8rem' }}>
                                                                {Icons.Clock} Held for: {ev.heldDays} day{ev.heldDays !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {ev.overdueDays && (
                                                            <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: '600', padding: '6px 10px', fontSize: '0.8rem' }}>
                                                                {Icons.AlertCircle} Overdue: {ev.overdueDays} day(s)
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {ev.remarks && (
                                                    <div className="p-3" style={{ background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #cbd5e1', fontSize: '0.85rem', color: '#334155' }}>
                                                        <strong style={{ color: '#0f172a' }}>Remarks:</strong> {ev.remarks}
                                                    </div>
                                                )}

                                                {isOngoing && (
                                                    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed #e2e8f0', fontSize: '0.85rem' }}>
                                                        <span style={{ color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                                                            {Icons.Ongoing} Currently in possession
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                )}
                    </div>
                    
                    <div className="modal-footer-custom bg-white" style={{ borderTop: '1px solid #f1f5f9' }}>
                        <button type="button" onClick={() => setShowHistoryModal(false)} className="btn-close-custom shadow-sm">Close</button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default AssetHistoryModal;