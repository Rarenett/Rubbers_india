import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AssetService from '../../../services/AssetService.js';
import { getUsers, getDepartments } from '../../../services/HRManagementService';
import { fetchBranches } from '../../../services/CompanyService';
import { exportToPDF, exportToExcel, printData } from './exportUtils';
import swal from 'sweetalert';
import './FileDashboard.css';
import { usePermission } from '../../../hooks/usePermission';

// Modular Components
import ManagementSidebar from './ManagementSidebar';
import AssetList from './AssetList';
import AssetForm from './AssetForm';
import AssetTypeList from './AssetTypeList';
import AssetTypeForm from './AssetTypeForm';
import AssetCategoryList from './AssetCategoryList';
import AssetCategoryForm from './AssetCategoryForm';
import QuickAddDepartmentModal from '../HR/Masters/QuickAddDepartmentModal';
import QuickAddUserModal from '../HR/Users/QuickAddUserModal';
import RoomList from './RoomList';
import RoomForm from './RoomForm';
import ShelfList from './ShelfList';
import ShelfForm from './ShelfForm';
import RackList from './RackList';
import RackForm from './RackForm';
import FileList from './FileList';
import FileForm from './FileForm';
import KeyList from './KeyList';
import KeyForm from './KeyForm';
import AssetAttributeList from './AssetAttributeList';
import AssetAttributeForm from './AssetAttributeForm';
import AssetDetailModal from './AssetDetailModal';
import AssetAllocationModals from './AssetAllocationModals';
import AssetAllocationList from './AssetAllocationList';
import AssetHistoryModal from './AssetHistoryModal';
import { usePageTitle } from '../../../context/TitleContext';

const AssetManagement = ({ embedded }) => {
    const { type } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { can } = usePermission();
    usePageTitle("Allocation History");
    
        // When embedded in dashboard, useParams won't have :type. Extract from page query param.
    let activeManagement;
    if (type) {
        activeManagement = decodeURIComponent(type);
    } else {
        // First try to check the path URL directly for asset-management
        const pathParts = window.location.pathname.split('/');
        const assetIndex = pathParts.indexOf('asset-management');
        if (assetIndex !== -1 && pathParts[assetIndex + 1]) {
            activeManagement = decodeURIComponent(pathParts[assetIndex + 1]);
        } else {
            const pageParam = searchParams.get('page') || '';
            const match = pageParam.match(/asset-management\/(.+)/);
            activeManagement = match ? decodeURIComponent(match[1]) : 'Room';
        }
    }

    // Map lowercase routes to expected capitalized internal names
    const activeLower = activeManagement ? activeManagement.toLowerCase() : '';
    if (activeLower === 'asset') {
        activeManagement = 'Asset';
    } else if (activeLower === 'room') {
        activeManagement = 'Room';
    } else if (activeLower === 'shelf') {
        activeManagement = 'Shelf';
    } else if (activeLower === 'rack') {
        activeManagement = 'Rack';
    } else if (activeLower === 'type') {
        activeManagement = 'Type';
    } else if (activeLower === 'assetcategory' || activeLower === 'category') {
        activeManagement = 'AssetCategory';
    } else if (activeLower === 'assetattributedefinition' || activeLower === 'attribute') {
        activeManagement = 'AssetAttributeDefinition';
    } else if (activeLower === 'file') {
        activeManagement = 'File';
    } else if (activeLower === 'key') {
        activeManagement = 'Key';
    } else if (activeLower === 'allocation') {
        activeManagement = 'Allocation';
    } else if (activeLower === 'key allocation') {
        activeManagement = 'Key Allocation';
    } else if (activeLower === 'key report') {
        activeManagement = 'Key Report';
    } else if (activeLower === 'report') {
        activeManagement = 'Report';
    }

    // Module code for the File subsubmenu permission checks
    // This matches the 'code' set in the SubSubMenu for File Management (code='file')
    const fileModule = 'file';
    // This matches the 'code' set in the SubSubMenu for Key Management (code='key')
    const keyModule = 'key';

    const now = new Date();
    const localMinDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const [managementData, setManagementData] = useState([]);
    const [allocationData, setAllocationData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [selectedId, setSelectedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [selectedShelfId, setSelectedShelfId] = useState('');
    const [bulkAttributes, setBulkAttributes] = useState([{ name: '', field_type: 'text', is_required: false, is_active: true, display_order: 0, help_text: '' }]);
    const [formDocuments, setFormDocuments] = useState([{ document_name: 'invoice', file: null, custom_name: '' }]);
    const [availableDocTypes, setAvailableDocTypes] = useState(['invoice', 'warranty', 'manual', 'repair bill']);

    // Quick Add Asset Type Modal States
    const [showQuickAddAssetTypeModal, setShowQuickAddAssetTypeModal] = useState(false);
    const [quickAssetTypeFormData, setQuickAssetTypeFormData] = useState({});

    const [showQuickAddAssetCategoryModal, setShowQuickAddAssetCategoryModal] = useState(false);
    const [quickAssetCategoryFormData, setQuickAssetCategoryFormData] = useState({});

    const [showQuickAddDepartmentModal, setShowQuickAddDepartmentModal] = useState(false);

    const [showQuickAddUserModal, setShowQuickAddUserModal] = useState(false);
    const [quickAddUserField, setQuickAddUserField] = useState(null);  

    const [showQuickAddAttributeModal, setShowQuickAddAttributeModal] = useState(false);
    const [quickAddAttributeCategory, setQuickAddAttributeCategory] = useState(null);
    const [quickAssetAttributeFormData, setQuickAssetAttributeFormData] = useState({});
    const [quickBulkAttributes, setQuickBulkAttributes] = useState([{ name: '', field_type: 'text', is_required: false, is_active: true, display_order: 0, help_text: '' }]);

    // Allocation modal states
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showReallocateModal, setShowReallocateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [allocateFormData, setAllocateFormData] = useState({
        asset: '',
        due_date: localMinDateTime,
        assigned_to: '',
        remarks: '',
        allow_reallocation: true
    });
    const [returnFormData, setReturnFormData] = useState({ return_remarks: '' });
    const [reallocateFormData, setReallocateFormData] = useState({ due_date: localMinDateTime });

    // History modal states
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyItemName, setHistoryItemName] = useState('');
    const [historyItemType, setHistoryItemType] = useState('');

    // Available items for Allocation tab modal
    const [availableFiles, setAvailableFiles] = useState([]);
    const [availableKeys, setAvailableKeys] = useState([]);
    const [availableITAssets, setAvailableITAssets] = useState([]);

    // Dropdown data
    const [rooms, setRooms] = useState([]);
    const [shelves, setShelves] = useState([]);
    const [racks, setRacks] = useState([]);
    const [assetTypes, setAssetTypes] = useState([]);
    const [assetCategories, setAssetCategories] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [attributeDefinitions, setAttributeDefinitions] = useState([]);

    useEffect(() => {
        const userDetails = localStorage.getItem('userDetails');
        if (userDetails) {
            setCurrentUser(JSON.parse(userDetails));
        }
        fetchData();
        prefetchDependencies();
    }, [activeManagement]);

    useEffect(() => {
        AssetService.getITAssetDocuments().then(res => {
            const types = new Set(['invoice', 'warranty', 'manual', 'repair bill']);
            const docs = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            docs.forEach(d => {
                if (d.document_name) types.add(d.document_name.toLowerCase());
            });
            setAvailableDocTypes(Array.from(types));
        }).catch(() => { });
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setManagementData([]);
        try {
            let res;
            if (activeManagement === 'Room') res = await AssetService.getStorageRooms();
            else if (activeManagement === 'Shelf') res = await AssetService.getShelves();
            else if (activeManagement === 'Rack') res = await AssetService.getRacks();
            else if (activeManagement === 'Type') res = await AssetService.getAssetTypes();
            else if (activeManagement === 'File') res = await AssetService.getFiles();
            else if (activeManagement === 'Key') res = await AssetService.getKeys();
            else if (activeManagement === 'Asset') res = await AssetService.getITAssets();
            else if (activeManagement === 'AssetCategory') res = await AssetService.getITAssetCategories();
            else if (activeManagement === 'AssetAttributeDefinition') res = await AssetService.getITAssetAttributeDefinitions();
            else if (activeManagement === 'Allocation' || activeManagement === 'Report') {
                res = activeManagement === 'Allocation'
                    ? await AssetService.getAllocations()
                    : await AssetService.getAllocationReport();
                const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                setAllocationData(data);
                setLoading(false);
                return;
            }
            else if (activeManagement === 'Key Allocation' || activeManagement === 'Key Report') {
                res = activeManagement === 'Key Allocation'
                    ? await AssetService.getKeyAllocations()
                    : await AssetService.getKeyAllocationReport();
                const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                setAllocationData(data);
                setLoading(false);
                return;
            }

            const dataToSet = Array.isArray(res.data)
                ? res.data
                : (res.data && res.data.results ? res.data.results : []);
            setManagementData(dataToSet);
        } catch (error) {
            console.error(`Error fetching ${activeManagement}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const prefetchDependencies = async () => {
        try {
            AssetService.getCompanies().then(r => setCompanies(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            fetchBranches().then(r => setBranches(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getStorageRooms().then(r => setRooms(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getAssetTypes().then(r => setAssetTypes(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getITAssetCategories().then(r => setAssetCategories(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getITAssetAttributeDefinitions().then(r => setAttributeDefinitions(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getShelves().then(r => setShelves(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            AssetService.getRacks().then(r => setRacks(Array.isArray(r.data) ? r.data : (r.data?.results || []))).catch(() => { });
            getUsers().then(r => setUsers(Array.isArray(r) ? r : (r?.results || []))).catch(() => { });
            getDepartments().then(r => setDepartments(Array.isArray(r) ? r : (r?.results || []))).catch(() => { });
            AssetService.getFiles().then(r => {
                const files = Array.isArray(r.data) ? r.data : (r.data?.results || []);
                let available = files.filter(f => f.status === 'Available');
                const userObj = JSON.parse(localStorage.getItem('userDetails') || '{}');
                const currentUserId = userObj?.user?.id || userObj?.id;
                const isSuper = userObj?.user?.is_superuser || userObj?.is_superuser;
                
                if (!isSuper && currentUserId) {
                    available = available.filter(f => String(f.rack_custodian_id) === String(currentUserId));
                }
                setAvailableFiles(available);
            }).catch(() => { });
            AssetService.getKeys().then(r => {
                const keys = Array.isArray(r.data) ? r.data : (r.data?.results || []);
                setAvailableKeys(keys.filter(k => k.status === 'Available'));
            }).catch(() => { });
            AssetService.getITAssets().then(r => {
                const assets = Array.isArray(r.data) ? r.data : (r.data?.results || []);
                setAvailableITAssets(assets.filter(a => a.status === 'available'));
            }).catch(() => { });
        } catch (err) {
            console.error('Error prefetching dependencies:', err);
        }
    };

    const getInheritedAttributes = (categoryId) => {
        if (!categoryId) return [];
        let attrs = [];
        let currentId = categoryId;
        const seenCategories = new Set();
        while (currentId && !seenCategories.has(currentId)) {
            seenCategories.add(currentId);
            const cat = assetCategories.find(c => String(c.id) === String(currentId));
            const catAttrs = attributeDefinitions.filter(ad => String(ad.category) === String(currentId));
            attrs = [...catAttrs, ...attrs];
            currentId = cat?.parent;
        }
        return attrs;
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            // Sanitize ALL empty strings to null for Django validation globally 
            const payload = { ...formData };
            for (const key in payload) {
                if (payload[key] === '') payload[key] = null;
            }

            if (activeManagement === 'Room') {
                const roomData = { ...payload };
                if (!isEditing && companies.length > 0) roomData.company = companies[0].id;
                if (isEditing) await AssetService.updateRoom(selectedId, roomData);
                else await AssetService.createRoom(roomData);
            } else if (activeManagement === 'Shelf') {
                if (isEditing) await AssetService.updateShelf(selectedId, payload);
                else await AssetService.createShelf(payload);
            } else if (activeManagement === 'Rack') {
                if (isEditing) await AssetService.updateRack(selectedId, payload);
                else await AssetService.createRack(payload);
            } else if (activeManagement === 'Type') {
                if (isEditing) await AssetService.updateAssetType(selectedId, payload);
                else await AssetService.createAssetType(payload);
            } else if (activeManagement === 'File') {
                if (isEditing) await AssetService.updateFile(selectedId, payload);
                else await AssetService.createFile(payload);
            } else if (activeManagement === 'Key') {
                if (isEditing) await AssetService.updateKey(selectedId, payload);
                else await AssetService.createKey(payload);
            } else if (activeManagement === 'Asset') {
                let assetId = selectedId;

                if (isEditing) {
                    await AssetService.updateITAsset(selectedId, payload);
                } else {
                    const res = await AssetService.createITAsset(payload);
                    assetId = res.data.id;
                }

                for (const doc of formDocuments) {
                    if (doc.file && !(typeof doc.file === 'string')) {
                        const docFormData = new FormData();
                        docFormData.append('asset', assetId);
                        const finalName = doc.document_name === 'other' ? doc.custom_name : doc.document_name;
                        docFormData.append('document_name', finalName || 'other');
                        docFormData.append('file', doc.file);
                        await AssetService.createITAssetDocument(docFormData);
                    }
                }
            } else if (activeManagement === 'AssetCategory') {
                if (isEditing) await AssetService.updateITAssetCategory(selectedId, payload);
                else await AssetService.createITAssetCategory(payload);
            } else if (activeManagement === 'AssetAttributeDefinition') {
                if (isEditing) {
                    await AssetService.updateITAssetAttributeDefinition(selectedId, payload);
                } else {
                    for (const attr of bulkAttributes) {
                        if (!attr.name) continue;
                        await AssetService.createITAssetAttributeDefinition({ ...attr, category: payload.category });
                    }
                }
            }
            setShowModal(false);
            fetchData();
            swal('Success!', `${activeManagement} saved successfully!`, 'success');
        } catch (error) {
            console.error('Save error:', error.response?.data);
            let errorMsg = 'Error saving record. Please check fields.';
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'string') {
                    errorMsg = data;
                } else if (data.detail) {
                    errorMsg = data.detail;
                } else {
                    const messages = [];
                    for (const key in data) {
                        const val = data[key];
                        if (Array.isArray(val)) {
                            messages.push(val[0]);
                        } else if (typeof val === 'string') {
                            messages.push(val);
                        }
                    }
                    if (messages.length > 0) {
                        errorMsg = messages.join('\n');
                    } else {
                        errorMsg = JSON.stringify(data);
                    }
                }
            }
            swal('Warning', errorMsg, 'warning');
        }
    };

    const handleQuickAddAssetTypeSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...quickAssetTypeFormData };
            for (const key in payload) {
                if (payload[key] === '') payload[key] = null;
            }
            const res = await AssetService.createAssetType(payload);
            const newType = res.data;

            // Refresh asset types
            const typesRes = await AssetService.getAssetTypes();
            setAssetTypes(Array.isArray(typesRes.data) ? typesRes.data : (typesRes.data?.results || []));

            // Auto-select in the AssetCategory form
            setFormData(prev => ({ ...prev, asset_type: String(newType.id) }));

            setShowQuickAddAssetTypeModal(false);
            setQuickAssetTypeFormData({});
            swal('Success!', 'Asset Type created successfully!', 'success');
        } catch (error) {
            console.error('Quick add error:', error.response?.data);
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : 'Error saving record. Please check fields.';
            swal('Error', errorMsg, 'error');
        }
    };

    const handleQuickAddAssetCategorySubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            const payload = { ...quickAssetCategoryFormData };
            for (const key in payload) {
                if (payload[key] === '') payload[key] = null;
            }
            const res = await AssetService.createITAssetCategory(payload);
            const newCat = res.data;
            const catRes = await AssetService.getITAssetCategories();
            setAssetCategories(Array.isArray(catRes.data) ? catRes.data : (catRes.data?.results || []));
            setFormData(prev => ({ ...prev, category: String(newCat.id) }));
            setShowQuickAddAssetCategoryModal(false);
            setQuickAssetCategoryFormData({});
            swal('Success!', 'Asset Category created successfully!', 'success');
        } catch (error) {
            swal('Error', error.response?.data ? JSON.stringify(error.response.data) : 'Error saving record', 'error');
        }
    };

    const handleQuickAddDepartmentSubmit = async (newDept) => {
        try {
            const depRes = await getDepartments();
            setDepartments(Array.isArray(depRes) ? depRes : (depRes?.results || []));
            setFormData(prev => ({ ...prev, department: String(newDept.id) }));
            setShowQuickAddDepartmentModal(false);
            swal('Success!', 'Department created successfully!', 'success');
        } catch (error) {
            swal('Error', 'Failed to refresh departments', 'error');
        }
    };

    const handleQuickAddUserSubmit = async (newUser) => {
        try {
            const userRes = await getUsers();
            setUsers(Array.isArray(userRes) ? userRes : (userRes?.results || []));
            if (quickAddUserField) {
                setFormData(prev => ({ ...prev, [quickAddUserField]: String(newUser.id) }));
            }
            setShowQuickAddUserModal(false);
            swal('Success!', 'User created successfully!', 'success');
        } catch (error) {
            swal('Error', 'Failed to refresh users', 'error');
        }
    };

    const handleQuickAddAttributeSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        try {
            for (const attr of quickBulkAttributes) {
                if (!attr.name) continue;
                await AssetService.createITAssetAttributeDefinition({ ...attr, category: quickAddAttributeCategory });
            }
            const attrRes = await AssetService.getITAssetAttributeDefinitions();
            setAttributeDefinitions(Array.isArray(attrRes.data) ? attrRes.data : (attrRes.data?.results || []));
            setShowQuickAddAttributeModal(false);
            setQuickAssetAttributeFormData({});
            setQuickBulkAttributes([{ name: '', field_type: 'text', is_required: false, is_active: true, display_order: 0, help_text: '' }]);
            swal('Success!', 'Attribute Definitions created successfully!', 'success');
        } catch (error) {
            swal('Error', error.response?.data ? JSON.stringify(error.response.data) : 'Error saving record', 'error');
        }
    };

    const handleEdit = (item) => {
        setFormData(item);
        setSelectedId(item.id);
        setIsEditing(true);
        setShowModal(true);
        if (activeManagement === 'Shelf') {
            setSelectedRoomId(item.room || '');
        } else if (activeManagement === 'Rack') {
            const shelf = shelves.find(s => s.id === item.shelf);
            setSelectedRoomId(shelf?.room || '');
        } else if (activeManagement === 'File') {
            const rack = racks.find(r => r.id === item.rack);
            const shelf = shelves.find(s => s.id === rack?.shelf);
            setSelectedRoomId(shelf?.room || '');
            setSelectedShelfId(rack?.shelf || '');
        } else if (activeManagement === 'Asset') {
            const attrMap = {};
            if (item.attribute_values && Array.isArray(item.attribute_values)) {
                item.attribute_values.forEach(av => {
                    const val = av.value_text || av.value_number || av.value_date || av.value_boolean;
                    attrMap[av.attribute] = val;
                });
            }

            let maintenanceData = {};
            if (item.maintenances && item.maintenances.length > 0) {
                const main = item.maintenances[0];
                maintenanceData = {
                    maintenance_type: main.maintenance_type || '',
                    scheduled_date: main.scheduled_date || '',
                    technician: main.technician || ''
                };
            }

            setFormData({ ...item, attribute_values: attrMap, ...maintenanceData });
            AssetService.getITAssetDocuments().then(res => {
                const rawDocs = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                const docs = rawDocs.filter(d => d.asset === item.id);
                setFormDocuments(docs.length > 0 ? docs.map(d => ({ ...d, custom_name: d.document_name })) : [{ document_name: 'invoice', file: null, custom_name: '' }]);
            });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Are you sure you want to delete this ${activeManagement.toLowerCase()}?`)) return;
        try {
            if (activeManagement === 'Room') await AssetService.deleteRoom(id);
            else if (activeManagement === 'Shelf') await AssetService.deleteShelf(id);
            else if (activeManagement === 'Rack') await AssetService.deleteRack(id);
            else if (activeManagement === 'Type') await AssetService.deleteAssetType(id);
            else if (activeManagement === 'File') await AssetService.deleteFile(id);
            else if (activeManagement === 'Key') await AssetService.deleteKey(id);
            else if (activeManagement === 'Asset') await AssetService.deleteITAsset(id);
            else if (activeManagement === 'AssetCategory') await AssetService.deleteITAssetCategory(id);
            else if (activeManagement === 'AssetAttributeDefinition') await AssetService.deleteITAssetAttributeDefinition(id);
            fetchData();
        } catch (error) { alert('Error deleting record.'); }
    };

    const handleShowDetails = (item) => {
        const attrMap = {};
        if (item.attribute_values && Array.isArray(item.attribute_values)) {
            item.attribute_values.forEach(av => {
                const val = av.value_text || av.value_number || av.value_date || av.value_boolean;
                attrMap[av.attribute] = val;
            });
        }
        setFormData({ ...item, attribute_values: attrMap });
        AssetService.getITAssetDocuments().then(res => {
            const rawDocs = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            const docs = rawDocs.filter(d => d.asset === item.id);
            setFormDocuments(docs.length > 0 ? docs.map(d => ({ ...d, custom_name: d.document_name })) : [{ document_name: 'invoice', file: null, custom_name: '' }]);
        });
        setShowDetailModal(true);
    };

    const handleOpenAllocate = (item) => {
        setSelectedFile(item);
        setAllocateFormData({ asset: item.id, due_date: localMinDateTime, assigned_to: '', remarks: '', allow_reallocation: true });
        setShowAllocateModal(true);
    };

    const handleOpenAllocateFromTab = () => {
        setSelectedFile(null);
        setAllocateFormData({ asset: '', due_date: localMinDateTime, assigned_to: '', remarks: '', allow_reallocation: true });
        setShowAllocateModal(true);
    };

    const handleOpenKeyAllocateFromTab = () => {
        setSelectedFile(null);
        setAllocateFormData({ asset: '', due_date: localMinDateTime, assigned_to: '', remarks: '', allow_reallocation: true });
        setShowAllocateModal(true);
    };

    const handleAllocateSubmit = async (e) => {
        e.preventDefault();
        const assetId = selectedFile ? selectedFile.id : allocateFormData.asset;
        try {
            if (activeManagement.startsWith('Key')) {
                await AssetService.allocateKey({ ...allocateFormData, key: assetId });
            } else if (activeManagement === 'File' || activeManagement === 'Allocation') {
                await AssetService.allocateFile({ ...allocateFormData, file: assetId });
            } else if (activeManagement === 'Asset') {
                // Map 'assigned_to' to 'allocated_to_user' for IT assets
                const payload = {
                    ...allocateFormData,
                    assets: [assetId],
                    allocated_to_user: allocateFormData.assigned_to,
                    allocated_to_department: allocateFormData.allocated_to_department
                };
                await AssetService.createITAssetAllocation(payload);
            }
            setShowAllocateModal(false);
            fetchData();
            swal('Allocated!', 'Asset allocated successfully!', 'success');
        } catch (error) {
            console.error('Allocation error:', error);
            swal('Error', error.response?.data?.error || 'Allocation failed.', 'error');
        }
    };

    const handleOpenReturn = (item) => {
        setSelectedAllocation(item);
        setSelectedFile(item.file_details || item.key_details);
        setReturnFormData({ return_remarks: '', return_to: 'admin' });
        setShowReturnModal(true);
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeManagement.startsWith('Key')) {
                await AssetService.returnKey(selectedAllocation.id, returnFormData);
            } else if (activeManagement === 'File' || activeManagement === 'Allocation') {
                await AssetService.returnFile(selectedAllocation.id, returnFormData);
            } else if (activeManagement.includes('Asset')) {
                await AssetService.returnITAsset(selectedAllocation.id, returnFormData);
            }
            setShowReturnModal(false);
            fetchData();
            swal('Returned!', 'Asset returned successfully!', 'success');
        } catch (error) {
            console.error('Return error:', error);
            swal('Error', 'Return failed.', 'error');
        }
    };

    const handleOpenReallocate = (item) => {
        setSelectedAllocation(item);
        setSelectedFile(item.file_details || item.key_details);
        setReallocateFormData({ due_date: localMinDateTime, allow_reallocation: true });
        setShowReallocateModal(true);
    };

    const handleReallocateSubmit = async (e) => {
        e.preventDefault();
        try {
            if (activeManagement.startsWith('Key')) await AssetService.reallocateKey(selectedAllocation.id, reallocateFormData);
            else await AssetService.reallocateFile(selectedAllocation.id, reallocateFormData);
            setShowReallocateModal(false);
            fetchData();
        } catch (error) { alert('Reallocation failed.'); }
    };

    const handleShowFileHistory = async (file) => {
        setHistoryItemName(file.file_name);
        setHistoryItemType('File');
        setHistoryList([]);
        setHistoryLoading(true);
        setShowHistoryModal(true);
        try {
            const res = await AssetService.getFileHistory(file.id);
            setHistoryList(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleShowKeyHistory = async (keyItem) => {
        setHistoryItemName(keyItem.key_name);
        setHistoryItemType('Key');
        setHistoryList([]);
        setHistoryLoading(true);
        setShowHistoryModal(true);
        try {
            const res = await AssetService.getKeyHistory(keyItem.id);
            setHistoryList(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleUpdateResponse = async (item, response) => {
        try {
            if (activeManagement.startsWith('Key')) {
                await AssetService.updateKeyAllocationResponse(item.id, response);
            } else {
                await AssetService.updateAllocationResponse(item.id, response);
            }
            fetchData();
            swal('Updated!', `Allocation response updated to ${response.toLowerCase()}!`, 'success');
        } catch (error) {
            console.error('Update response error:', error);
            swal('Error', error.response?.data?.error || 'Failed to update response.', 'error');
        }
    };

    const handleExport = (format) => {
        let data = [];
        let columns = [];
        let title = `${activeManagement} Report`;
        if (activeManagement.includes('Allocation') || activeManagement.includes('Report')) {
            data = allocationData;
            const isKey = activeManagement.includes('Key');
            columns = [
                { header: isKey ? 'Key' : 'File', dataKey: isKey ? 'key_details' : 'file_details', formatter: (val) => isKey ? val?.key_name : val?.file_name },
                { header: 'Assigned To', dataKey: 'assigned_to_details', formatter: (val) => val ? `${val.first_name} ${val.last_name}` : '—' },
                { header: 'Status', dataKey: 'status' }
            ];
        } else {
            const getSafeLocation = (row) => {
                if (!row) return '';
                const parts = [];
                if (row.room_name) parts.push(row.room_name);
                if (row.shelf_name) parts.push(row.shelf_name);
                if (row.rack_name) parts.push(row.rack_name);
                return parts.length > 0 ? parts.join(' - ') : '—';
            };

            data = managementData || [];
            if (activeManagement === 'Room') {
                columns = [
                    { header: 'Room Name', dataKey: 'name' },
                    { header: 'Capacity', dataKey: 'total_capacity' },
                    { header: 'Company', dataKey: 'company_name' },
                    { header: 'Branch', dataKey: 'branch_name' },
                    { header: 'Department', dataKey: 'department_name' }
                ];
            } else if (activeManagement === 'Shelf') {
                columns = [
                    { header: 'Shelf Name', dataKey: 'name' },
                    { header: 'Storage Room', dataKey: 'room_name' }
                ];
            } else if (activeManagement === 'Rack') {
                columns = [
                    { header: 'Rack Name', dataKey: 'name' },
                    { header: 'Shelf', dataKey: 'shelf_name' },
                    { header: 'Storage Room', dataKey: 'room_name' }
                ];
            } else if (activeManagement === 'Type') {
                columns = [
                    { header: 'Type Name', dataKey: 'name' },
                    { header: 'Code Prefix', dataKey: 'code_prefix' },
                    { header: 'Description', dataKey: 'description' }
                ];
            } else if (activeManagement === 'AssetCategory') {
                columns = [
                    { header: 'Category Name', dataKey: 'name' },
                    { header: 'Asset Type', dataKey: 'asset_type_name' },
                    { header: 'Parent Category', dataKey: 'parent_name' },
                    { header: 'Code Prefix', dataKey: 'code_prefix' }
                ];
            } else if (activeManagement === 'AssetAttributeDefinition') {
                columns = [
                    { header: 'Attribute Name', dataKey: 'name' },
                    { header: 'Category', dataKey: 'category_name' },
                    { header: 'Field Type', dataKey: 'field_type' },
                    { header: 'Required', dataKey: 'is_required', formatter: (val) => val ? 'Yes' : 'No' }
                ];
            } else if (activeManagement === 'Asset') {
                columns = [
                    { header: 'Asset Code', dataKey: 'asset_code' },
                    { header: 'Name', dataKey: 'name' },
                    { header: 'Type', dataKey: 'asset_type_name', formatter: (val) => val || '—' },
                    { header: 'Category', dataKey: 'category_name', formatter: (val) => val || '—' },
                    { header: 'Status', dataKey: 'status', formatter: (val) => val || '—' },
                    { header: 'Purchase Date', dataKey: 'purchase_date', formatter: (val) => val || '—' },
                    { header: 'Department', dataKey: 'department_name', formatter: (val) => val || '—' },
                    { header: 'Incharge', dataKey: 'incharge_name', formatter: (val) => val || '—' }
                ];
            } else if (activeManagement === 'File') {
                columns = [
                    { header: 'File Name', dataKey: 'file_name' },
                    { header: 'File Type', dataKey: 'file_type_name' },
                    { header: 'Status', dataKey: 'status' },
                    { header: 'Priority', dataKey: 'priority' },
                    { header: 'Current Holder', dataKey: 'current_holder_name', formatter: (val) => val || '—' },
                    { header: 'Location', dataKey: 'room_name', formatter: (val, row) => getSafeLocation(row) }
                ];
            } else if (activeManagement === 'Key') {
                columns = [
                    { header: 'Key Name', dataKey: 'key_name' },
                    { header: 'Asset Type', dataKey: 'asset_type_name' },
                    { header: 'Status', dataKey: 'status' },
                    { header: 'Current Holder', dataKey: 'current_holder_name', formatter: (val) => val || '—' },
                    { header: 'Location', dataKey: 'room_name', formatter: (val, row) => getSafeLocation(row) }
                ];
            } else {
                columns = [{ header: 'Name', dataKey: 'name' }];
            }
        }
        if (format === 'pdf') exportToPDF(data, columns, `${activeManagement}.pdf`, title);
        else if (format === 'excel') exportToExcel(data, columns, `${activeManagement}.xlsx`);
        else if (format === 'print') printData(data, columns, title);
    };

    const filteredManagementData = React.useMemo(() => {
        if (!searchTerm) return managementData;
        const term = searchTerm.toLowerCase();
        
        const checkObject = (obj) => {
            if (!obj) return false;
            return Object.entries(obj).some(([key, val]) => {
                const k = key.toLowerCase();
                if (k.includes('created_by') || k.includes('updated_by') || k.includes('deleted_by') || k.includes('owner') || k.includes('email')) return false;
                if (val === null || val === undefined) return false;
                if (typeof val === 'object') {
                    // Prevent circular reference issues and only check plain objects or arrays
                    try {
                        return checkObject(val);
                    } catch (e) {
                        return false;
                    }
                }
                return String(val).toLowerCase().includes(term);
            });
        };

        return (managementData || []).filter(item => checkObject(item));
    }, [managementData, searchTerm]);

    const categories = [
        { name: 'Room', label: 'Storage Room', icon: '🏠', adminOnly: true },
        { name: 'Shelf', label: 'Shelf', icon: '🪜', adminOnly: true },
        { name: 'Rack', label: 'Rack', icon: '📦', adminOnly: true },
        { name: 'File', label: 'File', icon: '📄', adminOnly: false },
        { name: 'Allocation', label: 'Allocations', icon: '🤝', adminOnly: false },
        { name: 'Report', label: 'Report', icon: '📊', adminOnly: false },
        { name: 'Key', label: 'Key', icon: '🔑', adminOnly: false },
        { name: 'Key Allocation', label: 'Key Allocation', icon: '🔓', adminOnly: false },
        { name: 'Key Report', label: 'Key Report', icon: '📝', adminOnly: false },
        { name: 'Type', label: 'Asset Type', icon: '🏷️', adminOnly: true },
        { name: 'AssetCategory', label: 'Asset Category', icon: '📂', adminOnly: true },
        { name: 'AssetAttributeDefinition', label: 'Attribute', icon: '⚙️', adminOnly: true },
        { name: 'Asset', label: 'Asset', icon: '🖥️', adminOnly: false }
    ].filter(cat => !cat.adminOnly || currentUser?.user?.is_superuser);

    return (
        <>
            {(!embedded && !['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Allocation', 'Key Allocation', 'Report', 'Key Report', 'Key'].includes(activeManagement)) && (
                <div className="fd-hero-card" style={{ padding: '1.5rem 2.5rem' }}>
                    <div className="fd-hero-content">
                        <div className="d-flex align-items-center mb-2">
                            
                            <h1 style={{ fontSize: '1.8rem', margin: 0 }}>{activeManagement} <span>Management</span></h1>
                        </div>
                        <p style={{ fontSize: '0.9rem', marginBottom: 0 }}>Configure and manage your {activeManagement.toLowerCase()} records.</p>
                    </div>
                    <div className="fd-header-actions">
                        {(currentUser?.user?.is_superuser || (activeManagement === 'File' && can(fileModule, 'create')) || (activeManagement === 'Key' && can(keyModule, 'create'))) && (
                            (activeManagement.includes('Allocation')) ? (
                                <button className="btn" style={{ background: 'var(--fd-accent)', color: '#fff', fontWeight: '700', borderRadius: '10px' }} onClick={activeManagement === 'Allocation' ? handleOpenAllocateFromTab : handleOpenKeyAllocateFromTab}>+ Allocate</button>
                            ) : (
                                <button className="btn" style={{ background: 'var(--fd-accent)', color: '#fff', fontWeight: '700', borderRadius: '10px' }} onClick={() => { setIsEditing(false); setFormData({}); setFormDocuments([{ document_name: 'invoice', file: null, custom_name: '' }]); setShowModal(true); }}>+ Add {activeManagement}</button>
                            )
                        )}
                    </div>
                </div>
            )}

            

            {(embedded && !['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Allocation', 'Key Allocation', 'Report', 'Key Report', 'Key'].includes(activeManagement) && !activeManagement.includes('Report')) && (currentUser?.user?.is_superuser || (activeManagement === 'File' && can(fileModule, 'create')) || (activeManagement === 'Key' && can(keyModule, 'create'))) && (
                <div className="d-flex justify-content-end mb-3">
                    {(activeManagement.includes('Allocation')) ? (
                        <button className="btn btn-primary" style={{ background: 'var(--fd-accent)', color: '#fff', fontWeight: '700', borderRadius: '10px' }} onClick={activeManagement === 'Allocation' ? handleOpenAllocateFromTab : handleOpenKeyAllocateFromTab}>+ Allocate</button>
                    ) : (
                        <button className="btn btn-primary" style={{ background: 'var(--fd-accent)', color: '#fff', fontWeight: '700', borderRadius: '10px' }} onClick={() => { setIsEditing(false); setFormData({}); setFormDocuments([{ document_name: 'invoice', file: null, custom_name: '' }]); setShowModal(true); }}>+ Add {activeManagement}</button>
                    )}
                </div>
            )}

            <>
                {activeManagement === 'Room' && <RoomList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'Shelf' && <ShelfList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'Rack' && <RackList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'Type' && <AssetTypeList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'AssetCategory' && <AssetCategoryList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'AssetAttributeDefinition' && <AssetAttributeList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setBulkAttributes([{ name: '', field_type: 'text', is_required: false, is_active: true, display_order: 0, help_text: '' }]); setShowModal(true); }} />}
                {activeManagement === 'Asset' && <AssetList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} onShowDetails={handleShowDetails} onAllocate={handleOpenAllocate} currentUser={currentUser} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'File' && <FileList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} onAllocate={handleOpenAllocate} onShowHistory={handleShowFileHistory} currentUser={currentUser} module={fileModule} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} />}
                {activeManagement === 'Key' && <KeyList data={filteredManagementData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onEdit={handleEdit} onDelete={handleDelete} onExport={handleExport} onAllocate={handleOpenAllocate} onShowHistory={handleShowKeyHistory} currentUser={currentUser} module={keyModule} can={can} onAdd={() => { setIsEditing(false); setFormData({}); setShowModal(true); }} departments={departments} />}
                {(activeManagement.includes('Allocation') || activeManagement.includes('Report')) && <AssetAllocationList activeManagement={activeManagement} data={allocationData} loading={loading} searchTerm={searchTerm} onSearchChange={setSearchTerm} onExport={handleExport} onReturn={handleOpenReturn} onReallocate={handleOpenReallocate} onUpdateResponse={handleUpdateResponse} currentUser={currentUser} onShowHistory={activeManagement.includes('Key') ? handleShowKeyHistory : handleShowFileHistory} onAllocate={activeManagement.includes('Allocation') ? (activeManagement === 'Allocation' ? handleOpenAllocateFromTab : handleOpenKeyAllocateFromTab) : undefined} />}
            </>

            {showModal && (
                <div className="fd-modal-overlay">
                    <div className="fd-modal-content" style={{
                        maxWidth: (activeManagement === 'AssetAttributeDefinition') ? '1000px' : '600px',
                        padding: ['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Key'].includes(activeManagement) ? '0' : '2rem',
                        background: ['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Key'].includes(activeManagement) ? 'transparent' : undefined,
                        border: ['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Key'].includes(activeManagement) ? 'none' : undefined,
                        boxShadow: ['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Key'].includes(activeManagement) ? 'none' : undefined
                    }}>
                        {!['Room', 'Shelf', 'Rack', 'Type', 'AssetCategory', 'AssetAttributeDefinition', 'Asset', 'File', 'Key'].includes(activeManagement) && (
                            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <h2 className="m-0" style={{ fontSize: '1.5rem', fontWeight: '700' }}>{isEditing ? 'Edit' : 'Add New'} {activeManagement}</h2>
                                <button className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                        )}
                        {activeManagement === 'Room' && <RoomForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} branches={branches} departments={departments} companies={companies} />}
                        {activeManagement === 'Shelf' && <ShelfForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} rooms={rooms} />}
                        {activeManagement === 'Rack' && <RackForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} rooms={rooms} shelves={shelves} selectedRoomId={selectedRoomId} setSelectedRoomId={setSelectedRoomId} users={users} />}
                        {activeManagement === 'Type' && <AssetTypeForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} />}
                        {activeManagement === 'AssetCategory' && <AssetCategoryForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} assetTypes={assetTypes} assetCategories={assetCategories} users={users} onAddAssetType={() => setShowQuickAddAssetTypeModal(true)} />}
                        {activeManagement === 'AssetAttributeDefinition' && <AssetAttributeForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} assetCategories={assetCategories} bulkAttributes={bulkAttributes} setBulkAttributes={setBulkAttributes} attributeDefinitions={attributeDefinitions} />}
                        {activeManagement === 'File' && <FileForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} rooms={rooms} shelves={shelves} selectedRoomId={selectedRoomId} setSelectedRoomId={setSelectedRoomId} assetTypes={assetTypes} racks={racks} selectedShelfId={selectedShelfId} setSelectedShelfId={setSelectedShelfId} departments={departments} />}
                        {activeManagement === 'Key' && <KeyForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} departments={departments} assetTypes={assetTypes} racks={racks} rooms={rooms} shelves={shelves} />}
                        {activeManagement === 'Asset' && <AssetForm formData={formData} setFormData={setFormData} onSave={handleSubmit} onCancel={() => setShowModal(false)} isEditing={isEditing} assetTypes={assetTypes} assetCategories={assetCategories} departments={departments} branches={branches} companies={companies} users={users} attributeDefinitions={attributeDefinitions} formDocuments={formDocuments} setFormDocuments={setFormDocuments} availableDocTypes={availableDocTypes} getInheritedAttributes={getInheritedAttributes}
                            onAddAssetType={() => setShowQuickAddAssetTypeModal(true)}
                            onAddAssetCategory={(typeId) => { setQuickAssetCategoryFormData({ asset_type: typeId }); setShowQuickAddAssetCategoryModal(true); }}
                            onAddDepartment={() => setShowQuickAddDepartmentModal(true)}
                            onAddUser={(field) => { setQuickAddUserField(field); setShowQuickAddUserModal(true); }}
                            onAddAttributeDefinition={(catId) => { setQuickAddAttributeCategory(catId); setQuickAssetAttributeFormData({ category: catId }); setShowQuickAddAttributeModal(true); }}
                        />}
                    </div>
                </div>
            )}

            {showQuickAddAssetTypeModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '600px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
                        <AssetTypeForm
                            formData={quickAssetTypeFormData}
                            setFormData={setQuickAssetTypeFormData}
                            onSave={handleQuickAddAssetTypeSubmit}
                            onCancel={() => setShowQuickAddAssetTypeModal(false)}
                            isEditing={false}
                        />
                    </div>
                </div>
            )}

            {showQuickAddAssetCategoryModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '600px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
                        <AssetCategoryForm formData={quickAssetCategoryFormData} setFormData={setQuickAssetCategoryFormData} onSave={handleQuickAddAssetCategorySubmit} onCancel={() => setShowQuickAddAssetCategoryModal(false)} isEditing={false} assetTypes={assetTypes} assetCategories={assetCategories} users={users} />
                    </div>
                </div>
            )}

            {showQuickAddDepartmentModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '600px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
                        <QuickAddDepartmentModal onSave={handleQuickAddDepartmentSubmit} onCancel={() => setShowQuickAddDepartmentModal(false)} />
                    </div>
                </div>
            )}

            {showQuickAddUserModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '800px' }}>
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <h2 className="m-0" style={{ fontSize: '1.5rem', fontWeight: '700' }}>Quick Add User</h2>
                            <button className="btn-close" onClick={() => setShowQuickAddUserModal(false)}></button>
                        </div>
                        <QuickAddUserModal onSave={handleQuickAddUserSubmit} onCancel={() => setShowQuickAddUserModal(false)} initialDepartment={formData.department} />
                    </div>
                </div>
            )}

            {showQuickAddAttributeModal && (
                <div className="fd-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="fd-modal-content" style={{ maxWidth: '1000px', padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
                        <AssetAttributeForm
                            formData={quickAssetAttributeFormData}
                            setFormData={setQuickAssetAttributeFormData}
                            onSave={handleQuickAddAttributeSubmit}
                            onCancel={() => setShowQuickAddAttributeModal(false)}
                            isEditing={false}
                            assetCategories={assetCategories}
                            attributeDefinitions={attributeDefinitions}
                            bulkAttributes={quickBulkAttributes}
                            setBulkAttributes={setQuickBulkAttributes}
                        />
                    </div>
                </div>
            )}

            <AssetHistoryModal showHistoryModal={showHistoryModal} setShowHistoryModal={setShowHistoryModal} historyList={historyList} historyLoading={historyLoading} historyItemName={historyItemName} historyItemType={historyItemType} />

            <AssetDetailModal show={showDetailModal} onClose={() => setShowDetailModal(false)} formData={formData} formDocuments={formDocuments} getInheritedAttributes={getInheritedAttributes} />
            <AssetAllocationModals activeManagement={activeManagement} showAllocateModal={showAllocateModal} setShowAllocateModal={setShowAllocateModal} showReturnModal={showReturnModal} setShowReturnModal={setShowReturnModal} showReallocateModal={showReallocateModal} setShowReallocateModal={setShowReallocateModal} selectedFile={selectedFile} selectedAllocation={selectedAllocation} allocateFormData={allocateFormData} setAllocateFormData={setAllocateFormData} handleAllocateSubmit={handleAllocateSubmit} returnFormData={returnFormData} setReturnFormData={setReturnFormData} handleReturnSubmit={handleReturnSubmit} reallocateFormData={reallocateFormData} setReallocateFormData={setReallocateFormData} handleReallocateSubmit={handleReallocateSubmit} users={users} departments={departments} availableFiles={availableFiles} availableKeys={availableKeys} availableITAssets={availableITAssets} localMinDateTime={localMinDateTime} />
        </>
    );
};

export default AssetManagement;  