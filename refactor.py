import sys
import re

file_path = 'frontend/src/jsx/components/CommonMaster/SalesmanVisitings.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Select import
content = content.replace("import { Card, Button, Form, Modal } from 'react-bootstrap';", "import { Card, Button, Form, Modal } from 'react-bootstrap';\nimport Select from 'react-select';")

# 2. Update formData
content = content.replace("delivery_location: '',", "delivery_locations: [],")
content = content.replace("delivery_location: ''", "delivery_locations: []")

# 3. Update handleInputChange
content = content.replace("return { ...prev, [name]: value, delivery_location: '' };", "return { ...prev, [name]: value, delivery_locations: [] };")

# 4. Remove location modal state
loc_modal_state = '''    // Delivery Location Modal State
    const [showLocModal, setShowLocModal] = useState(false);
    const [locFormData, setLocFormData] = useState({ id: null, location_name: '' });'''
content = content.replace(loc_modal_state, '')

# 5. Remove location functions
functions_pattern = re.compile(r'    const handleAddLoc = \(\) => \{.*?\n    const handleEdit =', re.DOTALL)
content = re.sub(functions_pattern, '    const handleEdit =', content)

# 6. Update handleEdit
handle_edit_old = '''    const handleEdit = (visiting) => {
        setFormData({
            salesman_mapping: visiting.salesman_mapping || '',
            delivery_location: visiting.delivery_location || '','''
handle_edit_new = '''    const handleEdit = (visiting) => {
        setFormData({
            salesman_mapping: visiting.salesman_mapping || '',
            delivery_locations: visiting.delivery_location ? [{ value: visiting.delivery_location, label: visiting.delivery_location_name }] : [],'''
content = content.replace(handle_edit_old, handle_edit_new)

# 7. Update handleSubmit
handle_submit_old = '''    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await AreaService.updateSalesmanVisiting(selectedId, formData);
                swal("Success", "Record updated successfully", "success");
            } else {
                await AreaService.createSalesmanVisiting(formData);
                swal("Success", "Record added successfully", "success");
            }'''
handle_submit_new = '''    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!formData.delivery_locations || formData.delivery_locations.length === 0) {
                swal("Error", "Please select at least one delivery location.", "error");
                return;
            }
            if (isEditing) {
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
            } else {
                for (const loc of formData.delivery_locations) {
                    await AreaService.createSalesmanVisiting({
                        ...formData,
                        delivery_location: loc.value
                    });
                }
                swal("Success", "Record(s) added successfully", "success");
            }'''
content = content.replace(handle_submit_old, handle_submit_new)

# 8. Add customSelectStyles
styles = '''    const customSelectStyles = {
        control: (base, state) => ({
            ...base,
            border: state.isFocused ? '1px solid #2ece8a' : '1px solid #cbd5e1',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#334155',
            backgroundColor: '#fff',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(46, 206, 138, 0.15)' : 'none',
            minHeight: '43px',
            '&:hover': {
                border: state.isFocused ? '1px solid #2ece8a' : '1px solid #cbd5e1'
            }
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '2px 8px',
        }),
        dropdownIndicator: (base) => ({
            ...base,
            padding: '4px 8px',
            color: '#6e7e8f'
        }),
        clearIndicator: (base) => ({
            ...base,
            padding: '4px'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: '#f1f5f9',
            borderRadius: '6px'
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: '#334155',
            fontSize: '12px',
            padding: '3px 6px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            color: '#64748b',
            ':hover': {
                backgroundColor: '#cbd5e1',
                color: '#334155'
            }
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            marginTop: '4px',
            zIndex: 9999
        }),
        option: (base, state) => ({
            ...base,
            fontSize: '13px',
            padding: '10px 14px',
            backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#f8fafc' : 'white',
            color: state.isSelected ? 'white' : '#334155',
            cursor: 'pointer',
            '&:active': {
                backgroundColor: '#26b277'
            }
        })
    };

    return ('''
content = content.replace("    return (", styles)

# 9. Update JSX form
old_form_part = '''                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Delivery Location <span className="text-danger">*</span></label>
                                <Form.Select
                                    name="delivery_location"
                                    value={formData.delivery_location}
                                    onChange={handleInputChange}
                                    required
                                    disabled={!formData.salesman_mapping || locationsLoading || deliveryLocations.length === 0}
                                    className="form-control-custom"
                                >
                                    <option value="">
                                        {!formData.salesman_mapping 
                                            ? 'Select Salesman First' 
                                            : locationsLoading 
                                                ? 'Loading locations...' 
                                                : deliveryLocations.length === 0 
                                                    ? 'No delivery locations available' 
                                                    : 'Select Location '}
                                    </option>
                                    {deliveryLocations.map(loc => (
                                        <option key={loc.id} value={loc.id}>
                                            {loc.location_number}. {loc.location_name}
                                        </option>
                                    ))}
                                </Form.Select>
                                {formData.salesman_mapping && !locationsLoading && deliveryLocations.length === 0 && (
                                    <small className="text-danger d-block mt-1">
                                        No delivery locations have been created for {mappedArea}. Please add delivery locations in Area Creation.
                                    </small>
                                )}
                            </div>'''

new_form_part = '''                            <div className="col-md-6 mb-3">
                                <label className="form-label-custom">Delivery Location <span className="text-danger">*</span></label>
                                <Select
                                    isMulti
                                    classNamePrefix="react-select"
                                    value={formData.delivery_locations}
                                    onChange={(selected) => setFormData({ ...formData, delivery_locations: selected || [] })}
                                    options={deliveryLocations.map(loc => ({ value: loc.id, label: loc.location_name }))}
                                    placeholder={!formData.salesman_mapping ? 'Select Salesman First' : locationsLoading ? 'Loading locations...' : 'Select Location(s)...'}
                                    styles={customSelectStyles}
                                    isDisabled={!formData.salesman_mapping || locationsLoading || deliveryLocations.length === 0}
                                />
                                {formData.salesman_mapping && !locationsLoading && deliveryLocations.length === 0 && (
                                    <small className="text-danger d-block mt-1">
                                        No delivery locations have been created for {mappedArea}. Please add delivery locations in Area Creation.
                                    </small>
                                )}
                            </div>'''
content = content.replace(old_form_part, new_form_part)

# 10. Remove Area Delivery Locations table
table_pattern = re.compile(r'                            \{/\* Area Delivery Locations Management List \*/\}.*?\{formData\.salesman_mapping && \(\n                                <div className="col-md-12 mb-3 mt-3">.*?</div>\n                            \)\}', re.DOTALL)
content = re.sub(table_pattern, '', content)

# 11. Remove loc modal
modal_pattern = re.compile(r'            <Modal show=\{showLocModal\}.*?</Modal>', re.DOTALL)
content = re.sub(modal_pattern, '', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
