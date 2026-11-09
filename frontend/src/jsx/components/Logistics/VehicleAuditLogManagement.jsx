import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

import VehicleAuditLogList from './VehicleAuditLogList';

const VehicleAuditLogManagement = () => {

    const navigate = useNavigate();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getVehicleAuditLogs();
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const filteredLogs = logs.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            (item.vehicle_name   || '').toLowerCase().includes(term) ||
            (item.vehicle_number || '').toLowerCase().includes(term) ||
            (item.username       || '').toLowerCase().includes(term) ||
            (item.action         || '').toLowerCase().includes(term) ||
            (item.remarks        || '').toLowerCase().includes(term)
        );
    });

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index'          },
            { header: 'Date & Time',  dataKey: 'modified_at'    },
            { header: 'User',         dataKey: 'username'        },
            { header: 'Vehicle',      dataKey: 'vehicle_name'   },
            { header: 'Vehicle No.',  dataKey: 'vehicle_number' },
            { header: 'Action',       dataKey: 'action'         },
            { header: 'Remarks',      dataKey: 'remarks'        },
        ];
        const exportData = filteredLogs.map((item, i) => ({
            ...item,
            index: i + 1,
            modified_at: new Date(item.modified_at).toLocaleString(),
        }));
        if (format === 'pdf')        exportToPDF(exportData, columns, 'vehicle-audit-log.pdf', 'Vehicle Audit Log');
        else if (format === 'excel') exportToExcel(exportData, columns, 'vehicle-audit-log.xlsx');
        else if (format === 'print') printData(exportData, columns, 'Vehicle Audit Log');
    };

    return (
        <Fragment>
            <VehicleAuditLogList
                data={filteredLogs}
                loading={loading}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
            />
        </Fragment>
    );
};

export default VehicleAuditLogManagement;