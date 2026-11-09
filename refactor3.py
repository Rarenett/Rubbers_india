import re

file_path = 'frontend/src/jsx/components/CommonMaster/SalesmanVisitings.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update table header
header_old = '''                            <thead>
                                <tr>
                                    <th><strong>SALESMAN</strong></th>
                                    <th><strong>AREA</strong></th>
                                    <th><strong>DELIVERY LOCATION</strong></th>
                                    <th><strong>DATE</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th><strong>REMARKS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>'''

header_new = '''                            <thead>
                                <tr>
                                    <th><strong>SL NO</strong></th>
                                    <th><strong>SALESMAN</strong></th>
                                    <th><strong>AREA</strong></th>
                                    <th><strong>DATE</strong></th>
                                    <th><strong>STATUS</strong></th>
                                    <th><strong>REMARKS</strong></th>
                                    <th className="text-end"><strong>ACTIONS</strong></th>
                                </tr>
                            </thead>'''

content = content.replace(header_old, header_new)

# 2. Update table body
body_old = '''                                    filteredVisitings.map((group) => (
                                        <tr key={group.group_key}>
                                            <td className="fw-bold">{group.salesman_name || 'N/A'}</td>
                                            <td className="fw-bold">{group.area_name || 'N/A'}</td>
                                            <td className="text-muted">{group.locations.map(l => l.location_name).join(', ') || 'N/A'}</td>
                                            <td className="text-muted">{group.visiting_date}</td>'''

body_new = '''                                    filteredVisitings.map((group, index) => (
                                        <tr key={group.group_key}>
                                            <td className="fw-bold text-primary">{index + 1}</td>
                                            <td className="fw-bold">{group.salesman_name || 'N/A'}</td>
                                            <td className="fw-bold">{group.area_name || 'N/A'}</td>
                                            <td className="text-muted">{group.visiting_date}</td>'''

content = content.replace(body_old, body_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
