import axios from 'axios';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/chatbot`;

/**
 * Get JWT token from localStorage
 */
const getAuthToken = () => {
    const userDetails = localStorage.getItem('userDetails');
    if (!userDetails) {
        throw new Error('No authentication token found');
    }
    const { access } = JSON.parse(userDetails);
    return access;
};

/**
 * Get authorization headers
 */
const getAuthHeaders = () => ({
    headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
    }
});

/**
 * Fetch chat message history
 */
export const getChatHistory = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/messages/`, getAuthHeaders());
        return response.data;
    } catch (error) {
        console.error('Error fetching chat history:', error);
        throw error;
    }
};

/**
 * Send a message to the chatbot
 * @param {string} text - The message text
 * @returns {Promise} Response containing user_message and bot_message
 */
export const sendMessage = async (text) => {
    try {
        const response = await axios.post(
            `${API_BASE_URL}/messages/`,
            { text },
            getAuthHeaders()
        );
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};
