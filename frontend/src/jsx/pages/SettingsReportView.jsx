import React, { useState, useEffect, useContext } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ThemeContext } from '../../context/ThemeContext';

import { formatDate } from '../../utils/dateUtils';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/settings`;

const getAuthHeaders = () => {
    try {
        const userDetails = localStorage.getItem('userDetails');
        if (!userDetails) return {};
        const { access } = JSON.parse(userDetails);
        return { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
    } catch { return {}; }
};

const fetchData = async (endpoint) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/${endpoint}/`, { headers: getAuthHeaders() });
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data?.results)) return res.data.results;
        return [];
    } catch { return []; }
};

// Reusable sub-components
const StatusBadge = ({ active }) => (
    <span style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px',
        background: active ? '#34d39920' : '#f8717120',
        color: active ? '#34d399' : '#f87171',
        border: `1px solid ${active ? '#34d39940' : '#f8717140'}`,
        borderRadius: '20px', padding: '3px 10px',
        whiteSpace: 'nowrap', flexShrink: 0,
    }}>
        {active ? '● Active' : '○ Inactive'}
    </span>
);

const Fields = ({ items, th }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
        {items.filter(f => f.value !== null && f.value !== undefined && f.value !== '').map(f => (
            <div key={f.label} style={{ background: th.fieldBg, borderRadius: '8px', padding: '8px 10px' }}>
                <div style={{ color: th.sub, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1px', marginBottom: '3px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {f.icon && <i className={`fa ${f.icon}`} style={{ fontSize: '10px' }} />} {f.label}
                </div>
                <div style={{ color: th.title, fontWeight: 600, fontSize: '0.83rem', wordBreak: 'break-all' }}>
                    {String(f.value)}
                </div>
            </div>
        ))}
    </div>
);

// Custom Full Page Company View
const FullCompanyView = ({ company, addresses, contacts, th }) => {
    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* Main Header Card */}
            <div style={{
                background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px',
                padding: '30px', marginBottom: '24px', position: 'relative', overflow: 'hidden',
                boxShadow: th.cardShadow
            }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle at top right, #4fc3f715 0%, transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', gap: '30px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: '120px', height: '120px', borderRadius: '24px', background: '#4fc3f710', border: '1px solid #4fc3f730', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {company.logo ? (
                            <img src={company.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
                        ) : (
                            <i className="fa fa-building" style={{ fontSize: '48px', color: '#4fc3f7' }} />
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0, color: th.title, fontWeight: 800, fontSize: '2rem' }}>{company.name}</h2>
                            <StatusBadge active={company.is_active} />
                        </div>
                        <h5 style={{ color: th.sub, fontWeight: 500, marginBottom: '20px' }}>{company.display_name}</h5>

                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ color: th.sub, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Company Code</div>
                                <div style={{ color: th.title, fontWeight: 700, fontSize: '1.1rem' }}>{company.company_code || '—'}</div>
                            </div>
                            <div style={{ width: '1px', background: th.cardBorder, margin: '5px 0' }} />
                            <div>
                                <div style={{ color: th.sub, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>GST Number</div>
                                <div style={{ color: th.title, fontWeight: 700, fontSize: '1.1rem' }}>{company.gst_no || '—'}</div>
                            </div>
                            <div style={{ width: '1px', background: th.cardBorder, margin: '5px 0' }} />
                            <div>
                                <div style={{ color: th.sub, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>Date Format</div>
                                <div style={{ color: th.title, fontWeight: 700, fontSize: '1.1rem' }}>{company.date_format || '—'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                {/* General Information */}
                <div style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: th.cardShadow }}>
                    <h5 style={{ color: th.title, fontWeight: 700, marginBottom: '20px', borderBottom: `1px solid ${th.cardBorder}`, paddingBottom: '12px' }}>
                        <i className="fa fa-info-circle" style={{ marginRight: '10px', color: '#4fc3f7' }} /> General Details
                    </h5>
                    <Fields th={th} items={[
                        { label: 'Registration No.', value: company.registration_no, icon: 'fa-file-text' },
                        { label: 'PAN Number', value: company.pan_no, icon: 'fa-id-card' },
                        { label: 'Country', value: company.country, icon: 'fa-globe' },
                        { label: 'Timezone', value: company.timezone, icon: 'fa-clock-o' },
                        { label: 'Website', value: company.website, icon: 'fa-link' },
                        { label: 'Created At', value: formatDate(company.created_at), icon: 'fa-calendar' },
                    ]} />
                </div>

                {/* Contact Information Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Primary Contacts */}
                    <div style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: th.cardShadow }}>
                        <h5 style={{ color: th.title, fontWeight: 700, marginBottom: '20px', borderBottom: `1px solid ${th.cardBorder}`, paddingBottom: '12px' }}>
                            <i className="fa fa-phone" style={{ marginRight: '10px', color: '#4fc3f7' }} /> Primary Contacts
                        </h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {contacts.length > 0 ? contacts.map((c, i) => (
                                <div key={i} style={{ background: th.fieldBg, borderRadius: '12px', padding: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4fc3f715', color: '#4fc3f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa fa-user" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: th.title, fontWeight: 700, fontSize: '0.9rem' }}>{c.contact_person}</div>
                                        <div style={{ color: th.sub, fontSize: '0.8rem' }}>{c.phone} | {c.email}</div>
                                    </div>
                                    {c.is_primary && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4fc3f7', background: '#4fc3f718', padding: '2px 8px', borderRadius: '4px' }}>PRIMARY</span>}
                                </div>
                            )) : <div style={{ color: th.sub, textAlign: 'center', padding: '20px' }}>No contacts found</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Vision & Mission */}
            {(company.vision || company.mission) && (
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: company.vision && company.mission ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', gap: '24px' }}>
                    {company.vision && (
                        <div style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: th.cardShadow }}>
                            <h5 style={{ color: th.title, fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="fa fa-eye" style={{ color: '#4fc3f7' }} /> Vision
                            </h5>
                            <div style={{ color: th.title, lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{company.vision}</div>
                        </div>
                    )}
                    {company.mission && (
                        <div style={{ background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: th.cardShadow }}>
                            <h5 style={{ color: th.title, fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <i className="fa fa-bullseye" style={{ color: '#4fc3f7' }} /> Mission
                            </h5>
                            <div style={{ color: th.title, lineHeight: '1.6', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>{company.mission}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Addresses */}
            <div style={{ marginTop: '24px', background: th.cardBg, border: `1px solid ${th.cardBorder}`, borderRadius: '16px', padding: '24px', boxShadow: th.cardShadow }}>
                <h5 style={{ color: th.title, fontWeight: 700, marginBottom: '20px', borderBottom: `1px solid ${th.cardBorder}`, paddingBottom: '12px' }}>
                    <i className="fa fa-map-marker" style={{ marginRight: '10px', color: '#4fc3f7' }} /> Registered Addresses
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {addresses.length > 0 ? addresses.map((a, i) => (
                        <div key={i} style={{ background: th.fieldBg, borderRadius: '12px', padding: '20px', position: 'relative' }}>
                            <div style={{ color: '#4fc3f7', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>{a.address_type || 'Address'}</div>
                            <div style={{ color: th.title, fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 500 }}>
                                {a.address_line1}<br />
                                {a.address_line2 && <>{a.address_line2}<br /></>}
                                {a.city}, {a.state}<br />
                                {a.country} - {a.postal_code}
                            </div>
                        </div>
                    )) : <div style={{ color: th.sub, textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>No addresses found</div>}
                </div>
            </div>
        </div>
    );
}

// Per-entity: title, icon, color, endpoint, search fields, card renderer
const ENTITY_CONFIG = {
    company: {
        title: 'Company Profile', icon: 'fa-building', color: '#4fc3f7',
        endpoint: 'company',
        searchKeys: ['name', 'display_name', 'gst_no', 'country'],
        CardBody: ({ item, th }) => null, // Not used for company since it's full page
    },
    branches: {
        title: 'Branches', icon: 'fa-code-branch', color: '#a78bfa',
        endpoint: 'branches',
        searchKeys: ['name', 'branch_code', 'gst_number', 'country'],
        CardBody: ({ item, th, related }) => (
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#a78bfa18', border: '1px solid #a78bfa44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="fa fa-code-branch" style={{ fontSize: '20px', color: '#a78bfa' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#a78bfa18', color: '#a78bfa', border: '1px solid #a78bfa44', borderRadius: '6px', padding: '1px 8px' }}>
                            {item.branch_code}
                        </span>
                    </div>
                    <StatusBadge active={item.is_active} />
                </div>
                <Fields th={th} items={[
                    { label: 'GST No.', value: item.gst_number, icon: 'fa-id-card' },
                    { label: 'Country', value: item.country, icon: 'fa-globe' },
                    { label: 'Currency', value: item.default_currency, icon: 'fa-money' },
                    { label: 'Timezone', value: item.timezone, icon: 'fa-clock-o' },
                ]} />

                {related.addresses?.length > 0 && (
                    <RelatedSection title="Addresses" icon="fa-map-marker" color="#a78bfa" th={th}>
                        {related.addresses.map((a, idx) => <MiniAddress key={idx} address={a} th={th} color="#a78bfa" />)}
                    </RelatedSection>
                )}
                {related.contacts?.length > 0 && (
                    <RelatedSection title="Contacts" icon="fa-phone" color="#a78bfa" th={th}>
                        {related.contacts.map((c, idx) => <MiniContact key={idx} contact={c} th={th} color="#a78bfa" />)}
                    </RelatedSection>
                )}
                {related.bankAccounts?.length > 0 && (
                    <RelatedSection title="Bank Accounts" icon="fa-university" color="#a78bfa" th={th}>
                        {related.bankAccounts.map((b, idx) => <MiniBank key={idx} bank={b} th={th} color="#a78bfa" />)}
                    </RelatedSection>
                )}
            </>
        ),
    },
    factories: {
        title: 'Factories', icon: 'fa-industry', color: '#34d399',
        endpoint: 'factories',
        searchKeys: ['name', 'factory_code', 'license_number'],
        CardBody: ({ item, th, related }) => (
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#34d39918', border: '1px solid #34d39944', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="fa fa-industry" style={{ fontSize: '20px', color: '#34d399' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#34d39918', color: '#34d399', border: '1px solid #34d39944', borderRadius: '6px', padding: '1px 8px' }}>
                            {item.factory_code}
                        </span>
                    </div>
                    <StatusBadge active={item.is_active} />
                </div>
                <Fields th={th} items={[
                    { label: 'License No.', value: item.license_number, icon: 'fa-certificate' },
                    { label: 'Timezone', value: item.timezone, icon: 'fa-clock-o' },
                    { label: 'Branch ID', value: item.branch, icon: 'fa-code-branch' },
                ]} />

                {related.addresses?.length > 0 && (
                    <RelatedSection title="Addresses" icon="fa-map-marker" color="#34d399" th={th}>
                        {related.addresses.map((a, idx) => <MiniAddress key={idx} address={a} th={th} color="#34d399" />)}
                    </RelatedSection>
                )}
                {related.contacts?.length > 0 && (
                    <RelatedSection title="Contacts" icon="fa-phone" color="#34d399" th={th}>
                        {related.contacts.map((c, idx) => <MiniContact key={idx} contact={c} th={th} color="#34d399" />)}
                    </RelatedSection>
                )}
            </>
        ),
    },
    warehouses: {
        title: 'Warehouses', icon: 'fa-warehouse', color: '#fbbf24',
        endpoint: 'warehouses',
        searchKeys: ['name', 'code'],
        CardBody: ({ item, th, related }) => {
            const hasOwnAddress = related.addresses?.length > 0;
            const parentAddress = related.parentAddresses?.[0];

            return (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fbbf2418', border: '1px solid #fbbf2444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fa fa-warehouse" style={{ fontSize: '20px', color: '#fbbf24' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#fbbf2418', color: '#fbbf24', border: '1px solid #fbbf2444', borderRadius: '6px', padding: '1px 8px' }}>
                                {item.code}
                            </span>
                        </div>
                        <StatusBadge active={item.is_active} />
                    </div>
                    <div style={{ background: '#fbbf2410', border: '1px solid #fbbf2430', borderRadius: '10px', padding: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <i className="fa fa-cube" style={{ color: '#fbbf24', fontSize: '20px' }} />
                        <div>
                            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>
                                {item.total_capacity ?? '—'} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.capacity_unit}</span>
                            </div>
                            <div style={{ color: th.sub, fontSize: '0.73rem', marginTop: '2px' }}>Total Capacity</div>
                        </div>
                    </div>
                    <Fields th={th} items={[
                        { label: 'Branch', value: item.branch, icon: 'fa-code-branch' },
                        { label: 'Factory', value: item.factory, icon: 'fa-industry' },
                    ]} />

                    {(hasOwnAddress || parentAddress) && (
                        <RelatedSection title="Address" icon="fa-map-marker" color="#fbbf24" th={th}>
                            {hasOwnAddress ? (
                                related.addresses.map((a, idx) => <MiniAddress key={idx} address={a} th={th} color="#fbbf24" />)
                            ) : parentAddress ? (
                                <div style={{ background: th.fieldBg, borderRadius: '8px', padding: '10px', fontSize: '0.75rem', borderLeft: `3px solid #fbbf2422` }}>
                                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.65rem', marginBottom: '4px' }}>REUSED FROM PARENT</div>
                                    <div style={{ color: th.title }}>
                                        {parentAddress.address_line1}, {parentAddress.city}
                                    </div>
                                </div>
                            ) : null}
                        </RelatedSection>
                    )}

                    {related.contacts?.length > 0 && (
                        <RelatedSection title="Contacts" icon="fa-phone" color="#fbbf24" th={th}>
                            {related.contacts.map((c, idx) => <MiniContact key={idx} contact={c} th={th} color="#fbbf24" />)}
                        </RelatedSection>
                    )}
                </>
            );
        },
    },
    currencies: {
        title: 'Currencies', icon: 'fa-coins', color: '#f87171',
        endpoint: 'currencies',
        searchKeys: ['name', 'code', 'country'],
        CardBody: ({ item, th }) => (
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#f8717118', border: '1px solid #f8717144', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#f87171', fontWeight: 800, fontSize: '1.3rem' }}>{item.symbol || '?'}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#f8717118', color: '#f87171', border: '1px solid #f8717144', borderRadius: '6px', padding: '1px 8px' }}>
                            {item.code}
                        </span>
                    </div>
                    <StatusBadge active={item.is_active} />
                </div>
                <Fields th={th} items={[
                    { label: 'Country', value: item.country, icon: 'fa-globe' },
                ]} />
            </>
        ),
    },
    'exchange-rates': {
        title: 'Exchange Rates', icon: 'fa-exchange-alt', color: '#fb923c',
        endpoint: 'exchange-rates',
        searchKeys: ['from_currency', 'to_currency'],
        CardBody: ({ item, th }) => (
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fb923c', fontWeight: 800, fontSize: '1.3rem' }}>{item.from_currency_code}</div>
                        <div style={{ color: th.sub, fontSize: '0.7rem' }}>FROM</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <i className="fa fa-exchange-alt" style={{ color: '#fb923c', fontSize: '18px' }} />
                        <div style={{ color: th.title, fontWeight: 800, fontSize: '1.2rem' }}>{item.rate}</div>
                        <div style={{ color: th.sub, fontSize: '0.68rem', fontWeight: 600 }}>RATE</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fb923c', fontWeight: 800, fontSize: '1.3rem' }}>{item.to_currency_code}</div>
                        <div style={{ color: th.sub, fontSize: '0.7rem' }}>TO</div>
                    </div>
                </div>
                <Fields th={th} items={[
                    { label: 'Effective Date', value: formatDate(item.effective_date), icon: 'fa-calendar' },
                ]} />
            </>
        ),
    },
    languages: {
        title: 'Languages', icon: 'fa-language', color: '#38bdf8',
        endpoint: 'languages',
        searchKeys: ['name', 'code', 'country'],
        CardBody: ({ item, th }) => (
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#38bdf818', border: '1px solid #38bdf844', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className="fa fa-language" style={{ fontSize: '20px', color: '#38bdf8' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                        <div style={{ color: th.sub, fontSize: '0.82rem' }}>{item.native_name}</div>
                    </div>
                    <StatusBadge active={item.is_active} />
                </div>
                <Fields th={th} items={[
                    { label: 'Code', value: item.code, icon: 'fa-hashtag' },
                    { label: 'Country', value: item.country, icon: 'fa-globe' },
                ]} />
            </>
        ),
    },
    'financial-years': {
        title: 'Financial Years', icon: 'fa-calendar-alt', color: '#c084fc',
        endpoint: 'company-financial-years',
        searchKeys: ['name'],
        CardBody: ({ item, th }) => {
            const start = item.start_date ? new Date(item.start_date) : null;
            const end = item.end_date ? new Date(item.end_date) : null;
            const today = new Date();
            const isCurrent = start && end && today >= start && today <= end;
            return (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#c084fc18', border: '1px solid #c084fc44', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fa fa-calendar-alt" style={{ fontSize: '20px', color: '#c084fc' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: th.title, fontWeight: 700, fontSize: '1rem' }}>{item.name}</div>
                            {isCurrent && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#34d39920', color: '#34d399', border: '1px solid #34d39940', borderRadius: '6px', padding: '1px 8px' }}>
                                    ● Current Year
                                </span>
                            )}
                        </div>
                        <StatusBadge active={item.is_active} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center', background: '#c084fc0e', borderRadius: '10px', padding: '12px 16px', marginBottom: '4px' }}>
                        <div>
                            <div style={{ color: th.sub, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>START</div>
                            <div style={{ color: th.title, fontWeight: 700, fontSize: '0.92rem' }}>{formatDate(item.start_date)}</div>
                        </div>
                        <i className="fa fa-long-arrow-right" style={{ color: '#c084fc', fontSize: '16px', textAlign: 'center' }} />
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: th.sub, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>END</div>
                            <div style={{ color: th.title, fontWeight: 700, fontSize: '0.92rem' }}>{formatDate(item.end_date)}</div>
                        </div>
                    </div>
                </>
            );
        },
    },
};

// Sub-components for related data
const RelatedSection = ({ title, icon, color, children, th }) => (
    <div style={{ marginTop: '16px', borderTop: `1px solid ${th.cardBorder}`, paddingTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <i className={`fa ${icon}`} style={{ color: color, fontSize: '12px' }} />
            <span style={{ color: th.title, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {children}
        </div>
    </div>
);

const MiniAddress = ({ address, th, color }) => (
    <div style={{ background: th.fieldBg, borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: th.title, borderLeft: `3px solid ${color}44` }}>
        <div style={{ fontWeight: 600, color: color, fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '4px' }}>{address.address_type || 'Address'}</div>
        <div>{address.address_line1}</div>
        {address.address_line2 && <div>{address.address_line2}</div>}
        <div>{address.city}, {address.state} - {address.postal_code}</div>
    </div>
);

const MiniContact = ({ contact, th, color }) => (
    <div style={{ background: th.fieldBg, borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: th.title, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>
            <i className="fa fa-user" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.contact_person}</div>
            <div style={{ color: th.sub, fontSize: '0.75rem' }}>{contact.phone} | {contact.email}</div>
        </div>
        {contact.is_primary && <span style={{ fontSize: '0.6rem', fontWeight: 800, color: color, background: `${color}15`, padding: '1px 6px', borderRadius: '4px' }}>PRI</span>}
    </div>
);

const MiniBank = ({ bank, th, color }) => (
    <div style={{ background: th.fieldBg, borderRadius: '8px', padding: '10px', fontSize: '0.8rem', color: th.title }}>
        <div style={{ fontWeight: 700, color: color, fontSize: '0.85rem' }}>{bank.bank_name}</div>
        <div style={{ color: th.sub, fontSize: '0.75rem', marginTop: '2px' }}>A/C: {bank.account_number}</div>
        <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>IFSC: {bank.ifsc_code} | Branch: {bank.branch_name}</div>
    </div>
);

const SettingsReportView = () => {
    const { entity } = useParams();
    const navigate = useNavigate();
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [data, setData] = useState([]);
    const [addresses, setAddresses] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const config = ENTITY_CONFIG[entity];

    const th = {
        pageBg: 'transparent',
        cardBg: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
        cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        headerBg: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
        title: isDark ? '#f1f5f9' : '#0f172a',
        sub: isDark ? 'rgba(255,255,255,0.42)' : '#64748b',
        inputBg: isDark ? 'rgba(255,255,255,0.07)' : '#fff',
        inputBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
        inputText: isDark ? '#f1f5f9' : '#1e293b',
        fieldBg: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
        cardShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
    };

    const [relMap, setRelMap] = useState({});

    useEffect(() => {
        if (!config) return;
        const loadAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const mainData = await fetchData(config.endpoint);
                setData(mainData);

                if (entity === 'company' && mainData.length > 0) {
                    const companyId = mainData[0].id;
                    const [addr, cont] = await Promise.all([
                        fetchData(`company-addresses/?company=${companyId}`),
                        fetchData(`company-contacts/?company=${companyId}`)
                    ]);
                    setAddresses(addr);
                    setContacts(cont);
                } else if (['branches', 'factories', 'warehouses'].includes(entity)) {
                    // Bulk fetch related data
                    const map = {};
                    if (entity === 'branches') {
                        const [addrs, conts, banks] = await Promise.all([
                            fetchData('branch-addresses'),
                            fetchData('branch-contacts'),
                            fetchData('branch-bank-accounts')
                        ]);
                        mainData.forEach(item => {
                            map[item.id] = {
                                addresses: addrs.filter(a => a.branch === item.id),
                                contacts: conts.filter(c => c.branch === item.id),
                                bankAccounts: banks.filter(b => b.branch === item.id)
                            };
                        });
                    } else if (entity === 'factories') {
                        const [addrs, conts] = await Promise.all([
                            fetchData('factory-addresses'),
                            fetchData('factory-contacts')
                        ]);
                        mainData.forEach(item => {
                            map[item.id] = {
                                addresses: addrs.filter(a => a.factory === item.id),
                                contacts: conts.filter(c => c.factory === item.id)
                            };
                        });
                    } else if (entity === 'warehouses') {
                        const [addrs, conts, bAddrs, fAddrs] = await Promise.all([
                            fetchData('warehouse-addresses'),
                            fetchData('warehouse-contacts'),
                            fetchData('branch-addresses'),
                            fetchData('factory-addresses')
                        ]);
                        mainData.forEach(item => {
                            const parentAddresses = item.branch
                                ? bAddrs.filter(a => a.branch === item.branch)
                                : item.factory
                                    ? fAddrs.filter(a => a.factory === item.factory)
                                    : [];
                            map[item.id] = {
                                addresses: addrs.filter(a => a.warehouse === item.id),
                                contacts: conts.filter(c => c.warehouse === item.id),
                                parentAddresses
                            };
                        });
                    }
                    setRelMap(map);
                }
            } catch (e) {
                setError('Failed to load data.');
            } finally {
                setLoading(false);
            }
        };
        loadAll();
    }, [entity, config]);

    if (!config) return (
        <div className="text-center py-5">
            <i className="fa fa-exclamation-triangle fa-3x text-warning mb-3 d-block" />
            <h4>Unknown entity: {entity}</h4>
            <button className="btn btn-primary mt-3" onClick={() => navigate('/settings-dashboard')}>
                ← Back
            </button>
        </div>
    );

    const filtered = data.filter(row => {
        const matchesSearch = config.searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(search.toLowerCase()));
        const matchesDate = !dateFilter || row.effective_date === dateFilter;
        return matchesSearch && matchesDate;
    });

    return (
        <div style={{ minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

            {/* Breadcrumb */}
            <div className="page-titles">
                <button 
                    onClick={() => window.history.back()} 
                    className="btn btn-outline-primary btn-sm d-flex align-items-center"
                    style={{ gap: '6px', borderRadius: '6px' }}
                >
                    <i className="fa fa-arrow-left"></i> Back
                </button>
            </div>

            {/* Header Strip */}
            <div style={{
                background: th.headerBg, border: `1px solid ${th.cardBorder}`,
                borderRadius: '14px', padding: '20px 24px', marginBottom: '22px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '14px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: `${config.color}18`, border: `1px solid ${config.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <i className={`fa ${config.icon}`} style={{ fontSize: '20px', color: config.color }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h4 style={{ margin: 0, color: th.title, fontWeight: 700 }}>{config.title}</h4>
                            <span style={{
                                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px',
                                background: `${config.color}18`, color: config.color,
                                border: `1px solid ${config.color}44`,
                                borderRadius: '20px', padding: '2px 10px',
                            }}>READ ONLY</span>
                        </div>
                        <p style={{ margin: 0, color: th.sub, fontSize: '0.82rem' }}>
                            {loading ? 'Loading…' : entity === 'company' ? 'Primary Organization Profile' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {entity === 'exchange-rates' && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <i className="fa fa-calendar" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: config.color, fontSize: '12px' }} />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={e => setDateFilter(e.target.value)}
                                    style={{
                                        background: th.inputBg, border: `1px solid ${th.inputBorder}`,
                                        borderRadius: '8px', padding: '8px 12px 8px 32px',
                                        color: th.inputText, fontSize: '0.85rem', outline: 'none', width: '160px',
                                        cursor: 'pointer'
                                    }}
                                />
                                {dateFilter && (
                                    <button
                                        onClick={() => setDateFilter('')}
                                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px', padding: '4px' }}
                                        title="Clear Date"
                                    >
                                        <i className="fa fa-times-circle" />
                                    </button>
                                )}
                            </div>
                            <div style={{ width: '1px', height: '20px', background: th.cardBorder, margin: '0 12px' }} />
                        </div>
                    )}
                    {entity !== 'company' && (
                        <div style={{ position: 'relative' }}>
                            <i className="fa fa-search" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: th.sub, fontSize: '12px' }} />
                            <input
                                type="text" placeholder="Search…" value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    background: th.inputBg, border: `1px solid ${th.inputBorder}`,
                                    borderRadius: '8px', padding: '8px 12px 8px 32px',
                                    color: th.inputText, fontSize: '0.85rem', outline: 'none', width: '190px',
                                }}
                            />
                        </div>
                    )}
                    <button onClick={() => navigate('/settings-dashboard')} style={{
                        background: 'transparent', border: `1px solid ${th.cardBorder}`,
                        borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                        color: th.sub, fontSize: '0.85rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <i className="fa fa-arrow-left" style={{ fontSize: '11px' }} /> Back
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div className="spinner-border" style={{ color: config.color, width: '2.5rem', height: '2.5rem' }} />
                    <p style={{ color: th.sub, marginTop: '16px' }}>Loading {config.title}…</p>
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <i className="fa fa-exclamation-circle fa-3x d-block mb-3" style={{ color: '#f87171' }} />
                    <p style={{ color: '#f87171' }}>{error}</p>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => window.location.reload()}>Retry</button>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <i className={`fa ${config.icon} fa-3x d-block mb-3`} style={{ color: th.sub }} />
                    <p style={{ color: th.sub }}>{search ? `No results for "${search}"` : `No ${config.title} found.`}</p>
                </div>
            ) : entity === 'company' ? (
                <FullCompanyView company={filtered[0]} addresses={addresses} contacts={contacts} th={th} />
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '16px',
                }}>
                    {filtered.map((item, i) => (
                        <div key={item.id || i} style={{
                            background: th.cardBg, border: `1px solid ${th.cardBorder}`,
                            borderRadius: '14px', padding: '20px',
                            boxShadow: th.cardShadow,
                            transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                            position: 'relative', overflow: 'hidden',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.15), 0 0 0 1px ${config.color}33`; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = th.cardShadow; }}
                        >
                            <div style={{ position: 'absolute', top: 0, right: 0, width: '90px', height: '90px', background: `radial-gradient(circle at top right, ${config.color}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
                            <config.CardBody item={item} th={th} related={relMap[item.id] || {}} />
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            {!loading && filtered.length > 0 && (
                <div style={{ marginTop: '20px', textAlign: 'center', color: th.sub, fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <i className="fa fa-eye" /> View-only — {entity === 'company' ? 'Company Report' : `${filtered.length} of ${data.length} records shown`}
                </div>
            )}
        </div>
    );
};

export default SettingsReportView;
