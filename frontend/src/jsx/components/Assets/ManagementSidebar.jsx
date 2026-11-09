import React from 'react';
import { useNavigate } from 'react-router-dom';

const ManagementSidebar = ({ activeManagement, currentUser }) => {
    const navigate = useNavigate();

    const categories = [
        {
            name: 'Room',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
            label: 'Storage Room',
            adminOnly: true
        },
        {
            name: 'Shelf',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>,
            label: 'Shelf',
            adminOnly: true
        },
        {
            name: 'Rack',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="2" y1="9" x2="22" y2="9"></line><line x1="2" y1="15" x2="22" y2="15"></line><circle cx="6" cy="6" r="1" fill="currentColor"></circle><circle cx="6" cy="12" r="1" fill="currentColor"></circle><circle cx="6" cy="18" r="1" fill="currentColor"></circle></svg>,
            label: 'Rack',
            adminOnly: true
        },
        {
            name: 'File',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
            label: 'File',
            adminOnly: false
        },
        {
            name: 'Allocation',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>,
            label: 'Allocations',
            adminOnly: false
        },
        {
            name: 'Report',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
            label: 'Report',
            adminOnly: false
        },
        {
            name: 'Key',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>,
            label: 'Key',
            adminOnly: false
        },
        {
            name: 'Key Allocation',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3"></path><path d="M16 11l2 2 2-2"></path></svg>,
            label: 'Key Allocation',
            adminOnly: false
        },
        {
            name: 'Key Report',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="10" cy="15" r="2"></circle><path d="m11.5 13.5 1.5-1.5"></path></svg>,
            label: 'Key Report',
            adminOnly: false
        },
        {
            name: 'Type',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>,
            label: 'Asset Type',
            adminOnly: true
        },
        {
            name: 'AssetCategory',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path></svg>,
            label: 'Asset Category',
            adminOnly: true
        },
        {
            name: 'AssetAttributeDefinition',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>,
            label: 'Attribute Definition',
            adminOnly: true
        },
        {
            name: 'Asset',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>,
            label: 'Asset',
            adminOnly: false
        },
    ].filter(cat => !cat.adminOnly || currentUser?.user?.is_superuser);

    return (
        <div className="fd-action-grid mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {categories.map(cat => (
                <div
                    key={cat.name}
                    className={`fd-action-card ${activeManagement === cat.name ? 'active-tab' : ''}`}
                    style={{
                        padding: '1rem',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}
                    onClick={() => navigate(`/asset-management/${encodeURIComponent(cat.name)}`)}
                >
                    <div className="fd-stat-icon-box" style={{ width: '40px', height: '40px', fontSize: '1.2rem', marginBottom: 0 }}>
                        {cat.icon}
                    </div>
                    <div className="fd-action-content">
                        <h3 style={{ fontSize: '1rem', margin: 0, color: activeManagement === cat.name ? 'var(--fd-accent)' : 'var(--fd-text-dark)' }}>
                            {cat.label}
                        </h3>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ManagementSidebar;
