import React, { Fragment, useContext, useState, useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
/// React router dom
import { Link } from "react-router-dom";
import { navtoggle } from "../../../store/actions/AuthActions";
import { ThemeContext } from "../../../context/ThemeContext";

const NavHader = () => {
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [logoLoaded, setLogoLoaded] = useState(false);

  const { navigationHader, background } = useContext(ThemeContext);

  useEffect(() => {
    // Helper: update the browser tab favicon
    const setFavicon = (url) => {
      const link = document.querySelector("link[rel='icon']") || document.createElement('link');
      link.rel = 'icon';
      link.href = url;
      document.head.appendChild(link);
    };

    // 1. Apply cached value immediately (instant render, no flash of Fasto logo)
    const cached = JSON.parse(localStorage.getItem('companySettings') || '{}');
    if (cached.logo)        { setCompanyLogo(cached.logo);        setLogoLoaded(true); }
    if (cached.displayName) { setCompanyName(cached.displayName); }
    if (cached.titleLogo)   { setFavicon(cached.titleLogo); }

    // 2. Fetch from the public API so any browser gets the correct logo (not just cached)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
    fetch(`${backendUrl}/api/settings/company/branding/`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        setCompanyLogo(data.logo || '');
        setCompanyName(data.display_name || '');
        setLogoLoaded(true);
        // Apply title_logo as favicon (fall back to small-logo.png if not set)
        const faviconUrl = data.title_logo || '/small-logo.png';
        setFavicon(faviconUrl);
        // Keep localStorage in sync for instant render on next load
        const prev = JSON.parse(localStorage.getItem('companySettings') || '{}');
        localStorage.setItem('companySettings', JSON.stringify({
          ...prev,
          logo: data.logo || '',
          titleLogo: data.title_logo || '',
          displayName: data.display_name || '',
          dateFormat: data.date_format || prev.dateFormat || 'DD/MM/YYYY',
          date_format: data.date_format || prev.date_format || 'DD/MM/YYYY',
        }));
      })
      .catch(() => { setLogoLoaded(true); });

    // 3. Also respond to in-app settings updates (e.g. after logo change in ManageCompany)
    const updateSettings = () => {
      const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
      setCompanyLogo(settings.logo || "");
      setCompanyName(settings.displayName || "");
      if (settings.titleLogo) setFavicon(settings.titleLogo);
    };
    window.addEventListener('companySettingsUpdate', updateSettings);
    return () => window.removeEventListener('companySettingsUpdate', updateSettings);
  }, []);

  const dispatch = useDispatch();
  const sideMenu = useSelector(state => state.sideMenu);
  const handleToogle = () => {
    dispatch(navtoggle());
  };

  const { auth } = useSelector(state => state.auth || {});
  const storedUser = (() => {
    try {
      const details = localStorage.getItem('userDetails');
      return details ? JSON.parse(details)?.user || JSON.parse(details) : null;
    } catch {
      return null;
    }
  })();
  const user = auth?.user || storedUser || {};

  const defaultDashboard = user?.role?.assigned_dashboards?.find(d => d.is_default);
  const firstDashboard = user?.role?.assigned_dashboards?.[0];
  let roleTargetUrl = defaultDashboard ? defaultDashboard.route : (firstDashboard ? firstDashboard.route : null);
  if (roleTargetUrl && !roleTargetUrl.startsWith('/')) {
    roleTargetUrl = '/' + roleTargetUrl;
  }

  const rawCustomerType = 
    user?.designation ||
    user?.customer_type ||
    user?.customer_info?.customer_type ||
    user?.role?.name ||
    user?.role_name ||
    '';
  const customerType = String(rawCustomerType).toLowerCase().trim();
  const isDriver = 
    user?.is_driver ||
    (user?.designation && String(user?.designation).toLowerCase().includes('driver')) ||
    (user?.role?.name && String(user?.role.name).toLowerCase().includes('driver')) ||
    (user?.role_name && String(user?.role_name).toLowerCase().includes('driver')) ||
    customerType === 'driver';

  let logoRedirectUrl = '/dashboard';
  if (roleTargetUrl) {
    logoRedirectUrl = roleTargetUrl;
  } else if (customerType === 'distributor') {
    logoRedirectUrl = '/distributor-orders';
  } else if (isDriver) {
    logoRedirectUrl = '/driver-operations';
  }

  return (
    <div className="nav-header">
      <Link to={logoRedirectUrl} className="brand-logo d-flex align-items-center">
        {companyLogo ? (
          /* Company logo uploaded — always show it */
          <Fragment>
            <img
              className="logo-abbr"
              src={companyLogo}
              alt={companyName || 'Logo'}
              style={{
                maxWidth: 'clamp(100px, 30vw, 160px)',
                maxHeight: '52px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                marginLeft: '10px'
              }}
            />
          </Fragment>
        ) : logoLoaded ? (
          /* No company logo set — show name text or neutral placeholder (Fasto SVG removed) */
          companyName ? (
            <span style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: background.value === 'dark' ? '#fff' : '#0a500f',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}>
              {companyName}
            </span>
          ) : (
            <span style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: background.value === 'dark' ? '#aaa' : '#888',
              letterSpacing: '0.05em',
            }}>
              ERP
            </span>
          )
        ) : null /* Still loading — render nothing to prevent flash */}
      </Link>

      <div
        className="nav-control"
        style={{
          background: 'transparent',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          border: 'none',
        }}
        onClick={() => { handleToogle(); }}
      >
        <div className={`hamburger ${sideMenu ? "is-active" : ""}`}>
          <span className="line"></span>
          <span className="line"></span>
          <span className="line"></span>
        </div>
      </div>
    </div>
  );
};

export default NavHader;
