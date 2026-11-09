import axiosInstance from './AxiosInstance';

const API_URL = '/api/complaints/categories/';

// GET ALL
export const getCategories = async () => {
    const response = await axiosInstance.get(API_URL);
    return response.data;
};

// CREATE
export const createCategory = async (data) => {
    const response = await axiosInstance.post(API_URL, data);
    return response.data;
};

// UPDATE
export const updateCategory = async (id, data) => {
    const response = await axiosInstance.put(`${API_URL}${id}/`, data);
    return response.data;
};

// DELETE
export const deleteCategory = async (id) => {
    const response = await axiosInstance.delete(`${API_URL}${id}/`);
    return response.data;
};