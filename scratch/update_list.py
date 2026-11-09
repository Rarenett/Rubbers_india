import os

file_path = r"C:\Users\ADMIN\Documents\GitHub\glenda_vite\frontend\src\jsx\components\AccessPoint\GateEntryList.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update search filter
search_filter_old = """
            return (
                entry.driver?.toLowerCase().includes(search) ||
                entry.vehicle_number?.toLowerCase().includes(search) ||
                entry.tag_number?.includes(search) ||
                entry.department_name?.toLowerCase().includes(search)
            );
"""
search_filter_new = """
            return (
                entry.driver?.toLowerCase().includes(search) ||
                entry.vehicles_data?.some(v => v.vehicle_number?.toLowerCase().includes(search)) ||
                entry.tag_number?.includes(search) ||
                entry.department_name?.toLowerCase().includes(search)
            );
"""
content = content.replace(search_filter_old.strip(), search_filter_new.strip())

# 2. Displaying vehicle number
display_old = """
                                                                <div>
                                                                    <strong>{entry.vehicle_number}</strong>
                                                                    <div className="text-muted small">{entry.driver || 'No Driver'}</div>
                                                                </div>
"""
display_new = """
                                                                <div>
                                                                    <strong>
                                                                        {entry.vehicles_data && entry.vehicles_data.length > 0 
                                                                            ? (entry.vehicles_data.length === 1 
                                                                                ? entry.vehicles_data[0].vehicle_number 
                                                                                : `${entry.vehicles_data[0].vehicle_number} (+${entry.vehicles_data.length - 1} more)`) 
                                                                            : 'Unknown Vehicle'}
                                                                    </strong>
                                                                    <div className="text-muted small">{entry.driver || 'No Driver'}</div>
                                                                </div>
"""
content = content.replace(display_old.strip(), display_new.strip())

# 3. Checkout button
checkout_old = """
                                                                    onClick={() => handleCheckout(entry.id, activeTab === 'visitors' ? entry.visitor_name : entry.vehicle_number)}
"""
checkout_new = """
                                                                    onClick={() => handleCheckout(entry.id, activeTab === 'visitors' ? entry.visitor_name : (entry.vehicles_data?.[0]?.vehicle_number || 'Unknown Vehicle'))}
"""
content = content.replace(checkout_old.strip(), checkout_new.strip())

# 4. Delete button
delete_old = """
                                                                    onClick={() => handleDelete(entry.id, activeTab === 'visitors' ? entry.visitor_name : entry.vehicle_number)}
"""
delete_new = """
                                                                    onClick={() => handleDelete(entry.id, activeTab === 'visitors' ? entry.visitor_name : (entry.vehicles_data?.[0]?.vehicle_number || 'Unknown Vehicle'))}
"""
content = content.replace(delete_old.strip(), delete_new.strip())


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated GateEntryList.jsx successfully")
