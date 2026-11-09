import React, { useContext } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ThemeContext } from "../../../context/ThemeContext";

const TrendChart = ({ data }) => {
 const { background } = useContext(ThemeContext);
 const isDark = background.value === "dark";

 if (!data || data.length === 0) {
 return (
 <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
 <p className="text-muted">No allocation data available for this period.</p>
 </div>
 );
 }

 const options = {
 chart: {
 type: 'area',
 toolbar: { show: false },
 zoom: { enabled: false },
 background: 'transparent',
 animations: {
 enabled: true,
 easing: 'easeinout',
 speed: 800,
 }
 },
 stroke: {
 curve: 'smooth',
 width: [3, 3],
 },
 colors: ['#00d1ff', '#8b5cf6'], // Cyan for Files, Purple for Keys
 fill: {
 type: 'gradient',
 gradient: {
 shadeIntensity: 1,
 opacityFrom: 0.4,
 opacityTo: 0.05,
 stops: [0, 90, 100],
 }
 },
 dataLabels: { enabled: false },
 grid: {
 borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
 xaxis: { lines: { show: false } },
 yaxis: { lines: { show: true } }
 },
 xaxis: {
 categories: data.map(item => item.date || ''),
 labels: {
 style: {
 colors: isDark ? '#a1a1c5' : '#64748b',
 fontSize: '11px'
 }
 },
 axisBorder: { show: false },
 axisTicks: { show: false }
 },
 yaxis: {
 labels: {
 style: {
 colors: isDark ? '#a1a1c5' : '#64748b',
 fontSize: '11px'
 }
 }
 },
 legend: {
 position: 'top',
 horizontalAlign: 'right',
 offsetY: -10,
 itemMargin: { horizontal: 15 },
 markers: { radius: 12 },
 labels: { colors: isDark ? '#fff' : '#000' }
 },
 tooltip: {
 theme: isDark ? 'dark' : 'light',
 shared: true,
 intersect: false,
 x: {
 format: 'dd MMM'
 }
 }
 };

 const series = [
 {
 name: 'Files',
 data: data.map(item => item.files || 0)
 },
 {
 name: 'Keys',
 data: data.map(item => item.keys || 0)
 }
 ];

 return (
 <ReactApexChart options={options} series={series} type="area" height={320} />
 );


};

export default TrendChart;
