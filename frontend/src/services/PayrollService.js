import axiosInstance from './AxiosInstance';

const PAYROLL_API_BASE = '/api/payroll';

/**
 * Payroll Service for Units, Compound Units, and Attendance/Production Types
 */

// ==========================================
// Payroll Units
// ==========================================

export const getPayrollUnits = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/payroll-units/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching payroll units:', error);
        throw error;
    }
};

export const getPayrollUnitById = async (id) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/payroll-units/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching payroll unit ${id}:`, error);
        throw error;
    }
};

export const createPayrollUnit = async (data) => {
    try {
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/payroll-units/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating payroll unit:', error);
        throw error;
    }
};

export const updatePayrollUnit = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${PAYROLL_API_BASE}/payroll-units/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating payroll unit ${id}:`, error);
        throw error;
    }
};

export const deletePayrollUnit = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/payroll-units/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting payroll unit ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Payroll Compound Units
// ==========================================

export const getPayrollCompoundUnits = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/payroll-compound-units/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching payroll compound units:', error);
        throw error;
    }
};

export const getPayrollCompoundUnitById = async (id) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/payroll-compound-units/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching payroll compound unit ${id}:`, error);
        throw error;
    }
};

export const createPayrollCompoundUnit = async (data) => {
    try {
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/payroll-compound-units/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating payroll compound unit:', error);
        throw error;
    }
};

export const updatePayrollCompoundUnit = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${PAYROLL_API_BASE}/payroll-compound-units/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating payroll compound unit ${id}:`, error);
        throw error;
    }
};

export const deletePayrollCompoundUnit = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/payroll-compound-units/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting payroll compound unit ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Attendance & Production Types
// ==========================================

export const getAttendanceProductionTypes = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/attendance-production-types/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching attendance/production types:', error);
        throw error;
    }
};

export const getAttendanceProductionTypeById = async (id) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/attendance-production-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching attendance/production type ${id}:`, error);
        throw error;
    }
};

export const createAttendanceProductionType = async (data) => {
    try {
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/attendance-production-types/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating attendance/production type:', error);
        throw error;
    }
};

export const updateAttendanceProductionType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${PAYROLL_API_BASE}/attendance-production-types/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating attendance/production type ${id}:`, error);
        throw error;
    }
};

export const deleteAttendanceProductionType = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/attendance-production-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting attendance/production type ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Pay Heads
// ==========================================

export const getPayHeads = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/pay-heads/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching pay heads:', error);
        throw error;
    }
};

export const getPayHeadById = async (id) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/pay-heads/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching pay head ${id}:`, error);
        throw error;
    }
};

export const createPayHead = async (data) => {
    try {
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/pay-heads/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating pay head:', error);
        throw error;
    }
};

export const updatePayHead = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${PAYROLL_API_BASE}/pay-heads/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating pay head ${id}:`, error);
        throw error;
    }
};

export const deletePayHead = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/pay-heads/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting pay head ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Calculation Types
// ==========================================

export const getCalculationTypes = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/calculation-types/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching calculation types:', error);
        throw error;
    }
};

export const getCalculationTypeById = async (id) => {
    try {
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/calculation-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching calculation type ${id}:`, error);
        throw error;
    }
};

export const createCalculationType = async (data) => {
    try {
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/calculation-types/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating calculation type:', error);
        throw error;
    }
};

export const updateCalculationType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${PAYROLL_API_BASE}/calculation-types/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating calculation type ${id}:`, error);
        throw error;
    }
};

export const deleteCalculationType = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/calculation-types/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting calculation type ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Employee Pay Heads
// ==========================================

export const getEmployeePayHeads = async (employeeId, params = {}) => {
    try {
        const queryParams = { ...params };
        if (employeeId) queryParams.employee = employeeId;
        const response = await axiosInstance.get(`${PAYROLL_API_BASE}/employee-payheads/`, { params: queryParams });
        return response.data;
    } catch (error) {
        console.error(`Error fetching employee pay heads for employee ${employeeId}:`, error);
        throw error;
    }
};

export const saveEmployeePayHeads = async (employeeId, rows, candidateId = null) => {
    try {
        const payload = {
            employee: employeeId,
            candidate: candidateId,
            rows: rows
        };
        const response = await axiosInstance.post(`${PAYROLL_API_BASE}/employee-payheads/bulk-save/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error saving employee pay heads for employee ${employeeId}:`, error);
        throw error;
    }
};

export const deleteEmployeePayHead = async (id) => {
    try {
        const response = await axiosInstance.delete(`${PAYROLL_API_BASE}/employee-payheads/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting employee pay head ${id}:`, error);
        throw error;
    }
};



