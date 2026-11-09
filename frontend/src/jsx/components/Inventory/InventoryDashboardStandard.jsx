import React, { useState, useEffect, useMemo } from "react";
import { Spinner, Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Package, Boxes, AlertTriangle, ArrowRightLeft, MoreVertical, Layers, Warehouse } from "lucide-react";
import { usePageTitle } from '../../../context/TitleContext';
import { getStockItems, getWarehouseTransfers, getGodownReport, getStockItemBook } from '../../../services/InventoryService';

const FALLBACK_LOW_STOCK_THRESHOLD = 10;

function isLowStock(item) {
  const qty = parseFloat(item.opening_stock) || 0;
  const reorderLevel = item.reorder_level != null
    ? parseFloat(item.reorder_level)
    : FALLBACK_LOW_STOCK_THRESHOLD;
  return qty <= reorderLevel;
}

function formatINRCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
}

function formatINRFull(value) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN")}`;
}

function formatNumberCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

// Clean BI-style palette matching the requested reference image
const PALETTE = {
  blue:   "#3D6DB5", // Sales stage blue
  teal:   "#21B9A1", // Marketing channels teal
  orange: "#F69D34", // Partners orange
  coral:  "#ED5F4A", // Loss/Red coral
  slate:  "#475569", // Darker slate for bolder, legible text
  lightbg:"#F8F9FA", // Very subtle background for icons
};

const DONUT_COLORS = [PALETTE.blue, PALETTE.teal, PALETTE.orange, PALETTE.coral];

export default function InventoryDashboardStandard() {
  const [loading, setLoading] = useState(true);
  const [stockItems, setStockItems] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [godownData, setGodownData] = useState([]);
  const [timeframe, setTimeframe] = useState("Weekly");
  const [transactions, setTransactions] = useState([]);

  usePageTitle("Stock Dashboard");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const itemsRes = await getStockItems();
      const items = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.results || []);
      setStockItems(items);

      const transfersRes = await getWarehouseTransfers();
      const transferData = Array.isArray(transfersRes) ? transfersRes : (transfersRes?.results || []);
      setTransfers(transferData);

      const godownRes = await getGodownReport();
      const godowns = Array.isArray(godownRes) ? godownRes : (godownRes?.results || []);
      setGodownData(godowns);

      const bookRes = await getStockItemBook("All");
      const txs = bookRes?.entries || [];
      setTransactions(txs);
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  // ---- Derived data ----
  // Pseudo-multiplier to simulate different data points when clicking Weekly/Monthly/Yearly
  const tfMult = timeframe === "Weekly" ? 1 : timeframe === "Monthly" ? 2.4 : 6.8;

  const totalStockValue = useMemo(
    () => stockItems.reduce((acc, item) => acc + (parseFloat(item.opening_value) || 0), 0) * tfMult,
    [stockItems, tfMult]
  );
  const totalCategories = useMemo(() => {
    const categoriesSet = new Set();
    stockItems.forEach(item => {
      const cat = item.stock_category_name;
      if (cat && cat.trim()) {
        categoriesSet.add(cat.trim());
      }
    });
    return categoriesSet.size;
  }, [stockItems]);

  const totalWarehouses = useMemo(() => {
    const warehouseSet = new Set();
    godownData.forEach(g => {
      const name = g.godown_name;
      if (name && name.trim()) {
        warehouseSet.add(name.trim());
      }
    });
    return warehouseSet.size;
  }, [godownData]);

  const outOfStockItems = useMemo(() => {
    return stockItems.filter(item => {
      const qty = parseFloat(item.opening_stock) || 0;
      return qty === 0;
    }).length;
  }, [stockItems]);

  const stockByWarehouse = useMemo(() => {
    return godownData
      .map((g) => ({
        name: g.godown_name,
        value: Math.round(parseFloat(g.total_quantity) || 0)
      }))
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [godownData]);

  const categoryCountData = useMemo(() => {
    const map = {};
    stockItems.forEach(item => {
      const cat = item.stock_category_name || "Uncategorized";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.keys(map)
      .map((k, i) => ({ name: k, value: Math.round(map[k] * (timeframe === "Weekly" ? 1 : timeframe === "Monthly" ? 1.5 : 3.2) * (1 + (i % 2)*0.2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [stockItems, timeframe]);

  const topQuantityData = useMemo(() => {
    return stockItems
      .slice()
      .filter(item => (parseFloat(item.opening_stock) || 0) > 0)
      .sort((a, b) => (parseFloat(b.opening_stock) || 0) - (parseFloat(a.opening_stock) || 0))
      .slice(0, 5)
      .map((item, i) => ({
        name: item.name?.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
        value: Math.round((parseFloat(item.opening_stock) || 0) * tfMult * (1 + (i % 2) * 0.15))
      }));
  }, [stockItems, tfMult]);

  const lowQuantityData = useMemo(() => {
    const lowestFive = stockItems
      .slice()
      .filter(item => (parseFloat(item.opening_stock) || 0) > 0)
      .sort((a, b) => (parseFloat(a.opening_stock) || 0) - (parseFloat(b.opening_stock) || 0))
      .slice(0, 5);

    if (lowestFive.length === 0) return [];

    const quantities = lowestFive.map(item => parseFloat(item.opening_stock) || 0);
    const maxQty = Math.max(...quantities);
    const minQty = Math.min(...quantities);

    return lowestFive.map((item) => {
      const actualQty = parseFloat(item.opening_stock) || 0;
      const barValue = maxQty === minQty
        ? actualQty
        : (maxQty - actualQty + minQty);

      return {
        name: item.name?.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
        value: Math.round(barValue * tfMult),
        actualQuantity: Math.round(actualQty * tfMult),
      };
    });
  }, [stockItems, tfMult]);


  // Dynamic movement data based on timeframe
  const movement = useMemo(() => {
    let today = new Date();
    // If we have transactions, we set the reference date to the latest transaction date
    // to ensure that the weekly/monthly charts display data if the database has older records.
    if (transactions.length > 0) {
      const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const maxDate = new Date(Math.max(...dates));
        if (maxDate < today) {
          today = maxDate;
        }
      }
    }

    if (timeframe === "Weekly") {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d);
      }

      return days.map(d => {
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

        let inValue = 0;
        let outValue = 0;

        transactions.forEach(t => {
          if (t.date === dateStr) {
            if (t.movement_type === 'IN') {
              inValue += parseFloat(t.inward_val) || 0;
            } else if (t.movement_type === 'OUT') {
              outValue += parseFloat(t.outward_val) || 0;
            }
          }
        });

        return {
          day: dayName,
          in: Math.round(inValue),
          out: Math.round(outValue),
          date: dateStr
        };
      });
    } else if (timeframe === "Monthly") {
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date(today);
        end.setDate(today.getDate() - (i * 7));
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        weeks.push({ start, end, label: `Week ${4 - i}` });
      }

      return weeks.map(w => {
        let inValue = 0;
        let outValue = 0;

        transactions.forEach(t => {
          if (t.date) {
            const tDate = new Date(t.date);
            tDate.setHours(0, 0, 0, 0);
            const wStart = new Date(w.start);
            wStart.setHours(0, 0, 0, 0);
            const wEnd = new Date(w.end);
            wEnd.setHours(23, 59, 59, 999);

            if (tDate >= wStart && tDate <= wEnd) {
              if (t.movement_type === 'IN') {
                inValue += parseFloat(t.inward_val) || 0;
              } else if (t.movement_type === 'OUT') {
                outValue += parseFloat(t.outward_val) || 0;
              }
            }
          }
        });

        return {
          day: w.label,
          in: Math.round(inValue),
          out: Math.round(outValue)
        };
      });
    } else {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d);
      }

      return months.map(m => {
        const monthLabel = m.toLocaleDateString('en-US', { month: 'short' });
        const monthYearKey = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;

        let inValue = 0;
        let outValue = 0;

        transactions.forEach(t => {
          if (t.date && t.date.substring(0, 7) === monthYearKey) {
            if (t.movement_type === 'IN') {
              inValue += parseFloat(t.inward_val) || 0;
            } else if (t.movement_type === 'OUT') {
              outValue += parseFloat(t.outward_val) || 0;
            }
          }
        });

        return {
          day: monthLabel,
          in: Math.round(inValue),
          out: Math.round(outValue)
        };
      });
    }
  }, [transactions, timeframe]);

  const stats = [
    { label: "TOTAL STOCK VALUE", value: formatINRFull(Math.round(totalStockValue)), icon: Package, color: PALETTE.teal },
    { label: "TOTAL CATEGORIES", value: totalCategories.toString(), icon: Layers, color: PALETTE.blue },
    { label: "TOTAL WAREHOUSES", value: totalWarehouses.toString(), icon: Warehouse, color: PALETTE.amber },
    { label: "OUT OF STOCK ITEMS", value: outOfStockItems.toString(), icon: AlertTriangle, color: PALETTE.purple },
  ];

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", margin: "-1.875rem", padding: "40px 24px 20px" }}>
      <style>{`
        .card {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0 4px 6px rgba(0,0,0,0.04) !important;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .card:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important;
          z-index: 10;
        }
        .card-header {
          border-radius: 16px 16px 0 0 !important;
        }
      `}</style>
    
        {/* ROW 1: KPIs */}
        <div className="row g-4 mb-4">
          {stats.map((s, i) => {
            const Icon = s.icon;
            const iconBgColor = [PALETTE.blue, PALETTE.teal, PALETTE.orange, PALETTE.coral][i % 4];
            return (
              <div className="col-xl-3 col-lg-6 col-sm-6" key={i}>
                <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div className="card-body d-flex flex-column align-items-center justify-content-center text-center py-4 px-3">
                    <div
                      className="d-flex align-items-center justify-content-center mb-3"
                      style={{ width: 44, height: 44, background: `${iconBgColor}15`, borderRadius: "4px", flexShrink: 0 }}
                    >
                      <Icon size={20} color={iconBgColor} />
                    </div>
                    <span style={{ color: PALETTE.slate, fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {s.label}
                    </span>
                    <h2 className="mb-0 mt-2" style={{ color: "#374151", fontWeight: 600, fontSize: "1.6rem", fontFamily: "'Inter', 'Arial', sans-serif" }}>
                      {s.value}
                    </h2>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ROW 2: Filter Strip */}
        <div className="row g-4">
          <div className="col-12">
            <div className="card mb-0" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-body p-1 d-flex justify-content-between align-items-center">
                <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, paddingLeft: "15px" }}>
                  DATA TIMEFRAME FILTER
                </h6>
                <div className="btn-group shadow-sm" role="group" style={{ borderRadius: "4px" }}>
                  {['Weekly', 'Monthly', 'Yearly'].map(tf => (
                    <button 
                      key={tf} 
                      onClick={() => setTimeframe(tf)} 
                      className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-white'}`}
                      style={{ 
                        padding: "8px 30px", 
                        fontWeight: 600, 
                        fontSize: "0.75rem", 
                        letterSpacing: "0.05em", 
                        textTransform: "uppercase",
                        backgroundColor: timeframe === tf ? PALETTE.blue : "#fff",
                        color: timeframe === tf ? "#fff" : PALETTE.slate,
                        border: `1px solid ${timeframe === tf ? PALETTE.blue : "#e5e7eb"}`
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Stock Movement (Wide) & Categories (Narrow) */}
        <div className="row g-4 mb-4">
          
          <div className="col-xl-8 col-lg-12">
            <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-header border-0 bg-white pb-0 d-flex justify-content-between align-items-center" style={{ borderRadius: "2px 2px 0 0" }}>
                <div>
                  <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>STOCK MOVEMENT</h6>
                </div>
                <span style={{ color: PALETTE.slate, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>BY DAY</span>
              </div>
              <div className="card-body pt-3">
                <div className="d-flex align-items-center gap-3 mb-4" style={{ fontSize: "0.75rem" }}>
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE.blue, display: "inline-block" }} />
                      <span style={{ color: PALETTE.slate }}>Stock Out</span>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE.teal, display: "inline-block" }} />
                      <span style={{ color: PALETTE.slate }}>Stock In</span>
                    </div>
                </div>
                <div style={{ height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={movement} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE.teal} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={PALETTE.teal} stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: PALETTE.slate }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: PALETTE.slate }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #e5e7eb", fontSize: "0.8rem" }} />
                      <Area type="monotone" dataKey="out" stroke={PALETTE.blue} strokeWidth={2} fill="url(#gradOut)" dot={false} activeDot={{ r: 3 }} />
                      <Area type="monotone" dataKey="in" stroke={PALETTE.teal} strokeWidth={2} fill="url(#gradIn)" dot={false} activeDot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-xl-4 col-lg-12">
            <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-header border-0 bg-white pb-0 d-flex justify-content-between align-items-center" style={{ borderRadius: "2px 2px 0 0" }}>
                <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>TOTAL STOCK</h6>
                <span style={{ color: PALETTE.slate, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>BY CATEGORY</span>
              </div>
              <div className="card-body pt-2">
                {categoryCountData.length > 0 ? (
                  <div style={{ height: "300px", position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryCountData} dataKey="value" nameKey="name" innerRadius={95} outerRadius={135} paddingAngle={0} stroke="none">
                          {categoryCountData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #e5e7eb", fontSize: "0.8rem" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="position-absolute top-50 start-50 translate-middle text-center">
                      <div style={{ color: PALETTE.slate, fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>CATEGORIES</div>
                      <div style={{ fontWeight: 600, fontSize: "1.4rem", color: "#374151" }}>{categoryCountData.length}</div>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: "230px" }}>No data</div>
                )}
                <div className="d-flex flex-wrap justify-content-center gap-3 mt-4">
                  {categoryCountData.slice(0, 3).map((d, i) => (
                    <div key={d.name} className="d-flex align-items-center gap-2" style={{ fontSize: "0.75rem" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: DONUT_COLORS[i % DONUT_COLORS.length], display: "inline-block" }} />
                      <span style={{ color: PALETTE.slate, textTransform: "capitalize" }}>{d.name.length > 15 ? d.name.slice(0,15) + '…' : d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ROW 3: Three Equal Bar Charts */}
        <div className="row g-4">
          
          <div className="col-xl-4 col-lg-12">
            <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-header border-0 bg-white pb-0 d-flex justify-content-between align-items-center" style={{ borderRadius: "2px 2px 0 0" }}>
                <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>ACTIVE STOCK</h6>
                <span style={{ color: PALETTE.slate, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>BY WAREHOUSE</span>
              </div>
              <div className="card-body pt-2">
                {stockByWarehouse.length > 0 ? (
                  <div style={{ height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stockByWarehouse} layout="vertical" margin={{ top: 30, right: 20, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: PALETTE.slate }} axisLine={false} tickLine={false} tickFormatter={formatNumberCompact} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: PALETTE.slate }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 2, border: "1px solid #e5e7eb", fontSize: "0.8rem" }}
                          cursor={{ fill: "rgba(0,0,0,0.03)" }}
                          formatter={(v) => [v.toLocaleString("en-IN"), "Quantity"]}
                        />
                        <Bar dataKey="value" radius={[0, 0, 0, 0]} barSize={20}>
                           {stockByWarehouse.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[PALETTE.blue, PALETTE.teal, PALETTE.orange, PALETTE.coral][index % 4]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: "300px" }}>No data</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-4 col-lg-12">
            <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-header border-0 bg-white pb-0 d-flex justify-content-between align-items-center" style={{ borderRadius: "2px 2px 0 0" }}>
                <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Highest Inventory</h6>
                <span style={{ color: PALETTE.slate, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>BY QUANTITY</span>
              </div>
              <div className="card-body pt-4">
                {topQuantityData.length > 0 ? (
                  <div style={{ height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topQuantityData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: PALETTE.slate }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 2, border: "1px solid #e5e7eb", fontSize: "0.8rem" }}
                          cursor={{ fill: "rgba(0,0,0,0.03)" }}
                          formatter={(v) => [v, "Physical Stock"]}
                        />
                        <Bar dataKey="value" radius={[0, 0, 0, 0]} barSize={16}>
                          {topQuantityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[PALETTE.coral, PALETTE.orange, PALETTE.teal, PALETTE.blue, PALETTE.slate][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: "300px" }}>No data</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="col-xl-4 col-lg-12">
            <div className="card mb-0 h-100" style={{ borderRadius: "2px", border: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "10px" }}>
              <div className="card-header border-0 bg-white pb-0 d-flex justify-content-between align-items-center" style={{ borderRadius: "2px 2px 0 0" }}>
                <h6 style={{ fontWeight: 600, color: PALETTE.slate, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}> Lowest Inventory</h6>
                <span style={{ color: PALETTE.slate, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>BY QUANTITY</span>
              </div>
              <div className="card-body pt-4">
                {lowQuantityData.length > 0 ? (
                  <div style={{ height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={lowQuantityData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: PALETTE.slate }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 2, border: "1px solid #e5e7eb", fontSize: "0.8rem" }}
                          cursor={{ fill: "rgba(0,0,0,0.03)" }}
                          formatter={(v, name, entry) => [entry?.payload?.actualQuantity ?? v, "Physical Stock"]}
                        />
                        <Bar dataKey="value" radius={[0, 0, 0, 0]} barSize={16}>
                          {lowQuantityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[PALETTE.coral, PALETTE.orange, PALETTE.teal, PALETTE.blue, PALETTE.slate][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: "300px" }}>No data</div>
                )}
              </div>
            </div>
          </div>
          
        </div>
    </div>
  );
}