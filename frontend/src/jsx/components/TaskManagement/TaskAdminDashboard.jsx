import React, { useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../../services/AxiosInstance";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Spinner,
  Badge,
  Dropdown,
  Modal,
  Tabs,
  Tab,
} from "react-bootstrap";
import swal from "sweetalert";
import { getEmployeesByDepartment } from "../../../services/MachineManagementService";
import CreateButton from "../../../components/permissions/CreateButton";
import EditButton from "../../../components/permissions/EditButton";
import DeleteButton from "../../../components/permissions/DeleteButton";
import Pagination from "../Common/Pagination";

const getTodayLocal = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TaskAdminDashboard = () => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [formData, setFormData] = useState({
    taskName: "",
    description: "",
    department: "",
    user: "", // Assigned employee
    plannedDate: getTodayLocal(),
    plannedStartTime: "",
    expectedHours: 0,
    expectedMinutes: 30,
    expectedEndTime: "10:30",
    priority: "Medium",
    reminderSystem: "Duration Based",
    firstReminderMinutes: 30,
    secondReminderMinutes: 15,
    thirdReminderMinutes: "",
    fourthReminderMinutes: "",
    fifthReminderMinutes: "",
    deadline: "",
    allowPostpone: false,
    maxPostponeDays: 0,
  });

  useEffect(() => {
    fetchDepartments();
    fetchTasks();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await axiosInstance.get("/api/hr/departments/");
      setDepartments(response.data);
    } catch (error) {
      console.error("Error fetching departments", error);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        "/api/task-management/admin-tasks/",
      );
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMutate = () => fetchTasks();
    window.addEventListener("taskMutated", handleMutate);
    return () => window.removeEventListener("taskMutated", handleMutate);
  }, []);

  const handleDepartmentChange = async (e) => {
    const deptId = e.target.value;
    setFormData({ ...formData, department: deptId, user: "" });

    if (deptId) {
      try {
        const employeesData = await getEmployeesByDepartment(deptId);
        setEmployees(employeesData.filter((emp) => emp.user_id));
      } catch (error) {
        console.error("Error fetching employees", error);
      }
    } else {
      setEmployees([]);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let h = parseInt(formData.expectedHours) || 0;
    let m = parseInt(formData.expectedMinutes) || 0;

    let deadline;
    if (
      formData.reminderSystem === "End Time Based" &&
      formData.expectedEndTime
    ) {
      const startDatetime = new Date(
        `${formData.plannedDate}T${formData.plannedStartTime}`,
      );
      deadline = new Date(
        `${formData.endDate || formData.plannedDate}T${formData.expectedEndTime}`,
      );
      // If end time is before start time, assume it ends on the next day (if dates are the same)
      if (
        deadline < startDatetime &&
        (!formData.endDate || formData.endDate === formData.plannedDate)
      ) {
        deadline = new Date(deadline.getTime() + 24 * 60 * 60 * 1000);
      }
      const diffMs = deadline.getTime() - startDatetime.getTime();
      h = Math.floor(diffMs / (1000 * 60 * 60));
      m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    } else {
      const startDatetime = new Date(
        `${formData.plannedDate}T${formData.plannedStartTime}`,
      );
      deadline = new Date(startDatetime.getTime() + (h * 60 + m) * 60000);
      if (
        formData.endDate &&
        formData.endDate !== formData.plannedDate &&
        formData.endDate.includes("-")
      ) {
        const parts = formData.endDate.split("-");
        if (parts.length === 3) {
          const [yyyy, mm, dd] = parts;
          deadline.setFullYear(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
        }
      }
    }

    const durationStr = `${h}h ${m}m`;

    // Format as YYYY-MM-DDTHH:mm:ss in local time to prevent Django from interpreting UTC when USE_TZ=False
    const localDeadlineStr = new Date(
      deadline.getTime() - deadline.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 19);

    const payload = {
      ...formData,
      expectedHours: h,
      expectedMinutes: m,
      expectedDuration: durationStr,
      deadline: localDeadlineStr,
      firstReminderMinutes: formData.firstReminderMinutes || null,
      secondReminderMinutes: formData.secondReminderMinutes || null,
      thirdReminderMinutes: formData.thirdReminderMinutes || null,
      fourthReminderMinutes: formData.fourthReminderMinutes || null,
      fifthReminderMinutes: formData.fifthReminderMinutes || null,
      allowPostpone: formData.allowPostpone,
      maxPostponeDays: formData.maxPostponeDays,
    };

    // Remove endDate from payload since it's not a valid backend field
    delete payload.endDate;

    try {
      if (editTaskId) {
        await axiosInstance.put(
          `/api/task-management/admin-tasks/${editTaskId}/`,
          payload,
        );
        swal("Success", "Task updated successfully", "success");
      } else {
        await axiosInstance.post("/api/task-management/admin-tasks/", payload);
        swal("Success", "Task assigned successfully", "success");
      }
      setShowModal(false);
      setEditTaskId(null);
      fetchTasks();
      setFormData({
        taskName: "",
        description: "",
        department: "",
        user: "",
        plannedDate: getTodayLocal(),
        plannedStartTime: "",
        expectedHours: 0,
        expectedMinutes: 30,
        expectedEndTime: "10:30",
        priority: "Medium",
        reminderSystem: "Duration Based",
        firstReminderMinutes: 30,
        secondReminderMinutes: 15,
        thirdReminderMinutes: "",
        fourthReminderMinutes: "",
        fifthReminderMinutes: "",
        deadline: "",
        allowPostpone: false,
        maxPostponeDays: 0,
      });
      setEmployees([]);
    } catch (error) {
      console.error("Error saving task", error);
      swal("Error", "Failed to save task", "error");
    }
  };

  const handleEdit = async (task) => {
    setEditTaskId(task.id);

    // Ensure employees are loaded for the department
    if (task.department) {
      try {
        const employeesData = await getEmployeesByDepartment(task.department);
        setEmployees(employeesData.filter((emp) => emp.user_id));
      } catch (error) {
        console.error("Error fetching employees", error);
      }
    }

    setFormData({
      taskName: task.taskName || "",
      description: task.description || "",
      department: task.department || "",
      user: task.user || "",
      plannedDate: task.plannedDate || getTodayLocal(),
      endDate:
        (task.deadline ? task.deadline.slice(0, 10) : "") ||
        task.plannedDate ||
        getTodayLocal(),
      plannedStartTime: task.plannedStartTime
        ? task.plannedStartTime.slice(0, 5)
        : "",
      expectedHours: task.expectedHours || 0,
      expectedMinutes: task.expectedMinutes || 30,
      expectedEndTime: task.deadline ? task.deadline.slice(11, 16) : "10:30",
      priority: task.priority || "Medium",
      reminderSystem: "Duration Based",
      firstReminderMinutes: task.firstReminderMinutes || "",
      secondReminderMinutes: task.secondReminderMinutes || "",
      thirdReminderMinutes: task.thirdReminderMinutes || "",
      fourthReminderMinutes: task.fourthReminderMinutes || "",
      fifthReminderMinutes: task.fifthReminderMinutes || "",
      deadline: task.deadline || "",
      allowPostpone: task.allowPostpone || false,
      maxPostponeDays: task.maxPostponeDays || 0,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const willDelete = await swal({
      title: "Are you sure?",
      text: "Once deleted, you will not be able to recover this task!",
      icon: "warning",
      buttons: true,
      dangerMode: true,
    });

    if (willDelete) {
      try {
        await axiosInstance.delete(`/api/task-management/admin-tasks/${id}/`);
        swal("Poof! Task has been deleted!", { icon: "success" });
        fetchTasks();
      } catch (error) {
        console.error("Error deleting task", error);
        swal("Error", "Failed to delete task", "error");
      }
    }
  };

  const handleOpenCreateModal = () => {
    setEditTaskId(null);
    setFormData({
      taskName: "",
      description: "",
      department: "",
      user: "",
      plannedDate: getTodayLocal(),
      endDate: getTodayLocal(),
      plannedStartTime: "",
      expectedHours: 0,
      expectedMinutes: 30,
      expectedEndTime: "10:30",
      priority: "Medium",
      reminderSystem: "Duration Based",
      firstReminderMinutes: 30,
      secondReminderMinutes: 15,
      thirdReminderMinutes: "",
      fourthReminderMinutes: "",
      fifthReminderMinutes: "",
      deadline: "",
      allowPostpone: false,
      maxPostponeDays: 0,
    });
    setEmployees([]);
    setShowModal(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      (task.taskName &&
        task.taskName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.department_name &&
        task.department_name
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (task.user_name &&
        task.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.priority &&
        task.priority.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.status &&
        task.status.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "All" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRecords = filteredTasks.length;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentRecords = filteredTasks.slice(indexOfFirst, indexOfLast);

  return (
    <div className="container-fluid park-area-page">
      <div className="page-titles">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={"#"}>Task Management</Link>
          </li>
          <li className="breadcrumb-item active">
            <Link to={"#"}>Task Admin</Link>
          </li>
        </ol>
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
                  Tasks Assigned By Me
                </Card.Title>
                <p className="mb-0 text-muted" style={{ fontSize: "13px" }}>
                  All tasks assigned across departments
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

                <Form.Select
                  size="sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    width: "auto",
                    minWidth: "130px",
                    height: "36px",
                    fontSize: "13px",
                    borderRadius: "8px",
                    borderColor: "#cbd5e1",
                  }}
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Incomplete">Incomplete</option>
                </Form.Select>

                <CreateButton
                  module="task-admin"
                  onClick={handleOpenCreateModal}
                  style={{
                    height: "36px",
                    borderRadius: "8px",
                    padding: "0 16px",
                  }}
                >
                  Assign New Task
                </CreateButton>
              </div>
            </Card.Header>

            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-responsive-md w-100">
                    <thead>
                      <tr>
                        <th>
                          <strong>SL NO</strong>
                        </th>
                        <th>
                          <strong>TASK NAME</strong>
                        </th>
                        <th>
                          <strong>DEPARTMENT</strong>
                        </th>
                        <th>
                          <strong>ASSIGNED TO</strong>
                        </th>
                        <th>
                          <strong>STATUS</strong>
                        </th>
                        <th>
                          <strong>PRIORITY</strong>
                        </th>
                        <th>
                          <strong>START DATE</strong>
                        </th>
                        <th className="text-end">
                          <strong>ACTIONS</strong>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="text-center py-4 text-muted"
                          >
                            No tasks found.
                          </td>
                        </tr>
                      ) : (
                        currentRecords.map((task, index) => (
                          <tr key={task.id}>
                            <td>{indexOfFirst + index + 1}</td>
                            <td>
                              <span className="fw-semibold text-dark">
                                {task.taskName}
                              </span>
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
                            <td>{task.department_name || "-"}</td>
                            <td>{task.user_name || "-"}</td>
                            <td>
                              <span
                                className={`badge light badge-${
                                  task.status === "Completed"
                                    ? "success"
                                    : task.status === "In Progress"
                                    ? "primary"
                                    : task.status === "Incomplete"
                                    ? "danger"
                                    : "warning"
                                }`}
                                style={{ whiteSpace: "nowrap" }}
                              >
                                {task.status}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge light badge-${
                                  task.priority === "High" ||
                                  task.priority === "Critical"
                                    ? "danger"
                                    : task.priority === "Medium"
                                    ? "warning"
                                    : "info"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </td>
                            <td>
                              {task.plannedDate}{" "}
                              {task.plannedStartTime
                                ? task.plannedStartTime.slice(0, 5)
                                : ""}
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end align-items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewTask(task)}
                                  className="btn btn-outline-info shadow"
                                  title="View Details"
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
                                <EditButton
                                  module="task-admin"
                                  onClick={() => handleEdit(task)}
                                  title="Edit Task"
                                />
                                <DeleteButton
                                  module="task-admin"
                                  onClick={() => handleDelete(task.id)}
                                  title="Delete Task"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && filteredTasks.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  totalPages={totalPages}
                  indexOfFirst={indexOfFirst}
                  indexOfLast={indexOfLast}
                  totalRecords={totalRecords}
                  loading={loading}
                />
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Modal for Assign / Edit Task */}
      <Modal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setEditTaskId(null);
        }}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editTaskId ? "Edit Task" : "Assign New Task"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Tabs
              defaultActiveKey="details"
              id="assign-task-tabs"
              className="mb-3"
            >
              <Tab eventKey="details" title="Task Details">
                <Row>
                  <Col md="6">
                    <Form.Group className="mb-3">
                      <Form.Label>Department *</Form.Label>
                      <Form.Select
                        name="department"
                        value={formData.department}
                        onChange={handleDepartmentChange}
                        required
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md="6">
                    <Form.Group className="mb-3">
                      <Form.Label>Assign To (Employee) *</Form.Label>
                      <Form.Select
                        name="user"
                        value={formData.user}
                        onChange={handleChange}
                        required
                        disabled={!formData.department}
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                          <option key={emp.value} value={emp.user_id}>
                            {emp.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md="12">
                    <Form.Group className="mb-3">
                      <Form.Label>Task Name *</Form.Label>
                      <Form.Control
                        type="text"
                        name="taskName"
                        value={formData.taskName}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col md="12">
                    <Form.Group className="mb-3">
                      <Form.Label>Description</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows="3"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>

              <Tab eventKey="schedule" title="Schedule & Reminders">
                <Row>
                  <Col md="3">
                    <Form.Group className="mb-3">
                      <Form.Label>Start Date *</Form.Label>
                      <Form.Control
                        type="date"
                        name="plannedDate"
                        value={formData.plannedDate}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md="3">
                    <Form.Group className="mb-3">
                      <Form.Label>Start Time *</Form.Label>
                      <Form.Control
                        type="time"
                        name="plannedStartTime"
                        value={formData.plannedStartTime}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md="3">
                    <Form.Group className="mb-3">
                      <Form.Label>End Date</Form.Label>
                      <Form.Control
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleChange}
                      />
                    </Form.Group>
                  </Col>
                  <Col md="3">
                    {formData.reminderSystem === "Duration Based" ? (
                      <Form.Group className="mb-3">
                        <Form.Label>Duration</Form.Label>
                        <div className="d-flex">
                          <Form.Control
                            type="number"
                            name="expectedHours"
                            value={formData.expectedHours}
                            onChange={handleChange}
                            placeholder="H"
                            min="0"
                            className="mr-2 px-1"
                          />
                          <span className="align-self-center mr-2">h</span>
                          <Form.Control
                            type="number"
                            name="expectedMinutes"
                            value={formData.expectedMinutes}
                            onChange={handleChange}
                            placeholder="M"
                            min="0"
                            max="59"
                            className="mr-2 px-1"
                          />
                          <span className="align-self-center">m</span>
                        </div>
                      </Form.Group>
                    ) : (
                      <Form.Group className="mb-3">
                        <Form.Label>End Time</Form.Label>
                        <Form.Control
                          type="time"
                          name="expectedEndTime"
                          value={formData.expectedEndTime}
                          onChange={handleChange}
                          required
                        />
                      </Form.Group>
                    )}
                  </Col>

                  <Col md="6">
                    <Form.Group className="mb-3">
                      <Form.Label>Reminder System *</Form.Label>
                      <Form.Select
                        name="reminderSystem"
                        value={formData.reminderSystem}
                        onChange={handleChange}
                      >
                        <option value="Duration Based">
                          Duration Based
                        </option>
                        <option value="End Time Based">
                          End Time Based
                        </option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md="6">
                    <Form.Group className="mb-3">
                      <Form.Label>Priority *</Form.Label>
                      <Form.Select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md="6">
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        label="Allow Employee to Postpone"
                        name="allowPostpone"
                        checked={formData.allowPostpone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allowPostpone: e.target.checked,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                  <Col md="6">
                    {formData.allowPostpone && (
                      <Form.Group className="mb-3">
                        <Form.Label>Max Postpone Days</Form.Label>
                        <Form.Control
                          type="number"
                          name="maxPostponeDays"
                          value={formData.maxPostponeDays}
                          onChange={handleChange}
                          min="1"
                          required={formData.allowPostpone}
                        />
                      </Form.Group>
                    )}
                  </Col>

                  <Col md="12">
                    <div
                      className="mt-2 mb-1"
                      style={{ fontSize: "0.9rem", fontWeight: 600 }}
                    >
                      {formData.reminderSystem === "Duration Based"
                        ? "Reminders (Mins After Start)"
                        : "Reminders (Mins Before Deadline)"}
                    </div>
                    <Row>
                      {["Low", "Medium", "High", "Critical"].indexOf(
                        formData.priority,
                      ) >= 0 && (
                        <>
                          <Col xs={6} sm={4} md className="mb-2">
                            <Form.Control
                              type="number"
                              name="firstReminderMinutes"
                              value={formData.firstReminderMinutes}
                              onChange={handleChange}
                              min="0"
                              placeholder="1st"
                            />
                          </Col>
                          <Col xs={6} sm={4} md className="mb-2">
                            <Form.Control
                              type="number"
                              name="secondReminderMinutes"
                              value={formData.secondReminderMinutes}
                              onChange={handleChange}
                              min="0"
                              placeholder="2nd"
                            />
                          </Col>
                        </>
                      )}
                      {["Medium", "High", "Critical"].indexOf(
                        formData.priority,
                      ) >= 0 && (
                        <Col xs={6} sm={4} md className="mb-2">
                          <Form.Control
                            type="number"
                            name="thirdReminderMinutes"
                            value={formData.thirdReminderMinutes}
                            onChange={handleChange}
                            min="0"
                            placeholder="3rd"
                          />
                        </Col>
                      )}
                      {["High", "Critical"].indexOf(formData.priority) >=
                        0 && (
                        <Col xs={6} sm={4} md className="mb-2">
                          <Form.Control
                            type="number"
                            name="fourthReminderMinutes"
                            value={formData.fourthReminderMinutes}
                            onChange={handleChange}
                            min="0"
                            placeholder="4th"
                          />
                        </Col>
                      )}
                      {formData.priority === "Critical" && (
                        <Col xs={6} sm={4} md className="mb-2">
                          <Form.Control
                            type="number"
                            name="fifthReminderMinutes"
                            value={formData.fifthReminderMinutes}
                            onChange={handleChange}
                            min="0"
                            placeholder="5th"
                          />
                        </Col>
                      )}
                    </Row>
                  </Col>
                </Row>
              </Tab>
            </Tabs>

            <Row>
              <Col md="12" className="d-flex justify-content-end mt-3">
                <Button
                  className="me-2 btn-cancel-custom"
                  style={{
                    backgroundColor: "#dc3545",
                    borderColor: "#dc3545",
                    color: "#ffffff",
                    borderRadius: "8px",
                    fontWeight: 500,
                    padding: "8px 22px",
                  }}
                  onClick={() => {
                    setShowModal(false);
                    setEditTaskId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  style={{
                    backgroundColor: "#0a500f",
                    borderColor: "#0a500f",
                    borderRadius: "8px",
                    fontWeight: 500,
                    padding: "8px 22px",
                  }}
                >
                  {editTaskId ? "Update Task" : "Assign Task"}
                </Button>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Modal for View Task */}
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
                <p>
                  <strong>Assigned To:</strong>{" "}
                  {viewTask.user_name || "Unknown User"}
                </p>
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
    </div>
  );
};

export default TaskAdminDashboard;
