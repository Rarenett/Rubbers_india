import os

path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

import_statement = "import TaskAdminReportList from './components/TaskManagement/TaskAdminReportList.jsx';"
new_imports = import_statement + "\nimport TaskPostponedReportList from './components/TaskManagement/TaskPostponedReportList.jsx';"
content = content.replace(import_statement, new_imports)

route_statement = '{ url: "task-management/admin-report", component: <TaskAdminReportList /> },'
new_routes = route_statement + '\n    { url: "task-management/postponed-report", component: <TaskPostponedReportList /> },'
content = content.replace(route_statement, new_routes)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated index.jsx routes.')
