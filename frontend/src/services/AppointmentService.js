import axiosInstance from './AxiosInstance';

const AppointmentService = {
    getAppointments: async () => {
        const response = await axiosInstance.get('/api/appointment/appointments/');
        return response.data;
    },
    getAppointment: async (id) => {
        const response = await axiosInstance.get(`/api/appointment/appointments/${id}/`);
        return response.data;
    },
    createAppointment: async (data) => {
        const response = await axiosInstance.post('/api/appointment/appointments/', data);
        return response.data;
    },
    updateAppointment: async (id, data) => {
        const response = await axiosInstance.put(`/api/appointment/appointments/${id}/`, data);
        return response.data;
    },
    deleteAppointment: async (id) => {
        const response = await axiosInstance.delete(`/api/appointment/appointments/${id}/`);
        return response.data;
    },
    // Helper methods for dynamic dropdowns
    getMyDepartment: async () => {
        const response = await axiosInstance.get('/api/appointment/appointments/get_my_department/');
        return response.data;
    },
    getDesignationsByDepartment: async (deptId) => {
        const response = await axiosInstance.get(`/api/appointment/appointments/designations_by_department/?department_id=${deptId}`);
        return response.data;
    },
    getStaffByDesignation: async (deptId, desigId) => {
        const response = await axiosInstance.get(`/api/appointment/appointments/staff_by_designation/?department_id=${deptId}&designation_id=${desigId}`);
        return response.data;
    },
    getAllDepartments: async () => {
        const response = await axiosInstance.get('/api/appointment/appointments/all_departments/');
        return response.data;
    },
    getTodayAppointments: async (number = '') => {
        const params = number ? { number } : {};
        const response = await axiosInstance.get('/api/appointment/appointments/today_appointments/', { params });
        return response.data;
    },
    getMyPendingApprovals: async (params = {}) => {
        const response = await axiosInstance.get('/api/appointment/appointments/my_pending_approvals/', { params });
        return response.data;
    },
    getMyApprovedRequests: async (params = {}) => {
        const response = await axiosInstance.get('/api/appointment/appointments/my_approved_requests/', { params });
        return response.data;
    },
    getMyRejectedRequests: async (params = {}) => {
        const response = await axiosInstance.get('/api/appointment/appointments/my_rejected_requests/', { params });
        return response.data;
    },
    approveAppointment: async (id) => {
        const response = await axiosInstance.post(`/api/appointment/appointments/${id}/approve/`);
        return response.data;
    },
    rejectAppointment: async (id) => {
        const response = await axiosInstance.post(`/api/appointment/appointments/${id}/reject/`);
        return response.data;
    }
};

export default AppointmentService;
