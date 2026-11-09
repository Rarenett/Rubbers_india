import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

if 'currentPage' not in content:
    content = content.replace('const [showModal, setShowModal] = useState(false);', '''const [showModal, setShowModal] = useState(false);

const [currentPageLeads, setCurrentPageLeads] = useState(1);
const [currentPageProjects, setCurrentPageProjects] = useState(1);
const [searchTerm, setSearchTerm] = useState('');
const itemsPerPage = 10;

const filteredLeads = leads.filter(l => l.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.first_name?.toLowerCase().includes(searchTerm.toLowerCase()));
const currentLeads = filteredLeads.slice((currentPageLeads - 1) * itemsPerPage, currentPageLeads * itemsPerPage);
const totalPagesLeads = Math.ceil(filteredLeads.length / itemsPerPage);

const filteredProjects = projects.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));
const currentProjects = filteredProjects.slice((currentPageProjects - 1) * itemsPerPage, currentPageProjects * itemsPerPage);
const totalPagesProjects = Math.ceil(filteredProjects.length / itemsPerPage);
''')

    # Replace Search Input
    content = content.replace('''<Form.Control
                                            type="text"
                                            placeholder="Search..."
                                            style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />''', '''<Form.Control
                                            type="text"
                                            placeholder="Search..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPageLeads(1);
                                                setCurrentPageProjects(1);
                                            }}
                                            style={{ height: '34px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />''')

    # Replace leads.map with currentLeads.map
    content = content.replace('{leads.length > 0 ? leads.map(lead => (', '{currentLeads.length > 0 ? currentLeads.map(lead => (')
    
    # Replace projects.map with currentProjects.map
    content = content.replace('{projects.length > 0 ? projects.map((proj, idx) => (', '{currentProjects.length > 0 ? currentProjects.map((proj, idx) => (')

    # Add pagination UI for leads
    leads_table_end = '''                                            </table>
                                        </div>
                                    </>'''
    leads_pagination = '''                                            </table>
                                        </div>
                                        {filteredLeads.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {(currentPageLeads - 1) * itemsPerPage + 1} to {Math.min(currentPageLeads * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} entries
                                                </div>
                                                {totalPagesLeads > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${currentPageLeads === 1 ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPageLeads(prev => Math.max(prev - 1, 1))} disabled={currentPageLeads === 1} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-left" />
                                                                </button>
                                                            </li>
                                                            {Array.from({ length: totalPagesLeads }, (_, index) => {
                                                                const pageNumber = index + 1;
                                                                if (pageNumber === 1 || pageNumber === totalPagesLeads || (pageNumber >= currentPageLeads - 1 && pageNumber <= currentPageLeads + 1)) {
                                                                    return (
                                                                        <li key={pageNumber} className={`page-item ${currentPageLeads === pageNumber ? 'active' : ''}`}>
                                                                            <button type="button" className="page-link" onClick={() => setCurrentPageLeads(pageNumber)} style={{ border: 'none' }}>
                                                                                {pageNumber}
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                } else if (pageNumber === currentPageLeads - 2 || pageNumber === currentPageLeads + 2) {
                                                                    return <li key={pageNumber} className="page-item disabled"><span className="page-link" style={{ border: 'none' }}>...</span></li>;
                                                                }
                                                                return null;
                                                            })}
                                                            <li className={`page-item page-indicator ${currentPageLeads === totalPagesLeads ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPageLeads(prev => Math.min(prev + 1, totalPagesLeads))} disabled={currentPageLeads === totalPagesLeads} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                    </>'''
    content = content.replace(leads_table_end, leads_pagination)

    # Add pagination UI for projects
    projects_table_end = '''                                        </table>
                                    </div>
                                )}'''
    projects_pagination = '''                                        </table>
                                    </div>
                                    {filteredProjects.length > 0 && (
                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                                    Showing {(currentPageProjects - 1) * itemsPerPage + 1} to {Math.min(currentPageProjects * itemsPerPage, filteredProjects.length)} of {filteredProjects.length} entries
                                                </div>
                                                {totalPagesProjects > 1 && (
                                                    <nav>
                                                        <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                                                            <li className={`page-item page-indicator ${currentPageProjects === 1 ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPageProjects(prev => Math.max(prev - 1, 1))} disabled={currentPageProjects === 1} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-left" />
                                                                </button>
                                                            </li>
                                                            {Array.from({ length: totalPagesProjects }, (_, index) => {
                                                                const pageNumber = index + 1;
                                                                if (pageNumber === 1 || pageNumber === totalPagesProjects || (pageNumber >= currentPageProjects - 1 && pageNumber <= currentPageProjects + 1)) {
                                                                    return (
                                                                        <li key={pageNumber} className={`page-item ${currentPageProjects === pageNumber ? 'active' : ''}`}>
                                                                            <button type="button" className="page-link" onClick={() => setCurrentPageProjects(pageNumber)} style={{ border: 'none' }}>
                                                                                {pageNumber}
                                                                            </button>
                                                                        </li>
                                                                    );
                                                                } else if (pageNumber === currentPageProjects - 2 || pageNumber === currentPageProjects + 2) {
                                                                    return <li key={pageNumber} className="page-item disabled"><span className="page-link" style={{ border: 'none' }}>...</span></li>;
                                                                }
                                                                return null;
                                                            })}
                                                            <li className={`page-item page-indicator ${currentPageProjects === totalPagesProjects ? 'disabled' : ''}`}>
                                                                <button type="button" className="page-link" onClick={() => setCurrentPageProjects(prev => Math.min(prev + 1, totalPagesProjects))} disabled={currentPageProjects === totalPagesProjects} style={{ border: 'none', background: 'none' }}>
                                                                    <i className="la la-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                )}
                                            </div>
                                        )}
                                )}'''
    content = content.replace(projects_table_end, projects_pagination)
    
    with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
