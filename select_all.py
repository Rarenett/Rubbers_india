import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Update the options in Select
old_select = """                                                <Select
                                                    options={categories.map(cat => ({
                                                        value: cat.id,
                                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                    }))}
                                                    value={categories.filter(c => c.id === activeCategory).map(cat => ({
                                                        value: cat.id,
                                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                    }))[0] || null}"""

new_select = """                                                <Select
                                                    options={[
                                                        { value: 'ALL', label: 'Select All (All Repositories)' },
                                                        ...categories.map(cat => ({
                                                            value: cat.id,
                                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                        }))
                                                    ]}
                                                    value={activeCategory === 'ALL' 
                                                        ? { value: 'ALL', label: 'Select All (All Repositories)' }
                                                        : categories.filter(c => c.id === activeCategory).map(cat => ({
                                                            value: cat.id,
                                                            label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                                        }))[0] || null
                                                    }"""
content = content.replace(old_select, new_select)

# 2. Update the useEffect for fetching leads
old_effect = """    useEffect(() => {
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
    }, [activeCategory]);"""

new_effect = """    useEffect(() => {
        if (!activeCategory) {
            setLeads([]);
            return;
        }
        const fetchLeadsForCategory = async () => {
            try {
                let url = activeCategory === 'ALL' ? '/api/crm/leads/' : `/api/crm/leads/?category=${activeCategory}`;
                let allLeads = [];
                let nextUrl = url;
                
                while (nextUrl) {
                    const res = await axiosInstance.get(nextUrl);
                    if (res.data && res.data.results) {
                        allLeads = [...allLeads, ...res.data.results];
                        nextUrl = res.data.next ? res.data.next.replace(/^.*\\/\\/[^\\/]+/, '') : null;
                    } else if (Array.isArray(res.data)) {
                        allLeads = [...allLeads, ...res.data];
                        nextUrl = null;
                    } else {
                        allLeads = res.data;
                        break;
                    }
                }
                
                // Ensure no duplicate leads
                const uniqueLeads = Array.from(new Map(allLeads.map(item => [item.id, item])).values());
                setLeads(uniqueLeads);
                
            } catch (error) {
                console.error("Error fetching leads for category", error);
            }
        };
        fetchLeadsForCategory();
    }, [activeCategory]);"""
content = content.replace(old_effect, new_effect)


# 3. Add repository badge if Select All is active
old_company_cell = """                                                            <td>
                                                                <strong>{lead.company_name}</strong><br/>
                                                                <small className="text-muted">{lead.industry_detail?.name || 'Unknown'}</small>
                                                            </td>"""

new_company_cell = """                                                            <td>
                                                                <strong>{lead.company_name}</strong><br/>
                                                                <small className="text-muted">{lead.industry_detail?.name || 'Unknown'}</small>
                                                                {activeCategory === 'ALL' && lead.category_detail && (
                                                                    <div className="mt-1"><span className="badge bg-primary-light text-primary py-1 px-2">{lead.category_detail.name}</span></div>
                                                                )}
                                                            </td>"""
content = content.replace(old_company_cell, new_company_cell)

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied select all fixes")
