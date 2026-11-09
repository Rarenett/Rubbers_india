import axiosInstance from './AxiosInstance';

export const ProductionService = {
    // --- Shifts ---
    getShifts: (params = '') => axiosInstance.get(`/api/production/shifts/${params}`),
    getShift: (id) => axiosInstance.get(`/api/production/shifts/${id}/`),
    createShift: (data) => axiosInstance.post('/api/production/shifts/', data),
    updateShift: (id, data) => axiosInstance.put(`/api/production/shifts/${id}/`, data),
    deleteShift: (id) => axiosInstance.delete(`/api/production/shifts/${id}/`),

    // --- Break Types ---
    getBreakTypes: (params = '') => axiosInstance.get(`/api/production/break-types/${params}`),
    getBreakType: (id) => axiosInstance.get(`/api/production/break-types/${id}/`),
    createBreakType: (data) => axiosInstance.post('/api/production/break-types/', data),
    updateBreakType: (id, data) => axiosInstance.put(`/api/production/break-types/${id}/`, data),
    deleteBreakType: (id) => axiosInstance.delete(`/api/production/break-types/${id}/`),

    // --- Shift Plans ---
    getShiftPlans: (params = '') => axiosInstance.get(`/api/production/shift-plans/${params}`),
    getShiftPlan: (id) => axiosInstance.get(`/api/production/shift-plans/${id}/`),
    createShiftPlan: (data) => axiosInstance.post('/api/production/shift-plans/', data),
    updateShiftPlan: (id, data) => axiosInstance.put(`/api/production/shift-plans/${id}/`, data),
    deleteShiftPlan: (id) => axiosInstance.delete(`/api/production/shift-plans/${id}/`),
    bulkGenerateShiftPlans: (data) => axiosInstance.post('/api/production/shift-plans/bulk_generate/', data),

    // --- Shift Plan Days ---
    getShiftPlanDays: (params = '') => axiosInstance.get(`/api/production/shift-plan-days/${params}`),

    // --- Shift Production Lines ---
    getShiftProductionLines: (params = '') => axiosInstance.get(`/api/production/shift-production-lines/${params}`),
    getShiftProductionLine: (id) => axiosInstance.get(`/api/production/shift-production-lines/${id}/`),
    createShiftProductionLine: (data) => axiosInstance.post('/api/production/shift-production-lines/', data),
    updateShiftProductionLine: (id, data) => axiosInstance.put(`/api/production/shift-production-lines/${id}/`, data),
    patchShiftProductionLine: (id, data) => axiosInstance.patch(`/api/production/shift-production-lines/${id}/`, data),
    deleteShiftProductionLine: (id) => axiosInstance.delete(`/api/production/shift-production-lines/${id}/`),

    // --- Production Lines ---
    getProductionLines: (params = '') => axiosInstance.get(`/api/production/production-lines/${params}`),
    getProductionLine: (id) => axiosInstance.get(`/api/production/production-lines/${id}/`),
    createProductionLine: (data) => axiosInstance.post('/api/production/production-lines/', data),
    updateProductionLine: (id, data) => axiosInstance.put(`/api/production/production-lines/${id}/`, data),
    deleteProductionLine: (id) => axiosInstance.delete(`/api/production/production-lines/${id}/`),

    // --- Shift Production Employees ---
    validateShiftProductionEmployeeConflict: (data) => axiosInstance.post('/api/production/shift-production-employees/validate_conflict/', data),

    // --- Attendance ---
    getAttendances: (params = '') => axiosInstance.get(`/api/production/attendance/${params}`),
    getAttendanceEmployeeReport: (params = '') => axiosInstance.get(`/api/production/attendance/employee-report/${params}`),
    getAttendanceHrSummary: (params = '') => axiosInstance.get(`/api/production/attendance/hr_summary/${params}`),
    bulkMarkAttendance: (data) => axiosInstance.post('/api/production/attendance/bulk_mark/', data),

    // --- Break Logs ---
    getBreakLogs: (params = '') => axiosInstance.get(`/api/production/break-logs/${params}`),
    startBreakLog: (data) => axiosInstance.post('/api/production/break-logs/break_start/', data),
    endBreakLog: (data) => axiosInstance.post('/api/production/break-logs/break_end/', data),
    patchBreakLog: (id, data) => axiosInstance.patch(`/api/production/break-logs/${id}/`, data),
    deleteBreakLog: (id) => axiosInstance.delete(`/api/production/break-logs/${id}/`),

    // --- Post Production Entries ---
    getPostProductionEntries: (params = '') => axiosInstance.get(`/api/production/post-production-entries/${params}`),
    getPostProductionEntry: (id) => axiosInstance.get(`/api/production/post-production-entries/${id}/`),
    createPostProductionEntry: (data) => axiosInstance.post('/api/production/post-production-entries/', data),
    updatePostProductionEntry: (id, data) => axiosInstance.put(`/api/production/post-production-entries/${id}/`, data),
    deletePostProductionEntry: (id) => axiosInstance.delete(`/api/production/post-production-entries/${id}/`),

    // --- Adjustments ---
    getAdjustments: (params = '') => axiosInstance.get(`/api/production/adjustments/${params}`),
    getAdjustment: (id) => axiosInstance.get(`/api/production/adjustments/${id}/`),
    getAdjustmentStockItems: (params = '') => axiosInstance.get(`/api/production/adjustments/stock-items/${params ? (params.startsWith('?') ? params : `?${params}`) : ''}`),
    getAdjustmentAvailableEntries: (stockItemId, adjustmentId = '') => axiosInstance.get(`/api/production/adjustments/available-entries/?stock_item_id=${stockItemId}${adjustmentId ? `&adjustment_id=${adjustmentId}` : ''}`),
    createAdjustment: (data) => axiosInstance.post('/api/production/adjustments/create-adjustment/', data),
    updateAdjustment: (id, data) => axiosInstance.put(`/api/production/adjustments/${id}/update-adjustment/`, data),

    // --- Post Production Responsibilities ---
    getPostProductionResponsibilities: (params = '') => axiosInstance.get(`/api/production/post-production-responsibilities/${params}`),
    getPostProductionResponsibility: (id) => axiosInstance.get(`/api/production/post-production-responsibilities/${id}/`),
    createPostProductionResponsibility: (data) => axiosInstance.post('/api/production/post-production-responsibilities/', data),
    updatePostProductionResponsibility: (id, data) => axiosInstance.put(`/api/production/post-production-responsibilities/${id}/`, data),
    patchPostProductionResponsibility: (id, data) => axiosInstance.patch(`/api/production/post-production-responsibilities/${id}/`, data),
    deletePostProductionResponsibility: (id) => axiosInstance.delete(`/api/production/post-production-responsibilities/${id}/`),

    // --- Employee Groups ---
    getEmployeeGroups: (params = '') => axiosInstance.get(`/api/production/employee-groups/${params}`),
    getEmployeeGroup: (id) => axiosInstance.get(`/api/production/employee-groups/${id}/`),
    createEmployeeGroup: (data) => axiosInstance.post('/api/production/employee-groups/', data),
    updateEmployeeGroup: (id, data) => axiosInstance.put(`/api/production/employee-groups/${id}/`, data),
    deleteEmployeeGroup: (id) => axiosInstance.delete(`/api/production/employee-groups/${id}/`),

    // --- Employee Group Members ---
    getEmployeeGroupMembers: (params = '') => axiosInstance.get(`/api/production/employee-group-members/${params}`),

    // --- Cross-Domain Helpers ---
    getEmployees: (params = '') => axiosInstance.get(`/api/hr/employees/${params}`),
    getDepartmentDesignations: (params = '') => axiosInstance.get(`/api/hr/department-designations/${params}`),
    getStockItems: (params = '') => axiosInstance.get(`/api/inventory/stock-items/${params}`),
    getFactories: (params = '') => axiosInstance.get(`/api/settings/factories/${params}`),
};

export default ProductionService;
