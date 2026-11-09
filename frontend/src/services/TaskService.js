import axiosInstance from './AxiosInstance';

const API_URL = '/api/task/categories/';
const TASK_API_BASE = '/api/task';

// GET ALL
export const getTaskCategories = async () => {
    const response = await axiosInstance.get(API_URL);
    return response.data;
};

// CREATE
export const createTaskCategory = async (data) => {
    const response = await axiosInstance.post(API_URL, data);
    return response.data;
};

// UPDATE
export const updateTaskCategory = async (id, data) => {
    const response = await axiosInstance.put(`${API_URL}${id}/`, data);
    return response.data;
};

// DELETE
export const deleteTaskCategory = async (id) => {
    const response = await axiosInstance.delete(`${API_URL}${id}/`);
    return response.data;
};

// Task Sub-Categories
export const getTaskSubCategories = async (categoryId = null) => {
    const params = categoryId ? { category: categoryId } : {};
    const response = await axiosInstance.get(`${TASK_API_BASE}/subcategories/`, { params });
    return response.data;
};
 
export const createTaskSubCategory = async (data) => {
    const response = await axiosInstance.post(`${TASK_API_BASE}/subcategories/`, data);
    return response.data;
};
 
export const updateTaskSubCategory = async (id, data) => {
    const response = await axiosInstance.put(`${TASK_API_BASE}/subcategories/${id}/`, data);
    return response.data;
};
 
export const deleteTaskSubCategory = async (id) => {
    const response = await axiosInstance.delete(`${TASK_API_BASE}/subcategories/${id}/`);
    return response.data;
};


// Tasks
export const getTasks = async (taskType = null) => {
    const params = taskType ? { task_type: taskType } : {};
    const response = await axiosInstance.get(`${TASK_API_BASE}/tasks/`, { params });
    return response.data;
};
 
export const createTask = async (data) => {
    const response = await axiosInstance.post(`${TASK_API_BASE}/tasks/`, data);
    return response.data;
};
 
export const updateTask = async (id, data) => {
    const response = await axiosInstance.put(`${TASK_API_BASE}/tasks/${id}/`, data);
    return response.data;
};
 
export const deleteTask = async (id) => {
    const response = await axiosInstance.delete(`${TASK_API_BASE}/tasks/${id}/`);
    return response.data;
};
 
// Task Attachments
export const deleteTaskAttachment = async (id) => {
    const response = await axiosInstance.delete(`${TASK_API_BASE}/task-attachments/${id}/`);
    return response.data;
};

//subtask
export const getSubtasks = async (taskType = null) => {
    const params = taskType ? { task_type: taskType } : {};
    const response = await axiosInstance.get(`${TASK_API_BASE}/subtasks/`, { params });
    return response.data;
};

export const createSubtask = async (data) => {
    const response = await axiosInstance.post(`${TASK_API_BASE}/subtasks/`, data);
    return response.data;
};

export const updateSubtask = async (id, data) => {
    const response = await axiosInstance.put(`${TASK_API_BASE}/subtasks/${id}/`, data);
    return response.data;
};

export const deleteSubtask = async (id) => {
    const response = await axiosInstance.delete(`${TASK_API_BASE}/subtasks/${id}/`);
    return response.data;
};

export const deleteSubtaskAttachment = async (id) => {
    const response = await axiosInstance.delete(`${TASK_API_BASE}/subtasks/attachments/${id}/`);
    return response.data;
};

export const getSubtasksForTask = (taskId, parentSubtaskId = null) => {
    const params = {};
    if (taskId) params.task = taskId;
    if (parentSubtaskId) params.parent_subtask = parentSubtaskId;
    return axiosInstance.get(`${TASK_API_BASE}/subtasks/`, { params }).then(res => res.data);
};

 
// Task Vote Requests

export const createTaskVoteRequest = (payload) =>
    axiosInstance.post(`${TASK_API_BASE}/task-vote-requests/`, payload).then(res => res.data);

export const castVote = (voteRequestId, vote, remarks) =>
    axiosInstance
        .post(`/api/task/task-vote-requests/${voteRequestId}/cast-vote/`, { vote, remarks })
        .then(r => r.data);

export const getMyPendingVotes = () =>
    axiosInstance.get(`${TASK_API_BASE}/task-vote-requests/my-pending-votes/`).then(res => res.data);

export const getMyCreatedVoteRequests = () =>
    axiosInstance.get(`/api/task/task-vote-requests/my-created-requests/`).then(r => r.data);

export const getMyAssignedTasks = () =>
    axiosInstance.get(`/api/task/task-vote-requests/my-assigned-tasks/`).then(r => r.data);

// Subtask assignments for current employee at ANY depth (Anu/John/Aleena pattern)
export const getMyAssignedSubtasks = () =>
    axiosInstance.get(`/api/task/task-assignments/my-subtasks/`).then(r => r.data);

export const rescheduleTaskVoteRequest = (id, cutoff_date, remarks = '') =>
    axiosInstance.post(`${TASK_API_BASE}/task-vote-requests/${id}/reschedule/`, { cutoff_date, remarks }).then(res => res.data);


//team

export const getDepartments = () =>
    axiosInstance.get(`${TASK_API_BASE}/departments/`).then(res => res.data);
 
export const getDepartmentEmployees = (departmentId) =>
    axiosInstance.get(`${TASK_API_BASE}/departments/${departmentId}/employees/`).then(res => res.data);
 
export const getMyDepartmentEmployees = () =>
    axiosInstance.get(`${TASK_API_BASE}/my-department/employees/`).then(res => res.data);

export const getCurrentEmployee = () =>
    axiosInstance.get(`${TASK_API_BASE}/task-assignments/current-employee/`).then(res => res.data);

export const createTeam = (payload) =>
    axiosInstance.post(`${TASK_API_BASE}/teams/`, payload).then(res => res.data);

export const getTeamForTask = (taskId) =>
    axiosInstance.get(`${TASK_API_BASE}/teams/`, { params: { task: taskId } }).then(r => r.data);

export const getTeamForSubtask = (subtaskId) =>
    axiosInstance.get(`${TASK_API_BASE}/teams/`, { params: { subtask: subtaskId } }).then(r => r.data);

export const updateTeam = (teamId, payload) =>
    axiosInstance.patch(`${TASK_API_BASE}/teams/${teamId}/`, payload).then(r => r.data);

// Assign Task

export const getTaskAssignments = (taskId, parentSubtaskId = null) => {
    const params = {};
    if (taskId) params.task = taskId;
    if (parentSubtaskId) params.parent_subtask = parentSubtaskId;
    return axiosInstance.get(`${TASK_API_BASE}/task-assignments/`, { params }).then(r => r.data);
};

export const saveTaskAssignments = (taskId, parentSubtaskId, assignments) => {
    const payload = { assignments };
    if (taskId) payload.task = taskId;
    if (parentSubtaskId) payload.parent_subtask = parentSubtaskId;
    return axiosInstance
        .post(`${TASK_API_BASE}/task-assignments/bulk-save/`, payload)
        .then(r => r.data);
};

export const approveMemberAssignments = (taskId, parentSubtaskId, employeeId) => {
    const payload = { employee: employeeId };
    if (taskId) payload.task = taskId;
    if (parentSubtaskId) payload.parent_subtask = parentSubtaskId;
    return axiosInstance
        .post(`${TASK_API_BASE}/task-assignments/approve-member/`, payload)
        .then(r => r.data);
};

export const bulkApproveAssignments = (taskId, parentSubtaskId, employeeIds = null) => {
    const payload = {};
    if (taskId) payload.task = taskId;
    if (parentSubtaskId) payload.parent_subtask = parentSubtaskId;
    if (employeeIds && employeeIds.length > 0) payload.employee_ids = employeeIds;
    return axiosInstance
        .post(`${TASK_API_BASE}/task-assignments/approve-member/`, payload)
        .then(r => r.data);
};

export const getMyTaskReport = (status = null) => {
    const params = status ? { status } : {};
    return axiosInstance.get(`${TASK_API_BASE}/my-task-report/`, { params }).then(r => r.data);
};

export const getNotVotedTasksReport = () =>
    axiosInstance.get('/api/task/not-voted-tasks-report/').then((r) => r.data);

export const getNotStartedTasksReport = () =>
    axiosInstance.get('/api/task/not-started-tasks-report/').then((r) => r.data);

export const getTaskSubtasksOverview = (assignmentId) =>
    axiosInstance.get(`${TASK_API_BASE}/task-assignments/subtasks-overview/`, { params: { assignment: assignmentId } }).then((r) => r.data);
