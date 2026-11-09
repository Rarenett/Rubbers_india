import axiosInstance from './AxiosInstance';

const RENEWAL_API_BASE = '/api/renewal';

// ==================== RENEWAL SUBJECT ENDPOINTS ====================

export const getRenewalSubjects = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${RENEWAL_API_BASE}/subjects/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching renewal subjects:', error);
        throw error;
    }
};

export const createRenewalSubject = async (data) => {
    try {
        const response = await axiosInstance.post(`${RENEWAL_API_BASE}/subjects/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating renewal subject:', error);
        throw error;
    }
};

export const updateRenewalSubject = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${RENEWAL_API_BASE}/subjects/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating renewal subject ${id}:`, error);
        throw error;
    }
};

export const deleteRenewalSubject = async (id) => {
    try {
        const response = await axiosInstance.delete(`${RENEWAL_API_BASE}/subjects/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting renewal subject ${id}:`, error);
        throw error;
    }
};

// ==================== RENEWAL REMINDER ENDPOINTS ====================

export const getMyDueRenewalReminders = async () => {
    try {
        const response = await axiosInstance.get(`${RENEWAL_API_BASE}/reminders/my-due/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching due renewal reminders:', error);
        throw error;
    }
};

export const getRenewalReminders = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${RENEWAL_API_BASE}/reminders/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching renewal reminders:', error);
        throw error;
    }
};

export const getRenewalHistory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${RENEWAL_API_BASE}/reminders/history/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching renewal history:', error);
        throw error;
    }
};

export const createRenewalReminder = async (data) => {
    try {
        const response = await axiosInstance.post(`${RENEWAL_API_BASE}/reminders/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating renewal reminder:', error);
        throw error;
    }
};

export const updateRenewalReminder = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${RENEWAL_API_BASE}/reminders/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating renewal reminder ${id}:`, error);
        throw error;
    }
};

export const deleteRenewalReminder = async (id) => {
    try {
        const response = await axiosInstance.delete(`${RENEWAL_API_BASE}/reminders/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting renewal reminder ${id}:`, error);
        throw error;
    }
};

// ==================== RENEWAL UPDATION ENDPOINTS ====================

export const fetchReminderForUpdate = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${RENEWAL_API_BASE}/reminders/fetch-for-update/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching reminder for update:', error);
        throw error;
    }
};

export const submitRenewalUpdate = async (data) => {
    try {
        const response = await axiosInstance.post(`${RENEWAL_API_BASE}/reminders/renew-update/`, data);
        return response.data;
    } catch (error) {
        console.error('Error submitting renewal update:', error);
        throw error;
    }
};

// ==================== DROPDOWN HELPER ENDPOINTS ====================

export const getBranches = async (companyId) => {
    try {
        const params = companyId ? { company: companyId } : {};
        const response = await axiosInstance.get('/api/settings/branches/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching branches:', error);
        throw error;
    }
};

export const getDepartments = async () => {
    try {
        const response = await axiosInstance.get('/api/hr/departments/');
        return response.data;
    } catch (error) {
        console.error('Error fetching departments:', error);
        throw error;
    }
};

export const getEmployees = async (departmentId) => {
    try {
        const params = departmentId ? { department: departmentId } : {};
        const response = await axiosInstance.get('/api/hr/employees/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employees:', error);
        throw error;
    }
};
