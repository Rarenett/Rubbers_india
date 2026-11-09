import React, { useState, useEffect } from 'react';
import LogisticsService from '../../../services/LogisticsService';
import { Card, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';

const DemoTableConfiguration = () => {
    const [fields, setFields] = useState([]);
    const [config, setConfig] = useState({});
    const [configId, setConfigId] = useState(null);

    useEffect(() => {
        fetchFieldsAndConfig();
    }, []);

    const fetchFieldsAndConfig = async () => {
        try {
            // 1. Fetch available fields from the model
            const fieldsResponse = await LogisticsService.getDemoTableFields();
            const modelFields = fieldsResponse.data.filter(f => f.name !== 'id'); // skip ID

            // 2. Fetch saved configuration
            const configResponse = await LogisticsService.getDemoTableConfiguration();
            const configData = configResponse.data.length > 0 ? configResponse.data[0] : null;

            if (configData) {
                setConfigId(configData.id);
            }

            const savedSettings = configData?.settings || {};

            // 3. Merge: if a model field isn't in settings yet, default it to true
            const mergedConfig = { ...savedSettings };
            modelFields.forEach(field => {
                if (!mergedConfig[field.name]) {
                    mergedConfig[field.name] = { show: true }; // default to visible for new fields
                }
            });

            setFields(modelFields);
            setConfig(mergedConfig);
        } catch (error) {
            console.error("Error fetching demo configuration:", error);
            Swal.fire('Error', 'Failed to load configuration.', 'error');
        }
    };

    const handleToggle = (field) => {
        setConfig(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                show: !prev[field].show
            }
        }));
    };

    const handleSave = async () => {
        try {
            const data = { settings: config };
            if (configId) {
                await LogisticsService.updateDemoTableConfiguration(configId, data);
            } else {
                // If it doesn't exist, we just update ID 1 (handled by viewset)
                await LogisticsService.updateDemoTableConfiguration(1, data);
            }
            Swal.fire('Success', 'Configuration saved successfully', 'success');
        } catch (error) {
            console.error("Error saving demo configuration:", error);
            Swal.fire('Error', 'Failed to save configuration.', 'error');
        }
    };



    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header>
                            <Card.Title>Demo Table Configuration</Card.Title>
                            <div className="text-muted small">
                                Any new fields added to the database will automatically appear here!
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Form>
                                <div className="row">
                                    {fields.map(field => (
                                        <div className="col-md-4 mb-3" key={field.name}>
                                            <Form.Check 
                                                type="switch"
                                                id={`switch-${field.name}`}
                                                label={`Show ${field.label}`}
                                                checked={config[field.name]?.show || false}
                                                onChange={() => handleToggle(field.name)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </Form>
                            <div className="text-end mt-4">
                                <Button variant="primary" onClick={handleSave}>
                                    Save Configuration
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DemoTableConfiguration;
