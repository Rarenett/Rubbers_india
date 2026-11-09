import sys
import re

file_path = 'frontend/src/jsx/components/CommonMaster/SalesmanVisitings.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add selectedGroup state and remove selectedId
content = content.replace('const [selectedId, setSelectedId] = useState(null);', 'const [selectedGroup, setSelectedGroup] = useState(null);')

# 2. Update resetForm
reset_old = '''    const resetForm = () => {
        setFormData({ salesman_mapping: '', delivery_locations: [], visiting_date: '', status: 'Planned', remarks: '' });
        setMappedArea('');
        setMappedDepartment('');
        setMappedReportingPerson('');
        setIsEditing(false);
        setSelectedId(null);
    };'''
reset_new = '''    const resetForm = () => {
        setFormData({ salesman_mapping: '', delivery_locations: [], visiting_date: '', status: 'Planned', remarks: '' });
        setMappedArea('');
        setMappedDepartment('');
        setMappedReportingPerson('');
        setIsEditing(false);
        setSelectedGroup(null);
    };'''
content = content.replace(reset_old, reset_new)

# 3. Update handleEdit
edit_old = '''    const handleEdit = (visiting) => {
        setFormData({
            salesman_mapping: visiting.salesman_mapping || '',
            delivery_locations: visiting.delivery_location ? [{ value: visiting.delivery_location, label: visiting.delivery_location_name }] : [],
            visiting_date: visiting.visiting_date || '',
            status: visiting.status || 'Planned',
            remarks: visiting.remarks || ''
        });
        setIsEditing(true);
        setSelectedId(visiting.id);
        setShowModal(true);
    };'''
edit_new = '''    const handleEdit = (group) => {
        setFormData({
            salesman_mapping: group.salesman_mapping || '',
            delivery_locations: group.locations.map(loc => ({ value: loc.id, label: loc.location_name })),
            visiting_date: group.visiting_date || '',
            status: group.status || 'Planned',
            remarks: group.remarks || ''
        });
        setIsEditing(true);
        setSelectedGroup(group);
        setShowModal(true);
    };'''
content = content.replace(edit_old, edit_new)

# 4. Update handleDelete
delete_old = '''    const handleDelete = (id) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover this record!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    await AreaService.deleteSalesmanVisiting(id);
                    swal("Success", "Record deleted successfully", "success");
                    fetchVisitings();
                } catch (error) {
                    console.error('Error deleting record:', error);
                    swal("Error", "Failed to delete record.", "error");
                }
            }
        });
    };'''
delete_new = '''    const handleDelete = (group) => {
        swal({
            title: "Are you sure?",
            text: "Once deleted, you will not be able to recover these records!",
            icon: "warning",
            buttons: true,
            dangerMode: true,
        }).then(async (willDelete) => {
            if (willDelete) {
                try {
                    for (const item of group.original_items) {
                        await AreaService.deleteSalesmanVisiting(item.id);
                    }
                    swal("Success", "Records deleted successfully", "success");
                    fetchVisitings();
                } catch (error) {
                    console.error('Error deleting record:', error);
                    swal("Error", "Failed to delete records.", "error");
                }
            }
        });
    };'''
content = content.replace(delete_old, delete_new)

# 5. Update handleSubmit
submit_old = '''            if (isEditing) {
                await AreaService.updateSalesmanVisiting(selectedId, {
                    ...formData,
                    delivery_location: formData.delivery_locations[0].value
                });
                for (let i = 1; i < formData.delivery_locations.length; i++) {
                    await AreaService.createSalesmanVisiting({
                        ...formData,
                        delivery_location: formData.delivery_locations[i].value
                    });
                }
                swal("Success", "Record updated successfully", "success");
            }'''
submit_new = '''            if (isEditing) {
                const existingItems = selectedGroup.original_items;
                const newLocationIds = formData.delivery_locations.map(s => s.value);
                
                const toDelete = existingItems.filter(e => !newLocationIds.includes(e.delivery_location));
                const existingLocationIds = existingItems.map(e => e.delivery_location);
                const toAdd = newLocationIds.filter(id => !existingLocationIds.includes(id));
                const toUpdate = existingItems.filter(e => newLocationIds.includes(e.delivery_location));
                
                for (const item of toDelete) {
                    await AreaService.deleteSalesmanVisiting(item.id);
                }
                
                for (const item of toUpdate) {
                    await AreaService.updateSalesmanVisiting(item.id, {
                        ...formData,
                        delivery_location: item.delivery_location
                    });
                }
                
                for (const locId of toAdd) {
                    await AreaService.createSalesmanVisiting({
                        ...formData,
                        delivery_location: locId
                    });
                }
                swal("Success", "Record updated successfully", "success");
            }'''
content = content.replace(submit_old, submit_new)

# 6. Group visitings and update filtering
filter_old = '''    const filteredVisitings = visitings.filter(visiting => {
        const salesmanName = visiting.salesman_name?.toLowerCase() || '';
        const areaName = visiting.area_name?.toLowerCase() || '';
        const locName = visiting.delivery_location_name?.toLowerCase() || '';
        const statusStr = visiting.status?.toLowerCase() || '';
        const term = searchTerm.toLowerCase();
        
        return salesmanName.includes(term) || areaName.includes(term) || locName.includes(term) || statusStr.includes(term);
    });'''
filter_new = '''    const groupedVisitings = Object.values(visitings.reduce((acc, item) => {
        const key = `${item.salesman_mapping}_${item.visiting_date}`;
        if (!acc[key]) {
            acc[key] = {
                group_key: key,
                salesman_mapping: item.salesman_mapping,
                salesman_name: item.salesman_name,
                area_name: item.area_name,
                visiting_date: item.visiting_date,
                status: item.status,
                remarks: item.remarks,
                locations: [],
                original_items: []
            };
        }
        acc[key].locations.push({
            id: item.delivery_location,
            location_name: item.delivery_location_name,
            visiting_id: item.id
        });
        acc[key].original_items.push(item);
        return acc;
    }, {}));

    const filteredVisitings = groupedVisitings.filter(group => {
        const salesmanName = group.salesman_name?.toLowerCase() || '';
        const areaName = group.area_name?.toLowerCase() || '';
        const locNames = group.locations.map(l => l.location_name?.toLowerCase() || '').join(' ');
        const statusStr = group.status?.toLowerCase() || '';
        const term = searchTerm.toLowerCase();
        
        return salesmanName.includes(term) || areaName.includes(term) || locNames.includes(term) || statusStr.includes(term);
    });'''
content = content.replace(filter_old, filter_new)

# 7. Update table rendering
table_old = '''                                    filteredVisitings.map((item) => (
                                        <tr key={item.id}>
                                            <td className="fw-bold">{item.salesman_name || 'N/A'}</td>
                                            <td className="fw-bold">{item.area_name || 'N/A'}</td>
                                            <td className="text-muted">{item.delivery_location_name || 'N/A'}</td>
                                            <td className="text-muted">{item.visiting_date}</td>
                                            <td>
                                                <span className={`badge ${item.status === 'Completed' ? 'badge-success' : item.status === 'Cancelled' ? 'badge-danger' : 'badge-primary'}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="text-muted">{item.remarks || '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <EditButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleEdit(item)}
                                                        className="sharp btn-xs"
                                                    />
                                                    <DeleteButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleDelete(item.id)}
                                                        className="sharp btn-xs"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))'''
table_new = '''                                    filteredVisitings.map((group) => (
                                        <tr key={group.group_key}>
                                            <td className="fw-bold">{group.salesman_name || 'N/A'}</td>
                                            <td className="fw-bold">{group.area_name || 'N/A'}</td>
                                            <td className="text-muted">{group.locations.map(l => l.location_name).join(', ') || 'N/A'}</td>
                                            <td className="text-muted">{group.visiting_date}</td>
                                            <td>
                                                <span className={`badge ${group.status === 'Completed' ? 'badge-success' : group.status === 'Cancelled' ? 'badge-danger' : 'badge-primary'}`}>
                                                    {group.status}
                                                </span>
                                            </td>
                                            <td className="text-muted">{group.remarks || '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <EditButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleEdit(group)}
                                                        className="sharp btn-xs"
                                                    />
                                                    <DeleteButton
                                                        module="salesman_visitings"
                                                        onClick={() => handleDelete(group)}
                                                        className="sharp btn-xs"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))'''
content = content.replace(table_old, table_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
