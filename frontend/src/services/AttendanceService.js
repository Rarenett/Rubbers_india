import axiosInstance from './AxiosInstance';
import { formatFriendlyError, getEmployees, getUsers } from './HRManagementService';

export { formatFriendlyError, getEmployees, getUsers };

const ATTENDANCE_API_BASE = '/api/attendance';

/**
 * Service for Attendance & Leave Management
 */

// ==========================================
// Leave Types
// ==========================================

export const getLeaveTypes = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-types/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching leave types:', error);
        throw error;
    }
};

export const getLeaveTypeById = async (id) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching leave type ${id}:`, error);
        throw error;
    }
};

export const createLeaveType = async (data) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-types/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating leave type:', error);
        throw error;
    }
};

export const updateLeaveType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${ATTENDANCE_API_BASE}/leave-types/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating leave type ${id}:`, error);
        throw error;
    }
};

export const deleteLeaveType = async (id) => {
    try {
        const response = await axiosInstance.delete(`${ATTENDANCE_API_BASE}/leave-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting leave type ${id}:`, error);
        throw error;
    }
};

export const toggleLeaveTypeActive = async (id) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-types/${id}/toggle-active/`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling leave type active status ${id}:`, error);
        throw error;
    }
};


// ==========================================
// Leave Requests
// ==========================================

export const getLeaveRequests = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-requests/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        throw error;
    }
};

export const getLeaveRequestById = async (id) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-requests/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching leave request ${id}:`, error);
        throw error;
    }
};

export const createLeaveRequest = async (data) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating leave request:', error);
        throw error;
    }
};

export const updateLeaveRequest = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${ATTENDANCE_API_BASE}/leave-requests/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating leave request ${id}:`, error);
        throw error;
    }
};

export const deleteLeaveRequest = async (id) => {
    try {
        const response = await axiosInstance.delete(`${ATTENDANCE_API_BASE}/leave-requests/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting leave request ${id}:`, error);
        throw error;
    }
};

export const getReceivedLeaveRequests = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-requests/received/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching received leave requests:', error);
        throw error;
    }
};

export const approveLeaveRequest = async (id, data = {}) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/approve/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error approving leave request ${id}:`, error);
        throw error;
    }
};

export const rejectLeaveRequest = async (id, data = {}) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/reject/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error rejecting leave request ${id}:`, error);
        throw error;
    }
};

export const forwardLeaveRequest = async (id, data) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/forward/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error forwarding leave request ${id}:`, error);
        throw error;
    }
};

export const getForwardRecipients = async (id) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-requests/${id}/forward-recipients/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching forward recipients for leave request ${id}:`, error);
        throw error;
    }
};

export const cancelLeaveRequest = async (id) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/cancel/`);
        return response.data;
    } catch (error) {
        console.error(`Error cancelling leave request ${id}:`, error);
        throw error;
    }
};

export const acceptLeaveRequest = async (id) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/accept/`);
        return response.data;
    } catch (error) {
        console.error(`Error accepting leave request ${id}:`, error);
        throw error;
    }
};

export const declineLeaveRequest = async (id, data) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/leave-requests/${id}/decline/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error declining leave request ${id}:`, error);
        throw error;
    }
};


// ==========================================
// Leave Request Dates & Forwarding History
// ==========================================

export const getLeaveRequestDates = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-request-dates/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching leave request dates:', error);
        throw error;
    }
};

export const getLeaveRequestForwardings = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-request-forwardings/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching forwarding history:', error);
        throw error;
    }
};

// ==========================================
// Employee Leave Types (Mappings)
// ==========================================

export const getEmployeeLeaveTypes = async (employeeId, params = {}) => {
    try {
        const queryParams = { ...params };
        if (employeeId) {
            queryParams.employee = employeeId;
        }
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/employee-leave-types/`, { params: queryParams });
        return response.data;
    } catch (error) {
        console.error('Error fetching employee leave types:', error);
        throw error;
    }
};

export const getEmployeeLeaveTypeById = async (id) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/employee-leave-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching employee leave type ${id}:`, error);
        throw error;
    }
};

export const createEmployeeLeaveType = async (data) => {
    try {
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/employee-leave-types/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating employee leave type:', error);
        throw error;
    }
};

export const updateEmployeeLeaveType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${ATTENDANCE_API_BASE}/employee-leave-types/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating employee leave type ${id}:`, error);
        throw error;
    }
};

export const deleteEmployeeLeaveType = async (id) => {
    try {
        const response = await axiosInstance.delete(`${ATTENDANCE_API_BASE}/employee-leave-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting employee leave type ${id}:`, error);
        throw error;
    }
};

export const saveEmployeeLeaveTypes = async (employeeId, rows, candidateId = null) => {
    try {
        const payload = {
            employee: employeeId,
            candidate: candidateId,
            rows,
        };
        const response = await axiosInstance.post(`${ATTENDANCE_API_BASE}/employee-leave-types/bulk-save/`, payload);
        return response.data;
    } catch (error) {
        console.error('Error bulk saving employee leave types:', error);
        throw error;
    }
};

// ==========================================
// Employee Leave Transactions & Balances
// ==========================================

export const getLeaveBalances = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/employee-leave-transactions/balances/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching leave balances:', error);
        throw error;
    }
};

export const getEmployeeLeaveHistory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${ATTENDANCE_API_BASE}/leave-requests/employee-history/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employee leave history:', error);
        throw error;
    }
};

export default {
    getLeaveTypes,
    getLeaveTypeById,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    toggleLeaveTypeActive,
    getLeaveRequests,
    getLeaveRequestById,
    createLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    forwardLeaveRequest,
    cancelLeaveRequest,
    acceptLeaveRequest,
    declineLeaveRequest,
    getLeaveRequestDates,
    getLeaveRequestForwardings,
    getEmployeeLeaveTypes,
    getEmployeeLeaveTypeById,
    createEmployeeLeaveType,
    updateEmployeeLeaveType,
    deleteEmployeeLeaveType,
    saveEmployeeLeaveTypes,
    getLeaveBalances,
    getEmployeeLeaveHistory,
};
