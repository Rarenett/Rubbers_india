import re
with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

target = """return (
        <>
                        <div className="tele-dashboard w-100" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
                        <Card className="mb-5 pb-4">"""

replacement = """return (
        <>
            <PageTitle activeMenu="Telecalling" motherMenu="CRM" />
            <div className="container-fluid tele-dashboard" style={{ overflowX: 'hidden' }}>
                <Card className="mb-4 shadow-sm" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
                    <Card.Header className="d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom-0 pb-0 pt-4 px-4">
                        <Card.Title className="mb-2" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                            The <span className="text-primary">CRM</span> Hub
                        </Card.Title>
                        <div className="d-flex align-items-center gap-4 mb-2">
                            <span className="text-muted fw-bold d-none d-md-block" style={{ fontSize: '0.95rem' }}>
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
                            </span>
                            <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: 'rgba(var(--primary-rgb, 0, 209, 255), 0.1)', borderRadius: '2rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary, #00d1ff)', boxShadow: '0 0 10px var(--primary, #00d1ff)' }}></div>
                                <span className="text-primary fw-bold" style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>SYSTEM ACTIVE</span>
                            </div>
                        </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                        <ul className="nav nav-tabs border-bottom px-4 pt-2" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                            {TAB_ITEMS.map(t => (
                                <li className="nav-item" key={t.id}>
                                    <button 
                                        className={`nav-link d-flex align-items-center gap-2 px-3 py-3 ${t.id === 'telecalling' ? 'active text-primary' : 'text-muted'}`}
                                        style={{ 
                                            fontWeight: 700, 
                                            background: 'transparent',
                                            borderTop: 'none',
                                            borderLeft: 'none',
                                            borderRight: 'none',
                                            borderBottomStyle: 'solid',
                                            borderBottomWidth: '3px',
                                            borderBottomColor: t.id === 'telecalling' ? 'var(--primary, #00d1ff)' : 'transparent',
                                            marginBottom: '-1px'
                                        }}
                                        onClick={() => navigate(t.url)}
                                    >
                                        <i className={t.icon} style={{ fontSize: '1.1rem' }}></i> {t.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card.Body>
                </Card>

                <Card className="mb-5 pb-4">"""

if target in content:
    content = content.replace(target, replacement)
    with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced")
else:
    print("Target not found")
