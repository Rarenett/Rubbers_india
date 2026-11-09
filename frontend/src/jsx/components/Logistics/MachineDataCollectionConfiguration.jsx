import React, { useState, useEffect, useCallback } from 'react';
import { getMachineDataCollectionFields, getMachineDataCollectionConfiguration, updateMachineDataCollectionConfiguration } from '../../../services/MachineManagementService';
import { getStockItems } from '../../../services/InventoryService';
import { Card, Form, Button } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';

const MachineDataCollectionConfiguration = () => {
    const [fields, setFields] = useState([]);
    const [config, setConfig] = useState({});
    const [configId, setConfigId] = useState(null);
    const [stockItems, setStockItems] = useState([]);
    const [selectedStockItem, setSelectedStockItem] = useState('');



    const fetchInitialData = useCallback(async () => {
        try {
            // Fetch stock items for the dropdown filtered to Machinery and Equipments
            try {
    const stockResponse = await getStockItems({ from_stock_definition: 'true' });
    const allItems = stockResponse.data || stockResponse || [];

    // Exclude "spare parts" and "vehicle" stock groups — only
    // Machines/Equipment should be selectable here.
    const EXCLUDED_STOCK_GROUPS = ['spare parts'];
    const items = allItems.filter(
        item => !EXCLUDED_STOCK_GROUPS.includes((item.stock_group_name || '').trim().toLowerCase())
    );

    setStockItems(items);
} catch (err) {
    console.error("Error fetching stock items:", err);
}

            // 1. Fetch available fields from the model
            const fieldsResponse = await getMachineDataCollectionFields();
            const modelFields = fieldsResponse.filter(f => f.name !== 'id'); // skip ID
            setFields(modelFields);
            
            // Note: fetchConfigForStockItem will be triggered by the second useEffect
        } catch (error) {
            console.error("Error fetching initial configuration data:", error);
            Swal.fire('Error', 'Failed to load data.', 'error');
        }
    }, []);

    const fetchConfigForStockItem = useCallback(async (stockItemId) => {
        if (!fields || fields.length === 0) return; // Fields not loaded yet
        
        try {
            const configData = await getMachineDataCollectionConfiguration(stockItemId);

            if (configData && configData.id) {
                setConfigId(configData.id);
            } else {
                setConfigId(null);
            }

            const savedSettings = configData?.settings || {};

            // Merge: if a model field isn't in settings yet, default it to true
            const mergedConfig = { ...savedSettings };
            fields.forEach(field => {
                if (!mergedConfig[field.name]) {
                    mergedConfig[field.name] = { show: true }; // default to visible for new fields
                }
            });

            setConfig(mergedConfig);
        } catch (error) {
            console.error(`Error fetching configuration for stock item ${stockItemId}:`, error);
        }
    }, [fields]);

    useEffect(() => {
        // Fetch initial data (fields and stock items) and default config
        fetchInitialData();
    }, [fetchInitialData]);

    // Re-fetch config when selectedStockItem changes
    useEffect(() => {
        fetchConfigForStockItem(selectedStockItem);
    }, [selectedStockItem, fetchConfigForStockItem]);

    // Re-apply merge if fields change after config is loaded
    useEffect(() => {
        if (fields.length > 0 && Object.keys(config).length === 0) {
            fetchConfigForStockItem(selectedStockItem);
        }
    }, [fields, config, selectedStockItem, fetchConfigForStockItem]);

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
            const data = { 
                settings: config,
                stock_item: selectedStockItem || null
            };
            if (configId) {
                await updateMachineDataCollectionConfiguration(configId, data);
            } else {
                if (selectedStockItem && !configId) {
                    Swal.fire('Error', 'Could not save. Please reload the page.', 'error');
                    return;
                }
                await updateMachineDataCollectionConfiguration(1, data); // Fallback for global
            }
            Swal.fire('Success', 'Configuration saved successfully', 'success');
        } catch (error) {
            console.error("Error saving machine data collection configuration:", error);
            Swal.fire('Error', 'Failed to save configuration.', 'error');
        }
    };

    const selectOptions = stockItems.map(item => ({
        value: item.id,
        label: `${item.name || item.item_name || item.stock_item_name || `Item #${item.id}`}${item.stock_group_name ? ` (${item.stock_group_name})` : ''}`
    }));

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <Card>
                        <Card.Header>
                            <Card.Title>Machine Data Collection Configuration</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form>
                                <div className="row mb-4">
                                    <div className="col-md-6">
                                        <Form.Group>
                                            <Form.Label>Select Stock Item (Machinery & Equipments)</Form.Label>
                                            <Select
                                                options={selectOptions}
                                                value={selectOptions.find(opt => opt.value === selectedStockItem) || null}
                                                onChange={(selectedOption) => setSelectedStockItem(selectedOption ? selectedOption.value : '')}
                                                placeholder="-- Select a Machinery / Equipment Item --"
                                                isSearchable={true}
                                                isClearable={true}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>
                                <hr />
                                <div className="row">
                                    {fields.map(field => (
                                        <div className="col-md-4 mb-3" key={field.name}>
                                            <Form.Check 
                                                type="switch"
                                                id={`switch-${field.name}`}
                                                label={field.label}
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

export default MachineDataCollectionConfiguration;
