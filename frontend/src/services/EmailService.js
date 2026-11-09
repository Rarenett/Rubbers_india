import axiosInstance from './AxiosInstance';

/**
 * Email Service
 * Handles all email-related API calls
 */

/**
 * Get emails by folder with optional pagination
 * @param {string} folder - Folder name (inbox, sent, starred, trash, archive)
 * @param {number} page - Page number for pagination
 * @returns {Promise} Array of email objects
 */
export const getEmails = async (folder = 'inbox', page = 1) => {
    try {
        const response = await axiosInstance.get('/api/emails/', {
            params: { folder, page }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching emails for folder ${folder}:`, error);
        throw error;
    }
};

/**
 * Get single email by ID
 * @param {number} id - Email ID
 * @returns {Promise} Email object
 */
export const getEmailById = async (id) => {
    try {
        const response = await axiosInstance.get(`/api/emails/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching email ${id}:`, error);
        throw error;
    }
};

/**
 * Send/compose new email
 * @param {object} emailData - {subject, body, recipient_emails, files}
 * @returns {Promise} Created email object
 */
export const sendEmail = async (emailData) => {
    try {
        const formData = new FormData();
        formData.append('subject', emailData.subject || '');
        formData.append('body', emailData.body || '');

        // Add recipients
        if (emailData.recipient_emails && emailData.recipient_emails.length > 0) {
            emailData.recipient_emails.forEach(email => {
                formData.append('recipient_emails', email);
            });
        }

        // Add attachments
        if (emailData.files && emailData.files.length > 0) {
            emailData.files.forEach(file => {
                formData.append('files', file);
            });
        }

        const response = await axiosInstance.post('/api/emails/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

/**
 * Mark email as read
 * @param {number} id - Email ID
 * @returns {Promise} Response object
 */
export const markAsRead = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/emails/${id}/mark_read/`);
        return response.data;
    } catch (error) {
        console.error(`Error marking email ${id} as read:`, error);
        throw error;
    }
};

/**
 * Toggle star status
 * @param {number} id - Email ID
 * @returns {Promise} Response with is_starred status
 */
export const toggleStar = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/emails/${id}/toggle_star/`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling star for email ${id}:`, error);
        throw error;
    }
};

/**
 * Toggle archive status
 * @param {number} id - Email ID
 * @returns {Promise} Response with is_archived status
 */
export const toggleArchive = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/emails/${id}/archive/`);
        return response.data;
    } catch (error) {
        console.error(`Error toggling archive for email ${id}:`, error);
        throw error;
    }
};

/**
 * Move email to trash
 * @param {number} id - Email ID
 * @returns {Promise} Response object
 */
export const moveToTrash = async (id) => {
    try {
        const response = await axiosInstance.post(`/api/emails/${id}/trash/`);
        return response.data;
    } catch (error) {
        console.error(`Error moving email ${id} to trash:`, error);
        throw error;
    }
};

/**
 * Get folder counts
 * @returns {Promise} Object with counts for all folders
 */
export const getFolderCounts = async () => {
    try {
        const response = await axiosInstance.get('/api/emails/folder_counts/');
        return response.data;
    } catch (error) {
        console.error('Error fetching folder counts:', error);
        throw error;
    }
};

/**
 * Search users for email composition
 * @param {string} query - Search query
 * @returns {Promise} Array of user objects
 */
export const searchUsers = async (query) => {
    try {
        const response = await axiosInstance.get('/api/emails/search_users/', {
            params: { q: query }
        });
        return response.data;
    } catch (error) {
        console.error('Error searching users:', error);
        throw error;
    }
};

/**
 * Get internal users for composing email
 * @returns {Promise} Array of user objects
 */
export const getInternalUsers = async () => {
    try {
        const response = await axiosInstance.get('/api/emails/internal_users/');
        return response.data;
    } catch (error) {
        console.error('Error fetching internal users:', error);
        throw error;
    }
};

const EmailService = {
    getEmails,
    getEmailById,
    sendEmail,
    markAsRead,
    toggleStar,
    toggleArchive,
    moveToTrash,
    getFolderCounts,
    searchUsers,
    getInternalUsers
};

export default EmailService;
