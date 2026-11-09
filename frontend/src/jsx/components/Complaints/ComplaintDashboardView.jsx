import React, { useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ThemeContext } from "../../../context/ThemeContext";

const ComplaintDashboardView = ({ stats }) => {
    const { background } = useContext(ThemeContext);

    return (
        <div className="cm-section-container">
            <div className="cm-section-header mb-4">
                <h3>Complaints Analytics Overview</h3>
            </div>
            <div className="cm-chart-wrapper" style={{ height: '350px', width: '100%', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '15px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={[
                            { name: 'Total', value: stats.total, fill: 'var(--cm-accent)' },
                            { name: 'Pending', value: stats.pending, fill: '#f59e0b' },
                            { name: 'In Progress', value: stats.in_progress, fill: '#8b5cf6' },
                            { name: 'Resolved', value: stats.resolved, fill: '#10b981' },
                            { name: 'Closed', value: stats.closed, fill: '#64748b' }
                        ]}
                        margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                        barSize={40}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'var(--cm-text-secondary)', fontSize: 12, fontWeight: 500 }}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'var(--cm-text-secondary)', fontSize: 12 }}
                        />
                        <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            contentStyle={{ 
                                borderRadius: '10px', 
                                border: 'none', 
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                background: background === 'dark' ? '#1e293b' : '#fff'
                            }}
                        />
                        <Bar 
                            dataKey="value" 
                            radius={[8, 8, 0, 0]}
                            animationDuration={1500}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ComplaintDashboardView;
