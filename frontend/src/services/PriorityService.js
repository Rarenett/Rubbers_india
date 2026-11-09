import axiosInstance from './AxiosInstance';

const API_URL = '/api/complaints/priority-rules/';

export const getPriorityRules = async () => {
    const response = await axiosInstance.get(API_URL);
    return response.data;
};

export const createPriorityRule = async (data) => {
    const response = await axiosInstance.post(API_URL, data);
    return response.data;
};

export const updatePriorityRule = async (id, data) => {
    const response = await axiosInstance.put(`${API_URL}${id}/`, data);
    return response.data;
};

export const deletePriorityRule = async (id) => {
    const response = await axiosInstance.delete(`${API_URL}${id}/`);
    return response.data;
};
