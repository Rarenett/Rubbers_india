import React, { useState, useEffect } from 'react';
import { getConfigurableModels, getModelFields, getTableConfiguration, updateTableConfiguration, FORM_REGISTRY } from '../../../services/ConfigurationService';
import { Card, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';

const DynamicFormConfiguration = () => {
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState(null);
    const [selectedForm, setSelectedForm] = useState(null);
    const [fields, setFields] = useState([]);
    const [configId, setConfigId] = useState(null);
    const [settings, setSettings] = useState({});

    // Tries multiple possible key formats to find the right FORM_REGISTRY entry
    const getFormOptionsForModel = (model) => {
        if (!model) return [];
        const candidateKeys = [
            model.table_name,
            model.model_name,
            model.model_name?.toLowerCase(),
            model.verbose_name,
            model.verbose_name?.toLowerCase(),
            model.verbose_name?.replace(/\s+/g, ''),
            model.verbose_name?.replace(/\s+/g, '').toLowerCase(),
        ].filter(Boolean);

        for (const key of candidateKeys) {
            if (FORM_REGISTRY[key]) {
                return FORM_REGISTRY[key];
            }
        }
        return [];
    };

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        try {
            const data = await getConfigurableModels();
            // Automatically filter out any models that do not have a registered form in FORM_REGISTRY
            const filteredData = data.filter(m => getFormOptionsForModel(m).length > 0);
            setModels(filteredData);
        } catch (error) {
            console.error("Error fetching configurable models:", error);
            Swal.fire('Error', 'Failed to load configurable models.', 'error');
        }
    };

    const handleModelChange = async (selectedOption) => {
        if (!selectedOption) {
            setSelectedModel(null);
            setSelectedForm(null);
            setFields([]);
            setSettings({});
            return;
        }

        const modelIndex = selectedOption.value;
        const model = models[modelIndex];
        setSelectedModel(model); 
        setSelectedForm(null); // Reset form selection when model changes
        setFields([]);
        setSettings({});
    };

    const handleFormChange = async (selectedOption) => {
        if (!selectedOption) {
            setSelectedForm(null);
            setFields([]);
            setSettings({});
            return;
        }

        const formValue = selectedOption.value;
        setSelectedForm(formValue);
        
        try {
            // Fetch fields for this model
            const fieldsData = await getModelFields(selectedModel.app_label, selectedModel.model_name);
            setFields(fieldsData);
            
            // Fetch existing configuration
            const configData = await getTableConfiguration(selectedModel.table_name, formValue);
            if (configData) {
                setConfigId(configData.id);
                // Merge default fields with saved settings
                const mergedSettings = {};
                fieldsData.forEach(field => {
                    mergedSettings[field.name] = configData.settings[field.name] || { show: true };
                });
                setSettings(mergedSettings);
            } else {
                setConfigId(null);
                // Set default settings (all visible)
                const defaultSettings = {};
                fieldsData.forEach(field => {
                    defaultSettings[field.name] = { show: true };
                });
                setSettings(defaultSettings);
            }
        } catch (error) {
            console.error("Error loading model details:", error);
            Swal.fire('Error', 'Failed to load model fields.', 'error');
        }
    };

    const handleToggle = (field) => {
        setSettings(prev => ({
            ...prev,
            [field.name]: {
                ...prev[field.name],
                show: !prev[field.name]?.show
            }
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedModel || !selectedForm) {
            Swal.fire('Error', 'Please select a table and a form to configure.', 'error');
            return;
        }

        const data = {
            settings: settings
        };

        try {
            await updateTableConfiguration(selectedModel.table_name, selectedForm, data);
            Swal.fire('Success', 'Configuration saved successfully', 'success');
        } catch (error) {
            console.error("Error saving configuration:", error);
            Swal.fire('Error', 'Failed to save configuration.', 'error');
        }
    };

    return (
        <div className="container-fluid">
            <div className="row page-titles mx-0">
                <div className="col-sm-6 p-md-0">
                    <div className="welcome-text">
                        <h4>Dynamic Form Configuration</h4>
                        <span>Configure visible fields for any form in the system</span>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-xl-12">
                    <Card>
                        <Card.Header>
                            <Card.Title>Form Configuration</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleSave}>
                                <div className="row mb-lg-4">
                                    <div className="col-lg-6 col-md-12 mb-3 mb-lg-0">
                                        <Form.Group>
                                            <Form.Label>Select Form/Table</Form.Label>
                                            <Select
                                                value={selectedModel ? {
                                                    value: models.indexOf(selectedModel),
                                                    label: `${selectedModel.verbose_name} (${selectedModel.model_name})`
                                                } : null}
                                                onChange={handleModelChange}
                                                options={models.map((model, index) => ({
                                                    value: index,
                                                    label: `${model.verbose_name} (${model.model_name})`
                                                }))}
                                                placeholder="-- Select a Form --"
                                                isClearable
                                                isSearchable
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-lg-6 col-md-12">
                                        <Form.Group>
                                            <Form.Label>Select Form</Form.Label>
                                            <Select
                                                value={selectedForm ? getFormOptionsForModel(selectedModel).find(f => f.value === selectedForm) : null}
                                                onChange={handleFormChange}
                                                options={getFormOptionsForModel(selectedModel)}
                                                placeholder={selectedModel ? "-- Select a Form --" : "-- Select a Table First --"}
                                                isDisabled={!selectedModel}
                                                isClearable
                                                isSearchable
                                            />
                                        </Form.Group>
                                    </div>
                                </div>

                                {selectedModel && selectedForm && fields.length > 0 && (
                                    <div className="row mt-4">
                                        <div className="col-12">
                                            <h5 className="mb-3">Fields for {selectedModel.verbose_name}</h5>
                                            <div className="row">
                                                {fields.map((field) => (
                                                    <div className="col-lg-4 col-md-6 col-sm-12 mb-3" key={field.name}>
                                                        <div className="d-flex align-items-center bg-light p-3 rounded" style={{ border: '1px solid #eee' }}>
                                                            <div className="me-3">
                                                                <Form.Check 
                                                                    type="switch"
                                                                    id={`custom-switch-${field.name}`}
                                                                    checked={settings[field.name]?.show || false}
                                                                    onChange={() => handleToggle(field)}
                                                                    className="custom-switch-lg"
                                                                />
                                                            </div>
                                                            <div>
                                                                <h6 className="mb-0">
                                                                    {field.label || field.name}
                                                                    {field.required && <span className="text-danger ms-1">*</span>}
                                                                </h6>
                                                                <small className="text-muted text-uppercase" style={{ fontSize: '10px' }}>{field.type}</small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="row mt-4 mb-4">
                                    <div className="col-12 text-end">
                                        <Button variant="primary" type="submit" disabled={!selectedModel || !selectedForm}>
                                            Save Configuration
                                        </Button>
                                    </div>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DynamicFormConfiguration;