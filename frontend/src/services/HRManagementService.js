import axiosInstance from './AxiosInstance';

/**
 * HR Management Service
 * Handles all employee/HR-related API calls
 */

const HR_API_BASE = '/api/hr';
const AUTH_API_BASE = '/api/auth';

/**
 * Format error object into a clean, human-friendly message for clients.
 */
export function formatFriendlyError(error, fallbackMsg = 'An error occurred') {
    if (!error) return fallbackMsg;
    
    let rawData = error.response?.data || error.data || error;

    const extractString = (val) => {
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.map(extractString).filter(Boolean).join(', ');
        if (typeof val === 'object' && val !== null) {
            return Object.values(val).map(extractString).filter(Boolean).join(', ');
        }
        return String(val || '');
    };

    const cleanMessage = (key, msgVal) => {
        let msgStr = extractString(msgVal);
        let lower = msgStr.toLowerCase();
        let fieldName = (!key || key.toLowerCase() === 'non_field_errors' || key.toLowerCase() === 'detail')
            ? ''
            : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        // 1. Unique constraint / Duplicate entry check
        if (lower.includes('must make a unique set') || lower.includes('already exists') || lower.includes('must be unique')) {
            if (fieldName) {
                return `Duplicate Entry: A record with this ${fieldName.toLowerCase()} already exists.`;
            }
            return `Duplicate Entry: An entry with these details already exists.`;
        }

        // 2. Required field check
        if (lower.includes('this field is required') || lower.includes('may not be null') || lower.includes('may not be blank')) {
            return `${fieldName || 'This field'} is required.`;
        }

        // Clean any residual DRF noise
        msgStr = msgStr.replace(/The fields (.+) must make a unique set\.?/gi, 'Duplicate Entry: An entry with these details already exists.');
        msgStr = msgStr.replace(/NON_FIELD_ERRORS:?\s*/gi, '');
        msgStr = msgStr.replace(/non_field_errors:?\s*/gi, '');

        return fieldName ? `${fieldName}: ${msgStr}` : msgStr;
    };

    if (typeof rawData === 'string') {
        return cleanMessage('', rawData);
    }

    if (typeof rawData === 'object' && rawData !== null) {
        if (rawData.detail) {
            return cleanMessage('', rawData.detail);
        }

        const messages = [];
        for (const [key, value] of Object.entries(rawData)) {
            messages.push(cleanMessage(key, value));
        }

        if (messages.length > 0) {
            return messages.join('\n');
        }
    }

    return error.message || fallbackMsg;
}

// ==================== CACHE STATE ====================
let hrCache = {
    departments: null,
    departmentsTime: 0,
    users: null,
    usersTime: 0
};
const CACHE_DURATION = 60000; // 60 seconds

// ==================== DEPARTMENT APIS ====================

/**
 * Get all departments
 * @returns {Promise} Array of department objects
 */
export const getDepartments = async () => {
    if (hrCache.departments && (Date.now() - hrCache.departmentsTime < CACHE_DURATION)) {
        return hrCache.departments;
    }
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/departments/`);
        hrCache.departments = response.data;
        hrCache.departmentsTime = Date.now();
        return response.data;
    } catch (error) {
        console.error('Error fetching departments:', error);
        throw error;
    }
};

/**
 * Get single department by ID
 * @param {number} id - Department ID
 * @returns {Promise} Department object
 */
export const getDepartmentById = async (id) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/departments/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching department ${id}:`, error);
        throw error;
    }
};

/**
 * Create new department
 * @param {object} departmentData - {name, is_active}
 * @returns {Promise} Created department object
 */
export const createDepartment = async (departmentData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/departments/`, departmentData);
        hrCache.departments = null; // Invalidate cache
        return response.data;
    } catch (error) {
        console.error('Error creating department:', error);
        throw error;
    }
};

/**
 * Update department
 * @param {number} id - Department ID
 * @param {object} departmentData - Updated data
 * @returns {Promise} Updated department object
 */
export const updateDepartment = async (id, departmentData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/departments/${id}/`, departmentData);
        return response.data;
    } catch (error) {
        console.error(`Error updating department ${id}:`, error);
        throw error;
    }
};

/**
 * Partially update department
 * @param {number} id - Department ID
 * @param {object} departmentData - Partial data to update
 * @returns {Promise} Updated department object
 */
export const patchDepartment = async (id, departmentData) => {
    try {
        const response = await axiosInstance.patch(`${HR_API_BASE}/departments/${id}/`, departmentData);
        return response.data;
    } catch (error) {
        console.error(`Error patching department ${id}:`, error);
        throw error;
    }
};

/**
 * Delete department
 * @param {number} id - Department ID
 * @returns {Promise} Response object
 */
export const deleteDepartment = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/departments/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting department ${id}:`, error);
        throw error;
    }
};

// ==================== DESIGNATION APIS ====================

/**
 * Get all designations
 * @param {number} departmentId - Optional filter by department
 * @returns {Promise} Array of designation objects
 */
export const getDesignations = async (departmentId = null) => {
    try {
        const params = departmentId ? { department: departmentId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/designations/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching designations:', error);
        throw error;
    }
};

/**
 * Create new designation
 * @param {object} designationData - {title, department, level, is_active}
 * @returns {Promise} Created designation object
 */
export const createDesignation = async (designationData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/designations/`, designationData);
        return response.data;
    } catch (error) {
        console.error('Error creating designation:', error);
        throw error;
    }
};

/**
 * Update designation
 * @param {number} id - Designation ID
 * @param {object} designationData - Updated data
 * @returns {Promise} Updated designation object
 */
export const updateDesignation = async (id, designationData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/designations/${id}/`, designationData);
        return response.data;
    } catch (error) {
        console.error(`Error updating designation ${id}:`, error);
        throw error;
    }
};

/**
 * Delete designation
 * @param {number} id - Designation ID
 * @returns {Promise} Response object
 */
export const deleteDesignation = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/designations/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting designation ${id}:`, error);
        throw error;
    }
};

// ==================== CANDIDATE APIS ====================

/**
 * Get all candidates
 * @param {string} status - Optional filter by status (Pending, Selected, Rejected, etc.)
 * @param {boolean} withoutUser - Optional filter to exclude candidates with user accounts
 * @param {number} positionApplied - Optional filter by position_applied ID
 * @returns {Promise} Array of candidate objects
 */
export const getCandidates = async (status = null, withoutUser = false, positionApplied = null, departmentApplied = null) => {
    try {
        const params = {};
        if (status) params.status = status;
        if (withoutUser) params.without_user = 'true';
        if (positionApplied) params.position_applied = positionApplied;
        if (departmentApplied) params.department_applied = departmentApplied;

        const response = await axiosInstance.get(`${HR_API_BASE}/candidates/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching candidates:', error);
        throw error;
    }
};

/**
 * Get single candidate by ID
 * @param {number} id - Candidate ID
 * @returns {Promise} Candidate object
 */
export const getCandidateById = async (id) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/candidates/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching candidate ${id}:`, error);
        throw error;
    }
};

export const updateCandidateStatus = async (id, status) => {
    try {
        const response = await axiosInstance.patch(`${HR_API_BASE}/candidates/${id}/`, { status });
        return response.data;
    } catch (error) {
        console.error(`Error updating status for candidate ${id}:`, error);
        throw error;
    }
};

/**
 * Update candidate interview schedule
 * @param {number} id - Candidate ID
 * @param {object} data - { interview_date, interviewer }
 * @returns {Promise} Updated candidate object
 */
export const updateCandidateInterview = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`${HR_API_BASE}/candidates/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error scheduling interview for candidate ${id}:`, error);
        throw error;
    }
};

/**
 * Create new candidate
 * @param {object} candidateData - Candidate information with FormData for file upload
 * @returns {Promise} Created candidate object
 */
export const createCandidate = async (candidateData) => {
    try {
        const formData = new FormData();

        // Fields that the serializer rejects as empty string (must be omitted or null)
        const nullableFields = [
            'date_of_birth', 'expected_salary', 'experience_years',
            'position_applied', 'department_applied', 'gender'
        ];

        // Add all fields to FormData
        Object.keys(candidateData).forEach(key => {
            const value = candidateData[key];
            if (value === null || value === undefined) return;
            // Only send actual File objects for file fields
            if ((key === 'photo' || key === 'resume') && !(value instanceof File)) return;
            // Skip empty strings for optional nullable fields
            if (nullableFields.includes(key) && value === '') return;

            formData.append(key, value);
        });

        const response = await axiosInstance.post(`${HR_API_BASE}/candidates/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error creating candidate:', error);
        throw error;
    }
};

/**
 * Update candidate
 * @param {number} id - Candidate ID
 * @param {object} candidateData - Updated candidate data
 * @returns {Promise} Updated candidate object
 */
export const updateCandidate = async (id, candidateData) => {
    try {
        const formData = new FormData();

        // Fields that should be sent as null (not empty string) when blank
        const nullableFields = [
            'date_of_birth', 'expected_salary', 'experience_years',
            'position_applied', 'department_applied', 'gender'
        ];

        Object.keys(candidateData).forEach(key => {
            const value = candidateData[key];
            // Skip null/undefined values entirely (keeps existing DB value via PATCH)
            if (value === null || value === undefined) return;
            // Skip photo/resume strings (only send actual File objects)
            if ((key === 'photo' || key === 'resume') && !(value instanceof File)) return;
            // Convert empty strings to empty for nullable optional fields — send nothing
            if (nullableFields.includes(key) && value === '') return;

            formData.append(key, value);
        });

        const response = await axiosInstance.patch(`${HR_API_BASE}/candidates/${id}/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating candidate ${id}:`, error);
        throw error;
    }
};

/**
 * Mark candidate as selected
 * @param {number} id - Candidate ID
 * @returns {Promise} Response object
 */
export const selectCandidate = async (id) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/candidates/${id}/select/`);
        return response.data;
    } catch (error) {
        console.error(`Error selecting candidate ${id}:`, error);
        throw error;
    }
};

/**
 * Delete candidate
 * @param {number} id - Candidate ID
 * @returns {Promise} Response object
 */
export const deleteCandidate = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/candidates/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting candidate ${id}:`, error);
        throw error;
    }
};

// ==================== EMPLOYEE APIS ====================

/**
 * Get all employees
 * @param {number} departmentId - Optional filter by department
 * @returns {Promise} Array of employee objects
 */
export const getEmployees = async (departmentId = null, includeBod = false) => {
    try {
        const params = {};
        if (departmentId) params.department = departmentId;
        if (includeBod) params.include_bod = 'true';
        const response = await axiosInstance.get(`${HR_API_BASE}/employees/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employees:', error);
        throw error;
    }
};

/**
 * Get single employee by ID
 * @param {number} id - Employee ID
 * @returns {Promise} Employee object
 */
export const getEmployeeById = async (id) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/employees/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching employee ${id}:`, error);
        throw error;
    }
};

/**
 * Get eligible reporting managers: employees in a given department.
 * @param {number} departmentId - The department to filter by
 * @param {number|null} maxLevel - If provided, only employees with designation level < maxLevel are returned.
 *                                 If null/undefined, all employees in the department are returned.
 * @returns {Promise} Array of employee objects
 */
export const getManagersForEmployee = async (departmentId, maxLevel = null) => {
    try {
        const params = { department_id: departmentId };
        if (maxLevel != null) params.max_level = maxLevel;
        const response = await axiosInstance.get(`${HR_API_BASE}/employees/`, { params });
        return response.data?.results || response.data || [];
    } catch (error) {
        console.error('Error fetching managers:', error);
        throw error;
    }
};

/**
 * Create new employee
 * @param {object} employeeData - Employee information
 * @returns {Promise} Created employee object
 */
export const createEmployee = async (employeeData) => {
    try {
        const formData = new FormData();

        Object.keys(employeeData).forEach(key => {
            if (employeeData[key] !== null && employeeData[key] !== undefined) {
                if (key === 'profile_picture' && employeeData[key] instanceof File) {
                    formData.append(key, employeeData[key]);
                } else {
                    formData.append(key, employeeData[key]);
                }
            }
        });

        const response = await axiosInstance.post(`${HR_API_BASE}/employees/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error creating employee:', error);
        throw error;
    }
};

/**
 * Update employee
 * @param {number} id - Employee ID
 * @param {object} employeeData - Updated data
 * @returns {Promise} Updated employee object
 */
export const updateEmployee = async (id, employeeData) => {
    try {
        const formData = new FormData();

        Object.keys(employeeData).forEach(key => {
            if (employeeData[key] !== null && employeeData[key] !== undefined) {
                if (key === 'profile_picture' && employeeData[key] instanceof File) {
                    formData.append(key, employeeData[key]);
                } else {
                    formData.append(key, employeeData[key]);
                }
            }
        });

        const response = await axiosInstance.put(`${HR_API_BASE}/employees/${id}/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating employee ${id}:`, error);
        throw error;
    }
};

/**
 * Delete employee
 * @param {number} id - Employee ID
 * @returns {Promise} Response object
 */
export const deleteEmployee = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/employees/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting employee ${id}:`, error);
        throw error;
    }
};

/**
 * Delete employee
 * @param {number} id - Employee ID
 * @returns {Promise} Response object
 */
export const deleteEmployeeDutyStatus = async (id) => {
    try {
        await axiosInstance.delete(`${HR_API_BASE}/employee-duty-status/${id}/`);
        return true;
    } catch (error) {
        console.error(`Error deleting employee duty status ${id}:`, error);
        throw error;
    }
};

// ==================== CUSTOMER APIS ====================

export const getCustomerTypes = async () => {
    try {
        const response = await axiosInstance.get(`/api/hrm/customer-types/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching customer types:', error);
        throw error;
    }
};

export const createCustomerType = async (data) => {
    try {
        const response = await axiosInstance.post(`/api/hrm/customer-types/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating customer type:', error);
        throw error;
    }
};

export const updateCustomerType = async (id, data) => {
    try {
        const response = await axiosInstance.put(`/api/hrm/customer-types/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating customer type ${id}:`, error);
        throw error;
    }
};

export const deleteCustomerType = async (id) => {
    try {
        await axiosInstance.delete(`/api/hrm/customer-types/${id}/`);
        return true;
    } catch (error) {
        console.error(`Error deleting customer type ${id}:`, error);
        throw error;
    }
};

export const createHrCustomer = async (endpoint, data) => {
    try {
        const response = await axiosInstance.post(`/api/hrm/${endpoint}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error creating customer in ${endpoint}:`, error);
        throw error;
    }
};

export const updateHrCustomer = async (endpoint, id, data) => {
    try {
        const response = await axiosInstance.put(`/api/hrm/${endpoint}/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating customer in ${endpoint}:`, error);
        throw error;
    }
};

export const deleteHrCustomer = async (endpoint, id) => {
    try {
        await axiosInstance.delete(`/api/hrm/${endpoint}/${id}/`);
        return true;
    } catch (error) {
        console.error(`Error deleting customer in ${endpoint}:`, error);
        throw error;
    }
};

export const getHrDistributors = async () => {
    try {
        const response = await axiosInstance.get('/api/hrm/hr-distributors/');
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    } catch (error) {
        console.error('Error fetching HR distributors:', error);
        throw error;
    }
};

export const getHrVendors = async () => {
    try {
        const response = await axiosInstance.get('/api/hrm/hr-vendors/');
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    } catch (error) {
        console.error('Error fetching HR vendors:', error);
        throw error;
    }
};

export const getHrOtherCustomers = async () => {
    try {
        const response = await axiosInstance.get('/api/hrm/hr-other-customers/');
        return Array.isArray(response.data) ? response.data : (response.data.results || []);
    } catch (error) {
        console.error('Error fetching HR other customers:', error);
        throw error;
    }
};


// ==================== OFFICE LOCATION APIS ====================

/**
 * Get all office locations
 * @returns {Promise} Array of office location objects
 */
export const getOfficeLocations = async () => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/office-locations/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching office locations:', error);
        throw error;
    }
};

/**
 * Create new office location
 * @param {object} locationData - Office location data
 * @returns {Promise} Created location object
 */
export const createOfficeLocation = async (locationData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/office-locations/`, locationData);
        return response.data;
    } catch (error) {
        console.error('Error creating office location:', error);
        throw error;
    }
};

/**
 * Update office location
 * @param {number} id - Location ID
 * @param {object} locationData - Updated data
 * @returns {Promise} Updated location object
 */
export const updateOfficeLocation = async (id, locationData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/office-locations/${id}/`, locationData);
        return response.data;
    } catch (error) {
        console.error(`Error updating office location ${id}:`, error);
        throw error;
    }
};

/**
 * Delete office location
 * @param {number} id - Location ID
 * @returns {Promise} Response object
 */
export const deleteOfficeLocation = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/office-locations/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting office location ${id}:`, error);
        throw error;
    }
};

// ==================== EMPLOYMENT DETAILS APIS ====================

/**
 * Get employment details for a candidate/user
 * @param {number} userId - User/Candidate ID
 * @returns {Promise} Employment details object
 */
export const getEmploymentDetails = async (userId = null) => {
    try {
        const params = userId ? { user: userId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/employment-details/`, { params });
        // Return first item if filtering by user, otherwise return all
        return userId && response.data.length > 0 ? response.data[0] : response.data;
    } catch (error) {
        console.error('Error fetching employment details:', error);
        throw error;
    }
};

/**
 * Create employment details
 * @param {object} detailsData - Employment details data
 * @returns {Promise} Created details object
 */
export const createEmploymentDetails = async (detailsData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/employment-details/`, detailsData);
        return response.data;
    } catch (error) {
        console.error('Error creating employment details:', error);
        throw error;
    }
};

/**
 * Update employment details
 * @param {number} id - Details ID
 * @param {object} detailsData - Updated data
 * @returns {Promise} Updated details object
 */
export const updateEmploymentDetails = async (id, detailsData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/employment-details/${id}/`, detailsData);
        return response.data;
    } catch (error) {
        console.error(`Error updating employment details ${id}:`, error);
        throw error;
    }
};

// ==================== BANK DETAILS APIS ====================

/**
 * Get bank details for a candidate/user
 * @param {number} userId - User/Candidate ID
 * @returns {Promise} Bank details object
 */
export const getBankDetails = async (userId = null) => {
    try {
        const params = userId ? { user: userId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/bank-details/`, { params });
        // Return first item if filtering by user, otherwise return all
        return userId && response.data.length > 0 ? response.data[0] : response.data;
    } catch (error) {
        console.error('Error fetching bank details:', error);
        throw error;
    }
};

/**
 * Create bank details
 * @param {object} bankData - Bank details data
 * @returns {Promise} Created bank details object
 */
export const createBankDetails = async (bankData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/bank-details/`, bankData);
        return response.data;
    } catch (error) {
        console.error('Error creating bank details:', error);
        throw error;
    }
};

/**
 * Update bank details
 * @param {number} id - Bank details ID
 * @param {object} bankData - Updated data
 * @returns {Promise} Updated bank details object
 */
export const updateBankDetails = async (id, bankData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/bank-details/${id}/`, bankData);
        return response.data;
    } catch (error) {
        console.error(`Error updating bank details ${id}:`, error);
        throw error;
    }
};

// ==================== SALARY BREAKUP APIS ====================

/**
 * Get salary breakup for a candidate/user
 * @param {number} userId - User/Candidate ID
 * @returns {Promise} Salary breakup object
 */
export const getSalaryBreakup = async (userId = null) => {
    try {
        const params = userId ? { user: userId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/salary-breakup/`, { params });
        // Return first item if filtering by user, otherwise return all
        return userId && response.data.length > 0 ? response.data[0] : response.data;
    } catch (error) {
        console.error('Error fetching salary breakup:', error);
        throw error;
    }
};

/**
 * Create salary breakup
 * @param {object} salaryData - Salary breakup data
 * @returns {Promise} Created salary breakup object
 */
export const createSalaryBreakup = async (salaryData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/salary-breakup/`, salaryData);
        return response.data;
    } catch (error) {
        console.error('Error creating salary breakup:', error);
        throw error;
    }
};

/**
 * Update salary breakup
 * @param {number} id - Salary breakup ID
 * @param {object} salaryData - Updated data
 * @returns {Promise} Updated salary breakup object
 */
export const updateSalaryBreakup = async (id, salaryData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/salary-breakup/${id}/`, salaryData);
        return response.data;
    } catch (error) {
        console.error(`Error updating salary breakup ${id}:`, error);
        throw error;
    }
};

// ==================== DOCUMENT UPLOAD APIS ====================

/**
 * Get employee documents
 * @param {number} userId - User/Candidate ID
 * @returns {Promise} Array of document objects
 */
export const getEmployeeDocuments = async (userId = null) => {
    try {
        const params = userId ? { user: userId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/documents/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employee documents:', error);
        throw error;
    }
};

/**
 * Upload employee document
 * @param {object} documentData - Document data with file
 * @returns {Promise} Created document object
 */
export const uploadEmployeeDocument = async (documentData) => {
    try {
        const formData = new FormData();

        Object.keys(documentData).forEach(key => {
            if (documentData[key] !== null && documentData[key] !== undefined) {
                if (key === 'document_file' && documentData[key] instanceof File) {
                    formData.append(key, documentData[key]);
                } else {
                    formData.append(key, documentData[key]);
                }
            }
        });

        const response = await axiosInstance.post(`${HR_API_BASE}/documents/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error uploading document:', error);
        throw error;
    }
};

/**
 * Delete employee document
 * @param {number} id - Document ID
 * @returns {Promise} Response object
 */
export const deleteEmployeeDocument = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/documents/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting document ${id}:`, error);
        throw error;
    }
};

// ==================== ATTENDANCE SETTINGS APIS ====================

/**
 * Get attendance settings for a user
 * @param {number} userId - User/Candidate ID
 * @returns {Promise} Attendance settings object
 */
export const getAttendanceSettings = async (userId = null) => {
    try {
        const params = userId ? { user: userId } : {};
        const response = await axiosInstance.get(`${HR_API_BASE}/attendance-settings/`, { params });
        // Return first item if filtering by user, otherwise return all
        return userId && response.data.length > 0 ? response.data[0] : response.data;
    } catch (error) {
        console.error('Error fetching attendance settings:', error);
        throw error;
    }
};

/**
 * Create attendance settings
 * @param {object} settingsData - Attendance settings data
 * @returns {Promise} Created settings object
 */
export const createAttendanceSettings = async (settingsData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/attendance-settings/`, settingsData);
        return response.data;
    } catch (error) {
        console.error('Error creating attendance settings:', error);
        throw error;
    }
};

/**
 * Update attendance settings
 * @param {number} id - Settings ID
 * @param {object} settingsData - Updated data
 * @returns {Promise} Updated settings object
 */
export const updateAttendanceSettings = async (id, settingsData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/attendance-settings/${id}/`, settingsData);
        return response.data;
    } catch (error) {
        console.error(`Error updating attendance settings ${id}:`, error);
        throw error;
    }
};

// Wrapper functions for consistency with form naming
export const getAttendanceSetting = getAttendanceSettings;
export const createAttendanceSetting = createAttendanceSettings;
export const updateAttendanceSetting = updateAttendanceSettings;

// ==================== USER APIS ====================

/**
 * Get all users for dropdown selections (e.g., reporting manager)
 * @returns {Promise} Array of user objects
 */
export const getUsers = async (params = {}) => {
    if (Object.keys(params).length === 0 && hrCache.users && (Date.now() - hrCache.usersTime < CACHE_DURATION)) {
        return hrCache.users;
    }
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/users/`, { params });
        if (Object.keys(params).length === 0) {
            hrCache.users = response.data;
            hrCache.usersTime = Date.now();
        }
        return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
};

/**
 * Create new user (creates both CustomUser and Employee)
 * @param {FormData} userData - User data with employee fields
 * @returns {Promise} Created user object
 */
export const createUser = async (userData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/users/`, userData);
        hrCache.users = null; // Invalidate cache
        return response.data;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
};

/**
 * Update user (updates both CustomUser and Employee)
 * @param {number} id - User ID
 * @param {FormData} userData - Updated user data
 * @returns {Promise} Updated user object
 */
export const updateUser = async (id, userData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/users/${id}/`, userData);
        return response.data;
    } catch (error) {
        console.error(`Error updating user ${id}:`, error);
        throw error;
    }
};

// ==========================================
// Board of Directors (BOD)
// ==========================================

export const getBODs = async () => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/bod/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching BODs:', error);
        throw error;
    }
};

export const getBOD = async (id) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/bod/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching BOD ${id}:`, error);
        throw error;
    }
};

export const createBOD = async (bodData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/bod/`, bodData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error creating BOD:', error);
        throw error;
    }
};

export const updateBOD = async (id, bodData) => {
    try {
        const response = await axiosInstance.patch(`${HR_API_BASE}/bod/${id}/`, bodData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating BOD ${id}:`, error);
        throw error;
    }
};

export const deleteBOD = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/bod/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting BOD ${id}:`, error);
        throw error;
    }
};

export const deleteBoardOfDirector = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/hr/bod/${id}/`);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// ==================== RESPONSIBILITY REMINDER APIS ====================

export const getResponsibilityReminders = async () => {
    try {
        const response = await axiosInstance.get(`/api/hrm/responsibility-reminders/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching responsibility reminders:', error);
        throw error;
    }
};

export const createResponsibilityReminder = async (data) => {
    try {
        const response = await axiosInstance.post(`/api/hrm/responsibility-reminders/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating responsibility reminder:', error);
        throw error;
    }
};

export const updateResponsibilityReminder = async (id, data) => {
    try {
        const response = await axiosInstance.patch(`/api/hrm/responsibility-reminders/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating responsibility reminder ${id}:`, error);
        throw error;
    }
};

export const deleteResponsibilityReminder = async (id) => {
    try {
        const response = await axiosInstance.delete(`/api/hrm/responsibility-reminders/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting responsibility reminder ${id}:`, error);
        throw error;
    }
};

export const getPendingResponsibilityReminders = async () => {
    try {
        const response = await axiosInstance.get(`/api/hrm/responsibility-reminders-detail/pending_reminders/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching pending responsibility reminders:', error);
        throw error;
    }
};

export const acknowledgeResponsibilityReminder = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/hrm/responsibility-reminders/${id}/acknowledge/`);
        return response.data;
    } catch (error) {
        console.error(`Error acknowledging responsibility reminder ${id}:`, error);
        throw error;
    }
};

/**
 * Delete user (deletes CustomUser and cascades to Employee)
 * @param {number} id - User ID
 * @returns {Promise} Response object
 */
export const deleteUser = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/users/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting user ${id}:`, error);
        throw error;
    }
};

// ==================== WORK EXPERIENCE APIS ====================

/**
 * Get work experiences for a candidate
 */
export const getWorkExperiences = async (candidateId) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/work-experiences/?employee_id=${candidateId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching work experiences:', error);
        throw error;
    }
};

/**
 * Create a new work experience
 */
export const createWorkExperience = async (experienceData) => {
    try {
        const formData = new FormData();
        Object.keys(experienceData).forEach(key => {
            if (experienceData[key] !== null && experienceData[key] !== undefined && experienceData[key] !== '') {
                if (['experience_certificate', 'relieving_letter', 'salary_slip'].includes(key) && experienceData[key] instanceof File) {
                    formData.append(key, experienceData[key]);
                } else if (!['experience_certificate', 'relieving_letter', 'salary_slip'].includes(key) || !(experienceData[key] instanceof File)) {
                    if (typeof experienceData[key] !== 'object' || experienceData[key] instanceof File) {
                        formData.append(key, experienceData[key]);
                    }
                }
            }
        });
        const response = await axiosInstance.post(`${HR_API_BASE}/work-experiences/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error creating work experience:', error);
        throw error;
    }
};

/**
 * Update an existing work experience
 */
export const updateWorkExperience = async (id, experienceData) => {
    try {
        const formData = new FormData();
        Object.keys(experienceData).forEach(key => {
            if (experienceData[key] !== null && experienceData[key] !== undefined) {
                if (['experience_certificate', 'relieving_letter', 'salary_slip'].includes(key)) {
                    if (experienceData[key] instanceof File) {
                        formData.append(key, experienceData[key]);
                    }
                } else {
                    formData.append(key, experienceData[key]);
                }
            }
        });
        const response = await axiosInstance.put(`${HR_API_BASE}/work-experiences/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating work experience ${id}:`, error);
        throw error;
    }
};

/**
 * Delete a work experience
 */
export const deleteWorkExperience = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/work-experiences/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting work experience ${id}:`, error);
        throw error;
    }
};


// Export all functions as a named object
const HRManagementService = {
    // Departments
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    patchDepartment,
    deleteDepartment,

    // Designations
    getDesignations,
    createDesignation,
    updateDesignation,
    deleteDesignation,

    // Candidates
    getCandidates,
    getCandidateById,
    createCandidate,
    updateCandidate,
    selectCandidate,
    deleteCandidate,

    // Employees
    getEmployees,
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,

    // Office Locations
    getOfficeLocations,
    createOfficeLocation,
    updateOfficeLocation,
    deleteOfficeLocation,

    // Employment Details
    getEmploymentDetails,
    createEmploymentDetails,
    updateEmploymentDetails,

    // Bank Details
    getBankDetails,
    createBankDetails,
    updateBankDetails,

    // Salary Breakup
    getSalaryBreakup,
    createSalaryBreakup,
    updateSalaryBreakup,

    // Documents
    getEmployeeDocuments,
    uploadEmployeeDocument,
    deleteEmployeeDocument,

    // Work Experiences
    getWorkExperiences,
    createWorkExperience,
    updateWorkExperience,
    deleteWorkExperience,

    // Attendance Settings
    getAttendanceSettings,
    createAttendanceSettings,
    updateAttendanceSettings,

    // Aliases (singular forms for backward compatibility)
    getAttendanceSetting: getAttendanceSettings,
    createAttendanceSetting: createAttendanceSettings,
    updateAttendanceSetting: updateAttendanceSettings,

    // Users
    getUsers,
    createUser: async (userData) => {
        try {
            const response = await axiosInstance.post(`${HR_API_BASE}/users/`, userData);
            return response.data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    },
    updateUser: async (id, userData) => {
        try {
            const response = await axiosInstance.put(`${HR_API_BASE}/users/${id}/`, userData);
            return response.data;
        } catch (error) {
            console.error(`Error updating user ${id}:`, error);
            throw error;
        }
    },
    deleteUser: async (id) => {
        try {
            const response = await axiosInstance.delete(`${HR_API_BASE}/users/${id}/`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting user ${id}:`, error);
            throw error;
        }
    }
};

export default HRManagementService;
// ==================== DEPARTMENT DESIGNATION APIS ====================

/**
 * Get all department-designation mappings
 * @returns {Promise} Array of mapping objects
 */
export const getDepartmentDesignations = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/department-designations/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching department-designations:', error);
        throw error;
    }
};

/**
 * Create new department-designation mapping
 * @param {object} mappingData - {company, department, designation}
 * @returns {Promise} Created mapping object
 */
export const createDepartmentDesignation = async (mappingData) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/department-designations/`, mappingData);
        return response.data;
    } catch (error) {
        console.error('Error creating department-designation:', error);
        throw error;
    }
};

/**
 * Update department-designation mapping
 * @param {number} id - Mapping ID
 * @param {object} mappingData - Updated data
 * @returns {Promise} Updated mapping object
 */
export const updateDepartmentDesignation = async (id, mappingData) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/department-designations/${id}/`, mappingData);
        return response.data;
    } catch (error) {
        console.error(`Error updating department-designation ${id}:`, error);
        throw error;
    }
};

/**
 * Delete department-designation mapping
 * @param {number} id - Mapping ID
 * @returns {Promise} Response object
 */
export const deleteDepartmentDesignation = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/department-designations/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting department-designation ${id}:`, error);
        throw error;
    }
};
// ==================== ROLE APIS ====================

/**
 * Get all roles
 * @returns {Promise} Array of role objects
 */
export const getRoles = async () => {
    try {
        const response = await axiosInstance.get(`${AUTH_API_BASE}/roles/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching roles:', error);
        throw error;
    }
};

/**
 * Create new role
 * @param {object} roleData - {name, description}
 * @returns {Promise} Created role object
 */
export const createRole = async (roleData) => {
    try {
        const response = await axiosInstance.post(`${AUTH_API_BASE}/roles/`, roleData);
        return response.data;
    } catch (error) {
        console.error('Error creating role:', error);
        throw error;
    }
};

/**
 * Update role
 * @param {number} id - Role ID
 * @param {object} roleData - Updated data
 * @returns {Promise} Updated role object
 */
export const updateRole = async (id, roleData) => {
    try {
        const response = await axiosInstance.put(`${AUTH_API_BASE}/roles/${id}/`, roleData);
        return response.data;
    } catch (error) {
        console.error(`Error updating role ${id}:`, error);
        throw error;
    }
};

/**
 * Delete role
 * @param {number} id - Role ID
 * @returns {Promise} Response object
 */
export const deleteRole = async (id) => {
    try {
        const response = await axiosInstance.delete(`${AUTH_API_BASE}/roles/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting role ${id}:`, error);
        throw error;
    }
};

export const getDashboards = async () => {
    try {
        const response = await axiosInstance.get(`${AUTH_API_BASE}/dashboards/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching dashboards:', error);
        throw error;
    }
};

export const createDashboard = async (dashboardData) => {
    try {
        const response = await axiosInstance.post(`${AUTH_API_BASE}/dashboards/`, dashboardData);
        return response.data;
    } catch (error) {
        console.error('Error creating dashboard:', error);
        throw error;
    }
};

export const updateDashboard = async (id, dashboardData) => {
    try {
        const response = await axiosInstance.put(`${AUTH_API_BASE}/dashboards/${id}/`, dashboardData);
        return response.data;
    } catch (error) {
        console.error(`Error updating dashboard ${id}:`, error);
        throw error;
    }
};

export const deleteDashboard = async (id) => {
    try {
        const response = await axiosInstance.delete(`${AUTH_API_BASE}/dashboards/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting dashboard ${id}:`, error);
        throw error;
    }
};
// ==================== DUTY AND RESPONSIBILITY APIS ====================

const HRM_API_BASE_HR = '/api/hrm';

export const getDutyNames = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/dutynames/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching duty names:', error);
        throw error;
    }
};

export const createDutyName = async (data) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE_HR}/dutynames/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating duty name:', error);
        throw error;
    }
};

export const updateDutyName = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${HRM_API_BASE_HR}/dutynames/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating duty name ${id}:`, error);
        throw error;
    }
};

export const deleteDutyName = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HRM_API_BASE_HR}/dutynames/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting duty name ${id}:`, error);
        throw error;
    }
};

export const getResponsibilities = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/responsibilities/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching responsibilities:', error);
        throw error;
    }
};

export const createResponsibility = async (data) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE_HR}/responsibilities/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating responsibility:', error);
        throw error;
    }
};

export const updateResponsibility = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${HRM_API_BASE_HR}/responsibilities/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating responsibility ${id}:`, error);
        throw error;
    }
};

export const deleteResponsibility = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HRM_API_BASE_HR}/responsibilities/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting responsibility ${id}:`, error);
        throw error;
    }
};

export const getAssignDuties = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/assignduties/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching assign duties:', error);
        throw error;
    }
};

export const createAssignDuty = async (data) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE_HR}/assignduties/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating assign duty:', error);
        throw error;
    }
};

export const updateAssignDuty = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${HRM_API_BASE_HR}/assignduties/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating assign duty ${id}:`, error);
        throw error;
    }
};

export const deleteAssignDuty = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HRM_API_BASE_HR}/assignduties/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting assign duty ${id}:`, error);
        throw error;
    }
};


// ==================== PERSON-WISE DUTY APIS ====================

export const getHREmployeesList = async (params) => {
    try {
        const response = await axiosInstance.get(HR_API_BASE + '/employees/', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching HR employees:', error);
        throw error;
    }
};


// -------------------------------------------------------------
// Employee Duty Status API
// -------------------------------------------------------------

export const getEmployeeDutyStatusByEmployee = async (employeeId) => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/employee-duty-status/by-employee/${employeeId}/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching duty statuses for employee:', error);
        throw error;
    }
};

export const endEmployeeDutyResponsibility = async (statusId, endDate) => {
    try {
        const response = await axiosInstance.patch(`${HRM_API_BASE_HR}/employee-duty-status/${statusId}/end/`, { end_date: endDate });
        return response.data;
    } catch (error) {
        console.error('Error ending responsibility:', error);
        throw error;
    }
};

export const endEmployeeDuty = async (employeeId, dutyNameId, endDate) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE_HR}/employee-duty-status/end-duty/`, {
            employee_id: employeeId,
            duty_name_id: dutyNameId,
            end_date: endDate
        });
        return response.data;
    } catch (error) {
        console.error('Error ending duty:', error);
        throw error;
    }
};

export const getAllEmployeeDutyStatuses = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/employee-duty-status/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching all duty statuses:', error);
        throw error;
    }
};

export const submitResponsibilityUpdate = async (formData) => {
    try {
        const response = await axiosInstance.post(`${HRM_API_BASE_HR}/responsibility-updates/`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error submitting responsibility update:', error);
        throw error;
    }
};

export const getMySubmittedUpdates = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/responsibility-updates/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching submitted updates:', error);
        throw error;
    }
};

export const getReportResponsibilities = async () => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/responsibility-updates/report_responsibilities/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching report responsibilities:', error);
        throw error;
    }
};

export const getResponsibilityUpdatesForReport = async (responsibilityId) => {
    try {
        const response = await axiosInstance.get(`${HRM_API_BASE_HR}/responsibility-updates/report_updates/?responsibility_id=${responsibilityId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching responsibility updates for report:', error);
        throw error;
    }
};


export const getMyAssignedResponsibilityReminders = async () => {
    try {
        const response = await axiosInstance.get(`/api/hrm/responsibility-reminders-detail/my_assigned/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching assigned responsibility reminders:', error);
        throw error;
    }
};

export const getResponsibilityReminderDetailsForReport = async (responsibilityId) => {
    try {
        const response = await axiosInstance.get(`/api/hrm/responsibility-reminders-detail/report_details/?responsibility_id=${responsibilityId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching responsibility reminder details for report:', error);
        throw error;
    }
};

/**
 * Employee Department & Designation History APIs
 */
export const getEmployeeDepartmentHistory = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${HR_API_BASE}/employee-department-history/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching employee department history:', error);
        throw error;
    }
};

export const createEmployeeDepartmentHistory = async (data) => {
    try {
        const response = await axiosInstance.post(`${HR_API_BASE}/employee-department-history/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating employee department history:', error);
        throw error;
    }
};

export const updateEmployeeDepartmentHistory = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${HR_API_BASE}/employee-department-history/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating employee department history:', error);
        throw error;
    }
};

export const deleteEmployeeDepartmentHistory = async (id) => {
    try {
        const response = await axiosInstance.delete(`${HR_API_BASE}/employee-department-history/${id}/`);
        return response.data;
    } catch (error) {
        console.error('Error deleting employee department history:', error);
        throw error;
    }
};

