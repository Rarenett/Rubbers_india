import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# Add hooks if not present
if 'const navigate = useNavigate();' not in content:
    idx = content.find('const TeleCallingDashboard = () => {')
    insert_str = '''
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    const TAB_ITEMS = [
        { id: 'dashboard',    url: '/crm/dashboard',    label: 'Management Central', icon: 'fa fa-th-large' },
        { id: 'leads',        url: '/crm/leads',        label: 'Lead Ecosystem',     icon: 'fa fa-users' },
        { id: 'telecalling',  url: '/crm_new/telecalling',label: 'Telecalling Dept', icon: 'fa fa-phone' },
        { id: 'interactions', url: '/crm/interactions', label: 'My Interactions',    icon: 'fa fa-headphones' },
        { id: 'performance',  url: '/crm/performance',  label: 'Performance',        icon: 'fa fa-line-chart' },
    ];
'''
    content = content[:idx+len('const TeleCallingDashboard = () => {')] + insert_str + content[idx+len('const TeleCallingDashboard = () => {'):]

# Find the return ( ... ) block
return_idx = content.find('return (')

new_return = '''return (
        <>
            <PageTitle activeMenu="Telecalling" motherMenu="CRM" />
            <div className="container-fluid">
                <Card className="mb-4 shadow-sm" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
                    <Card.Header className="d-flex flex-wrap justify-content-between align-items-center bg-white border-bottom-0 pb-0 pt-4 px-4">
                        <Card.Title className="mb-2" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                            The <span className="text-primary">CRM</span> Hub
                        </Card.Title>
                        <div className="d-flex align-items-center gap-4 mb-2">
                            <span className="text-muted fw-bold d-none d-md-block" style={{ fontSize: '0.95rem' }}>
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
                            </span>
                            <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '2rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>
                                <span className="text-primary fw-bold" style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>SYSTEM ACTIVE</span>
                            </div>
                        </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                        <ul className="nav nav-tabs border-bottom px-4 pt-2" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                            {TAB_ITEMS.map(t => (
                                <li className="nav-item" key={t.id}>
                                    <button 
                                        className={`nav-link d-flex align-items-center gap-2 px-3 py-3 ${t.id === 'telecalling' ? 'active text-primary border-primary' : 'text-muted border-transparent'}`}
                                        style={{ 
                                            fontWeight: 700, 
                                            background: 'transparent',
                                            borderTop: 'none',
                                            borderLeft: 'none',
                                            borderRight: 'none',
                                            borderBottomWidth: '3px',
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

                <Card className="mb-5 pb-4">
                    <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
'''

old_header_start = content.find('<div className="tele-dashboard w-100"')
old_header_end = content.find('<Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">') + len('<Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">')

content = content[:return_idx] + new_return + content[old_header_end:]

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
