import { useState, useEffect } from 'react';
import { getTableConfiguration } from '../services/ConfigurationService';

export const useFormConfig = (tableName, formName) => {
    const [formConfig, setFormConfig] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!tableName || !formName) {
                setLoading(false);
                return;
            }
            try {
                const config = await getTableConfiguration(tableName, formName);
                if (config && config.settings) {
                    setFormConfig(config.settings);
                }
            } catch (error) {
                console.error("Failed to load form configuration", error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [tableName, formName]);

    const isFieldVisible = (fieldName) => {
        if (!formConfig) return true; // Show all by default if no config
        return formConfig[fieldName]?.show !== false; // Hide only if explicitly set to false
    };

    const getHiddenFields = () => {
        if (!formConfig) return [];
        return Object.keys(formConfig).filter(field => formConfig[field].show === false);
    };

    const stripHiddenFields = (data) => {
        if (!formConfig) return data;
        const hiddenFields = getHiddenFields();
        const newData = { ...data };
        hiddenFields.forEach(field => {
            delete newData[field];
        });
        return newData;
    };

    return { isFieldVisible, getHiddenFields, stripHiddenFields, loadingConfig: loading };
};
