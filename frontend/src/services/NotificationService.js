import axiosInstance from './AxiosInstance';

/**
 * Notification Service
 * Handles all notification-related API calls
 */

/**
 * Get all notifications for the current user
 * @returns {Promise} Array of notification objects
 */
export const getNotifications = async () => {
    try {
        const response = await axiosInstance.get('/api/notifications/notifications/');
        return response.data;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

/**
 * Get count of unread notifications
 * @returns {Promise} Object with unread_count
 */
export const getUnreadCount = async () => {
    try {
        const response = await axiosInstance.get('/api/notifications/notifications/unread_count/');
        return response.data;
    } catch (error) {
        console.error('Error fetching unread count:', error);
        throw error;
    }
};

/**
 * Mark a single notification as read
 * @param {number} notificationId - ID of the notification to mark as read
 * @returns {Promise} Response object
 */
export const markNotificationAsRead = async (notificationId) => {
    try {
        const response = await axiosInstance.post(`/api/notifications/notifications/${notificationId}/mark_read/`);
        return response.data;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

/**
 * Mark all notifications as read
 * @returns {Promise} Response object
 */
export const markAllNotificationsAsRead = async () => {
    try {
        const response = await axiosInstance.post('/api/notifications/notifications/mark_all_read/');
        return response.data;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};

const NotificationService = {
    getNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
};

export default NotificationService;
