import React, { useContext } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ThemeContext } from "../../../context/ThemeContext";

const RoomChart = ({ data }) => {
 const { background } = useContext(ThemeContext);
 const isDark = background.value === "dark";

 if (!data || data.length === 0) {
 return (
 <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
 <p className="text-muted">No storage data available.</p>
 </div>
 );
 }

 const options = {
 chart: {
 type: 'donut',
 background: 'transparent',
 animations: {
 enabled: true,
 easing: 'easeinout',
 speed: 800,
 }
 },
 labels: data.map(item => item.room_name || 'Unassigned'),
 colors: [
 '#6366f1', '#00d1ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'
 ],
 stroke: { show: false },
 plotOptions: {
 pie: {
 donut: {
 size: '75%',
 labels: {
 show: true,
 name: {
 show: true,
 color: isDark ? '#fff' : '#1e293b',
 fontSize: '14px',
 fontWeight: 600
 },
 value: {
 show: true,
 color: isDark ? '#a1a1c5' : '#64748b',
 fontSize: '20px',
 fontWeight: 700
 },
 total: {
 show: true,
 label: 'Total Assets',
 color: isDark ? '#fff' : '#1e293b',
 fontSize: '14px',
 fontWeight: 600
 }
 }
 }
 }
 },
 dataLabels: { enabled: false },
 legend: {
 position: 'bottom',
 offsetY: 0,
 labels: { colors: isDark ? '#a1a1c5' : '#64748b' },
 markers: { radius: 12 }
 },
 tooltip: { theme: isDark ? 'dark' : 'light' }
 };

 const series = data.map(item => item.count || 0);

 return (
 <ReactApexChart options={options} series={series} type="donut" height={350} />
 );

};

export default RoomChart;
