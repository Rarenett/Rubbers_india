file_path = r'C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryForm.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_right_column = '''    const rightColumn = (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'rgba(46,206,138,0.2)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa fa-history" style={{ color: '#2ece8a', fontSize: '0.9rem' }}></i>
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.3px' }}>Previous Engagements</div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                            {engagementHistory.length > 0 ? `${engagementHistory.length} visit${engagementHistory.length > 1 ? 's' : ''} recorded` : 'No history yet'}
                        </div>
                    </div>
                </div>
                <button onClick={() => setShowHistory(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.7)', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem' }} title="Hide panel">
                    <i className="fa fa-times"></i>
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '12px' }}>
                {loadingHistory ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
                        <div className="spinner-border spinner-border-sm text-primary"></div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading history...</span>
                    </div>
                ) : engagementHistory && engagementHistory.length > 0 ? (
                    <div style={{ position: 'relative', paddingLeft: '24px' }}>
                        <div style={{ position: 'absolute', left: '9px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #2ece8a, #e2e8f0)' }}></div>
                        {engagementHistory.map((eng, idx) => {
                            const dateStr = eng.entry_time ? new Date(eng.entry_time).toLocaleDateString('en-GB') : 'Unknown Date';
                            const inTime = eng.entry_time ? new Date(eng.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                            const outTime = eng.exit_time ? new Date(eng.exit_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
                            const metPerson = entryMode === 'visitor' ? eng.employee_name : (eng.driver || 'N/A');
                            const purpose = eng.purpose_of_visit || eng.purpose || null;
                            const isOut = !!eng.exit_time || (entryMode === 'vehicle' && eng.status === 'exited') || (entryMode === 'visitor' && eng.verification_status === 'exited');
                            let duration = null;
                            if (eng.entry_time && eng.exit_time) {
                                const mins = Math.round((new Date(eng.exit_time) - new Date(eng.entry_time)) / 60000);
                                duration = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                            }
                            return (
                                <div key={idx} style={{ position: 'relative', marginBottom: '12px' }}>
                                    <div style={{ position: 'absolute', left: '-20px', top: '12px', width: '10px', height: '10px', borderRadius: '50%', background: isOut ? '#2ece8a' : '#f59e0b', border: '2px solid #fff', boxShadow: `0 0 0 2px ${isOut ? '#2ece8a' : '#f59e0b'}44` }}></div>
                                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                                        <div style={{ padding: '8px 12px', background: isOut ? 'linear-gradient(90deg, #f0fdf4, #fff)' : 'linear-gradient(90deg, #fffbeb, #fff)', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1e293b' }}>
                                                <i className="fa fa-calendar-day me-1" style={{ color: '#94a3b8' }}></i>{dateStr}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', padding: '2px 8px', borderRadius: '20px', background: isOut ? '#dcfce7' : '#fef3c7', color: isOut ? '#16a34a' : '#d97706' }}>
                                                {isOut ? '\\u2713 EXITED' : '\\u25cf IN CAMPUS'}
                                            </span>
                                        </div>
                                        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <i className="fa fa-sign-in-alt" style={{ color: '#2ece8a' }}></i>
                                                    <strong style={{ color: '#1e293b' }}>{inTime}</strong>
                                                </span>
                                                {outTime && (<>
                                                    <span style={{ color: '#cbd5e1' }}>&#8594;</span>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        <i className="fa fa-sign-out-alt" style={{ color: '#ef4444' }}></i>
                                                        <strong style={{ color: '#1e293b' }}>{outTime}</strong>
                                                    </span>
                                                </>)}
                                                {duration && (
                                                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>
                                                        <i className="fa fa-hourglass-half me-1" style={{ fontSize: '0.6rem' }}></i>{duration}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <i className={entryMode === 'visitor' ? 'fa fa-user-tie' : 'fa fa-id-card'} style={{ color: '#94a3b8', width: '12px' }}></i>
                                                <span style={{ color: '#94a3b8' }}>{entryMode === 'visitor' ? 'Met' : 'Driver'}:</span>
                                                <strong style={{ color: '#334155' }}>{metPerson}</strong>
                                            </div>
                                            {purpose && (
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', background: '#f8fafc', borderRadius: '6px', padding: '4px 8px', borderLeft: '2px solid #e2e8f0', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={purpose}>
                                                    <i className="fa fa-quote-left me-1" style={{ fontSize: '0.6rem', color: '#cbd5e1' }}></i>{purpose}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                            <i className="fa fa-calendar-times" style={{ fontSize: '1.5rem', color: '#cbd5e1' }}></i>
                        </div>
                        <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem', marginBottom: '4px' }}>No History Found</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>This is their first visit</div>
                    </div>
                )}
            </div>
        </div>
    );
'''

# Replace lines 1980-2042 (0-indexed: 1979-2041)
new_lines = lines[:1979] + [new_right_column + '\n'] + lines[2042:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done. File now has {len(new_lines)} lines.")
