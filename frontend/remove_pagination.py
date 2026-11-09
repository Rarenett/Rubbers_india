import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove Pagination import
content = content.replace("import Pagination from '../Common/Pagination';\n", "")
content = content.replace("import Pagination from '../Common/Pagination';\r\n", "")

# 2. Remove pagination state
content = re.sub(r"    const \[teamModalCurrentPage, setTeamModalCurrentPage\] = useState\(1\);\s*", "", content)
content = re.sub(r"    const teamModalItemsPerPage = 5;\s*", "", content)

# 3. Replace the selectedLeads rendering logic
old_table_body = """                                        {selectedLeads.length > 0 ? (() => {
                                            const indexOfLast = teamModalCurrentPage * teamModalItemsPerPage;
                                            const indexOfFirst = indexOfLast - teamModalItemsPerPage;
                                            const currentLeads = selectedLeads.slice(indexOfFirst, indexOfLast);
                                            
                                            return currentLeads.map((lead, idx) => (
                                                <tr key={lead.id}>
                                                    <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                                                            {lead.company ? `${lead.company} - ` : ''}{lead.first_name} {lead.last_name}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                        <span className="badge bg-light text-secondary border">{lead.category_detail?.name || 'Unknown'}</span>
                                                    </td>
                                                </tr>
                                            ));
                                        })() : ("""

new_table_body = """                                        {selectedLeads.length > 0 ? selectedLeads.map((lead, idx) => (
                                            <tr key={lead.id}>
                                                <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                                                        {lead.company ? `${lead.company} - ` : ''}{lead.first_name} {lead.last_name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                                                    <span className="badge bg-light text-secondary border">{lead.category_detail?.name || 'Unknown'}</span>
                                                </td>
                                            </tr>
                                        )) : ("""

content = content.replace(old_table_body, new_table_body)

# 4. Remove pagination component
old_pagination = """                            {selectedLeads.length > 0 && (
                                <div className="mt-3">
                                    <Pagination
                                        currentPage={teamModalCurrentPage}
                                        setCurrentPage={setTeamModalCurrentPage}
                                        totalPages={Math.ceil(selectedLeads.length / teamModalItemsPerPage)}
                                        indexOfFirst={(teamModalCurrentPage - 1) * teamModalItemsPerPage}
                                        indexOfLast={Math.min(teamModalCurrentPage * teamModalItemsPerPage, selectedLeads.length)}
                                        totalRecords={selectedLeads.length}
                                        loading={false}
                                    />
                                </div>
                            )}"""

content = content.replace(old_pagination, "")

# 5. Fix setTeamModalCurrentPage calls
content = content.replace("setTeamModalCurrentPage(1); ", "")
content = content.replace(" setTeamModalCurrentPage(1);", "")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
