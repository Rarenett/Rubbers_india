import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { ThemeContext } from '../../../context/ThemeContext';
import { TitleContext } from '../../../context/TitleContext';
import { useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
/// Scroll

//import ChatBox from "../ChatBox";
import LogoutPage from './Logout';
import ChangePasswordModal from './ChangePasswordModal';
import { getNotifications, getUnreadCount, markNotificationAsRead } from '../../../services/NotificationService';
import axiosInstance from '../../../services/AxiosInstance';

/// Image
import profile from "../../../images/profile/pic1.jpg";
import { Dropdown } from "react-bootstrap";


function Header({ onNote }) {
  // Get user data from Redux state or localStorage fallback
  const { auth } = useSelector(state => state.auth);
  const storedUser = (() => {
    try {
      const details = localStorage.getItem('userDetails');
      return details ? JSON.parse(details)?.user || JSON.parse(details) : null;
    } catch {
      return null;
    }
  })();
  const [freshUser, setFreshUser] = useState(null);
  const user = freshUser || auth?.user || storedUser || {};
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { background, changeBackground } = useContext(ThemeContext);
  const isDark = background?.value === 'dark';

  const location = useLocation();
  const navigate = useNavigate();

  const [adminDashboards, setAdminDashboards] = useState([]);

  useEffect(() => {
    if (user?.is_superuser && (!user?.role?.assigned_dashboards || user.role.assigned_dashboards.length === 0)) {
      axiosInstance.get('/api/auth/dashboards/')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
          setAdminDashboards(list.filter(d => d.is_active));
        })
        .catch(() => {});
    }
  }, [user?.is_superuser, user?.role]);

  const assignedDashboards = (() => {
    if (user?.role?.assigned_dashboards && Array.isArray(user.role.assigned_dashboards) && user.role.assigned_dashboards.length > 0) {
      return user.role.assigned_dashboards;
    }
    if (adminDashboards && adminDashboards.length > 0) {
      return adminDashboards.map(d => ({
        dashboard_id: d.id,
        name: d.name,
        route: d.route,
        is_default: false,
      }));
    }
    return [];
  })();

  const normalizeRoute = (r) => {
    if (!r) return '';
    let clean = r.trim().toLowerCase();
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean.endsWith('/') && clean.length > 1) clean = clean.slice(0, -1);
    return clean;
  };

  const currentPath = normalizeRoute(location.pathname);

  const activeDashboard = assignedDashboards.find(d => {
    const r = normalizeRoute(d.route);
    return r && (currentPath === r || (r !== '/' && currentPath.startsWith(r)));
  });

  const handleSelectDashboard = (dash) => {
    let route = dash.route;
    if (!route) return;
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    navigate(route);
  };

  useEffect(() => {
    setImgError(false);
  }, [user.profile_picture]);

  useEffect(() => {
    // Fetch latest user profile to ensure up-to-date profile picture and designation
    axiosInstance.get('/api/auth/profile/')
      .then(res => {
        if (res.data) {
          setFreshUser(res.data);
          try {
            const raw = localStorage.getItem('userDetails');
            if (raw) {
              const parsed = JSON.parse(raw);
              parsed.user = res.data;
              localStorage.setItem('userDetails', JSON.stringify(parsed));
            }
          } catch (e) {
            console.error('Error syncing userDetails in localStorage:', e);
          }
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    changeBackground({ value: isDark ? 'light' : 'dark', label: isDark ? 'Light' : 'Dark' });
  };

  // Get first name only for header display
  const userName = (() => {
    if (user.first_name && user.first_name.trim()) {
      return user.first_name.trim().split(/\s+/)[0];
    }
    const candidateName = (user.name || user.full_name || '').trim();
    if (candidateName) {
      return candidateName.split(/\s+/)[0];
    }
    if (user.username && user.username.trim()) {
      return user.username.trim();
    }
    if (user.email && user.email.trim()) {
      return user.email.trim().split('@')[0];
    }
    return 'User';
  })();

  const designationTitle = user.designation
    ? (typeof user.designation === 'object' ? (user.designation.title || user.designation.name) : user.designation)
    : '';

  const isBOD = Boolean(
    user.is_board_of_director ||
    user.is_bod ||
    user.bod_profile ||
    (typeof user.role === 'object' && (user.role?.name?.toLowerCase().includes('board') || user.role?.name?.toLowerCase().includes('director') || user.role?.name?.toLowerCase().includes('bod'))) ||
    (typeof user.role === 'string' && (user.role.toLowerCase().includes('board') || user.role.toLowerCase().includes('director') || user.role.toLowerCase().includes('bod')))
  );

  let userRole = 'User';
  if (isBOD) {
    userRole = designationTitle || (typeof user.role === 'object' ? user.role?.name : user.role) || 'Board of Director';
  } else if (user.is_superuser) {
    userRole = 'Admin';
  } else if (designationTitle) {
    userRole = designationTitle;
  } else if (user.is_staff) {
    userRole = 'Staff';
  } else if (user.role) {
    userRole = typeof user.role === 'object' ? (user.role.name || 'User') : user.role;
  }

  const resolveProfilePicUrl = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('data:')) {
      return value;
    }
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    const base = (envUrl ? envUrl.replace(':8001', ':8000') : 'http://127.0.0.1:8000').replace(/\/$/, '');
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${base}${path}`;
  };

  // Get user initials (e.g. "Ram K" -> "RK", "John Doe" -> "JD")
  const getUserInitials = (userObj) => {
    if (!userObj) return 'U';
    const f = (userObj.first_name || '').trim();
    const l = (userObj.last_name || '').trim();
    if (f && l) {
      return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
    }
    const raw = (f || l || userObj.name || userObj.full_name || userObj.username || userObj.email || '').trim();
    if (!raw) return 'U';
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const userProfilePic = resolveProfilePicUrl(user.profile_picture);
  const userInitials = getUserInitials(user);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);


  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const [notifData, countData] = await Promise.all([
        getNotifications(),
        getUnreadCount()
      ]);
      setNotifications(notifData);
      setUnreadCount(countData.unread_count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle mark as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Get initials
  const getInitials = (senderDetails) => {
    if (!senderDetails) return '?';
    const { first_name = '', last_name = '' } = senderDetails;
    return (first_name.charAt(0) + last_name.charAt(0)).toUpperCase() || '?';
  };

  // Get badge color
  const getBadgeColorClass = (color) => {
    const map = {
      success: 'badge-success', primary: 'badge-primary',
      warning: 'badge-warning', danger: 'badge-danger',
      info: 'badge-info', violet: 'badge-primary', orange: 'badge-warning'
    };
    return map[color] || 'badge-primary';
  };

  var path = decodeURIComponent(location.pathname).split("/");
  var lastSegment = path[path.length - 1];
  if (!isNaN(lastSegment) && path.length > 2) {
    lastSegment = path[path.length - 2];
  }

  const { pageTitle } = useContext(TitleContext);

  const titleMap = {
    "repairrequests": "Repair Requests",
    "machineproductmappings": "Machine Mappings",
    "machineoutputs": "Machine Outputs",
    "spareparts": "Spare Parts",
    "lifespans": "Lifespans",
    "typenames": "Type Names",
    "categories": "Categories",
    "subcategories": "Sub-Categories",
    "processes": "Processes",
    "machine-voucher": "Machine Vouchers",
    "not-started-report": "Pending Tasks",
    "not-voted-report": "Pending Votes",
    "update-progress": "Task Progress"
  };

  var displayTitle = "";
  if (pageTitle) {
    displayTitle = typeof pageTitle === 'object' ? (pageTitle?.title || '') : String(pageTitle || '');
  } else if (location.pathname.includes('/reports/assign-duty')) {
    displayTitle = "Assigned Duty Reports";
  } else if (titleMap[lastSegment]) {
    displayTitle = titleMap[lastSegment];
  } else {
    var name = lastSegment.split("-");
    var filterName = name.length >= 3 ? name.filter((n, i) => i > 0) : name;
    var finalName = filterName.includes("app")
      ? filterName.filter((f) => f !== "app")
      : filterName.includes("ui")
        ? filterName.filter((f) => f !== "ui")
        : filterName.includes("uc")
          ? filterName.filter((f) => f !== "uc")
          : filterName.includes("basic")
            ? filterName.filter((f) => f !== "basic")
            : filterName.includes("jquery")
              ? filterName.filter((f) => f !== "jquery")
              : filterName.includes("table")
                ? filterName.filter((f) => f !== "table")
                : filterName.includes("page")
                  ? filterName.filter((f) => f !== "page")
                  : filterName.includes("email")
                    ? filterName.filter((f) => f !== "email")
                    : filterName.includes("ecom")
                      ? filterName.filter((f) => f !== "ecom")
                      : filterName.includes("chart")
                        ? filterName.filter((f) => f !== "chart")
                        : filterName.includes("editor")
                          ? filterName.filter((f) => f !== "editor")
                          : filterName;
    displayTitle = finalName.join(" ").length === 0
      ? "Dashboard"
      : finalName.join(" ") === "dashboard dark"
        ? "Dashboard"
        : finalName.join(" ");
  }

  return (
    <>
      <style>{`
        .dashboard-switcher-dropdown .dropdown-toggle::after {
          display: none !important;
        }
      `}</style>
      <div className="header">
        <div className="header-content">
        <nav className="navbar navbar-expand">
          <div className="collapse navbar-collapse justify-content-between">
            <div className="header-left d-flex align-items-center gap-2 gap-md-3">
              <div
                className="dashboard_bar text-truncate"
                style={{ textTransform: "capitalize", maxWidth: '28vw' }}
              >
                {displayTitle}
              </div>

              {/* DASHBOARD SWITCHER DROPDOWN */}
              {assignedDashboards.length > 0 && (
                <Dropdown className="dashboard-switcher-dropdown position-relative">
                  <Dropdown.Toggle
                    as="button"
                    className="btn btn-sm d-flex align-items-center"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '10px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      color: isDark ? '#f8fafc' : '#334155',
                      fontSize: '13px',
                      fontWeight: 600,
                      gap: '8px',
                      boxShadow: 'none',
                      transition: 'all 0.2s ease',
                    }}
                    title="Switch Dashboard"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: '#22c55e', flexShrink: 0 }}
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <span
                      className="d-inline-block text-truncate"
                      style={{ maxWidth: '140px' }}
                    >
                      {activeDashboard ? activeDashboard.name : 'Switch Dashboard'}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.6, flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </Dropdown.Toggle>

                  <Dropdown.Menu
                    className="mt-1 shadow-lg border-0 py-2"
                    style={{
                      minWidth: '240px',
                      borderRadius: '12px',
                      backgroundColor: isDark ? '#1e1e2d' : '#ffffff',
                      border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <div
                      className="px-3 py-1 mb-1 border-bottom d-flex align-items-center justify-content-between"
                      style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }}
                    >
                      <span
                        className="text-uppercase fw-bold"
                        style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', letterSpacing: '0.5px' }}
                      >
                        Assigned Dashboards ({assignedDashboards.length})
                      </span>
                    </div>

                    {assignedDashboards.map((dash, idx) => {
                      const isSelected = activeDashboard?.dashboard_id === dash.dashboard_id ||
                        (dash.route && normalizeRoute(dash.route) === currentPath);
                      return (
                        <Dropdown.Item
                          key={dash.dashboard_id || dash.id || idx}
                          onClick={() => handleSelectDashboard(dash)}
                          className="d-flex align-items-center justify-content-between px-3 py-2"
                          style={{
                            backgroundColor: isSelected ? (isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)') : 'transparent',
                            color: isSelected ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#e2e8f0' : '#334155'),
                            fontWeight: isSelected ? 600 : 400,
                            borderRadius: '6px',
                            margin: '2px 6px',
                            width: 'calc(100% - 12px)',
                            cursor: 'pointer',
                          }}
                        >
                          <div className="d-flex align-items-center gap-2 text-truncate">
                            <i
                              className={`fa ${isSelected ? 'fa-dot-circle-o' : 'fa-circle-o'}`}
                              style={{
                                fontSize: '12px',
                                color: isSelected ? '#22c55e' : (isDark ? '#64748b' : '#94a3b8'),
                                flexShrink: 0,
                              }}
                            />
                            <span className="text-truncate" style={{ fontSize: '13px' }}>
                              {dash.name}
                            </span>
                          </div>
                          <div className="d-flex align-items-center gap-1 ms-2">
                            {dash.is_default && (
                              <span
                                className="badge rounded-pill"
                                style={{
                                  fontSize: '10px',
                                  padding: '3px 7px',
                                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.12)',
                                  color: isDark ? '#93c5fd' : '#2563eb',
                                  fontWeight: 600,
                                }}
                              >
                                Default
                              </span>
                            )}
                            {isSelected && (
                              <i className="fa fa-check text-success ms-1" style={{ fontSize: '12px' }} />
                            )}
                          </div>
                        </Dropdown.Item>
                      );
                    })}
                  </Dropdown.Menu>
                </Dropdown>
              )}
            </div>
            <ul className="navbar-nav header-right main-notification d-flex align-items-center gap-2 gap-sm-3">
              
              {/* THEME TOGGLE (Commented out: only light theme needed) */}
              {/* <li className="nav-item d-flex align-items-center">
                <button
                  onClick={toggleTheme}
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '50px',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    transition: 'all 0.25s ease',
                    color: isDark ? '#f8fafc' : '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.2px',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'scale(1.04)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {isDark ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f8d564" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                  <span className="d-none d-md-inline">{isDark ? 'Light' : 'Dark'}</span>
                </button>
              </li> */}

              <Dropdown
                as="li"
                className="nav-item dropdown notification_dropdown "
              >
                <Dropdown.Toggle
                  variant=""
                  as="a"
                  className="nav-link bell bell-link i-false c-pointer"
                  onClick={() => onNote()}
                >
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.23779 10.2492L4.66679 11.7064V8.30554L2.23779 10.2492Z" fill="#67636D" />
                    <path d="M1.1665 12.327V23.3334C1.16852 23.8531 1.28817 24.3656 1.5165 24.8325L9.20134 17.15L1.1665 12.327Z" fill="#67636D" />
                    <path d="M26.4832 24.8325C26.7115 24.3656 26.8311 23.8531 26.8332 23.3334V12.327L18.7983 17.15L26.4832 24.8325Z" fill="#67636D" />
                    <path d="M23.3335 8.30554V11.7064L25.7625 10.2492L23.3335 8.30554Z" fill="#67636D" />
                    <path d="M21.0492 13.0772C21.024 12.998 21.0076 12.9162 21.0002 12.8334V7.00004C21.0002 6.69062 20.8773 6.39388 20.6585 6.17508C20.4397 5.95629 20.1429 5.83337 19.8335 5.83337H8.16684C7.85742 5.83337 7.56067 5.95629 7.34188 6.17508C7.12309 6.39388 7.00017 6.69062 7.00017 7.00004V12.8334C6.99274 12.9162 6.97631 12.998 6.95117 13.0772L14.0002 17.3064L21.0492 13.0772Z" fill="#67636D" />
                    <path d="M17.3262 3.50003L14.7292 1.4222C14.5222 1.25653 14.2651 1.16626 14 1.16626C13.7349 1.16626 13.4777 1.25653 13.2708 1.4222L10.6738 3.50003H17.3262Z" fill="#67636D" />
                    <path d="M16.7358 18.3855L14.6008 19.6688C14.4194 19.7778 14.2117 19.8354 14 19.8354C13.7883 19.8354 13.5806 19.7778 13.3991 19.6688L11.2641 18.3855L3.16748 26.4833C3.63438 26.7117 4.14691 26.8313 4.66665 26.8333H23.3333C23.853 26.8313 24.3656 26.7117 24.8325 26.4833L16.7358 18.3855Z" fill="#67636D" />
                  </svg>
                  <span 
                    className="badge light text-white bg-primary rounded-circle"
                    style={{ backgroundColor: '#0a500f', color: '#ffffff' }}
                  >
                    6
                  </span>
                </Dropdown.Toggle>
              </Dropdown>
              <Dropdown
                as="li"
                className="nav-item dropdown notification_dropdown "
              >
                <Dropdown.Toggle
                  variant=""
                  as="a"
                  className="nav-link  ai-icon i-false c-pointer "
                  // href="#"
                  role="button"
                  data-toggle="dropdown"
                >
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23.3333 19.8333H23.1187C23.2568 19.4597 23.3295 19.065 23.3333 18.6666V12.8333C23.3294 10.7663 22.6402 8.75902 21.3735 7.12565C20.1068 5.49228 18.3343 4.32508 16.3333 3.80679V3.49996C16.3333 2.88112 16.0875 2.28763 15.6499 1.85004C15.2123 1.41246 14.6188 1.16663 14 1.16663C13.3812 1.16663 12.7877 1.41246 12.3501 1.85004C11.9125 2.28763 11.6667 2.88112 11.6667 3.49996V3.80679C9.66574 4.32508 7.89317 5.49228 6.6265 7.12565C5.35983 8.75902 4.67058 10.7663 4.66667 12.8333V18.6666C4.67053 19.065 4.74316 19.4597 4.88133 19.8333H4.66667C4.35725 19.8333 4.0605 19.9562 3.84171 20.175C3.62292 20.3938 3.5 20.6905 3.5 21C3.5 21.3094 3.62292 21.6061 3.84171 21.8249C4.0605 22.0437 4.35725 22.1666 4.66667 22.1666H23.3333C23.6428 22.1666 23.9395 22.0437 24.1583 21.8249C24.3771 21.6061 24.5 21.3094 24.5 21C24.5 20.6905 24.3771 20.3938 24.1583 20.175C23.9395 19.9562 23.6428 19.8333 23.3333 19.8333Z" fill="#67636D" />
                    <path d="M9.98193 24.5C10.3863 25.2088 10.971 25.7981 11.6767 26.2079C12.3823 26.6178 13.1839 26.8337 13.9999 26.8337C14.816 26.8337 15.6175 26.6178 16.3232 26.2079C17.0289 25.7981 17.6136 25.2088 18.0179 24.5H9.98193Z" fill="#67636D" />
                  </svg>
                  {unreadCount > 0 && (
                    <span 
                      className="badge light text-white bg-primary rounded-circle"
                      style={{ backgroundColor: '#0a500f', color: '#ffffff' }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Dropdown.Toggle>
                <Dropdown.Menu align="end" className="mt-2">
                  <div className="widget-media dz-scroll p-3 height380 ">
                    <ul className="timeline">
                      {notifications.length > 0 ? notifications.map((notification) => (
                        <li
                          key={notification.id}
                          onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                          style={{
                            cursor: notification.is_read ? 'default' : 'pointer',
                            opacity: notification.is_read ? 0.6 : 1,
                            backgroundColor: notification.is_read ? 'transparent' : 'rgba(10, 80, 15, 0.08)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div className="timeline-panel">
                            <div className={`media me-2 ${notification.avatar_color ? `media-${notification.avatar_color}` : 'media-info'}`}>
                              {notification.sender_details ? (
                                getInitials(notification.sender_details)
                              ) : notification.icon ? (
                                <i className={notification.icon} />
                              ) : (
                                <i className="fa fa-bell" />
                              )}
                            </div>
                            <div className="media-body">
                              <h6 className="mb-1">
                                {notification.message}
                                {!notification.is_read && (
                                  <span className="badge badge-primary badge-sm ms-2">New</span>
                                )}
                              </h6>
                              {notification.badge_text && (
                                <span className={`badge ${getBadgeColorClass(notification.badge_color)} me-2`}>
                                  {notification.badge_text}
                                </span>
                              )}
                              <small className="d-block">
                                {notification.time_ago}
                              </small>
                            </div>
                          </div>
                        </li>
                      )) : (
                        <li style={{ listStyle: 'none' }}>
                          <div className="text-center py-3">
                            <small className="text-muted">Loading notifications...</small>
                          </div>
                        </li>
                      )}
                    </ul>
                    <Link
                      className="all-notification"
                      to="#"
                      onClick={(e) => {
                        e.preventDefault();
                        fetchNotifications();
                      }}
                    >
                      Refresh <i className="ti-arrow-circle-right" />
                    </Link>
                  </div>
                </Dropdown.Menu>
              </Dropdown>
              <Dropdown as="li" className="nav-item dropdown header-profile">
                <Dropdown.Toggle
                  variant=""
                  as="a"
                  className="nav-link i-false c-pointer"
                  // href="#"
                  role="button"
                  data-toggle="dropdown"
                >
                  {(!imgError && userProfilePic) ? (
                    <img
                      src={userProfilePic}
                      alt={userName}
                      onError={() => setImgError(true)}
                      style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '1.25rem',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div
                      className="d-flex align-items-center justify-content-center fw-bold text-white shadow-sm"
                      style={{
                        width: '45px',
                        height: '45px',
                        borderRadius: '1.25rem',
                        background: '#0a500f',
                        fontSize: '15px',
                        fontWeight: '700',
                        letterSpacing: '0.5px',
                        flexShrink: 0,
                        userSelect: 'none',
                        boxShadow: '0 4px 12px rgba(10, 80, 15, 0.25)'
                      }}
                    >
                      {userInitials}
                    </div>
                  )}
                  <div className="header-info d-none d-md-block">
                    <span>{userName}</span>
                    <small>{userRole}</small>
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu align="end" className="mt-2">
                  {/* <Link to="/app-profile" className="dropdown-item ai-icon">
                    <svg
                      id="icon-user1"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-primary"
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx={12} cy={7} r={4} />
                    </svg>
                    <span className="ms-2">Profile </span>
                  </Link> */}
                  <Link to="/email-inbox" className="dropdown-item ai-icon">
                    <svg
                      id="icon-inbox"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ color: '#0a500f' }}
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0a500f"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span className="ms-2">Inbox </span>
                  </Link>
                  <button
                    className="dropdown-item ai-icon"
                    onClick={() => setShowChangePassword(true)}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <svg
                      id="icon-change-password"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ color: '#0d6efd' }}
                      width={18}
                      height={18}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0d6efd"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span className="ms-2">Change Password </span>
                  </button>
                  <LogoutPage />
                </Dropdown.Menu>
              </Dropdown>
            </ul>
          </div>
        </nav>
      </div>
      </div>
      <ChangePasswordModal show={showChangePassword} onHide={() => setShowChangePassword(false)} />
    </>
  );
};
export default Header;