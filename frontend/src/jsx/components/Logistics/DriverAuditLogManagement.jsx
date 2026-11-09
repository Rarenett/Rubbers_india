import React, {
    useState,
    useEffect,
    useCallback,
    Fragment
} from 'react';

import LogisticsService from '../../../services/LogisticsService';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';

import DriverAuditLogList from './DriverAuditLogList';

const DriverAuditLogManagement = () => {

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = useCallback(async () => {

        setLoading(true);

        try {

            const res =
                await LogisticsService.getDriverAuditLogs();

            setLogs(
                Array.isArray(res.data)
                    ? res.data
                    : []
            );

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

        const dateTime = item.modified_at
        ? new Date(item.modified_at).toLocaleString().toLowerCase()
        : '';

        return (
            (item.driver_name || '')
                .toLowerCase()
                .includes(term) ||

            (item.username || '')
                .toLowerCase()
                .includes(term) ||

            (item.action || '')
                .toLowerCase()
                .includes(term) ||

            (item.remarks || '')
                .toLowerCase()
                .includes(term) ||

            dateTime.includes(term)
        );
    });

    const handleExport = (format) => {
        const columns = [
            { header: '#',            dataKey: 'index'        },
            { header: 'Date & Time',  dataKey: 'modified_at'  },
            { header: 'User',         dataKey: 'username'     },
            { header: 'Driver',       dataKey: 'driver_name'  },
            { header: 'Action',       dataKey: 'action'       },
            { header: 'Remarks',      dataKey: 'remarks'      },
        ];
        const exportData = filteredLogs.map((item, i) => ({
            ...item,
            index: i + 1,
            modified_at: new Date(item.modified_at).toLocaleString(),
        }));
        if (format === 'pdf')        exportToPDF(exportData, columns, 'driver-audit-log.pdf', 'Driver Audit Log');
        else if (format === 'excel') exportToExcel(exportData, columns, 'driver-audit-log.xlsx');
        else if (format === 'print') printData(exportData, columns, 'Driver Audit Log');
    };

    return (
        <Fragment>
            <DriverAuditLogList
                data={filteredLogs}
                loading={loading}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
            />
        </Fragment>
    );
};

export default DriverAuditLogManagement;