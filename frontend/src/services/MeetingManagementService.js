import axiosInstance from './AxiosInstance';

/**
 * Meeting Management Service
 * Handles all meeting-related API calls
 */

const MEETING_API_BASE = '/api/meeting';

// ==================== CATEGORY APIS ====================

/**
 * Get all categories
 * @returns {Promise} Array of category objects
 */
export const getCategories = async () => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/categories/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
    }
};

/**
 * Create new category
 * @param {object} data - {category_name, narration, prefix_code}
 * @returns {Promise} Created category object
 */
export const createCategory = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/categories/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating category:', error);
        throw error;
    }
};

/**
 * Update category
 * @param {number} id - Category ID
 * @param {object} data - Updated data
 * @returns {Promise} Updated category object
 */
export const updateCategory = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MEETING_API_BASE}/categories/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating category ${id}:`, error);
        throw error;
    }
};

/**
 * Delete category
 * @param {number} id - Category ID
 * @returns {Promise} Response object
 */
export const deleteCategory = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/categories/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting category ${id}:`, error);
        throw error;
    }
};

// ==================== SUBCATEGORY APIS ====================

/**
 * Get all subcategories
 * @returns {Promise} Array of subcategory objects
 */
export const getSubcategories = async () => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/subcategories/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        throw error;
    }
};

/**
 * Create new subcategory
 * @param {object} data - {subcategory_name, category, narration, prefix_code}
 * @returns {Promise} Created subcategory object
 */
export const createSubcategory = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/subcategories/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating subcategory:', error);
        throw error;
    }
};

/**
 * Update subcategory
 * @param {number} id - Subcategory ID
 * @param {object} data - Updated data
 * @returns {Promise} Updated subcategory object
 */
export const updateSubcategory = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MEETING_API_BASE}/subcategories/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating subcategory ${id}:`, error);
        throw error;
    }
};

/**
 * Delete subcategory
 * @param {number} id - Subcategory ID
 * @returns {Promise} Response object
 */
export const deleteSubcategory = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/subcategories/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting subcategory ${id}:`, error);
        throw error;
    }
};

// ==================== MEETING ROOM APIS ====================

/**
 * Get all meeting rooms
 * @returns {Promise} Array of meeting room objects
 */
export const getMeetingRooms = async () => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meeting-rooms/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meeting rooms:', error);
        throw error;
    }
};

/**
 * Create new meeting room
 * @param {object} data - Room data
 * @returns {Promise} Created meeting room object
 */
export const createMeetingRoom = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/meeting-rooms/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating meeting room:', error);
        throw error;
    }
};

/**
 * Update meeting room
 * @param {number} id - Room ID
 * @param {object} data - Updated data
 * @returns {Promise} Updated meeting room object
 */
export const updateMeetingRoom = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MEETING_API_BASE}/meeting-rooms/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating meeting room ${id}:`, error);
        throw error;
    }
};

/**
 * Delete meeting room
 * @param {number} id - Room ID
 * @returns {Promise} Response object
 */
export const deleteMeetingRoom = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/meeting-rooms/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting meeting room ${id}:`, error);
        throw error;
    }
};

// ==================== MEETING APIS ====================

/**
 * Get all meetings
 * @returns {Promise} Array of meeting objects
 */
export const getMeetings = async (params = {}) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meetings/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching meetings:', error);
        throw error;
    }
};

/**
 * Get single meeting by ID
 * @param {number} id - Meeting ID
 * @returns {Promise} Meeting object
 */
export const getMeetingById = async (id) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meetings/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching meeting ${id}:`, error);
        throw error;
    }
};

/**
 * Create new meeting
 * @param {object} data - Meeting data
 * @returns {Promise} Created meeting object
 */
export const createMeeting = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/meetings/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating meeting:', error);
        throw error;
    }
};

/**
 * Update meeting
 * @param {number} id - Meeting ID
 * @param {object} data - Updated data
 * @returns {Promise} Updated meeting object
 */
export const updateMeeting = async (id, data) => {
    try {
        const response = await axiosInstance.put(`${MEETING_API_BASE}/meetings/${id}/`, data);
        return response.data;
    } catch (error) {
        console.error(`Error updating meeting ${id}:`, error);
        throw error;
    }
};

/**
 * Delete meeting
 * @param {number} id - Meeting ID
 * @returns {Promise} Response object
 */
export const deleteMeeting = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/meetings/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting meeting ${id}:`, error);
        throw error;
    }
};

/**
 * Check room availability
 * @param {string} date - Meeting date
 * @param {string} startTime - Start time
 * @param {string} endTime - End time
 * @param {number} meetingId - Optional meeting ID to exclude (for edits)
 * @returns {Promise} Array of available rooms
 */
export const checkRoomAvailability = async (date, startTime, endTime, meetingId = null) => {
    try {
        const params = { date, start_time: startTime, end_time: endTime };
        if (meetingId) params.meeting_id = meetingId;
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meeting-rooms/check_availability/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error checking room availability:', error);
        throw error;
    }
};

/**
 * Get schedule for a specific room
 * @param {number} roomId - Room ID
 * @returns {Promise} Array of meetings for the room
 */
export const getRoomSchedule = async (roomId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meeting-rooms/${roomId}/schedule/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching schedule for room ${roomId}:`, error);
        throw error;
    }
};

/**
 * Get meetings assigned to an approver
 * @param {number} approverId - User ID of the approver (optional if using myApprovals)
 * @param {string} status - Optional status filter
 * @param {boolean} myApprovals - If true, filters by current logged in user on backend
 * @returns {Promise} Array of meeting objects
 */
export const getApproverMeetings = async (approverId = null, status = null, myApprovals = false) => {
    try {
        const params = {};
        if (myApprovals) params.my_approvals = 'true';
        else if (approverId) params.approver_id = approverId;

        if (status) params.status = status;
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meetings/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching approver meetings:', error);
        throw error;
    }
};

/**
 * Verify (Approve/Reject) a meeting
 * @param {number} id - Meeting ID
 * @param {string} status - 'approved' or 'rejected'
 * @returns {Promise} Response data
 */
export const verifyMeeting = async (id, status) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/meetings/${id}/verify/`, { status });
        return response.data;
    } catch (error) {
        console.error(`Error verifying meeting ${id}:`, error);
        throw error;
    }
};

// ==================== PARTICIPANT APIS ====================

/**
 * Get participants for a meeting (Detailed objects for display)
 * @param {number} meetingId 
 * @returns {Promise}
 */
export const getMeetingParticipants = async (meetingId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meetings/${meetingId}/participants/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meeting participants:', error);
        throw error;
    }
};

/**
 * Get the raw MeetingParticipant record for a meeting (with ManyToMany IDs)
 * @param {number} meetingId
 * @returns {Promise}
 */
export const getMeetingParticipantRecord = async (meetingId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meeting-participants/?meeting=${meetingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching meeting participant record:', error);
        throw error;
    }
};

/**
 * Create or Update meeting participants
 * @param {object} data - {meeting, participant: [id1, id2]}
 * @returns {Promise}
 */
export const saveMeetingParticipants = async (data) => {
    try {
        if (data.id) {
            const response = await axiosInstance.put(`${MEETING_API_BASE}/meeting-participants/${data.id}/`, data);
            return response.data;
        } else {
            const response = await axiosInstance.post(`${MEETING_API_BASE}/meeting-participants/`, data);
            return response.data;
        }
    } catch (error) {
        console.error('Error saving meeting participants:', error);
        throw error;
    }
};

/**
 * Check if any participants have a scheduling conflict (already in an
 * APPROVED meeting on the same date with overlapping time).
 * @param {number} meetingId
 * @param {number[]} participantIds
 * @returns {Promise<{conflicts: {id: number, name: string}[]}>}
 */
export const checkParticipantConflicts = async (meetingId, participantIds) => {
    try {
        const response = await axiosInstance.post(
            `${MEETING_API_BASE}/meeting-participants/check_conflicts/`,
            { meeting_id: meetingId, participant_ids: participantIds }
        );
        return response.data;
    } catch (error) {
        console.error('Error checking participant conflicts:', error);
        throw error;
    }
};

// ==================== AGENDA APIS ====================

/**
 * Get agendas for a meeting
 * @param {number} meetingId 
 * @returns {Promise}
 */
export const getMeetingAgendas = async (meetingId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/agendas/?meeting=${meetingId}`);
        //         console.log("RAW RESPONSE:", response);
        // console.log("IS ARRAY?", Array.isArray(response));
        return response.data;
    } catch (error) {
        console.error('Error fetching meeting agendas:', error);
        throw error;
    }
};

/**
 * Create meeting agenda
 * @param {object} data 
 * @returns {Promise}
 */
export const createMeetingAgenda = async (data) => {
    try {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                formData.append(key, data[key]);
            }
        });

        const response = await axiosInstance.post(`${MEETING_API_BASE}/agendas/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error creating meeting agenda:', error);
        throw error;
    }
};

/**
 * Update meeting agenda
 * @param {number} id 
 * @param {object} data 
 * @returns {Promise}
 */
export const updateMeetingAgenda = async (id, data) => {
    try {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                // Handle file upload vs existing string URL
                if (key === 'file_upload' && typeof data[key] === 'string') {
                    // Skip if it's just the URL string
                    return;
                }
                formData.append(key, data[key]);
            }
        });

        const response = await axiosInstance.put(`${MEETING_API_BASE}/agendas/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating meeting agenda ${id}:`, error);
        throw error;
    }
};

/**
 * Delete meeting agenda
 * @param {number} id 
 * @returns {Promise}
 */
export const deleteMeetingAgenda = async (id) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/agendas/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting meeting agenda ${id}:`, error);
        throw error;
    }
};

/**
 * Get meetings assigned to the current user as a participant
 * @returns {Promise} Array of meeting objects
 */
export const getMyMeetings = async () => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/meetings/my_meetings/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching my meetings:', error);
        throw error;
    }
};

/**
 * Log entry into a meeting
 * @param {number} id - Meeting ID
 * @param {object} locationData - {latitude, longitude, location_address}
 * @returns {Promise} Response data
 */
export const enterMeeting = async (id, locationData = {}) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/meetings/${id}/enter_meeting/`, locationData);
        return response.data;
    } catch (error) {
        console.error(`Error entering meeting ${id}:`, error);
        throw error;
    }
};

/**
 * Log exit from a meeting
 * @param {number} id - Meeting ID
 * @returns {Promise} Response data
 */
export const exitMeeting = async (id) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/meetings/${id}/exit_meeting/`);
        return response.data;
    } catch (error) {
        console.error(`Error exiting meeting ${id}:`, error);
        throw error;
    }
};

/**
 * Submit a comment on an agenda item
 * @param {object} data - {agenda, vote, remarks}
 * @returns {Promise} Created comment object
 */
export const submitComment = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/comments/`, data);
        return response.data;
    } catch (error) {
        console.error('Error submitting comment:', error);
        throw error;
    }
};

// ==================== AGENDA DECISION APIS ====================

/**
 * Get agendas with all nested comments and vote summary
 * @param {number} meetingId
 * @returns {Promise} Array of agenda objects with comments
 */
export const getAgendasWithComments = async (meetingId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/agendas/with_comments/?meeting=${meetingId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching agendas with comments:', error);
        throw error;
    }
};

/**
 * Mark a comment as reviewed
 * @param {number} commentId
 * @returns {Promise} Updated comment object
 */
export const reviewComment = async (commentId) => {
    try {
        const response = await axiosInstance.patch(`${MEETING_API_BASE}/comments/${commentId}/review/`);
        return response.data;
    } catch (error) {
        console.error('Error reviewing comment:', error);
        throw error;
    }
};

/**
 * Submit host decision for an agenda
 * @param {number} agendaId
 * @param {string} decision
 * @returns {Promise} Updated agenda object
 */
export const submitAgendaDecision = async (agendaId, decision) => {
    try {
        const response = await axiosInstance.patch(`${MEETING_API_BASE}/agendas/${agendaId}/submit_decision/`, {
            host_decision: decision
        });
        return response.data;
    } catch (error) {
        console.error('Error submitting agenda decision:', error);
        throw error;
    }
};

/**
 * Review all pending comments for an agenda at once
 * @param {number} agendaId
 * @returns {Promise} { reviewed_count, agenda }
 */
export const reviewAllComments = async (agendaId) => {
    try {
        const response = await axiosInstance.patch(`${MEETING_API_BASE}/agendas/${agendaId}/review_all/`);
        return response.data;
    } catch (error) {
        console.error('Error reviewing all comments:', error);
        throw error;
    }
};

// ==================== AGENDA TASK APIS ====================

/**
 * Create a new agenda task
 * @param {object} data - { agenda, title, description, assigned_to, due_date }
 * @returns {Promise} Created task object
 */
export const createAgendaTask = async (data) => {
    try {
        const response = await axiosInstance.post(`${MEETING_API_BASE}/tasks/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating agenda task:', error);
        throw error;
    }
};

/**
 * Delete an agenda task
 * @param {number} taskId
 * @returns {Promise}
 */
export const deleteAgendaTask = async (taskId) => {
    try {
        const response = await axiosInstance.delete(`${MEETING_API_BASE}/tasks/${taskId}/`);
        return response.data;
    } catch (error) {
        console.error('Error deleting agenda task:', error);
        throw error;
    }
};

// Agenda Task actions

export const getMyTasks = async (userId) => {
    try {
        const response = await axiosInstance.get(`${MEETING_API_BASE}/tasks/?assigned_to=${userId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching assigned tasks:', error);
        throw error;
    }
};

export const updateTaskStatus = async (taskId, status) => {
    try {
        const response = await axiosInstance.patch(`${MEETING_API_BASE}/tasks/${taskId}/`, { status });
        return response.data;
    } catch (error) {
        console.error('Error updating task status:', error);
        throw error;
    }
};

/**
 * Convert uploaded audio file to text
 * @param {File} audioFile
 * @returns {Promise} Response object with transcribed text
 */
export const convertAudioToText = async (audioFile, agendaId = null) => {
    try {
        const formData = new FormData();
        formData.append('audio', audioFile);
        if (agendaId) {
            formData.append('agenda_id', agendaId);
        }

        const response = await axiosInstance.post(`${MEETING_API_BASE}/audio-to-text/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    } catch (error) {
        console.error('Error converting audio to text:', error);
        throw error;
    }
};

const MeetingManagementService = {
    // Categories
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,

    // Subcategories
    getSubcategories,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,

    // Meeting Rooms
    getMeetingRooms,
    createMeetingRoom,
    updateMeetingRoom,
    deleteMeetingRoom,

    // Availability & Schedule
    checkRoomAvailability,
    getRoomSchedule,

    // Meetings
    getMeetings,
    getMeetingById,
    createMeeting,
    updateMeeting,
    deleteMeeting,

    // Approver actions
    getApproverMeetings,
    verifyMeeting,

    // Participant actions
    getMeetingParticipants,
    saveMeetingParticipants,

    // Agenda actions
    getMeetingAgendas,
    createMeetingAgenda,
    updateMeetingAgenda,
    deleteMeetingAgenda,

    // Participant view actions
    getMyMeetings,
    enterMeeting,

    // Agenda decision actions
    getAgendasWithComments,
    reviewComment,
    submitAgendaDecision,

    // Agenda Task actions
    createAgendaTask,
    deleteAgendaTask,
    getMyTasks,
    updateTaskStatus,

    // Audio Processing
    convertAudioToText
};

export default MeetingManagementService;
