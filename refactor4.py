import re

file_path = 'frontend/src/jsx/components/CommonMaster/AreaLocationMapping.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state
content = content.replace("const [selectedRouteStops, setSelectedRouteStops] = useState([]);", "const [selectedRouteStops, setSelectedRouteStops] = useState([]);\n    const [manualLocations, setManualLocations] = useState('');")

# 2. Update resetForm
reset_old = '''    const resetForm = () => {
        setSelectedArea('');
        setSelectedRouteStops([]);
        setEditMode(false);
        setCurrentMappingId(null);
    };'''
reset_new = '''    const resetForm = () => {
        setSelectedArea('');
        setSelectedRouteStops([]);
        setManualLocations('');
        setEditMode(false);
        setCurrentMappingId(null);
    };'''
content = content.replace(reset_old, reset_new)

# 3. Update handleSubmit
submit_old = '''    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedArea || selectedRouteStops.length === 0) {
            swal('Error', 'Area and at least one Delivery Location are required.', 'error');
            return;
        }

        try {
            if (editMode) {
                const existingLocations = mappings.filter(m => String(m.area) === String(selectedArea));
                const newLabels = selectedRouteStops.map(s => s.label);
                
                const toDelete = existingLocations.filter(e => !newLabels.includes(e.location_name));
                const existingLabels = existingLocations.map(e => e.location_name);
                const toAdd = newLabels.filter(l => !existingLabels.includes(l));
                
                for (const d of toDelete) {
                    await AreaService.deleteDeliveryLocation(d.id);
                }
                for (const a of toAdd) {
                    await AreaService.createDeliveryLocation({ area: selectedArea, location_name: a });
                }
                swal('Success!', 'Mapping updated successfully.', 'success');
            } else {
                for (const stop of selectedRouteStops) {
                    await AreaService.createDeliveryLocation({ area: selectedArea, location_name: stop.label });
                }
                swal('Success!', 'Mapping(s) created successfully.', 'success');
            }'''
submit_new = '''    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const manualLocsList = manualLocations.split(',').map(l => l.trim()).filter(l => l);
        const allLabels = [...selectedRouteStops.map(s => s.label), ...manualLocsList];
        
        if (!selectedArea || allLabels.length === 0) {
            swal('Error', 'Area and at least one Delivery Location are required.', 'error');
            return;
        }

        try {
            if (editMode) {
                const existingLocations = mappings.filter(m => String(m.area) === String(selectedArea));
                const newLabels = allLabels;
                
                const toDelete = existingLocations.filter(e => !newLabels.includes(e.location_name));
                const existingLabels = existingLocations.map(e => e.location_name);
                const toAdd = newLabels.filter(l => !existingLabels.includes(l));
                
                for (const d of toDelete) {
                    await AreaService.deleteDeliveryLocation(d.id);
                }
                for (const a of toAdd) {
                    await AreaService.createDeliveryLocation({ area: selectedArea, location_name: a });
                }
                swal('Success!', 'Mapping updated successfully.', 'success');
            } else {
                for (const label of allLabels) {
                    await AreaService.createDeliveryLocation({ area: selectedArea, location_name: label });
                }
                swal('Success!', 'Mapping(s) created successfully.', 'success');
            }'''
content = content.replace(submit_old, submit_new)

# 4. Update JSX
jsx_old = '''                            <div className="col-md-12">
                                <label className="form-label-custom">Delivery Location <span className="text-danger">*</span></label>
                                <CreatableSelect
                                    isMulti
                                    classNamePrefix="react-select"
                                    value={selectedRouteStops}
                                    onChange={(selectedOptions) => setSelectedRouteStops(selectedOptions || [])}
                                    options={routeStops.map(stop => ({ value: stop.id, label: stop.stop_name }))}
                                    placeholder="Select or type to add Delivery Location(s)..."
                                    styles={customSelectStyles}
                                    formatCreateLabel={(inputValue) => `Add manually: "${inputValue}"`}
                                />
                            </div>'''
jsx_new = '''                            <div className="col-md-12">
                                <label className="form-label-custom">Select Route Stops <span className="text-danger">*</span></label>
                                <CreatableSelect
                                    isMulti
                                    classNamePrefix="react-select"
                                    value={selectedRouteStops}
                                    onChange={(selectedOptions) => setSelectedRouteStops(selectedOptions || [])}
                                    options={routeStops.map(stop => ({ value: stop.id, label: stop.stop_name }))}
                                    placeholder="Select existing Route Stops..."
                                    styles={customSelectStyles}
                                    formatCreateLabel={(inputValue) => `Add manually: "${inputValue}"`}
                                />
                            </div>
                            <div className="col-md-12 mt-3">
                                <label className="form-label-custom">Or Type Manually (Comma Separated)</label>
                                <textarea
                                    className="form-control-custom"
                                    rows="2"
                                    value={manualLocations}
                                    onChange={(e) => setManualLocations(e.target.value)}
                                    placeholder="e.g. Muvattupuzha Town, Kothamangalam, Perumbavoor"
                                ></textarea>
                                <small className="text-muted mt-1 d-block">
                                    You can enter multiple locations separated by commas.
                                </small>
                            </div>'''
content = content.replace(jsx_old, jsx_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
