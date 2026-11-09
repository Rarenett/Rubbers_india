import sys

content = open('frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8').read()
content = content.replace('/api/crm/projects/', '/api/crm_new/telecalling/')
content = content.replace('/api/hr/users/', '/api/hr/users/?department=Telecalling')

import_str = "import Select from 'react-select';\n"
if import_str not in content:
    content = content.replace("import axiosInstance from '../../../services/AxiosInstance';", "import axiosInstance from '../../../services/AxiosInstance';\n" + import_str)

old_cat_pill = """                            <div className="cat-pill-container">
                                {categories.map(cat => (
                                    <div
                                        key={cat.id}
                                        className={`cat-pill ${activeCategory === cat.id ? 'active' : ''}`}
                                        onClick={() => { setActiveCategory(cat.id); setSelectedLeads([]); }}
                                    >
                                        {cat.name}
                                    </div>
                                ))}
                            </div>"""

new_select = """                            <div className="mb-4" style={{ maxWidth: '400px' }}>
                                <Select
                                    options={categories.map(cat => ({
                                        value: cat.id,
                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                    }))}
                                    value={categories.filter(c => c.id === activeCategory).map(cat => ({
                                        value: cat.id,
                                        label: `${cat.name} — ${cat.lead_count || 0} Leads`
                                    }))[0] || null}
                                    onChange={(selectedOption) => {
                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                        setSelectedLeads([]);
                                    }}
                                    placeholder="Select Lead Repository"
                                    isSearchable={true}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            padding: '4px 8px',
                                            borderRadius: '12px',
                                            borderColor: '#cbd5e1',
                                            boxShadow: 'none',
                                            '&:hover': {
                                                borderColor: 'var(--tc-primary)'
                                            }
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isSelected ? 'var(--tc-primary)' : state.isFocused ? 'var(--tc-accent)' : 'white',
                                            color: state.isSelected ? 'white' : state.isFocused ? 'white' : 'var(--tc-text-main)',
                                            fontWeight: '600'
                                        })
                                    }}
                                />
                            </div>"""

content = content.replace(old_cat_pill, new_select)
content = content.replace(old_cat_pill.replace('\n', '\r\n'), new_select)

with open('frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
