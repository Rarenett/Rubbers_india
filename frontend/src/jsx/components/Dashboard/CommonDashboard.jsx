import React, { useState, useEffect, useContext } from "react";
import { Spinner, Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  Building2, Search, Filter, Settings, TrendingUp, TrendingDown,
  IndianRupee, ShoppingCart, ShoppingBag, CreditCard, Activity, Bell, Box, MapPin, Package, FileText, Briefcase, Users,
  ArrowRight, Calendar, Vote
} from "lucide-react";
import axiosInstance from "../../../services/AxiosInstance";
import { ThemeContext } from "../../../context/ThemeContext";
import { usePageTitle } from '../../../context/TitleContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, AreaChart, Area
} from 'recharts';
import './CommonDashboard.css';

export default function CommonDashboard() {
  const { background } = useContext(ThemeContext);
  const isDark = background.value === "dark";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState("all_time"); // all_time, this_month, last_month, this_year
  usePageTitle("Executive Dashboard");

  // Convert semantic date range to actual YYYY-MM-DD for backend
  const getDates = (range) => {
    const today = new Date();
    let start = new Date();
    let end = new Date(today);

    if (range === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (range === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (range === 'this_year') {
      start = new Date(today.getFullYear(), 0, 1);
    } else if (range === 'all_time') {
      start = new Date(2020, 0, 1);
    }

    let displayStr = '';
    if (range === 'all_time') {
      displayStr = 'All Time';
    } else {
      displayStr = `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }

    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      display: displayStr
    };
  };

  const fetchDashboardData = () => {
    setLoading(true);
    const dates = getDates(dateRange);

    axiosInstance.get(`/api/sales/common-dashboard/?start_date=${dates.start_date}&end_date=${dates.end_date}`)
      .then(response => {
        setData(response.data);
      })
      .catch(error => {
        console.error("Error fetching dashboard data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    document.title = "Executive Dashboard";
    fetchDashboardData();
  }, [dateRange]);

  if (loading && !data) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const { kpis, line_chart, categories, recent_orders, top_products, inventory, alerts } = data || {};

  const textColor = isDark ? "#F8FAFC" : "#172B3A";
  const mutedColor = isDark ? "#94A3B8" : "#64748B";
  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderColor = isDark ? "#334155" : "#E2E8F0";

  const cardStyle = {
    background: cardBg,
    borderRadius: "16px",
    border: `1px solid ${borderColor}`,
    boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 10px rgba(15, 61, 94, 0.04)",
    padding: "24px",
    height: "100%",
    display: "flex",
    flexDirection: "column"
  };

  const renderKPI = (title, dataKey, icon, iconColor, iconBg, isCurrency = false) => {
    const kpiData = kpis?.[dataKey] || { current: 0, change: 0, sparkline: [] };
    const value = isCurrency ? formatCurrency(kpiData.current) : new Intl.NumberFormat('en-IN').format(kpiData.current);
    const { change, sparkline } = kpiData;
    const isPositive = change >= 0;

    const sparkData = (sparkline || []).map(val => (typeof val === 'object' ? val : { val }));

    const specificCardStyle = {
      ...cardStyle,
    };

    return (
      <div className="col-12 col-md-6 col-xl-3 mb-4 animate-fade-in-up">
        <div style={specificCardStyle} className="premium-card">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div className="glow-icon-box" style={{
              width: "40px", height: "40px", borderRadius: "50%",
              background: iconColor, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {icon}
            </div>
            <span style={{ color: mutedColor, fontSize: "0.875rem", fontWeight: 600 }}>{title}</span>
          </div>

          <h3 style={{ color: textColor, fontWeight: 700, margin: "10px 0", fontSize: "1.75rem" }}>
            {value}
          </h3>

          <div className="d-flex justify-content-between align-items-end mt-auto">
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                color: iconColor,
                display: "flex", alignItems: "center", fontSize: "0.875rem", fontWeight: 600,
              }}>
                {isPositive ? <TrendingUp size={16} className="me-1" /> : <TrendingDown size={16} className="me-1" />}
                {Math.abs(change)}%
              </span>
              <span style={{ color: mutedColor, fontSize: "0.75rem" }}>from last period</span>
            </div>

            <div style={{ width: "80px", height: "40px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={iconColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={iconColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="val" stroke={iconColor} fillOpacity={1} fill={`url(#color-${dataKey})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const datesInfo = getDates(dateRange);

  return (
    <div className={`dashboard-theme-parent ${isDark ? 'theme-dark' : 'theme-light'}`} style={{ padding: "0 0 40px", backgroundColor: isDark ? "#0F172A" : "#F5F8FA", fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* Top Header Section */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-3 animate-fade-in-up" style={{ borderBottom: `1px solid ${borderColor}`, position: "relative", zIndex: 5 }}>
        <div className="mb-3 mb-md-0">
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: "2rem", letterSpacing: "-0.5px", color: textColor }}>Executive Dashboard</h2>
          <p style={{ margin: "6px 0 0 0", color: mutedColor, fontSize: "0.95rem", fontWeight: 500 }}>Real-time insights and business performance</p>
        </div>

        <div className="d-flex gap-3 align-items-center">
          <div className="position-relative d-none d-lg-block" style={{ width: "300px" }}>
            <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: mutedColor, pointerEvents: "none" }} />
            <input type="text" className="form-control ps-5" placeholder="Search anything... (e.g. orders)" style={{
              background: cardBg,
              border: `1px solid ${borderColor}`, borderRadius: "100px", color: textColor, fontSize: "0.875rem",
              transition: "border-color 0.2s ease", padding: "10px 20px 10px 45px"
            }} onFocus={(e) => e.target.style.borderColor = "#18A6B8"} onBlur={(e) => e.target.style.borderColor = borderColor} />
          </div>

          <Dropdown>
            <Dropdown.Toggle variant="light" id="dropdown-basic" style={{
              background: cardBg,
              border: `1px solid ${borderColor}`,
              color: textColor,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "100px",
              fontWeight: 500,
              fontSize: "0.875rem",
              padding: "8px 20px"
            }}>
              <Calendar size={16} color={mutedColor} />
              {datesInfo.display}
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setDateRange("all_time")}>All Time</Dropdown.Item>
              <Dropdown.Item onClick={() => setDateRange("this_month")}>This Month</Dropdown.Item>
              <Dropdown.Item onClick={() => setDateRange("last_month")}>Last Month</Dropdown.Item>
              <Dropdown.Item onClick={() => setDateRange("this_year")}>This Year</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="row">
        {renderKPI("Total Revenue", "revenue", <IndianRupee size={20} />, "#0F3D5E", "rgba(15, 61, 94, 0.05)", true)}
        {renderKPI("Total Orders", "orders", <ShoppingCart size={20} />, "#1677A8", "rgba(22, 119, 168, 0.05)")}
        {renderKPI("Total Expenses", "expenses", <CreditCard size={20} />, "#E05252", "rgba(224, 82, 82, 0.05)", true)}
        {renderKPI("Net Profit", "profit", <Activity size={20} />, "#16A085", "rgba(22, 160, 133, 0.05)", true)}
      </div>

      {/* Charts Row */}
      <div className="row mb-4">
        {/* Sales & Revenue Overview */}
        <div className="col-12 col-xl-8 mb-4 mb-xl-0">
          <div style={cardStyle}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ margin: 0, fontWeight: 700, color: textColor }}>Sales & Revenue Overview</h5>
              <div className="d-flex gap-4 align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0F3D5E" }}></div>
                  <span style={{ fontSize: "0.8125rem", color: mutedColor, fontWeight: 500 }}>Revenue</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#18A6B8" }}></div>
                  <span style={{ fontSize: "0.8125rem", color: mutedColor, fontWeight: 500 }}>Orders</span>
                </div>
              </div>
            </div>
            {line_chart && line_chart.length > 0 ? (
              <div style={{ height: "300px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={line_chart} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                    <defs>
                      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0F3D5E" floodOpacity="0.15" />
                      </filter>
                      <filter id="shadow-green" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#18A6B8" floodOpacity="0.15" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: mutedColor, fontSize: 12 }} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: mutedColor, fontSize: 12 }} tickFormatter={(value) => `₹${value / 1000}k`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: mutedColor, fontSize: 12 }} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: cardBg, borderColor: borderColor, color: textColor, borderRadius: "8px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}
                      itemStyle={{ color: textColor }}
                    />
                    <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#0F3D5E" radius={[6, 6, 0, 0]} barSize={24} filter="url(#shadow)" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#18A6B8" strokeWidth={4} filter="url(#shadow-green)" dot={{ r: 4, fill: "#18A6B8", strokeWidth: 2, stroke: cardBg }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="d-flex justify-content-center align-items-center" style={{ height: "300px", color: mutedColor }}>
                No sales data available.
              </div>
            )}
          </div>
        </div>

        {/* Sales by Category */}
        <div className="col-12 col-xl-4">
          <div style={cardStyle}>
            <h5 style={{ margin: 0, fontWeight: 700, color: textColor, marginBottom: "20px" }}>Sales by Product Category</h5>

            {categories && categories.length > 0 ? (
              <>
                <div style={{ height: "200px", width: "100%", position: "relative" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: cardBg, borderColor: borderColor, color: textColor, borderRadius: "8px" }}
                        formatter={(value) => [formatCurrency(value), undefined]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                    textAlign: "center", pointerEvents: "none"
                  }}>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: textColor }}>
                      {formatCurrency(categories.reduce((acc, curr) => acc + curr.value, 0))}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: mutedColor, fontWeight: 500 }}>Total Sales</div>
                  </div>
                </div>

                <div className="d-flex flex-column gap-2 mt-2">
                  {categories.map((cat, idx) => (
                    <div key={idx} className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: cat.color }}></div>
                        <span style={{ color: mutedColor, fontSize: "0.875rem", fontWeight: 500 }}>{cat.name}</span>
                      </div>
                      <span style={{ color: textColor, fontWeight: 600, fontSize: "0.875rem" }}>
                        {((cat.value / categories.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="d-flex justify-content-center align-items-center h-100" style={{ color: mutedColor }}>
                No product sales available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Row */}
      <div className="row mb-4">
        {/* Recent Alerts */}
        <div className="col-12">
          <div style={{ ...cardStyle, padding: 0 }}>
            <div className="d-flex justify-content-between align-items-center" style={{ padding: "20px", borderBottom: `1px solid ${borderColor}` }}>
              <h5 style={{ margin: 0, fontWeight: 700, color: textColor }}>Recent Alerts</h5>
              <Link to="/task-management/dashboard" style={{ fontSize: "0.875rem", color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>View All</Link>
            </div>

            <div className="row g-0" style={{ "--alert-border-color": borderColor }}>
              {(alerts || []).map((alert, idx) => {
                const getAlertIcon = (type) => {
                  switch (type) {
                    case "warning": return <ShoppingCart size={20} color="#F59E0B" />;
                    case "danger": return <Bell size={20} color="#E05252" />;
                    case "info": return <FileText size={20} color="#1677A8" />;
                    case "success": return <IndianRupee size={20} color="#16A085" />;
                    default: return <Bell size={20} color={mutedColor} />;
                  }
                };
                const getAlertColor = (type) => {
                  switch (type) {
                    case "warning": return "#F59E0B";
                    case "danger": return "#E05252";
                    case "info": return "#1677A8";
                    case "success": return "#16A085";
                    default: return mutedColor;
                  }
                };
                const color = getAlertColor(alert.type);

                return (
                  <div key={idx} className="col-12 col-md-6 col-xl-3 p-3 alert-item">
                    <div className="d-flex gap-3">
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                        background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div>
                        <h6 style={{ margin: "0 0 4px 0", color: textColor, fontSize: "0.875rem", fontWeight: 600 }}>{alert.message.split(":")[0]}</h6>
                        <p style={{ margin: 0, color: mutedColor, fontSize: "0.75rem", lineHeight: 1.4 }}>{alert.message.split(":")[1] || alert.message}</p>
                        <p style={{ margin: "4px 0 0 0", color: mutedColor, fontSize: "0.6875rem" }}>{alert.time}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Details Row */}
      <div className="row mb-5">
        {/* Top Selling Products */}
        <div className="col-12 col-xl-4 mb-4 mb-xl-0">
          <div style={cardStyle}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ margin: 0, fontWeight: 700, color: textColor }}>Top Selling Products</h5>
            </div>

            <div className="table-responsive">
              <table className="table table-borderless align-middle mb-0" style={{ color: textColor }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px", paddingLeft: 0, width: "30px" }}>#</th>
                    <th style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px" }}>Product Name</th>
                    <th className="text-end" style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px" }}>Qty Sold</th>
                    <th className="text-end" style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px", paddingRight: 0 }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(top_products || []).length > 0 ? top_products.map((prod, idx) => (
                    <tr key={idx} style={{ borderBottom: idx === top_products.length - 1 ? "none" : `1px solid ${borderColor}` }}>
                      <td style={{ padding: "12px 0", fontWeight: 500, fontSize: "0.875rem", color: mutedColor }}>{idx + 1}</td>
                      <td style={{ padding: "12px 0" }}>
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Box size={14} color={mutedColor} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{prod.name}</span>
                        </div>
                      </td>
                      <td className="text-end" style={{ padding: "12px 0", fontWeight: 500, fontSize: "0.875rem", color: mutedColor }}>{prod.quantity}</td>
                      <td className="text-end" style={{ padding: "12px 0", fontWeight: 600, fontSize: "0.875rem" }}>{formatCurrency(prod.amount)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="text-center py-4" style={{ color: mutedColor }}>No product data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="col-12 col-xl-4 mb-4 mb-xl-0">
          <div style={cardStyle}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ margin: 0, fontWeight: 700, color: textColor }}>Recent Orders</h5>
              <Link to="/sales-orders" style={{ fontSize: "0.875rem", color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>View All</Link>
            </div>

            <div className="table-responsive">
              <table className="table table-borderless align-middle mb-0" style={{ color: textColor }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px", paddingLeft: 0, width: "30px" }}>#</th>
                    <th style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px" }}>Order ID</th>
                    <th style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px" }}>Customer</th>
                    <th className="text-end" style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px" }}>Amount</th>
                    <th className="text-end" style={{ color: mutedColor, fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600, paddingBottom: "12px", paddingRight: 0 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent_orders || []).length > 0 ? recent_orders.map((order, idx) => {
                    const getStatusProps = (status) => {
                      switch (status) {
                        case "Delivered": return { bg: "rgba(16, 185, 129, 0.1)", text: "#10b981" };
                        case "Shipped": return { bg: "rgba(59, 130, 246, 0.1)", text: "#3b82f6" };
                        case "Processing": return { bg: "rgba(245, 158, 11, 0.1)", text: "#f59e0b" };
                        default: return { bg: "rgba(107, 114, 128, 0.1)", text: "#6b7280" };
                      }
                    };
                    const sp = getStatusProps(order.status);
                    return (
                      <tr key={idx} style={{ borderBottom: idx === recent_orders.length - 1 ? "none" : `1px solid ${borderColor}` }}>
                        <td style={{ padding: "12px 0", fontWeight: 500, fontSize: "0.875rem", color: mutedColor }}>{idx + 1}</td>
                        <td style={{ padding: "12px 0", fontWeight: 500, fontSize: "0.875rem", color: "#3b82f6" }}>{order.order_no}</td>
                        <td style={{ padding: "12px 0", fontWeight: 500, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }} title={order.customer}>
                          {order.customer}
                        </td>
                        <td className="text-end" style={{ padding: "12px 0", fontWeight: 600, fontSize: "0.875rem" }}>{formatCurrency(order.amount)}</td>
                        <td className="text-end" style={{ padding: "12px 0" }}>
                          <span style={{
                            padding: "4px 8px", borderRadius: "4px", fontSize: "0.6875rem", fontWeight: 600,
                            background: sp.bg, color: sp.text, display: "inline-block"
                          }}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan="5" className="text-center py-4" style={{ color: mutedColor }}>No recent orders</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="col-12 col-xl-4">
          <div style={cardStyle}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ margin: 0, fontWeight: 700, color: textColor }}>Inventory Summary</h5>
              <Link to="/Inventory/dashboard" style={{ fontSize: "0.875rem", color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>View All</Link>
            </div>

            <div className="row g-3">
              <div className="col-6">
                <div style={{
                  padding: "16px", borderRadius: "8px",
                  background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
                  border: `1px solid ${borderColor}`
                }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={14} />
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px 0", color: mutedColor, fontSize: "0.75rem", fontWeight: 600 }}>Total Stock</p>
                  <h4 style={{ margin: 0, fontWeight: 700, color: textColor }}>
                    {new Intl.NumberFormat('en-IN').format(inventory?.total_stock_qty || 0)}
                  </h4>
                  <div style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600, marginTop: "4px" }}>↑ 6.3%</div>
                </div>
              </div>

              <div className="col-6">
                <div style={{
                  padding: "16px", borderRadius: "8px",
                  background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
                  border: `1px solid ${borderColor}`
                }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Activity size={14} />
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px 0", color: mutedColor, fontSize: "0.75rem", fontWeight: 600 }}>Low Stock Items</p>
                  <h4 style={{ margin: 0, fontWeight: 700, color: textColor }}>
                    {inventory?.low_stock_items || 0}
                  </h4>
                  <div style={{ color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, marginTop: "4px" }}>↑ 2.1%</div>
                </div>
              </div>

              <div className="col-6">
                <div style={{
                  padding: "16px", borderRadius: "8px",
                  background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
                  border: `1px solid ${borderColor}`
                }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MapPin size={14} />
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px 0", color: mutedColor, fontSize: "0.75rem", fontWeight: 600 }}>Warehouse</p>
                  <h4 style={{ margin: 0, fontWeight: 700, color: textColor }}>
                    {inventory?.warehouses || 0}
                  </h4>
                  <div style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600, marginTop: "4px" }}>Active</div>
                </div>
              </div>

              <div className="col-6">
                <div style={{
                  padding: "16px", borderRadius: "8px",
                  background: isDark ? "rgba(255,255,255,0.02)" : "#f9fafb",
                  border: `1px solid ${borderColor}`
                }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Settings size={14} />
                    </div>
                  </div>
                  <p style={{ margin: "0 0 4px 0", color: mutedColor, fontSize: "0.75rem", fontWeight: 600 }}>Inventory Value</p>
                  <h4 style={{ margin: 0, fontWeight: 700, color: textColor, fontSize: "1.25rem" }}>
                    {formatCurrency(inventory?.total_value || 0)}
                  </h4>
                  <div style={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 600, marginTop: "4px" }}>↑ 5.8%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Modules Grid */}
      <div className="row g-3 mt-1">
        {[
          {
            name: "Pending Approvals",
            desc: "Track, review and make decisions on pending approvals",
            icon: <Vote size={20} />,
            link: "/my-votes",
            color: "#7C3AED",
            bg: isDark ? "rgba(124, 58, 237, 0.20)" : "rgba(124, 58, 237, 0.12)",
            isSpecial: true
          },
          { name: "Sales", desc: "Manage orders, customers and sales targets", icon: <ShoppingCart size={20} />, link: "/sales-orders", color: "#0F3D5E", bg: "rgba(15, 61, 94, 0.05)" },
          { name: "Purchase", desc: "Handle purchase orders, suppliers and deliveries", icon: <ShoppingBag size={20} />, link: "/purchase-orders", color: "#1677A8", bg: "rgba(22, 119, 168, 0.05)" },
          { name: "Inventory", desc: "Track stock, warehouses and inventory value", icon: <Package size={20} />, link: "/Inventory/dashboard", color: "#18A6B8", bg: "rgba(24, 166, 184, 0.05)" },
          { name: "Finance", desc: "Manage invoices, payments, expenses and cash flow", icon: <CreditCard size={20} />, link: "/finance/dashboard", color: "#16A085", bg: "rgba(22, 160, 133, 0.05)" },
          { name: "HR", desc: "Employee management, attendance and payroll", icon: <Users size={20} />, link: "/hr/dashboards", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.05)" },
          { name: "Production", desc: "Monitor production orders, output and machine utilization", icon: <Settings size={20} />, link: "/production/shifts", color: "#0F3D5E", bg: "rgba(15, 61, 94, 0.05)" }
        ].map((module, idx) => (
          <div key={idx} className="col-12 col-sm-6 col-md-4 col-xl module-tile animate-fade-in-up delay-4">
            <Link to={module.link} style={{ textDecoration: "none" }}>
              <div style={{
                background: module.isSpecial
                  ? (isDark ? "rgba(124, 58, 237, 0.12)" : "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)")
                  : cardBg,
                border: module.isSpecial
                  ? `1.5px solid ${isDark ? "#8B5CF6" : "#C4B5FD"}`
                  : `1px solid ${borderColor}`,
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                transition: "all 0.25s ease",
                boxShadow: module.isSpecial
                  ? (isDark ? "0 4px 16px rgba(124, 58, 237, 0.25)" : "0 4px 16px rgba(124, 58, 237, 0.12)")
                  : "0 2px 8px rgba(0,0,0,0.02)"
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = module.color;
                  e.currentTarget.style.backgroundColor = module.bg;
                  if (module.isSpecial) {
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(124, 58, 237, 0.28)";
                    e.currentTarget.style.transform = "translateY(-3px)";
                  } else {
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = module.isSpecial
                    ? (isDark ? "#8B5CF6" : "#C4B5FD")
                    : borderColor;
                  e.currentTarget.style.backgroundColor = module.isSpecial
                    ? (isDark ? "rgba(124, 58, 237, 0.12)" : "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)")
                    : (isDark ? "rgba(255,255,255,0.02)" : "#ffffff");
                  e.currentTarget.style.boxShadow = module.isSpecial
                    ? (isDark ? "0 4px 16px rgba(124, 58, 237, 0.25)" : "0 4px 16px rgba(124, 58, 237, 0.12)")
                    : "0 2px 8px rgba(0,0,0,0.02)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="d-flex align-items-center gap-3 mb-2">
                  <div className="module-icon glow-icon-box" style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    background: module.color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {module.icon}
                  </div>
                  <div>
                    <h6 style={{ margin: 0, fontWeight: 700, color: textColor }}>{module.name}</h6>
                  </div>
                </div>
                <p style={{ margin: "0 0 16px 0", color: mutedColor, fontSize: "0.75rem", lineHeight: 1.5, flex: 1 }}>{module.desc}</p>
                <div className="mt-auto d-flex justify-content-end">
                  <ArrowRight size={16} color={module.color} />
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

    </div>
  );
}
