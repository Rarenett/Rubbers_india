import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Remove setSelectedLeads([]) from repository dropdown
old_select = """                                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                                        setSelectedLeads([]);
                                                    }}"""
new_select = """                                                        setActiveCategory(selectedOption ? selectedOption.value : null);
                                                    }}"""
content = content.replace(old_select, new_select)

# 2. Fix Select All checkbox
old_select_all = """                                                                onChange={(e) => {
                                                                    if(e.target.checked) setSelectedLeads(leads.map(l => l.id));
                                                                    else setSelectedLeads([]);
                                                                }}
                                                                checked={leads.length > 0 && selectedLeads.length === leads.length}"""
new_select_all = """                                                                onChange={(e) => {
                                                                    if(e.target.checked) {
                                                                        const newSelections = leads.filter(l => !selectedLeads.some(sl => sl.id === l.id));
                                                                        setSelectedLeads([...selectedLeads, ...newSelections]);
                                                                    } else {
                                                                        setSelectedLeads(selectedLeads.filter(sl => !leads.some(l => l.id === sl.id)));
                                                                    }
                                                                }}
                                                                checked={leads.length > 0 && leads.every(l => selectedLeads.some(sl => sl.id === l.id))}"""
content = content.replace(old_select_all, new_select_all)


# 3. Fix individual checkbox
old_indiv = """                                                                    checked={selectedLeads.includes(lead.id)}
                                                                    onChange={() => {
                                                                        if (selectedLeads.includes(lead.id)) {
                                                                            setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                                                                        } else {
                                                                            setSelectedLeads([...selectedLeads, lead.id]);
                                                                        }
                                                                    }}"""
new_indiv = """                                                                    checked={selectedLeads.some(sl => sl.id === lead.id)}
                                                                    onChange={() => {
                                                                        if (selectedLeads.some(sl => sl.id === lead.id)) {
                                                                            setSelectedLeads(selectedLeads.filter(sl => sl.id !== lead.id));
                                                                        } else {
                                                                            setSelectedLeads([...selectedLeads, lead]);
                                                                        }
                                                                    }}"""
content = content.replace(old_indiv, new_indiv)


# 4. Fix project creation fallback (if it was using leadId)
# Since the user only asked about Make Team, I will leave Make Project alone if it breaks, but I should fix it.
old_assign = """const assignments = selectedLeads.map((leadId) => {"""
new_assign = """const assignments = selectedLeads.map((leadObj) => {
                                const leadId = typeof leadObj === 'object' ? leadObj.id : leadObj;"""
content = content.replace(old_assign, new_assign)


# 5. Fix modal rendering
old_modal = """{selectedLeads.length > 0 ? leads.filter(l => selectedLeads.includes(l.id)).map(lead => ("""
new_modal = """{selectedLeads.length > 0 ? selectedLeads.map(lead => ("""
content = content.replace(old_modal, new_modal)


with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated to preserve selected leads")
