import './marketing-cute.css';
import React, { useState, useEffect, useRef, useContext, Fragment } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { usePageTitle } from '../../../context/TitleContext';
import { ThemeContext } from '../../../context/ThemeContext';
import axiosInstance from '../../../services/axiosInstance'; 
import { Row, Col, Card, Nav, Tab, Form, Spinner } from 'react-bootstrap';
import { exportToPDF, exportToExcel, printData } from '../Assets/exportUtils';
import LeadFollowUpHistory from './LeadFollowUpHistory';

const DEFAULT_PURPOSES = [
    'New Lead',
    'Contacted',
    'Qualified',
    'Meeting',
    'Proposal/Quotation',
    'Negotiation',
    'Won',
    'Lost'
];

const LeadsModule = () => {
    usePageTitle("Leads - Marketing Connect");
    const themeContext = useContext(ThemeContext);
    const isDark = themeContext?.background?.value === "dark";
    const navigate = useNavigate();
    const location = useLocation();
    const isFollowUpSection = location.state?.isFollowUpSection || false;

    const getTodayDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const [formData, setFormData] = useState({
        leadDate: getTodayDate(),
        shopName: '',
        address: '',
        city: '',
        state: '',
        mobileNumber: '',
        gstNumber: '',
        shopType: '',
        status: 'Active'
    });
    const [nextLeadId, setNextLeadId] = useState('(Loading...)');
    const [leadsList, setLeadsList] = useState([]);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'register');
    const [editLeadId, setEditLeadId] = useState(null); 

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab);
        }
    }, [location.state]);

    useEffect(() => {
        if (activeTab === 'register' && !editLeadId) {
            fetchNextLeadId();
        } else if (activeTab === 'view') {
            fetchLeadsList();
        } else if (activeTab === 'followup') {
            fetchFollowUpLocations();
        }
    }, [activeTab, editLeadId]);

    const fetchNextLeadId = async () => {
        try {
            const res = await axiosInstance.get('/api/project/marketing/lead/next_id/');
            setNextLeadId(res.data.next_id);
        } catch (error) {
            console.error("Failed to fetch next lead id", error);
            setNextLeadId('(Error)');
        }
    };

    const [leadsLoading, setLeadsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const fetchLeadsList = async () => {
        setLeadsLoading(true);
        try {
            const res = await axiosInstance.get('/api/project/marketing/lead/');
            setLeadsList(res.data);
        } catch (error) {
            console.error("Failed to fetch leads", error);
        } finally {
            setLeadsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleEdit = (lead) => {
        setEditLeadId(lead.id);
        setFormData({
            leadDate: lead.lead_date || getTodayDate(),
            shopName: lead.shop_name || '',
            address: lead.address || '',
            city: lead.city || '',
            state: lead.state || '',
            mobileNumber: lead.mobile_number || '',
            gstNumber: lead.gst_number || '',
            shopType: lead.shop_type || '',
            status: lead.status || 'Active'
        });
        setActiveTab('register'); 
    };

    const resetForm = () => {
        setEditLeadId(null);
        setFormData({
            leadDate: getTodayDate(),
            shopName: '',
            address: '',
            city: '',
            state: '',
            mobileNumber: '',
            gstNumber: '',
            shopType: '',
            status: 'Active'
        });
    };

    const [leadCategories, setLeadCategories] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchLeadCategories();
    }, []);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterDate]);

    const filteredLeads = leadsList.filter(l => {
        const matchesDate = !filterDate || l.lead_date === filterDate;
        if (!matchesDate) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (l.lead_id && String(l.lead_id).toLowerCase().includes(q)) ||
            (l.shop_name && l.shop_name.toLowerCase().includes(q)) ||
            (l.shop_type && l.shop_type.toLowerCase().includes(q)) ||
            (l.mobile_number && l.mobile_number.toLowerCase().includes(q)) ||
            (l.status && l.status.toLowerCase().includes(q)) ||
            (l.city && l.city.toLowerCase().includes(q)) ||
            (l.state && l.state.toLowerCase().includes(q)) ||
            (l.location && l.location.toLowerCase().includes(q))
        );
    });

    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);

    const getExportData = () => {
        return filteredLeads.map((lead, index) => {
            const dateParts = lead.lead_date ? lead.lead_date.split('-') : [];
            const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (lead.lead_date || '-');
            return {
                sl_no: index + 1,
                lead_id: lead.lead_id || `LD-${String(lead.id).padStart(4, '0')}`,
                lead_date: formattedDate,
                shop_name: lead.shop_name || '',
                shop_type: lead.shop_type || '',
                mobile_number: lead.mobile_number || '',
                status: lead.status || '',
                location: lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || 'N/A'
            };
        });
    };

    const exportColumns = [
        { header: 'Sl No.', dataKey: 'sl_no' },
        { header: 'Lead ID', dataKey: 'lead_id' },
        { header: 'Date', dataKey: 'lead_date' },
        { header: 'Shop Name', dataKey: 'shop_name' },
        { header: 'Category', dataKey: 'shop_type' },
        { header: 'Mobile Number', dataKey: 'mobile_number' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Location', dataKey: 'location' }
    ];

    const handleExportExcel = () => {
        exportToExcel(getExportData(), exportColumns, `Leads_Report_${filterDate || 'All'}.xlsx`);
    };

    const handleExportPDF = () => {
        exportToPDF(getExportData(), exportColumns, `Leads_Report_${filterDate || 'All'}.pdf`, `Leads Report - ${filterDate || 'All'}`);
    };

    const handlePrint = () => {
        printData(getExportData(), exportColumns, `Leads Report - ${filterDate || 'All'}`);
    };

    const fetchLeadCategories = async () => {
        try {
            const response = await axiosInstance.get('/api/crm_new/categories/');
            const data = response.data.results || response.data;
            setLeadCategories(data);
        } catch (error) {
            console.error("Failed to fetch lead categories:", error);
        }
    };

    const [purposeOptions, setPurposeOptions] = useState(DEFAULT_PURPOSES);

    const fetchPurposes = async () => {
        try {
            let res;
            try {
                res = await axiosInstance.get('/api/crm_new/purposes/');
            } catch {
                res = await axiosInstance.get('/api/crm/purposes/');
            }
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            const apiNames = data.map(p => p.name).filter(Boolean);
            const combined = Array.from(new Set([...DEFAULT_PURPOSES, ...apiNames]));
            setPurposeOptions(combined);
        } catch (err) {
            console.error("Failed to fetch purposes:", err);
            setPurposeOptions(DEFAULT_PURPOSES);
        }
    };

    useEffect(() => {
        fetchPurposes();
    }, []);

    // Follow-Up State
    const [followUpLocations, setFollowUpLocations] = useState([]);
    const [followUpLeads, setFollowUpLeads] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [followUpForm, setFollowUpForm] = useState({ remarks: '', status: 'Active', nextVisitDate: '', purpose: '', visitDate: new Date().toISOString().split('T')[0] });
    const [shopPhoto, setShopPhoto] = useState(null);
    const [shopPhotoPreview, setShopPhotoPreview] = useState(null);
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

    // Engagement History Side Panel State
    const [engagementHistory, setEngagementHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const historyPanelRef = useRef(null);

    const scrollToHistoryOnMobile = () => {
        if (typeof window !== 'undefined' && window.innerWidth <= 991) {
            setTimeout(() => {
                if (historyPanelRef.current) {
                    historyPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 200);
        }
    };

    const fetchLeadHistory = async (leadId) => {
        if (!leadId) {
            setEngagementHistory([]);
            return;
        }
        setLoadingHistory(true);
        setShowHistory(true);
        try {
            const res = await axiosInstance.get(`/api/crm_new/followups/history/?lead=${leadId}`);
            setEngagementHistory(res.data.results || res.data || []);
        } catch (err) {
            console.error("Failed to fetch lead history:", err);
            setEngagementHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    // Live Camera State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const fetchFollowUpLocations = async () => {
        try {
            const res = await axiosInstance.get('/api/crm_new/followups/locations/');
            setFollowUpLocations(res.data.locations || []);
            // Also fetch all pending leads initially
            fetchPendingLeads('');
        } catch (err) {
            console.error("Failed to fetch follow-up locations", err);
        }
    };

    const fetchPendingLeads = async (loc = '') => {
        try {
            const url = loc ? `/api/crm_new/followups/pending_leads/?location=${encodeURIComponent(loc)}` : `/api/crm_new/followups/pending_leads/`;
            const res = await axiosInstance.get(url);
            setFollowUpLeads(res.data || []);
        } catch (err) {
            console.error("Failed to fetch pending leads", err);
        }
    };

    const handleLocationChange = async (e) => {
        const loc = e.target.value;
        setSelectedLocation(loc);
        setSelectedLead(null);
        setEngagementHistory([]);
        setShowHistory(false);
        setFollowUpLeads([]);
        fetchPendingLeads(loc);
    };

    const handleLeadChange = (e) => {
        const leadId = e.target.value;
        if (leadId) {
            const lead = followUpLeads.find(l => l.id.toString() === leadId.toString());
            setSelectedLead(lead || null);
            if (lead && !selectedLocation && lead.location) {
                setSelectedLocation(lead.location);
            }
            setShowHistory(true);
            fetchLeadHistory(leadId);
            scrollToHistoryOnMobile();
        } else {
            setSelectedLead(null);
            setEngagementHistory([]);
            setShowHistory(false);
        }
    };

    const handleFollowUpInputChange = (e) => {
        setFollowUpForm({ ...followUpForm, [e.target.name]: e.target.value });
    };

    const openCamera = async () => {
        setIsCameraOpen(true);
        setShopPhoto(null);
        setShopPhotoPreview(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please allow permissions.");
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
    };

    const captureLivePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], "shop_photo.jpg", { type: "image/jpeg" });
                    setShopPhoto(file);
                    setShopPhotoPreview(URL.createObjectURL(file));
                    stopCamera();
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const submitFollowUp = async () => {
        if (!selectedLocation || !selectedLead) {
            alert("Location and Lead are required.");
            return;
        }
        setIsSavingFollowUp(true);
        try {
            const formData = new FormData();
            formData.append('lead', selectedLead.id);
            formData.append('remarks', followUpForm.remarks);
            formData.append('status', followUpForm.status);
            if (followUpForm.nextVisitDate) formData.append('next_visit_date', followUpForm.nextVisitDate);
            if (followUpForm.visitDate) formData.append('visit_date', followUpForm.visitDate);
            if (followUpForm.purpose) formData.append('purpose', followUpForm.purpose);
            if (shopPhoto) formData.append('shop_photo', shopPhoto);

            await axiosInstance.post('/api/crm_new/followups/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Follow-Up saved successfully!");
            
            // Reset form
            setSelectedLead(null);
            setEngagementHistory([]);
            setShowHistory(false);
            setFollowUpForm({ remarks: '', status: 'Active', nextVisitDate: '', purpose: '', visitDate: new Date().toISOString().split('T')[0] });
            setShopPhoto(null);
            setShopPhotoPreview(null);
            // Reload pending leads
            handleLocationChange({ target: { value: selectedLocation } });
        } catch (error) {
            console.error("Error saving follow-up:", error);
            alert("Failed to save follow-up.");
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    const submitLead = async () => {
        if (!formData.shopName || !formData.shopType) {
            alert("Shop Name and Lead Category are required.");
            return;
        }

        const payload = {
            lead_date: formData.leadDate,
            shop_name: formData.shopName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            mobile_number: formData.mobileNumber,
            gst_number: formData.gstNumber,
            shop_type: formData.shopType,
            status: formData.status 
        };

        setIsSaving(true);

        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            await submitLeadWithLocation(payload);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                payload.latitude = lat;
                payload.longitude = lng;
                
                try {
                    const geoRes = await axiosInstance.get(`/api/area/geocode_reverse/?lat=${lat}&lon=${lng}`);
                    if (geoRes.data && geoRes.data.display_name) {
                        payload.location = geoRes.data.display_name;
                    }
                } catch (err) {
                    console.error("Geocoding failed", err);
                }
                
                await submitLeadWithLocation(payload);
            },
            async (error) => {
                console.error("Geolocation error", error);
                let errMsg = "Could not get location.";
                if (error.code === 1) errMsg = "Location permission denied.";
                else if (error.code === 2) errMsg = "Position unavailable.";
                else if (error.code === 3) errMsg = "Location request timed out.";
                // Graceful fallback
                alert(errMsg + " Saving lead without location.");
                await submitLeadWithLocation(payload);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const submitLeadWithLocation = async (payload) => {
        try {
            if (editLeadId) {
                await axiosInstance.put(`/api/project/marketing/lead/${editLeadId}/`, payload);
                alert("Lead updated successfully!");
                resetForm();
                setActiveTab('view');
            } else {
                await axiosInstance.post('/api/project/marketing/lead/', payload);
                alert("Lead saved successfully!");
                resetForm();
                navigate('/market_connect_master');
            }
        } catch (error) {
            console.error("Error saving lead:", error);
            alert("Failed to save lead.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Fragment>
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .card { border: none !important; box-shadow: none !important; }
                }
                `}
            </style>
            <div className="page-titles no-print">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to={"/market_connect_master"}>Marketing Connect</Link></li>
                    <li className="breadcrumb-item active"><Link to={"#"}>Leads</Link></li>
                </ol>
            </div>

            <Row>
                <Col xl="12">
                    <Card>
                        <Card.Header className="d-block d-sm-flex border-0">
                            <Card.Title>{isFollowUpSection ? 'Follow-Up Management' : (editLeadId ? 'Edit Lead' : 'Leads Management')}</Card.Title>
                            <div className="card-action card-tabs mt-3 mt-sm-0">
                                <Nav variant="tabs" className="nav nav-tabs style-2" activeKey={activeTab} onSelect={(k) => {
                                    if(k === 'register' && editLeadId) {
                                        resetForm();
                                    }
                                    setActiveTab(k);
                                }}>
                                    {!isFollowUpSection && (
                                        <Nav.Item>
                                            <Nav.Link eventKey="register">{editLeadId ? 'Edit Lead' : 'Register New Lead'}</Nav.Link>
                                        </Nav.Item>
                                    )}
                                    {!isFollowUpSection && (
                                        <Nav.Item>
                                            <Nav.Link eventKey="view">View Leads</Nav.Link>
                                        </Nav.Item>
                                    )}
                                    {isFollowUpSection && (
                                        <Nav.Item>
                                            <Nav.Link eventKey="followup">Follow Up</Nav.Link>
                                        </Nav.Item>
                                    )}
                                    {isFollowUpSection && (
                                        <Nav.Item>
                                            <Nav.Link eventKey="followup_history">Follow-Up History</Nav.Link>
                                        </Nav.Item>
                                    )}
                                </Nav>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Tab.Container activeKey={activeTab}>
                                <Tab.Content>
                                    <Tab.Pane eventKey="register">
                                        <Row>
                                            <Col md="4" className="mb-3">
                                                <label className="form-label font-w600">Lead ID</label>
                                                <input type="text" className="form-control bg-light" value={editLeadId ? `Editing Lead #${editLeadId}` : nextLeadId} disabled />
                                            </Col>
                                            <Col md="4" className="mb-3">
                                                <label className="form-label font-w600">Date *</label>
                                                <input type="date" className="form-control" name="leadDate" value={formData.leadDate} onChange={handleInputChange} />
                                            </Col>
                                            <Col md="4" className="mb-3">
                                                <label className="form-label font-w600">Lead Category *</label>
                                                <select className="form-control" name="shopType" value={formData.shopType} onChange={handleInputChange}>
                                                    <option value="">-- Select --</option>
                                                    {leadCategories.map(category => (
                                                        <option key={category.id} value={category.name}>{category.name}</option>
                                                    ))}
                                                </select>
                                            </Col>
                                            <Col md="12" className="mb-3">
                                                <label className="form-label font-w600">Shop Name *</label>
                                                <input type="text" className="form-control" name="shopName" value={formData.shopName} onChange={handleInputChange} />
                                            </Col>
                                            <Col md="6" className="mb-3">
                                                <label className="form-label font-w600">Mobile Number</label>
                                                <input type="text" className="form-control" name="mobileNumber" value={formData.mobileNumber} onChange={handleInputChange} />
                                            </Col>
                                            <Col md="6" className="mb-3">
                                                <label className="form-label font-w600">GST Number</label>
                                                <input type="text" className="form-control" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} />
                                            </Col>
                                            <Col md="12" className="mb-3">
                                                <label className="form-label font-w600">Address</label>
                                                <textarea className="form-control" rows="2" name="address" value={formData.address} onChange={handleInputChange}></textarea>
                                            </Col>
                                            <Col md="6" className="mb-3">
                                                <label className="form-label font-w600">City</label>
                                                <input type="text" className="form-control" name="city" value={formData.city} onChange={handleInputChange} />
                                            </Col>
                                            <Col md="6" className="mb-3">
                                                <label className="form-label font-w600">State</label>
                                                <input type="text" className="form-control" name="state" value={formData.state} onChange={handleInputChange} />
                                            </Col>
                                            
                                            {editLeadId && (
                                                <Col md="12" className="mb-3">
                                                    <label className="form-label font-w600">Deal Status</label>
                                                    <select className="form-control" name="status" value={formData.status} onChange={handleInputChange}>
                                                        <option value="Active">Active</option>
                                                        <option value="Working on Deal">Working on Deal</option>
                                                        <option value="Escalated">Escalated</option>
                                                    </select>
                                                </Col>
                                            )}

                                            <Col md="12" className="mt-3">
                                                <button className="btn btn-primary w-100" onClick={submitLead} disabled={isSaving}>
                                                    {isSaving ? 'Saving...' : (editLeadId ? 'Update Lead' : 'Save Lead')}
                                                </button>
                                            </Col>
                                        </Row>
                                    </Tab.Pane>

                                    <Tab.Pane eventKey="view">
                                        <div className="d-flex justify-content-between align-items-center flex-wrap mb-4 no-print" style={{ gap: '15px' }}>
                                            <h5 className="mb-0 text-muted" style={{ fontWeight: '600' }}>Lead Records</h5>
                                            <div className="d-flex gap-3 align-items-center flex-wrap">
                                                <Form.Group className="mb-0">
                                                    <Form.Control
                                                        type="text"
                                                        placeholder="Search by ID, shop name, category, or mobile..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        style={{ minWidth: '250px' }}
                                                    />
                                                </Form.Group>
                                                <Form.Group className="d-flex align-items-center mb-0 gap-1">
                                                    <Form.Control 
                                                        type="date" 
                                                        value={filterDate}
                                                        onChange={(e) => setFilterDate(e.target.value)}
                                                        style={{ maxWidth: '180px' }}
                                                    />
                                                    {filterDate && (
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-sm btn-outline-secondary" 
                                                            onClick={() => setFilterDate('')} 
                                                            title="Clear Date"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    )}
                                                </Form.Group>
                                                
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-sm btn-light border" onClick={handleExportPDF} title="Export PDF">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-light border" onClick={handleExportExcel} title="Export Excel">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M10 9H8"></path><path d="m13 13 3 4"></path><path d="m16 13-3 4"></path></svg>
                                                    </button>
                                                    <button className="btn btn-sm btn-light border" onClick={handlePrint} title="Print">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {leadsLoading ? (
                                            <div className="text-center py-5">
                                                <Spinner animation="border" variant="primary" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="table-responsive">
                                                    <table className="table w-100">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '50px' }}><strong>Sl No</strong></th>
                                                                <th><strong>ID</strong></th>
                                                                <th><strong>Date</strong></th>
                                                                <th><strong>Shop Name</strong></th>
                                                                <th><strong>Category</strong></th>
                                                                <th><strong>Mobile</strong></th>
                                                                <th><strong>Status</strong></th>
                                                                <th><strong>Location</strong></th>
                                                                <th className="no-print text-center"><strong>Actions</strong></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {currentItems.length > 0 ? (
                                                                currentItems.map((lead, index) => {
                                                                    const dateParts = lead.lead_date ? lead.lead_date.split('-') : [];
                                                                    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : (lead.lead_date || '-');
                                                                    return (
                                                                        <tr key={lead.id}>
                                                                            <td><strong>{indexOfFirstItem + index + 1}</strong></td>
                                                                            <td><span className="fw-bold text-primary">{lead.lead_id || lead.id}</span></td>
                                                                            <td>{formattedDate}</td>
                                                                            <td>{lead.shop_name}</td>
                                                                            <td>{lead.shop_type || '-'}</td>
                                                                            <td>{lead.mobile_number || '-'}</td>
                                                                            <td>
                                                                                <span className={`badge ${
                                                                                    lead.status === 'Active' 
                                                                                        ? 'badge-success light' 
                                                                                        : lead.status?.toLowerCase().includes('escalat') 
                                                                                        ? 'badge-warning light' 
                                                                                        : 'badge-info light'
                                                                                }`}>
                                                                                    {lead.status}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                {lead.location ? (
                                                                                    <small title={lead.location}>
                                                                                        {lead.location.split(',').slice(0, 2).join(',')}
                                                                                    </small>
                                                                                ) : lead.city || lead.state ? (
                                                                                    <small>{[lead.city, lead.state].filter(Boolean).join(', ')}</small>
                                                                                ) : (
                                                                                    <span className="text-muted"><small>N/A</small></span>
                                                                                )}
                                                                            </td>
                                                                            <td className="no-print text-center">
                                                                                <button 
                                                                                    className="btn btn-outline-success shadow btn-xs sharp me-1" 
                                                                                    onClick={() => handleEdit(lead)} 
                                                                                    title="Edit Lead"
                                                                                >
                                                                                    <i className="fas fa-pencil-alt"></i>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="9" className="text-center">No leads found.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {totalPages > 1 && (
                                                    <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                                                        <div className="mb-2">
                                                            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length} entries
                                                        </div>
                                                        <nav>
                                                            <ul className="pagination pagination-gutter pagination-success no-bg mb-0">
                                                                <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 'none', background: 'none' }}>
                                                                        <i className="la la-angle-left"></i>
                                                                    </button>
                                                                </li>
                                                                {Array.from({ length: totalPages }, (_, i) => (
                                                                    <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                                                        <button type="button" className="page-link" onClick={() => setCurrentPage(i + 1)} style={{ border: 'none' }}>{i + 1}</button>
                                                                    </li>
                                                                ))}
                                                                <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                                    <button type="button" className="page-link" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 'none', background: 'none' }}>
                                                                        <i className="la la-angle-right"></i>
                                                                    </button>
                                                                </li>
                                                            </ul>
                                                        </nav>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </Tab.Pane>

                                    <Tab.Pane eventKey="followup">
                                        <Row className="g-3">
                                            <Col lg={showHistory ? 8 : 12}>
                                                <Row>
                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Location *</label>
                                                        <select className="form-control" value={selectedLocation} onChange={handleLocationChange}>
                                                            <option value="">-- Select Location --</option>
                                                            {followUpLocations.map((loc, idx) => (
                                                                <option key={idx} value={loc}>{loc.split(',')[0]}</option>
                                                            ))}
                                                        </select>
                                                    </Col>
                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Visit Date *</label>
                                                        <input type="date" className="form-control" name="visitDate" value={followUpForm.visitDate} onChange={handleFollowUpInputChange} />
                                                    </Col>
                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Pending Lead *</label>
                                                        <select 
                                                            className="form-control" 
                                                            value={selectedLead ? selectedLead.id : ''} 
                                                            onChange={handleLeadChange}
                                                            onClick={() => {
                                                                if (selectedLead) {
                                                                    setShowHistory(true);
                                                                    if (engagementHistory.length === 0 && !loadingHistory) {
                                                                        fetchLeadHistory(selectedLead.id);
                                                                    }
                                                                    scrollToHistoryOnMobile();
                                                                }
                                                            }}
                                                            onFocus={() => {
                                                                if (selectedLead) {
                                                                    setShowHistory(true);
                                                                    if (engagementHistory.length === 0 && !loadingHistory) {
                                                                        fetchLeadHistory(selectedLead.id);
                                                                    }
                                                                    scrollToHistoryOnMobile();
                                                                }
                                                            }}
                                                        >
                                                            <option value="">-- Select Lead --</option>
                                                            {followUpLeads.map(lead => (
                                                                <option key={lead.id} value={lead.id}>{lead.lead_id} - {lead.shop_name}</option>
                                                            ))}
                                                        </select>
                                                    </Col>

                                                    {selectedLead && (
                                                        <Col xl="12" className="mb-4 mt-2">
                                                            <div className="p-4 rounded border bg-light">
                                                                <Row className="align-items-center">
                                                                    <Col sm="8">
                                                                        <h5 className="mb-1 text-primary">{selectedLead.shop_name}</h5>
                                                                        <p className="mb-0 text-muted">ID: {selectedLead.lead_id}</p>
                                                                    </Col>
                                                                    <Col sm="4" className="text-sm-end mt-3 mt-sm-0">
                                                                        <div className="d-flex align-items-center justify-content-sm-end gap-3">
                                                                            <div>
                                                                                <small className="d-block text-muted mb-1">Mobile Number</small>
                                                                                <strong className="d-block">{selectedLead.mobile_number || 'N/A'}</strong>
                                                                            </div>
                                                                            {selectedLead.mobile_number && (
                                                                                <a href={`tel:${selectedLead.mobile_number}`} className="btn btn-success shadow btn-sm d-flex align-items-center gap-2">
                                                                                    <i className="fas fa-phone-alt"></i> Call
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </Col>
                                                                </Row>
                                                            </div>
                                                        </Col>
                                                    )}

                                                    <Col md="12" className="mb-3">
                                                        <label className="form-label font-w600">Remarks</label>
                                                        <textarea className="form-control" rows="3" name="remarks" value={followUpForm.remarks} onChange={handleFollowUpInputChange} placeholder="Enter customer remarks..."></textarea>
                                                    </Col>
                                                    
                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Purpose</label>
                                                        <select 
                                                            className="form-control" 
                                                            name="purpose" 
                                                            value={followUpForm.purpose} 
                                                            onChange={handleFollowUpInputChange}
                                                        >
                                                            <option value="">-- Select Purpose --</option>
                                                            {purposeOptions.map((opt, idx) => (
                                                                <option key={idx} value={opt}>
                                                                    {opt}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </Col>
                                                    
                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Status *</label>
                                                        <select className="form-control" name="status" value={followUpForm.status} onChange={handleFollowUpInputChange}>
                                                            <option value="Active">Active</option>
                                                            <option value="Working On Lead">Working On Lead</option>
                                                            <option value="Escalated">Escalated</option>
                                                        </select>
                                                    </Col>

                                                    <Col md="4" className="mb-3">
                                                        <label className="form-label font-w600">Next Visit Date</label>
                                                        <input type="date" className="form-control" name="nextVisitDate" value={followUpForm.nextVisitDate} onChange={handleFollowUpInputChange} />
                                                    </Col>

                                                    <Col md="12" className="mb-4">
                                                        <label className="form-label font-w600 d-block">Live Shop Photo</label>
                                                        
                                                        {!isCameraOpen && !shopPhotoPreview && (
                                                            <button className="btn btn-outline-primary mb-0 d-flex align-items-center gap-2 cursor-pointer" onClick={openCamera}>
                                                                <i className="fas fa-camera"></i> Capture Photo
                                                            </button>
                                                        )}

                                                        {isCameraOpen && (
                                                            <div className="camera-container mt-2">
                                                                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: '400px', borderRadius: '8px', backgroundColor: '#000' }}></video>
                                                                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                                                                <div className="mt-2 d-flex gap-2">
                                                                    <button className="btn btn-success d-flex align-items-center gap-2" onClick={captureLivePhoto}>
                                                                        <i className="fas fa-camera"></i> Take Photo
                                                                    </button>
                                                                    <button className="btn btn-danger" onClick={stopCamera}>Cancel</button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {shopPhotoPreview && !isCameraOpen && (
                                                            <div className="mt-2">
                                                                <div className="position-relative d-inline-block" style={{ width: '150px', height: '150px' }}>
                                                                    <img src={shopPhotoPreview} alt="Shop Preview" className="img-thumbnail w-100 h-100 object-fit-cover" />
                                                                    <button 
                                                                        className="btn btn-danger btn-sm position-absolute" 
                                                                        style={{ top: '-10px', right: '-10px', borderRadius: '50%' }}
                                                                        onClick={() => { setShopPhotoPreview(null); setShopPhoto(null); }}
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                                <div className="mt-2">
                                                                    <button className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 cursor-pointer" onClick={openCamera}>
                                                                        <i className="fas fa-camera"></i> Retake Photo
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Col>

                                                    <Col md="12" className="mt-2">
                                                        <button className="btn btn-primary w-100" onClick={submitFollowUp} disabled={!selectedLocation || !selectedLead || isSavingFollowUp}>
                                                            {isSavingFollowUp ? 'Updating...' : 'Update'}
                                                        </button>
                                                    </Col>
                                                </Row>
                                            </Col>

                                            {showHistory && (
                                                <Col lg={4} ref={historyPanelRef} style={{ scrollMarginTop: '80px' }}>
                                                    <div 
                                                        style={{ 
                                                            display: 'flex', 
                                                            flexDirection: 'column', 
                                                            height: '100%', 
                                                            minHeight: '480px',
                                                            borderRadius: '16px', 
                                                            overflow: 'hidden', 
                                                            border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                                                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                                                            background: isDark ? '#1e293b' : '#ffffff',
                                                            position: 'sticky',
                                                            top: '20px'
                                                        }}
                                                    >
                                                        <div 
                                                            style={{ 
                                                                background: isDark ? '#0f172a' : '#ffffff', 
                                                                borderBottom: `2px solid ${isDark ? '#334155' : '#e8fdf4'}`, 
                                                                padding: '12px 16px', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'space-between' 
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ background: '#e8fdf4', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <i className="fa fa-history" style={{ color: '#2ece8a', fontSize: '0.9rem' }}></i>
                                                                </div>
                                                                <div>
                                                                    <div style={{ color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.3px' }}>Previous Engagements</div>
                                                                    <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                                                        {engagementHistory.length > 0 ? `${engagementHistory.length} visit${engagementHistory.length > 1 ? 's' : ''} recorded` : 'No history yet'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                type="button"
                                                                onClick={() => setShowHistory(false)} 
                                                                style={{ background: isDark ? '#334155' : '#f1f5f9', border: 'none', borderRadius: '8px', color: '#94a3b8', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem' }} 
                                                                title="Hide panel"
                                                            >
                                                                <i className="fa fa-times"></i>
                                                            </button>
                                                        </div>
                                                        <div style={{ flex: 1, overflowY: 'auto', background: isDark ? '#1e293b' : '#f8fafc', padding: '12px', maxHeight: '650px' }}>
                                                            {loadingHistory ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
                                                                    <div className="spinner-border spinner-border-sm text-primary"></div>
                                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading history...</span>
                                                                </div>
                                                            ) : engagementHistory && engagementHistory.length > 0 ? (
                                                                <div style={{ position: 'relative', paddingLeft: '22px' }}>
                                                                    <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'linear-gradient(to bottom, #2ece8a, #e2e8f0)' }}></div>
                                                                    {engagementHistory.map((eng, idx) => {
                                                                        const dateRaw = eng.visit_date || eng.entry_time || eng.created_at;
                                                                        const dateStr = dateRaw ? new Date(dateRaw).toLocaleDateString('en-GB') : 'Unknown Date';
                                                                        const inTime = eng.entry_time ? new Date(eng.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : (eng.created_at ? new Date(eng.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-');
                                                                        const outTime = eng.exit_time ? new Date(eng.exit_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : null;
                                                                        const metPerson = eng.employee_name || 'N/A';
                                                                        const purpose = eng.remarks || eng.purpose || null;
                                                                        const isOut = eng.status?.toLowerCase() === 'exited' || !!eng.exit_time || eng.status?.toLowerCase() === 'completed';
                                                                        let duration = eng.duration || null;
                                                                        if (!duration && eng.entry_time && eng.exit_time) {
                                                                            const mins = Math.round((new Date(eng.exit_time) - new Date(eng.entry_time)) / 60000);
                                                                            duration = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                                                                        }
                                                                        const statusLabel = eng.status ? eng.status.toUpperCase() : (isOut ? 'EXITED' : 'ACTIVE');
                                                                        return (
                                                                            <div key={eng.id || idx} style={{ position: 'relative', marginBottom: '10px' }}>
                                                                                <div style={{ position: 'absolute', left: '-18px', top: '12px', width: '9px', height: '9px', borderRadius: '50%', background: isOut ? '#2ece8a' : '#f59e0b', border: '2px solid #fff', boxShadow: `0 0 0 2px ${isOut ? '#2ece8a' : '#f59e0b'}44` }}></div>
                                                                                <div style={{ background: isDark ? '#0f172a' : '#fff', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                                                                                    <div style={{ padding: '7px 10px', background: isOut ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'linear-gradient(90deg, #f0fdf4, #fff)') : (isDark ? 'rgba(245, 158, 11, 0.1)' : 'linear-gradient(90deg, #fffbeb, #fff)'), borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                                        <span style={{ fontWeight: 700, fontSize: '0.75rem', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                                                            <i className="fa fa-calendar-day me-1" style={{ color: '#94a3b8' }}></i>{dateStr}
                                                                                        </span>
                                                                                        <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.4px', padding: '1px 7px', borderRadius: '20px', background: isOut ? '#dcfce7' : '#fef3c7', color: isOut ? '#16a34a' : '#d97706' }}>
                                                                                            {isOut ? `\u2713 ${statusLabel}` : `\u25cf ${statusLabel}`}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                                                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                                                <i className="fa fa-sign-in-alt text-success"></i>
                                                                                                <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{inTime}</strong>
                                                                                            </span>
                                                                                            {outTime && (<>
                                                                                                <span style={{ color: '#cbd5e1' }}>&#8594;</span>
                                                                                                <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                                                    <i className="fa fa-sign-out-alt text-danger"></i>
                                                                                                    <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{outTime}</strong>
                                                                                                </span>
                                                                                            </>)}
                                                                                            {duration && (
                                                                                                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', fontWeight: 600, background: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#e2e8f0' : '#475569', padding: '1px 6px', borderRadius: '8px' }}>
                                                                                                    <i className="fa fa-hourglass-half me-1" style={{ fontSize: '0.55rem' }}></i>{duration}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                            <i className="fa fa-user-tie" style={{ color: '#94a3b8', width: '12px' }}></i>
                                                                                            <span style={{ color: '#94a3b8' }}>Met:</span>
                                                                                            <strong style={{ color: isDark ? '#cbd5e1' : '#334155' }}>{metPerson}</strong>
                                                                                        </div>
                                                                                        {purpose && (
                                                                                            <div style={{ fontSize: '0.68rem', color: isDark ? '#94a3b8' : '#64748b', background: isDark ? '#1e293b' : '#f8fafc', borderRadius: '6px', padding: '3px 7px', borderLeft: '2px solid #2ece8a', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={purpose}>
                                                                                                <i className="fa fa-quote-left me-1" style={{ fontSize: '0.55rem', color: '#cbd5e1' }}></i>{purpose}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
                                                                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                                                        <i className="fa fa-calendar-times" style={{ fontSize: '1.3rem', color: '#cbd5e1' }}></i>
                                                                    </div>
                                                                    <div style={{ fontWeight: 600, color: '#475569', fontSize: '0.82rem', marginBottom: '2px' }}>No History Found</div>
                                                                    <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>This is their first registered visit</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Col>
                                            )}
                                        </Row>
                                    </Tab.Pane>

                                    <Tab.Pane eventKey="followup_history">
                                        <LeadFollowUpHistory />
                                    </Tab.Pane>
                                </Tab.Content>
                            </Tab.Container>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Fragment>
    );
};

export default LeadsModule;
