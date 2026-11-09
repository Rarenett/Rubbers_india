






import axiosInstance from './AxiosInstance';

export const WalletService = {
  // Wallet Master Endpoints
  getWallets: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/master/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching wallets:', error);
      throw error;
    }
  },

  getActiveWallets: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/master/active/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching active wallets:', error);
      throw error;
    }
  },

  getWalletSummary: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/master/summary/');
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet summary:', error);
      throw error;
    }
  },

  getWalletById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/master/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching wallet with id ${id}:`, error);
      throw error;
    }
  },

  getNextWalletCode: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/master/next-code/');
      return response.data;
    } catch (error) {
      console.error('Error fetching next wallet code:', error);
      throw error;
    }
  },

  getOwners: async (ownerType) => {
    try {
      const response = await axiosInstance.get('/api/wallet/master/owners/', {
        params: { owner_type: ownerType },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching owners for type ${ownerType}:`, error);
      throw error;
    }
  },

  createWallet: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/master/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  },

  updateWallet: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/wallet/master/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating wallet ${id}:`, error);
      throw error;
    }
  },

  deleteWallet: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/master/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting wallet ${id}:`, error);
      throw error;
    }
  },

  // Wallet Transactions Endpoints
  getTransactions: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/transactions/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },

  getTransactionById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/transactions/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction with id ${id}:`, error);
      throw error;
    }
  },

  createTransaction: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/transactions/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  },

  cancelTransaction: async (id, reason) => {
    try {
      const response = await axiosInstance.post(`/api/wallet/transactions/${id}/cancel/`, { reason });
      return response.data;
    } catch (error) {
      console.error(`Error cancelling transaction ${id}:`, error);
      throw error;
    }
  },

  // Wallet Report Endpoint
  getReport: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/report/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet report:', error);
      throw error;
    }
  },

  // Wallet Owner Type Endpoints
  getOwnerTypes: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/owner-types/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching owner types:', error);
      throw error;
    }
  },

  getActiveOwnerTypes: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/owner-types/active/');
      return response.data;
    } catch (error) {
      console.error('Error fetching active owner types:', error);
      throw error;
    }
  },

  getOwnerTypeById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/owner-types/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching owner type ${id}:`, error);
      throw error;
    }
  },

  createOwnerType: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/owner-types/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating owner type:', error);
      throw error;
    }
  },

  updateOwnerType: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/wallet/owner-types/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating owner type ${id}:`, error);
      throw error;
    }
  },

  deleteOwnerType: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/owner-types/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting owner type ${id}:`, error);
      throw error;
    }
  },

  toggleOwnerTypeStatus: async (id) => {
    try {
      const response = await axiosInstance.patch(`/api/wallet/owner-types/${id}/toggle-status/`);
      return response.data;
    } catch (error) {
      console.error(`Error toggling owner type status ${id}:`, error);
      throw error;
    }
  },

  // Wallet Schemes Endpoints
  getSchemes: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/schemes/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching schemes:', error);
      throw error;
    }
  },

  getSchemeById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/schemes/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching scheme ${id}:`, error);
      throw error;
    }
  },

  getActiveSchemes: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/schemes/active/');
      return response.data;
    } catch (error) {
      console.error('Error fetching active schemes:', error);
      throw error;
    }
  },

  createScheme: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/schemes/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating scheme:', error);
      throw error;
    }
  },

  updateScheme: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/wallet/schemes/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating scheme ${id}:`, error);
      throw error;
    }
  },

  toggleSchemeStatus: async (id) => {
    try {
      const response = await axiosInstance.patch(`/api/wallet/schemes/${id}/toggle-status/`);
      return response.data;
    } catch (error) {
      console.error(`Error toggling scheme status ${id}:`, error);
      throw error;
    }
  },

  deleteScheme: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/schemes/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting scheme ${id}:`, error);
      throw error;
    }
  },

  // Wallet Scheme Criteria Endpoints
  getSchemeCriteria: async (schemeId, group = null) => {
    try {
      const params = group ? { group } : {};
      const response = await axiosInstance.get(`/api/wallet/schemes/${schemeId}/criteria/`, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching criteria for scheme ${schemeId}:`, error);
      throw error;
    }
  },

  deleteSchemeCriteria: async (criteriaId) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/scheme-criteria/${criteriaId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting criteria ${criteriaId}:`, error);
      throw error;
    }
  },

  deleteCriteriaValue: async (criteriaValueId) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/criteria-values/${criteriaValueId}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting criteria value ${criteriaValueId}:`, error);
      throw error;
    }
  },

  // Wallet Reason Endpoints
  getReasons: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/reasons/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching reasons:', error);
      throw error;
    }
  },

  getActiveReasons: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/reasons/active/');
      return response.data;
    } catch (error) {
      console.error('Error fetching active reasons:', error);
      throw error;
    }
  },

  getReasonById: async (id) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/reasons/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching reason with id ${id}:`, error);
      throw error;
    }
  },

  createReason: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/reasons/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating reason:', error);
      throw error;
    }
  },

  updateReason: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/wallet/reasons/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating reason ${id}:`, error);
      throw error;
    }
  },

  deleteReason: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/reasons/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting reason ${id}:`, error);
      throw error;
    }
  },

  toggleReasonStatus: async (id) => {
    try {
      const response = await axiosInstance.patch(`/api/wallet/reasons/${id}/toggle-status/`);
      return response.data;
    } catch (error) {
      console.error(`Error toggling reason status ${id}:`, error);
      throw error;
    }
  },

  // Wallet Points Entry Endpoints
  getPointsEntries: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/points-entry/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching points entries:', error);
      throw error;
    }
  },

  createPointsEntry: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/points-entry/', data);
      return response.data;
    } catch (error) {
      console.error('Error posting points entry:', error);
      throw error;
    }
  },

  updatePointsEntry: async (id, data) => {
    try {
      const response = await axiosInstance.put(`/api/wallet/points-entry/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating points entry ${id}:`, error);
      throw error;
    }
  },

  deletePointsEntry: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/points-entry/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting points entry ${id}:`, error);
      throw error;
    }
  },

  getNextPointsEntryNumber: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/points-entry/next-entry-number/');
      return response.data;
    } catch (error) {
      console.error('Error fetching next points entry number:', error);
      throw error;
    }
  },

  // Wallet Working (Inactivity & Break Tracking) Endpoints
  getWorkingSettings: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/settings/');
      return response.data;
    } catch (error) {
      console.error('Error fetching working settings:', error);
      throw error;
    }
  },

  updateWorkingSettings: async (data) => {
    try {
      const response = await axiosInstance.patch('/api/wallet/working/settings/', data);
      return response.data;
    } catch (error) {
      console.error('Error updating working settings:', error);
      throw error;
    }
  },

  getWorkingSession: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/session/');
      return response.data;
    } catch (error) {
      console.error('Error fetching working session:', error);
      throw error;
    }
  },

  confirmWorking: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/confirm/', data);
      return response.data;
    } catch (error) {
      console.error('Error confirming working status:', error);
      throw error;
    }
  },

  getPendingIdlePrompt: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/idle-prompt/');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending idle prompt:', error);
      throw error;
    }
  },

  triggerIdlePrompt: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/idle-prompt/', data);
      return response.data;
    } catch (error) {
      console.error('Error triggering idle prompt:', error);
      throw error;
    }
  },

  submitIdleTimeout: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/idle-timeout/', data);
      return response.data;
    } catch (error) {
      console.error('Error submitting idle timeout:', error);
      throw error;
    }
  },

  startWorkingBreak: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/start-break/', data);
      return response.data;
    } catch (error) {
      console.error('Error starting working break:', error);
      throw error;
    }
  },

  endWorkingBreak: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/end-break/', data);
      return response.data;
    } catch (error) {
      console.error('Error ending working break:', error);
      throw error;
    }
  },

  getWorkingBreaks: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/breaks/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching working breaks:', error);
      throw error;
    }
  },

  updateBreakThreshold: async (breakId, thresholdMinutes) => {
    try {
      const response = await axiosInstance.patch(`/api/wallet/working/breaks/${breakId}/threshold/`, {
        threshold_minutes: thresholdMinutes
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating break threshold for break ${breakId}:`, error);
      throw error;
    }
  },

  updateEmployeeThreshold: async (userId, thresholdMinutes) => {
    try {
      const response = await axiosInstance.patch('/api/wallet/working/employee-threshold/', {
        user_id: userId,
        threshold_minutes: thresholdMinutes
      });
      return response.data;
    } catch (error) {
      console.error(`Error updating employee threshold for user ${userId}:`, error);
      throw error;
    }
  },

  // Idle Status Tracker Endpoints
  getWorkingStatus: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/status/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching working status:', error);
      throw error;
    }
  },

  submitWorkingStatus: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/status/', data);
      return response.data;
    } catch (error) {
      console.error('Error submitting working status:', error);
      throw error;
    }
  },

  sendWorkingHeartbeat: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/working/heartbeat/', data);
      return response.data;
    } catch (error) {
      console.error('Error sending working heartbeat:', error);
      throw error;
    }
  },

  getWorkingHistory: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/working/history/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching working history:', error);
      throw error;
    }
  },

  // Wallet Report Endpoints
  getWalletReport: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/report/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching wallet report:', error);
      throw error;
    }
  },

  getWalletLedger: async (walletId, params = {}) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/report/${walletId}/ledger/`, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching wallet ledger for ${walletId}:`, error);
      throw error;
    }
  },

  // Wallet Calendar & Scheduled Screenshot Endpoints
  getCalendarSchedules: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/calendar/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching calendar schedules:', error);
      throw error;
    }
  },

  createCalendarSchedule: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating calendar schedule:', error);
      throw error;
    }
  },

  updateCalendarSchedule: async (id, data) => {
    try {
      const response = await axiosInstance.patch(`/api/wallet/calendar/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating calendar schedule ${id}:`, error);
      throw error;
    }
  },

  deleteCalendarSchedule: async (id) => {
    try {
      const response = await axiosInstance.delete(`/api/wallet/calendar/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting calendar schedule ${id}:`, error);
      throw error;
    }
  },

  applyAllCalendarSchedules: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/apply-all/', data);
      return response.data;
    } catch (error) {
      console.error('Error applying schedules to all dates:', error);
      throw error;
    }
  },

  uploadCapturedScreenshot: async (formData) => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/capture/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading captured screenshot:', error);
      throw error;
    }
  },

  recordCalendarStatus: async (data) => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/record-status/', data);
      return response.data;
    } catch (error) {
      console.error('Error recording calendar status:', error);
      throw error;
    }
  },

  getCalendarExecutions: async (params = {}) => {
    try {
      const response = await axiosInstance.get('/api/wallet/calendar/executions/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching calendar executions:', error);
      throw error;
    }
  },

  getScheduleExecutions: async (scheduleId) => {
    try {
      const response = await axiosInstance.get(`/api/wallet/calendar/${scheduleId}/executions/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching executions for schedule ${scheduleId}:`, error);
      throw error;
    }
  },

  checkMissedSchedules: async () => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/check-missed/');
      return response.data;
    } catch (error) {
      console.error('Error checking missed schedules:', error);
      throw error;
    }
  },

  getPendingCaptures: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/calendar/pending-captures/');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending captures:', error);
      throw error;
    }
  },

  getAgentStatus: async () => {
    try {
      const response = await axiosInstance.get('/api/wallet/calendar/agent-status/');
      return response.data;
    } catch (error) {
      console.error('Error fetching agent status:', error);
      throw error;
    }
  },

  sendAgentHeartbeat: async (data = {}) => {
    try {
      const response = await axiosInstance.post('/api/wallet/calendar/agent-heartbeat/', data);
      return response.data;
    } catch (error) {
      console.error('Error sending agent heartbeat:', error);
      throw error;
    }
  },
};

export default WalletService;


