import axiosInstance from './axiosInstance';

export const AreaService = {
  getAreas: async () => {
    try {
      const response = await axiosInstance.get('/api/area/areas/');
      return response.data;
    } catch (error) {
      console.error('Error fetching areas:', error);
      throw error;
    }
  },

  getAreaById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/area/areas/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching area with id ${id}:`, error);
      throw error;
    }
  },

  createArea: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/areas/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating area:', error);
      throw error;
    }
  },

  updateArea: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/area/areas/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating area:', error);
      throw error;
    }
  },

  deleteArea: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/areas/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting area:', error);
      throw error;
    }
  },

  getSalesmanMappings: async () => {
    try {
      const response = await axiosInstance.get('/api/area/salesman-mappings/');
      return response.data;
    } catch (error) {
      console.error('Error fetching salesman mappings:', error);
      throw error;
    }
  },

  createSalesmanMapping: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/salesman-mappings/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating salesman mapping:', error);
      throw error;
    }
  },

  updateSalesmanMapping: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/area/salesman-mappings/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating salesman mapping:', error);
      throw error;
    }
  },

  deleteSalesmanMapping: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/salesman-mappings/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting salesman mapping:', error);
      throw error;
    }
  },

  getSalesmanVisitings: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/area/salesman-visitings/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching salesman visitings:', error);
      throw error;
    }
  },

  createSalesmanVisiting: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/salesman-visitings/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating salesman visiting:', error);
      throw error;
    }
  },

  updateSalesmanVisiting: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/area/salesman-visitings/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating salesman visiting:', error);
      throw error;
    }
  },

  deleteSalesmanVisiting: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/salesman-visitings/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting salesman visiting:', error);
      throw error;
    }
  },

  getDeliveryLocations: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/area/delivery-locations/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery locations:', error);
      throw error;
    }
  },

  createDeliveryLocation: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/delivery-locations/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating delivery location:', error);
      throw error;
    }
  },

  updateDeliveryLocation: async (id, data) => {
    try {
      const response = await axiosInstance.patch(`/api/area/delivery-locations/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating delivery location:', error);
      throw error;
    }
  },

  deleteDeliveryLocation: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/delivery-locations/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting delivery location:', error);
      throw error;
    }
  },

  getAreaLocationMappings: async () => {
    try {
      const response = await axiosInstance.get('/api/area/area-location-mappings/');
      return response.data;
    } catch (error) {
      console.error('Error fetching area location mappings:', error);
      throw error;
    }
  },

  createAreaLocationMapping: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/area-location-mappings/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating area location mapping:', error);
      throw error;
    }
  },

  deleteAreaLocationMapping: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/area-location-mappings/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting area location mapping:', error);
      throw error;
    }
  },

  getAreaLocationMappings: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/area/area-location-mappings/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching area location mappings:', error);
      throw error;
    }
  },

  createAreaLocationMapping: async (data) => {
    try {
      const response = await axiosInstance.post('/api/area/area-location-mappings/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating area location mapping:', error);
      throw error;
    }
  },

  updateAreaLocationMapping: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/area/area-location-mappings/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating area location mapping:', error);
      throw error;
    }
  },

  deleteAreaLocationMapping: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/area/area-location-mappings/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting area location mapping:', error);
      throw error;
    }
  },

  getDetectedLocations: async (areaId) => {
    try {
      const response = await axiosInstance.get(`/api/area/areas/${areaId}/detected_locations/`);
      return response.data;
    } catch (error) {
      console.error('Error getting detected locations:', error);
      throw error;
    }
  }
};

