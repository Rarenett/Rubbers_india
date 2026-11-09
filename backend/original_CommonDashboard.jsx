import React, { useState, useEffect, Fragment } from "react";
import { Spinner } from "react-bootstrap";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { Users, Building2, AlertCircle, LogIn } from "lucide-react";
import axiosInstance from "../../../services/AxiosInstance";

// Glenda banner image imported from local images
import glendaBanner from "../../../images/glenda-banner.jpg";

export default function CommonDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    document.title = "Company Overview";
    axiosInstance.get("/api/hr/company-dashboard/")
      .then(response => {
        setData(response.data);
      })
      .catch(error => {
        console.error("Error fetching company dashboard data:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  const { kpis, growth_chart, department_distribution, complaint_status, gate_distribution } = data;

  const stats = [
    { label: "Total Employees", value: kpis.employees.current, themeColor: "primary", icon: Users },
    { label: "Active Departments", value: kpis.departments.current, themeColor: "warning", icon: Building2 },
    { label: "Pending Complaints", value: kpis.pending_complaints.current, themeColor: "danger", icon: AlertCircle },
    { label: "Gate Visits (Today)", value: kpis.visitors_today.current, themeColor: "info", icon: LogIn },
  ];

  return (
    <Fragment>
      {/* Banner */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card overflow-hidden" style={{ borderRadius: '12px', border: 'none' }}>
            <div style={{ height: '220px', backgroundImage: `url(${glendaBanner})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
              <div className="position-absolute bottom-0 left-0 right-0 p-4" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', color: 'white' }}>
                <h2 className="mb-1 text-white font-w700 fs-32">Glenda Aqua Foods and Packs Pvt Ltd</h2>
                <div className="d-flex align-items-center gap-3">
                  <span className="fs-14 opacity-90">Factory 1 • Glen Valley, Chenkara, Kothamangalam, Ernakulam</span>
                  <span className="badge badge-success">All Branches Live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="row">
        {stats.map((s, i) => (
          <div className="col-xl-3 col-xxl-6 col-lg-6 col-sm-6" key={i}>
            <div className="card card-bd">
              <div className={`bg-${s.themeColor} card-border`} />
              <div className="card-body">
                <div className="media align-items-center">
                  <div className="media-body me-3">
                    <h2 className="num-text text-black font-w700 mb-1">{s.value}</h2>
                    <span className="fs-14 text-muted">{s.label}</span>
                  </div>
                  <div className={`text-${s.themeColor}`}>
                    <s.icon size={36} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        {/* LEFT COLUMN */}
        <div className="col-xl-8 col-lg-12">
          {/* Area Chart */}
          <div className="card">
            <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
              <h4 className="fs-20 mb-0 text-black font-w600">Workforce Growth</h4>
            </div>
            <div className="card-body">
              <div style={{ height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growth_chart} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }} />
                    <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#colorTotal)" activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-xl-4 col-lg-12">
          {/* Department Distribution (Donut) */}
          <div className="card" style={{ height: '368px' }}>
            <div className="card-header border-0 pb-0">
              <h4 className="fs-20 mb-0 text-black font-w600">Dept Distribution</h4>
            </div>
            <div className="card-body position-relative d-flex flex-column justify-content-center">
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={department_distribution} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={2} stroke="none">
                      {department_distribution.map((entry, index) => {
                        const COLORS = ["#8b5cf6", "#3D6DB5", "#21B9A1", "#F69D34", "#ED5F4A"];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ transform: 'translate(-50%, -60%)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>DEPTS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{department_distribution.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Left Bottom: Complaints Overview */}
        <div className="col-xl-6 col-lg-12">
          <div className="card">
            <div className="card-header border-0 pb-0">
              <h4 className="fs-20 mb-0 text-black font-w600">Complaints Status</h4>
            </div>
            <div className="card-body">
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complaint_status} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                      {(complaint_status || []).map((entry, index) => {
                        const COLORS = ['#F69D34', '#3D6DB5', '#10b981', '#ef4444'];
                        return <Cell key={`comp-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Bottom: Visitor Traffic */}
        <div className="col-xl-6 col-lg-12">
          <div className="card">
            <div className="card-header border-0 pb-0">
              <h4 className="fs-20 mb-0 text-black font-w600">Visitor Traffic by Dept</h4>
            </div>
            <div className="card-body">
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gate_distribution} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                      {(gate_distribution || []).map((entry, index) => {
                        const COLORS = ['#1b2c45', '#3D6DB5', '#21B9A1', '#F69D34', '#ED5F4A', '#8b5cf6'];
                        return <Cell key={`gate-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
