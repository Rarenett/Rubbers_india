import AxiosInstance from "./AxiosInstance";

const API_ROUTES = {
  AREAS: "/api/logistics/areas/",
  SALESMAN_MAPPINGS: "/api/hr/salesman-mappings/",
};

const CommonMasterService = {
  // Areas
  getAreas: () => {
    return AxiosInstance.get(API_ROUTES.AREAS);
  },
  createArea: (data) => {
    return AxiosInstance.post(API_ROUTES.AREAS, data);
  },
  deleteArea: (id) => {
    return AxiosInstance.delete(`${API_ROUTES.AREAS}${id}/`);
  },

  // Salesman Mappings
  getSalesmanMappings: () => {
    return AxiosInstance.get(API_ROUTES.SALESMAN_MAPPINGS);
  },
  createSalesmanMapping: (data) => {
    return AxiosInstance.post(API_ROUTES.SALESMAN_MAPPINGS, data);
  },
  updateSalesmanMapping: (id, data) => {
    return AxiosInstance.put(`${API_ROUTES.SALESMAN_MAPPINGS}${id}/`, data);
  },
  deleteSalesmanMapping: (id) => {
    return AxiosInstance.delete(`${API_ROUTES.SALESMAN_MAPPINGS}${id}/`);
  },
};

export default CommonMasterService;
