import re

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Teams button
old_button = """                                    <button 
                                        className={`btn btn-sm ${activeView === 'teams' ? 'btn-primary' : 'btn-outline-primary'}`}
                                        onClick={() => setActiveView('teams')}
                                    >
                                        <i className="fa fa-users-cog me-1"></i> Teams
                                    </button>"""
content = content.replace(old_button, "")

with open(r'frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed Teams button")
