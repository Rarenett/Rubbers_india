import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Update Promise.allSettled and remove lead fetch
old_promises = """                const [projRes, leadRes, catRes, userRes, teamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/crm_new/telecalling/'),
                    axiosInstance.get('/api/crm/leads/'),
                    axiosInstance.get('/api/crm/categories/'),
                    axiosInstance.get('/api/hr/users/?department=Telecalling'),
                    axiosInstance.get('/api/teams/teams/')
                ]);"""

new_promises = """                const [projRes, catRes, userRes, teamRes] = await Promise.allSettled([
                    axiosInstance.get('/api/crm_new/telecalling/'),
                    axiosInstance.get('/api/crm/categories/'),
                    axiosInstance.get('/api/hr/users/?department=Telecalling'),
                    axiosInstance.get('/api/teams/teams/')
                ]);"""
content = content.replace(old_promises, new_promises)

# 2. Remove initial lead processing
old_lead_process = """                if (leadRes.status === 'fulfilled' && leadRes.value.status === 200) {
                    setLeads(leadRes.value.data);
                }"""
content = content.replace(old_lead_process, "")

# 3. Do not set default category
old_cat_process = """                if (catRes.status === 'fulfilled' && catRes.value.status === 200) {
                    setCategories(catRes.value.data);
                    if (catRes.value.data.length > 0) setActiveCategory(catRes.value.data[0].id);
                }"""
new_cat_process = """                if (catRes.status === 'fulfilled' && catRes.value.status === 200) {
                    setCategories(catRes.value.data);
                }"""
content = content.replace(old_cat_process, new_cat_process)

# 4. Add the new useEffect for activeCategory
new_effect = """
    useEffect(() => {
        if (!activeCategory) {
            setLeads([]);
            return;
        }
        const fetchLeadsForCategory = async () => {
            try {
                const res = await axiosInstance.get(`/api/crm/leads/?category=${activeCategory}`);
                setLeads(res.data);
            } catch (error) {
                console.error("Error fetching leads for category", error);
            }
        };
        fetchLeadsForCategory();
    }, [activeCategory]);
"""
# Insert after the first useEffect ends
idx = content.find("    const [activeView, setActiveView] = useState('projects');")
content = content[:idx] + new_effect + content[idx:]


# 5. Wrap table with activeCategory check
table_start = """                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>"""
table_end = """                                            </table>
                                        </div>"""

new_table_start = """                                        {activeCategory ? (
                                        <div className="table-responsive">
                                            <table className="table table-responsive-md">
                                                <thead>"""
new_table_end = """                                            </table>
                                        </div>
                                        ) : (
                                            <div className="text-center py-5 text-muted">
                                                <i className="fa fa-folder-open mb-3" style={{ fontSize: '3rem', opacity: 0.5 }}></i>
                                                <h5>Select Lead Repository</h5>
                                                <p>Please select a repository from the dropdown above to view its leads.</p>
                                            </div>
                                        )}"""

content = content.replace(table_start, new_table_start)

# Finding the exact table end requires care.
# Wait, it's safer to use regex or string indexing.
end_idx = content.find(table_end, content.find(new_table_start))
if end_idx != -1:
    content = content[:end_idx] + new_table_end + content[end_idx+len(table_end):]


with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
