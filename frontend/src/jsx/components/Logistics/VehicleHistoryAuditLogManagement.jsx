import React, { useState, useEffect, useCallback, Fragment } from 'react';
import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import VehicleHistoryAuditLogList from './VehicleHistoryAuditLogList';

const VehicleHistoryAuditLogManagement = () => {

    const [logs, setLogs]         = useState([]);
    const [loading, setLoading]   = useState(false);
    const [searchTerm, setSearch] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await LogisticsService.getVehicleHistoryAuditLogs();
            setLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filteredLogs = logs.filter((item) => {
        const term = searchTerm.toLowerCase();
        const displayDate = item.modified_at
        ? new Date(item.modified_at).toLocaleString().toLowerCase()
        : '';

    const rawDate = item.modified_at
        ? String(item.modified_at).toLowerCase()
        : '';
        return (
            (item.trans_no       || '').toLowerCase().includes(term) ||
            (item.vehicle_name   || '').toLowerCase().includes(term) ||
            (item.vehicle_number || '').toLowerCase().includes(term) ||
            (item.username       || '').toLowerCase().includes(term) ||
            (item.action         || '').toLowerCase().includes(term) ||
            (item.remarks        || '').toLowerCase().includes(term) ||
            displayDate.includes(term) ||
        rawDate.includes(term)
        );
    });

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index'          },
            { header: 'Date & Time',  dataKey: 'modified_at'    },
            { header: 'User',         dataKey: 'username'        },
            { header: 'Trans No.',    dataKey: 'trans_no'        },
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
        if (format === 'pdf')        exportToPDF(exportData, columns, 'vehicle-history-audit-log.pdf', 'Vehicle History Audit Log');
        else if (format === 'excel') exportToExcel(exportData, columns, 'vehicle-history-audit-log.xlsx');
        else if (format === 'print') printData(exportData, columns, 'Vehicle History Audit Log');
    };

    return (
        <Fragment>
            <VehicleHistoryAuditLogList
                data={filteredLogs}
                loading={loading}
                searchTerm={searchTerm}
                onSearchChange={setSearch}
                onExport={handleExport}
            />
        </Fragment>
    );
};

export default VehicleHistoryAuditLogManagement;