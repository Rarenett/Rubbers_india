import React, { useState, useEffect, Component } from "react";
import { Link } from "react-router-dom";
import { Card } from "react-bootstrap";
import axiosInstance from "../../../services/AxiosInstance";
import TaskForm from "./TaskForm";
import CreateButton from "../../../components/permissions/CreateButton";
import { useTaskReminder } from "../../../context/TaskReminderProvider";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error.message };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    alert("Crash detected in TaskForm: " + error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger">
          Error rendering form: {this.state.errorMsg}
        </div>
      );
    }
    return this.props.children;
  }
}

const TaskManagementDashboard = () => {
  const { enablePushNotifications, notificationPermission } = useTaskReminder();
  const [tasksToday, setTasksToday] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  const [viewMode, setViewMode] = useState("today"); // 'today' or 'admin'
  const [summary, setSummary] = useState({
    today: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    adminAssigned: 0,
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewTask, setViewTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // State for completion modal
  const [completingTask, setCompletingTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState("");

  // State for postpone modal
  const [postponingTask, setPostponingTask] = useState(null);
  const [postponeDays, setPostponeDays] = useState("");

  const fetchTasks = async () => {
    try {
      // Get today's self-planned tasks (exclude admin-assigned)
      const todayRes = await axiosInstance.get(
        "/api/task-management/tasks/today/",
      );
      const selfTodayTasks = todayRes.data.filter((t) => !t.assigned_by);
      setTasksToday(selfTodayTasks);

      // Get all tasks to calculate summary
      const allRes = await axiosInstance.get("/api/task-management/tasks/");
      const tasks = allRes.data;

      const summaryData = {
        today: selfTodayTasks.length,
        pending: tasks.filter((t) => t.status === "Pending").length,
        inProgress: tasks.filter((t) => t.status === "In Progress").length,
        completed: tasks.filter((t) => t.status === "Completed").length,
        incomplete: tasks.filter((t) => t.status === "Incomplete").length,
        adminAssigned: tasks.filter((t) => t.assigned_by).length,
      };
      setAdminTasks(tasks.filter((t) => t.assigned_by));
      setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  useEffect(() => {
    fetchTasks();

    const intervalId = setInterval(fetchTasks, 15000); // Auto-refresh every 15s

    const handleMutate = () => fetchTasks();
    window.addEventListener("taskMutated", handleMutate);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("taskMutated", handleMutate);
    };
  }, []);

  const handleStartTask = async (taskId) => {
    try {
      await axiosInstance.post(
        `/api/task-management/tasks/${taskId}/start_task/`,
      );
      fetchTasks(); // Refresh
    } catch (error) {
      console.error("Error starting task:", error);
    }
  };

  const handleCompleteTask = async (taskId) => {
    setCompletingTask(taskId);
    setCompletionNotes("");
  };

  const submitCompletion = async () => {
    try {
      await axiosInstance.post(
        `/api/task-management/tasks/${completingTask}/complete_task/`,
        {
          completionNotes: completionNotes,
        },
      );
      setCompletingTask(null);
      fetchTasks(); // Refresh
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (newStatus === "Completed") {
      setCompletingTask(taskId);
      setCompletionNotes("");
      return;
    }
    try {
      await axiosInstance.post(
        `/api/task-management/tasks/${taskId}/update_status/`,
        { status: newStatus },
      );
      fetchTasks(); // Refresh
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const submitPostpone = async () => {
    if (!postponeDays || isNaN(postponeDays) || parseInt(postponeDays) <= 0) {
      alert("Please enter a valid number of days to postpone.");
      return;
    }
    try {
      await axiosInstance.post(
        `/api/task-management/tasks/${postponingTask.id}/postpone_task/`,
        { days: parseInt(postponeDays) },
      );
      setPostponingTask(null);
      setPostponeDays("");
      fetchTasks(); // Refresh
    } catch (error) {
      console.error("Error postponing task:", error);
      alert(error.response?.data?.error || "Error postponing task.");
    }
  };

  const todayDateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const currentTaskList = viewMode === "admin" ? adminTasks : tasksToday;
  const displayedTasks = currentTaskList.filter((task) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (task.taskName && task.taskName.toLowerCase().includes(term)) ||
      (task.priority && task.priority.toLowerCase().includes(term)) ||
      (task.status && task.status.toLowerCase().includes(term)) ||
      (task.description && task.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="container-fluid park-area-page">
      <div className="page-titles">
        <button
          onClick={() => window.history.back()}
          className="btn btn-outline-primary btn-sm d-flex align-items-center"
          style={{ gap: "6px", borderRadius: "6px" }}
        >
          <i className="fa fa-arrow-left"></i> Back
        </button>
      </div>

      <div className="row">
        <div className="col-12">
          <Card
            style={{
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          >
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <Card.Title
                  className="mb-0 text-nowrap"
                  style={{ fontSize: "1.25rem", fontWeight: "600" }}
                >
                  {viewMode === "admin" ? "Admin Tasks" : "Today's Tasks"}
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  {viewMode === "admin"
                    ? "All tasks assigned by admin"
                    : todayDateStr}
                </p>
              </div>

              <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1 justify-content-end header-actions-wrapper">
                <div
                  className="search-bar-container m-0 search-bar-wrapper"
                  style={{
                    flex: "1 1 auto",
                    minWidth: "180px",
                    maxWidth: "260px",
                  }}
                >
                  <span className="search-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="d-flex gap-2 align-items-center flex-wrap">
                  {/* Button 1: Tasks Today */}
                  <button
                    type="button"
                    className={`btn btn-sm d-flex align-items-center gap-2 ${
                      viewMode === "today"
                        ? "btn-success text-white"
                        : "btn-outline-success"
                    }`}
                    style={{
                      height: "36px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      backgroundColor:
                        viewMode === "today" ? "#2ece8a" : "transparent",
                      borderColor: "#2ece8a",
                    }}
                    onClick={() => setViewMode("today")}
                  >
                    <i className="flaticon-381-calendar-1"></i>
                    <span>Tasks Today</span>
                    <span
                      className={`badge ${
                        viewMode === "today"
                          ? "bg-white text-success"
                          : "bg-success text-white"
                      }`}
                      style={{
                        fontSize: "11px",
                        borderRadius: "10px",
                        padding: "2px 7px",
                      }}
                    >
                      {summary.today}
                    </span>
                  </button>

                  {/* Button 2: Admin Tasks */}
                  <button
                    type="button"
                    className={`btn btn-sm d-flex align-items-center gap-2 ${
                      viewMode === "admin"
                        ? "btn-info text-white"
                        : "btn-outline-info"
                    }`}
                    style={{
                      height: "36px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                      backgroundColor:
                        viewMode === "admin" ? "#3b82f6" : "transparent",
                      borderColor: "#3b82f6",
                    }}
                    onClick={() => setViewMode("admin")}
                  >
                    <i className="fa fa-user-shield"></i>
                    <span>Admin Tasks</span>
                    <span
                      className={`badge ${
                        viewMode === "admin"
                          ? "bg-white text-info"
                          : "bg-info text-white"
                      }`}
                      style={{
                        fontSize: "11px",
                        borderRadius: "10px",
                        padding: "2px 7px",
                      }}
                    >
                      {summary.adminAssigned}
                    </span>
                  </button>

                  {/* Button 3: Plan Task */}
                  <CreateButton
                    module="to_do"
                    onClick={() => setIsFormOpen(true)}
                    style={{
                      height: "36px",
                      borderRadius: "8px",
                      padding: "0 16px",
                    }}
                  >
                    Plan Task
                  </CreateButton>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="table-responsive">
                <table className="table w-100">
                  <thead>
                    <tr>
                      <th>
                        <strong>SL NO</strong>
                      </th>
                      <th>
                        <strong>TASK NAME</strong>
                      </th>
                      <th>
                        <strong>PRIORITY</strong>
                      </th>
                      <th>
                        <strong>DURATION</strong>
                      </th>
                      <th>
                        <strong>STATUS</strong>
                      </th>
                      <th>
                        <strong>ACTIONS</strong>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTasks.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted">
                          No tasks found.
                        </td>
                      </tr>
                    ) : (
                      displayedTasks.map((task, index) => (
                        <tr key={task.id}>
                          <td>{index + 1}</td>
                          <td>
                            {task.taskName}
                            {task.postponedDaysUsed > 0 && (
                              <span
                                className="badge badge-warning badge-xs ml-2"
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 5px",
                                  marginLeft: "5px",
                                }}
                              >
                                Postponed
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge light badge-${task.priority === "High" || task.priority === "Critical" ? "danger" : task.priority === "Medium" ? "warning" : "info"}`}
                            >
                              {task.priority}
                            </span>
                          </td>
                          <td>
                            {task.expectedDuration ||
                              `${task.expectedHours}h ${task.expectedMinutes}m`}
                          </td>
                          <td>
                            {task.status === "Completed" ||
                            task.status === "Incomplete" ? (
                              <span
                                className={`badge light badge-${task.status === "Completed" ? "success" : "danger"}`}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {task.status}
                                {task.status === "Completed" &&
                                  task.completedAt && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        marginLeft: "4px",
                                      }}
                                    >
                                      (
                                      {new Date(
                                        task.completedAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                      )
                                    </span>
                                  )}
                              </span>
                            ) : (
                              <select
                                className={`form-control form-control-sm badge badge-${task.status === "In Progress" ? "primary" : "light"}`}
                                value={task.status}
                                onChange={(e) => {
                                  if (e.target.value === "Postpone") {
                                    setPostponingTask(task);
                                  } else {
                                    handleStatusChange(task.id, e.target.value);
                                  }
                                }}
                                style={{
                                  border: "none",
                                  color: "#fff",
                                  cursor: "pointer",
                                  paddingRight: "25px",
                                  textTransform: "capitalize",
                                  width: "auto",
                                }}
                              >
                                <option
                                  value={task.status}
                                  style={{
                                    color: "#000",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  {task.status}
                                </option>
                                <option
                                  value="Completed"
                                  style={{
                                    color: "#000",
                                    backgroundColor: "#fff",
                                  }}
                                >
                                  Completed
                                </option>
                                {task.allowPostpone && task.postponedDaysUsed < task.maxPostponeDays && (
                                  <option
                                    value="Postpone"
                                    style={{
                                      color: "#000",
                                      backgroundColor: "#fff",
                                    }}
                                  >
                                    Postpone
                                  </option>
                                )}
                              </select>
                            )}
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              {task.status === "Pending" && (
                                <button
                                  className="btn btn-outline-primary shadow mr-2"
                                  onClick={() => handleStartTask(task.id)}
                                  title="Start Task"
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "0",
                                    fontSize: "12px",
                                    borderRadius: "6px",
                                  }}
                                >
                                  <i className="fa fa-play"></i>
                                </button>
                              )}
                              <button
                                className="btn btn-outline-info shadow"
                                onClick={() => setViewTask(task)}
                                title="View Task Details"
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: "0",
                                  fontSize: "12px",
                                  borderRadius: "6px",
                                }}
                              >
                                <i className="fa fa-eye"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      {isFormOpen && (
        <ErrorBoundary>
          <TaskForm
            onClose={() => setIsFormOpen(false)}
            onSaved={() => {
              setIsFormOpen(false);
              fetchTasks();
            }}
          />
        </ErrorBoundary>
      )}

      {viewTask && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Task Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setViewTask(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Task Name:</strong> {viewTask.taskName}
                </p>
                <p>
                  <strong>Description:</strong>{" "}
                  {viewTask.description || "No description provided."}
                </p>
                <p>
                  <strong>Priority:</strong> {viewTask.priority}
                </p>
                <p>
                  <strong>Status:</strong> {viewTask.status}
                </p>
                {viewTask.status === "Completed" && viewTask.completedAt && (
                  <>
                    <p>
                      <strong>Completed On:</strong>{" "}
                      {new Date(viewTask.completedAt).toLocaleString()}
                      {viewTask.deadline &&
                      new Date(viewTask.completedAt) <
                        new Date(viewTask.deadline) ? (
                        <span
                          className="text-success ms-2 font-weight-bold"
                          style={{ fontSize: "13px" }}
                        >
                          <i className="fa fa-check-circle"></i> Completed
                          Early!
                        </span>
                      ) : null}
                    </p>
                    {viewTask.completionNotes && (
                      <p>
                        <strong>Completion Notes:</strong>{" "}
                        {viewTask.completionNotes}
                      </p>
                    )}
                  </>
                )}
                <p>
                  <strong>Planned Date & Time:</strong> {viewTask.plannedDate}{" "}
                  {viewTask.plannedStartTime}
                </p>
                <p>
                  <strong>Duration:</strong>{" "}
                  {viewTask.expectedDuration ||
                    `${viewTask.expectedHours}h ${viewTask.expectedMinutes}m`}
                </p>
                {viewTask.deadline && (
                  <p>
                    <strong>Deadline:</strong>{" "}
                    {new Date(viewTask.deadline).toLocaleString()}
                  </p>
                )}
                {viewTask.assigned_by && (
                  <p>
                    <strong>Assigned By:</strong> Admin
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-danger light"
                  onClick={() => setViewTask(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completion Notes Modal */}
      {completingTask && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Complete Task</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCompletingTask(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label>What did you do in this task?</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Enter completion notes here..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-danger light"
                  onClick={() => setCompletingTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={submitCompletion}
                >
                  Submit & Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Postpone Task Modal */}
      {postponingTask && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Postpone Task</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setPostponingTask(null);
                    setPostponeDays("");
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  You are allowed to postpone this task for a maximum of{" "}
                  <strong>{postponingTask.maxPostponeDays}</strong> days in
                  total.
                </p>
                <p>
                  You have already postponed it by{" "}
                  <strong>{postponingTask.postponedDaysUsed}</strong> days.
                </p>
                <div className="form-group mb-3">
                  <label>
                    How many days would you like to postpone it now?
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max={
                      postponingTask.maxPostponeDays -
                      postponingTask.postponedDaysUsed
                    }
                    value={postponeDays}
                    onChange={(e) => setPostponeDays(e.target.value)}
                    required
                  />
                  <small className="form-text text-muted">
                    Maximum allowed now:{" "}
                    {postponingTask.maxPostponeDays -
                      postponingTask.postponedDaysUsed}{" "}
                    days.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-danger light"
                  onClick={() => {
                    setPostponingTask(null);
                    setPostponeDays("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={submitPostpone}
                >
                  Postpone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagementDashboard;
