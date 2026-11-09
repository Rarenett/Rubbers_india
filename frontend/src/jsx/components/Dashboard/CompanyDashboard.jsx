import React, { useState, useEffect, useContext } from "react";
import { Spinner } from "react-bootstrap";
import { Building2, Mail, Phone, MapPin, Receipt, ShieldCheck, Eye, Target } from "lucide-react";
import axiosInstance from "../../../services/AxiosInstance";
import { ThemeContext } from "../../../context/ThemeContext";
import glendaFallbackImg from "../../../images/glenda-banner.jpg";
import { usePageTitle } from '../../../context/TitleContext';

const getBackendURL = () => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl.includes(':8001')) {
      return envUrl.replace(':8001', ':8000');
  }
  return envUrl || 'http://127.0.0.1:8000';
};

const getInitials = (name) => {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
};

const getAvatarColor = (name) => {
  const hash = [...(name || "")].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ["#0c4a6e", "#831843", "#78350f", "#064e3b", "#4c1d95", "#7f1d1d"];
  const textColors = ["#38bdf8", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#f87171"];
  const index = hash % colors.length;
  return { bg: colors[index], text: textColors[index] };
};

export default function CompanyDashboard() {
  const { background } = useContext(ThemeContext);
  const isDark = background.value === "dark";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [logoImgSrc, setLogoImgSrc] = useState(null);
  usePageTitle("Glen Board");
  const backendBase = getBackendURL().replace(/\/$/, "");
  const defaultGlendaImgUrl = `${backendBase}/media/pictures/glenda`;
  const [glendaImgSrc, setGlendaImgSrc] = useState(defaultGlendaImgUrl);
  const [avatarErrors, setAvatarErrors] = useState({});
 
  useEffect(() => {
    document.title = "Company Profile";
    axiosInstance.get("/api/hr/company-dashboard/")
      .then(response => {
        setData(response.data);
        const comp = response.data?.company || {};
        setLogoImgSrc(comp.title_logo_url || comp.logo_url || null);
      })
      .catch(error => {
        console.error("Error fetching company profile data:", error);
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

  const company = data?.company || {};
  const address = company?.address || {};
  const contact = company?.contact || {};
  const directors = data?.board_of_directors || [];

  const addressString = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.country
  ].filter(Boolean).join(", ") + (address.pincode ? ` - ${address.pincode}` : "");

  const descriptionText = "All the three beverages are available in various pack sizes for individuals, households, showrooms, offices, etc. and caters to diverse consumer needs and occasions. Since our inception, we have been continuously in the effort to nurture our customer relations, by way of timely and quality deliveries. On a selfish note, we wish to be known as a common household name through our exceptional customer service, ethical business behaviour, and product quality.";

  return (
    <div className={`dashboard-theme-parent ${isDark ? 'theme-dark' : 'theme-light'}`} style={{ margin: "-1.875rem -1.875rem 0 -1.875rem", padding: "40px 24px 80px", background: isDark ? "#0b0f19" : "#f8fafc", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .profile-card {
            border-radius: 12px !important;
            background: ${isDark ? '#111827' : '#ffffff'} !important;
            border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'} !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.03) !important;
            transition: all 0.3s ease;
        }
        .bod-card {
            transition: transform 0.25s ease, box-shadow 0.25s ease !important;
        }
        .bod-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
        }
        .bod-contact-link {
            transition: color 0.15s ease;
        }
        .bod-contact-link:hover {
            color: #3b82f6 !important;
            text-decoration: underline !important;
        }
      `}} />

      {/* Main full-width container - reduced gap to 12px to bring cards closer */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        
        {/* Banner & Header Card - removed marginBottom */}
        <div className="card profile-card" style={{ overflow: "hidden", marginBottom: "0px" }}>
          {/* Navy Blue Gradient Banner - Reduced height to 100px */}
          <div style={{
            height: "100px",
            background: "linear-gradient(135deg, #0b1528 0%, #0f2347 40%, #1c3d75 100%)",
            width: "100%",
            position: "relative"
          }}>
          </div>
          
          {/* Centralised Profile Header Info - reduced pb to pb-3 */}
          <div className="d-flex flex-column align-items-center text-center pb-3" style={{ position: "relative", marginTop: "-48px" }}>
            {/* Logo container 96px, overlapping banner */}
            <div style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              background: isDark ? "#111827" : "#ffffff",
              border: `4px solid ${isDark ? "#111827" : "#ffffff"}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: "12px",
              zIndex: 2
            }}>
              {logoImgSrc ? (
                <img 
                  src={logoImgSrc} 
                  alt="Company Logo" 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                  onError={() => {
                    if (logoImgSrc === company.title_logo_url && company.logo_url) {
                      setLogoImgSrc(company.logo_url);
                    } else {
                      setLogoImgSrc(null);
                    }
                  }}
                />
              ) : (
                <Building2 size={40} style={{ color: "#9ca3af" }} />
              )}
            </div>
            
            {/* Name */}
            <div>
              <h2 style={{
                margin: "0",
                fontWeight: 700,
                fontSize: "1.65rem",
                color: isDark ? "#ffffff" : "#111827",
                letterSpacing: "-0.01em"
              }}>
                {company.display_name || company.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Content Card (Overview / Main Content with BOD cards embedded inside) */}
        <div className="card profile-card p-4">
          {/* 2x2 Grid of small info tiles */}
          <div className="row g-3 mb-4">
            {/* Registered office */}
            <div className="col-md-6">
              <div style={{
                padding: "16px",
                borderRadius: "8px",
                background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3b82f6",
                  flexShrink: 0
                }}>
                  <MapPin size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Registered office
                  </div>
                  <div style={{ fontSize: "0.9rem", color: isDark ? "#e5e7eb" : "#1f2937", fontWeight: "600", lineHeight: "1.5" }}>
                    {addressString || "Address not specified"}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="col-md-6">
              <div style={{
                padding: "16px",
                borderRadius: "8px",
                background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                  flexShrink: 0
                }}>
                  <Phone size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Contact
                  </div>
                  <div style={{ fontSize: "0.9rem", color: isDark ? "#e5e7eb" : "#1f2937", fontWeight: "600", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {contact.email && <div>{contact.email}</div>}
                    {(contact.phone || contact.mobile) && <div>{contact.phone || contact.mobile}</div>}
                    {!contact.email && !(contact.phone || contact.mobile) && <div>N/A</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* GSTIN */}
            <div className="col-md-6">
              <div style={{
                padding: "16px",
                borderRadius: "8px",
                background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8b5cf6",
                  flexShrink: 0
                }}>
                  <Receipt size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    GSTIN
                  </div>
                  <div style={{ fontSize: "0.9rem", color: isDark ? "#e5e7eb" : "#1f2937", fontWeight: "600" }}>
                    {company.gst_no || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Registration no */}
            <div className="col-md-6">
              <div style={{
                padding: "16px",
                borderRadius: "8px",
                background: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)",
                border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)"}`,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  background: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(245, 158, 11, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f59e0b",
                  flexShrink: 0
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Registration no.
                  </div>
                  <div style={{ fontSize: "0.9rem", color: isDark ? "#e5e7eb" : "#1f2937", fontWeight: "600" }}>
                    {company.registration_no || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row with Facility Image & Quality description */}
          <div className="d-flex flex-column flex-md-row gap-4 align-items-center pt-2 mb-4">
            {/* Facility image - Increased size to 320x216px for better visibility */}
            <div style={{
              width: "320px",
              height: "216px",
              borderRadius: "8px",
              overflow: "hidden",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0, 0, 0, 0.05)"}`,
              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <img 
                src={glendaImgSrc} 
                alt="Glenda facility" 
                onError={() => setGlendaImgSrc(glendaFallbackImg)} 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            </div>

            {/* Quality & Production */}
            <div>
              <h4 style={{
                fontWeight: 700,
                color: isDark ? "#ffffff" : "#111827",
                fontSize: "1.1rem",
                marginBottom: "8px"
              }}>
                Quality and production
              </h4>
              <p style={{
                fontSize: "0.92rem",
                lineHeight: "1.65",
                color: isDark ? "#9ca3af" : "#4b5563",
                margin: 0,
                textAlign: "justify"
              }}>
                {company.description || descriptionText}
              </p>
            </div>
          </div>

          {/* Vision & Mission Section */}
          {(company.vision || company.mission) && (
            <div className="row g-3 mb-4">
              {company.vision && (
                <div className={company.mission ? "col-md-6" : "col-12"}>
                  <div style={{
                    padding: "20px 22px",
                    borderRadius: "10px",
                    background: isDark 
                      ? "linear-gradient(145deg, rgba(14, 165, 233, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)" 
                      : "linear-gradient(145deg, rgba(14, 165, 233, 0.06) 0%, #ffffff 100%)",
                    border: `1px solid ${isDark ? "rgba(14, 165, 233, 0.25)" : "rgba(14, 165, 233, 0.2)"}`,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: isDark 
                      ? "0 4px 20px rgba(0, 0, 0, 0.2)" 
                      : "0 4px 16px rgba(14, 165, 233, 0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: isDark ? "rgba(14, 165, 233, 0.2)" : "rgba(14, 165, 233, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#0ea5e9",
                        flexShrink: 0
                      }}>
                        <Eye size={20} />
                      </div>
                      <div style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: isDark ? "#38bdf8" : "#0284c7",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}>
                        Our Vision
                      </div>
                    </div>
                    <div style={{
                      fontSize: "0.92rem",
                      color: isDark ? "#e2e8f0" : "#334155",
                      lineHeight: "1.65",
                      whiteSpace: "pre-line",
                      fontWeight: 500
                    }}>
                      {company.vision}
                    </div>
                  </div>
                </div>
              )}

              {company.mission && (
                <div className={company.vision ? "col-md-6" : "col-12"}>
                  <div style={{
                    padding: "20px 22px",
                    borderRadius: "10px",
                    background: isDark 
                      ? "linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 24, 39, 0.6) 100%)" 
                      : "linear-gradient(145deg, rgba(16, 185, 129, 0.06) 0%, #ffffff 100%)",
                    border: `1px solid ${isDark ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.2)"}`,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: isDark 
                      ? "0 4px 20px rgba(0, 0, 0, 0.2)" 
                      : "0 4px 16px rgba(16, 185, 129, 0.06)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        background: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#10b981",
                        flexShrink: 0
                      }}>
                        <Target size={20} />
                      </div>
                      <div style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: isDark ? "#34d399" : "#059669",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em"
                      }}>
                        Our Mission
                      </div>
                    </div>
                    <div style={{
                      fontSize: "0.92rem",
                      color: isDark ? "#e2e8f0" : "#334155",
                      lineHeight: "1.65",
                      whiteSpace: "pre-line",
                      fontWeight: 500
                    }}>
                      {company.mission}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Embedded Board of Directors section */}
          {directors.length > 0 && (
            <div style={{ 
              borderTop: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"}`, 
              marginTop: "24px", 
              paddingTop: "24px" 
            }}>
              <h4 style={{
                fontWeight: 700,
                color: isDark ? "#ffffff" : "#111827",
                fontSize: "1.1rem",
                marginBottom: "16px",
                textAlign: "center"
              }}>
                Core Team
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "16px" }}>
                {directors.map((dir, idx) => {
                  const avatar = getAvatarColor(dir.name);
                  return (
                    <div key={idx} className="card profile-card bod-card" style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      textAlign: "center",
                      gap: "10px",
                      padding: "20px 16px",
                      margin: 0,
                      width: "220px",
                      minHeight: "220px",
                      flex: "0 0 220px",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
                    }}>
                      {dir.profile_picture && !avatarErrors[idx] ? (
                        <div style={{ width: "58px", height: "58px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${isDark ? "#374151" : "#e5e7eb"}` }}>
                          <img 
                            src={dir.profile_picture} 
                            alt={dir.name} 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                            onError={() => setAvatarErrors(prev => ({ ...prev, [idx]: true }))}
                          />
                        </div>
                      ) : (
                        <div style={{
                          width: "58px",
                          height: "58px",
                          borderRadius: "50%",
                          backgroundColor: avatar.bg,
                          color: avatar.text,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.15rem",
                          fontWeight: "600",
                          flexShrink: 0
                        }}>
                          {getInitials(dir.name)}
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "100%" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.92rem", color: isDark ? "#ffffff" : "#111827", lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={dir.name}>
                          {dir.name}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: isDark ? "#9ca3af" : "#64748b", fontWeight: 500 }}>
                          {dir.designation || "Director"}
                        </span>
                      </div>

                      {/* Contact Info (Email & Phone) */}
                      {(dir.email || dir.phone) && (
                        <div style={{
                          width: "100%",
                          borderTop: `1px solid ${isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"}`,
                          paddingTop: "10px",
                          marginTop: "2px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          alignItems: "center"
                        }}>
                          {dir.email && (
                            <div 
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                gap: "6px", 
                                width: "100%", 
                                fontSize: "0.76rem", 
                                color: isDark ? "#9ca3af" : "#64748b" 
                              }}
                              title={dir.email}
                            >
                              <Mail size={13} style={{ flexShrink: 0, color: isDark ? "#60a5fa" : "#3b82f6" }} />
                              <a 
                                href={`mailto:${dir.email}`} 
                                className="bod-contact-link"
                                style={{ 
                                  color: "inherit", 
                                  textDecoration: "none", 
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis", 
                                  whiteSpace: "nowrap",
                                  maxWidth: "165px"
                                }}
                              >
                                {dir.email}
                              </a>
                            </div>
                          )}

                          {dir.phone && (
                            <div 
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                gap: "6px", 
                                width: "100%", 
                                fontSize: "0.76rem", 
                                color: isDark ? "#9ca3af" : "#64748b" 
                              }}
                              title={dir.phone}
                            >
                              <Phone size={13} style={{ flexShrink: 0, color: isDark ? "#34d399" : "#10b981" }} />
                              <a 
                                href={`tel:${dir.phone}`} 
                                className="bod-contact-link"
                                style={{ 
                                  color: "inherit", 
                                  textDecoration: "none", 
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis", 
                                  whiteSpace: "nowrap",
                                  maxWidth: "165px"
                                }}
                              >
                                {dir.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
