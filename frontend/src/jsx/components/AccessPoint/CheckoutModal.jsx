import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Badge, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { markExitGateEntry, markExitVehicleEntry, checkoutEmployeeGateEntry, getGates, getEquipments } from '../../../services/GateManagementService';
import { playCheckOutSound } from '../../../utils/audioNotification';
import { printExitCard, downloadExitCardPDF } from '../../../utils/gateCardPdfGenerator';

const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return `${baseUrl}/${cleanPath}`;
};

const formatExactDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }) + ', ' + d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const getSoftTagBadgeStyle = (tagColour, isDark) => {
    // If no custom tag colour is assigned, use the primary Glenda theme soft emerald
    if (!tagColour) {
        return {
            backgroundColor: isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8fdf4',
            color: isDark ? '#6ee7b7' : '#047857',
            borderColor: isDark ? 'rgba(10, 80, 15, 0.35)' : '#a7f3d0',
            dotColor: '#0a500f'
        };
    }

    // If tagColour is hex format (#RRGGBB)
    if (tagColour.startsWith('#') && (tagColour.length === 7 || tagColour.length === 9)) {
        const r = parseInt(tagColour.slice(1, 3), 16) || 0;
        const g = parseInt(tagColour.slice(3, 5), 16) || 0;
        const b = parseInt(tagColour.slice(5, 7), 16) || 0;
        
        return {
            backgroundColor: isDark 
                ? `rgba(${r}, ${g}, ${b}, 0.18)` 
                : `rgba(${r}, ${g}, ${b}, 0.08)`,
            color: isDark 
                ? `rgb(${Math.min(255, Math.round(r * 0.7 + 100))}, ${Math.min(255, Math.round(g * 0.7 + 100))}, ${Math.min(255, Math.round(b * 0.7 + 100))})` 
                : `rgb(${Math.max(0, Math.round(r * 0.65))}, ${Math.max(0, Math.round(g * 0.65))}, ${Math.max(0, Math.round(b * 0.65))})`,
            borderColor: isDark 
                ? `rgba(${r}, ${g}, ${b}, 0.35)` 
                : `rgba(${r}, ${g}, ${b}, 0.22)`,
            dotColor: tagColour
        };
    }

    // Fallback for named colours or rgba strings:
    return {
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
        color: isDark ? '#a5b4fc' : '#4338ca',
        borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe',
        dotColor: tagColour
    };
};

const CheckoutModal = ({
    show,
    onHide,
    entry,
    activeTab = 'visitors',
    onSuccess
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [mode, setMode] = useState('initial'); // 'initial' | 'questions' | 'selective'
    const [selectiveSubMode, setSelectiveSubMode] = useState('vehicle'); // 'vehicle' | 'person' | 'equipment'
    const [includeVehicle, setIncludeVehicle] = useState(true);
    const [includePerson, setIncludePerson] = useState(false);
    const [includeEquipment, setIncludeEquipment] = useState(false);
    const [masterEquipments, setMasterEquipments] = useState([]);
    const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);
    const [exitingCount, setExitingCount] = useState(1);
    const [selectivePersonCount, setSelectivePersonCount] = useState(1);
    const [selectiveTagSurrendered, setSelectiveTagSurrendered] = useState(false);
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [selectedVehicles, setSelectedVehicles] = useState([]);
    const [partialNotes, setPartialNotes] = useState('');
    const [gates, setGates] = useState([]);
    const [selectedExitGate, setSelectedExitGate] = useState('');
    const [tagReceived, setTagReceived] = useState(false);
    const [selectedReturnedTagIds, setSelectedReturnedTagIds] = useState([]);
    const [isDark, setIsDark] = useState(false);

    // Company Vehicle Checkout Purpose states
    const [checkoutPurpose, setCheckoutPurpose] = useState('other'); // 'other' | 'delivery'
    const [purposeNote, setPurposeNote] = useState('');
    const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
    const [deliveryNotePhoto, setDeliveryNotePhoto] = useState(null);
    const [deliveryNotePreview, setDeliveryNotePreview] = useState(null);

    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.body.getAttribute('data-theme-version') === 'dark');
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme-version'] });
        return () => observer.disconnect();
    }, []);

    // Load available gates
    useEffect(() => {
        let isMounted = true;
        getGates()
            .then((data) => {
                if (isMounted && Array.isArray(data)) {
                    setGates(data);
                }
            })
            .catch((err) => {
                console.error('Failed to load gates in CheckoutModal:', err);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    // Load available equipments/tools for master resolution if needed
    useEffect(() => {
        let isMounted = true;
        getEquipments()
            .then((data) => {
                if (isMounted) {
                    const list = Array.isArray(data) ? data : (data?.results || []);
                    setMasterEquipments(list);
                }
            })
            .catch((err) => {
                console.error('Failed to load equipments in CheckoutModal:', err);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    // Extract registered vehicles with aggregation and deduplication across all sources
    const entryVehicles = React.useMemo(() => {
        const map = new Map();
        const addVeh = (vNum, extra = {}) => {
            if (!vNum || typeof vNum !== 'string') return;
            const clean = vNum.trim();
            if (!clean || clean === '—' || clean === '-') return;
            const upper = clean.toUpperCase();
            if (!map.has(upper)) {
                map.set(upper, { vehicle_number: clean, ...extra });
            }
        };

        if (Array.isArray(entry?.vehicles)) {
            entry.vehicles.forEach(v => {
                if (typeof v === 'string') addVeh(v);
                else if (v && v.vehicle_number) addVeh(v.vehicle_number, v);
            });
        }
        if (Array.isArray(entry?.vehicles_data)) {
            entry.vehicles_data.forEach(v => {
                if (typeof v === 'string') addVeh(v);
                else if (v && v.vehicle_number) addVeh(v.vehicle_number, v);
            });
        }
        if (Array.isArray(entry?.vehicle_numbers)) {
            entry.vehicle_numbers.forEach(v => {
                if (typeof v === 'string') addVeh(v);
                else if (v && v.vehicle_number) addVeh(v.vehicle_number, v);
            });
        }
        if (entry?.vehicle_number && typeof entry.vehicle_number === 'string') {
            entry.vehicle_number.split(',').forEach(v => addVeh(v));
        }
        // Also capture vehicles registered during re-entry
        if (Array.isArray(entry?.partial_exit_logs)) {
            entry.partial_exit_logs.forEach(l => {
                if (l.action === 're_entered' || l.action === 'reentry') {
                    if (l.vehicle_number) l.vehicle_number.split(',').forEach(v => addVeh(v));
                    if (Array.isArray(l.vehicle_numbers)) l.vehicle_numbers.forEach(v => addVeh(v));
                }
            });
        }
        return Array.from(map.values());
    }, [entry]);

    // Already exited vehicles from partial exit logs (accounting for re-entry)
    const alreadyExitedVehicles = React.useMemo(() => {
        const exited = new Set();
        if (entry?.partial_exit_logs && Array.isArray(entry.partial_exit_logs)) {
            entry.partial_exit_logs.forEach((log) => {
                if (log.action === 're_entered' || log.action === 'reentry') {
                    // Vehicle was returned / entered campus during re-entry, so it is NOT exited!
                    if (log.vehicle_number) {
                        log.vehicle_number.split(',').forEach((v) => {
                            const trimmed = v.trim().toUpperCase();
                            if (trimmed) exited.delete(trimmed);
                        });
                    }
                    if (Array.isArray(log.vehicle_numbers)) {
                        log.vehicle_numbers.forEach((v) => {
                            const trimmed = String(v).trim().toUpperCase();
                            if (trimmed) exited.delete(trimmed);
                        });
                    }
                    return;
                }
                if (log.vehicle_number) {
                    log.vehicle_number.split(',').forEach((v) => {
                        const trimmed = v.trim().toUpperCase();
                        if (trimmed) exited.add(trimmed);
                    });
                }
                if (Array.isArray(log.vehicle_numbers)) {
                    log.vehicle_numbers.forEach((v) => {
                        const trimmed = String(v).trim().toUpperCase();
                        if (trimmed) exited.add(trimmed);
                    });
                }
            });
        }
        return exited;
    }, [entry]);

    const availableVehicles = React.useMemo(() => {
        return entryVehicles.filter(v => {
            const vNum = (v.vehicle_number || '').trim().toUpperCase();
            return vNum && !alreadyExitedVehicles.has(vNum);
        });
    }, [entryVehicles, alreadyExitedVehicles]);

    const hasAvailableVehicle = availableVehicles.length > 0;

    // Extract registered equipments / tools
    const entryEquipments = React.useMemo(() => {
        if (Array.isArray(entry?.equipment_details) && entry.equipment_details.length > 0) {
            return entry.equipment_details;
        }
        if (Array.isArray(entry?.equipments) && entry.equipments.length > 0) {
            if (typeof entry.equipments[0] === 'object' && entry.equipments[0] !== null) {
                return entry.equipments;
            }
            return entry.equipments.map(id => {
                const found = masterEquipments.find(m => String(m.id) === String(id));
                return found || { id, name: `Equipment #${id}` };
            });
        }
        return [];
    }, [entry, masterEquipments]);

    // Already exited equipments / tools from partial exit logs
    const alreadyExitedEquipmentIds = React.useMemo(() => {
        const exited = new Set();
        if (entry?.partial_exit_logs && Array.isArray(entry.partial_exit_logs)) {
            entry.partial_exit_logs.forEach((log) => {
                if (log.action === 're_entered' || log.action === 'reentry') return;
                if (Array.isArray(log.exiting_equipments)) {
                    log.exiting_equipments.forEach((id) => {
                        if (id !== null && id !== undefined && id !== '') {
                            exited.add(String(id));
                        }
                    });
                }
            });
        }
        return exited;
    }, [entry]);

    const availableEquipments = React.useMemo(() => {
        return entryEquipments.filter(eq => {
            const eqId = String(eq.id || eq.value || '');
            return eqId && !alreadyExitedEquipmentIds.has(eqId);
        });
    }, [entryEquipments, alreadyExitedEquipmentIds]);

    const hasAvailableEquipment = availableEquipments.length > 0;

    // Reset state whenever modal is opened
    useEffect(() => {
        if (show && entry) {
            const totalP = entry.number_of_persons || 1;
            const insideCount = entry.persons_inside != null ? entry.persons_inside : totalP;
            const hasPersonsIn = insideCount > 0;
            const hasVeh = availableVehicles.length > 0 || entryVehicles.length > 0;
            const hasEq = availableEquipments.length > 0;

            setMode(hasPersonsIn ? 'initial' : 'selective');
            setSelectiveSubMode(hasVeh ? 'vehicle' : 'equipment');
            setIncludeVehicle(hasVeh || (!hasPersonsIn && hasVeh));
            setIncludePerson(hasPersonsIn && !hasVeh);
            setIncludeEquipment(hasEq);
            setExitingCount(hasPersonsIn ? 1 : 0);
            setSelectivePersonCount(hasPersonsIn ? 1 : 0);
            setSelectiveTagSurrendered(false);
            setPartialNotes('');
            setTagReceived(false);
            if (entryTags.length > 0 && hasPersonsIn) {
                setSelectedReturnedTagIds([entryTags[0].id]);
                setTagReceived(true);
            } else {
                setSelectedReturnedTagIds([]);
            }
            setSubmitting(false);
            setCheckoutPurpose('other');
            setPurposeNote('');
            setDeliveryNoteNumber('');
            setDeliveryNotePhoto(null);
            setDeliveryNotePreview(null);

            // Initialize selected equipments (pre-selected with available tools)
            if (availableEquipments.length > 0) {
                setSelectedEquipmentIds(availableEquipments.map(eq => eq.id || eq.value).filter(Boolean));
            } else {
                setSelectedEquipmentIds([]);
            }

            // Default vehicle number & selected vehicles from available vehicles if present
            if (availableVehicles.length > 0) {
                const firstVeh = availableVehicles[0].vehicle_number || '';
                setVehicleNumber(firstVeh);
                setSelectedVehicles(firstVeh ? [firstVeh] : []);
            } else if (entryVehicles.length > 0) {
                const firstVeh = entryVehicles[0].vehicle_number || '';
                setVehicleNumber(firstVeh);
                setSelectedVehicles(firstVeh ? [firstVeh] : []);
            } else {
                setVehicleNumber('');
                setSelectedVehicles([]);
            }

            // Auto-select exit gate:
            // 1. entry.exit_gate (if assigned)
            // 2. entry.entry_gate (default to same gate entered through)
            // 3. first gate in available gates list
            const initialGateId = (entry?.exit_gate && typeof entry.exit_gate === 'object' ? entry.exit_gate.id : entry?.exit_gate)
                || (entry?.entry_gate && typeof entry.entry_gate === 'object' ? entry.entry_gate.id : entry?.entry_gate)
                || (gates.length > 0 ? gates[0].id : '');
            setSelectedExitGate(initialGateId ? String(initialGateId) : '');
        }
    }, [show, entry, gates]);

    const isVisitor = activeTab === 'visitors';
    const isCompanyVehicle = !isVisitor && Boolean(
        entry?.company === 'Company Fleet' ||
        entry?.company_name === 'Company Fleet' ||
        entry?.vehicle_type === 'Company Vehicle' ||
        entry?.vehicle_type_name === 'Company Vehicle' ||
        (entry?.vehicles && entry.vehicles.some(v => v?.vehicle_type_name === 'Company Vehicle' || v?.company === 'Company Fleet')) ||
        (entry?.vehicles_data && entry.vehicles_data.some(v => v?.vehicle_type_name === 'Company Vehicle' || v?.company === 'Company Fleet'))
    );
    const isOwnerVehicle = !isVisitor && Boolean(
        entry?.company === 'Owner Vehicle' ||
        entry?.company_name === 'Owner Vehicle' ||
        entry?.vehicle_type === 'Owner Vehicle' ||
        entry?.vehicle_type_name === 'Owner Vehicle' ||
        entry?.is_owner ||
        (entry?.vehicles && entry.vehicles.some(v => v?.vehicle_type_name === 'Owner Vehicle' || v?.is_owner || v?.company === 'Owner Vehicle')) ||
        (entry?.vehicles_data && entry.vehicles_data.some(v => v?.vehicle_type_name === 'Owner Vehicle' || v?.is_owner || v?.company === 'Owner Vehicle'))
    );
    const isEmployeeEntry = Boolean(
        activeTab === 'employees' ||
        entry?.employment_no ||
        entry?.employee_name ||
        entry?.is_employee ||
        entry?.vehicle_type === 'Employee Vehicle' ||
        entry?.vehicle_type_name === 'Employee Vehicle' ||
        (entry?.vehicles && entry.vehicles.some(v => v?.vehicle_type_name === 'Employee Vehicle' || v?.is_employee)) ||
        (entry?.vehicles_data && entry.vehicles_data.some(v => v?.vehicle_type_name === 'Employee Vehicle' || v?.is_employee))
    );
    const shouldSkipPrinting = isCompanyVehicle || isOwnerVehicle || isEmployeeEntry;
    const totalPersons = entry?.number_of_persons || 1;
    const currentInside = entry?.persons_inside != null ? entry.persons_inside : totalPersons;

    // Physical Tag Details
    const rawTagNumber = entry?.tag_code || entry?.tag_number || (entry?.generated_tag && entry.generated_tag.tag_number) || entry?.pass_number || null;
    const isTagNA = !rawTagNumber || rawTagNumber === 'N/A' || rawTagNumber === 'n/a' || rawTagNumber === 'NA';
    const tagNumber = isTagNA ? null : rawTagNumber;
    const tagCategory = entry?.tag_category_name || (entry?.generated_tag?.entry_tag?.category?.name) || (isVisitor ? 'Visitor Pass' : 'Vehicle Pass');
    const tagColor = entry?.tag_colour || (entry?.generated_tag?.entry_tag?.category?.colour_code) || '#0a500f';

    const entryTags = React.useMemo(() => {
        if (!entry) return [];
        const list = [];
        const seenIds = new Set();
        if (Array.isArray(entry.generated_tags_details) && entry.generated_tags_details.length > 0) {
            entry.generated_tags_details.forEach(t => {
                if (t && t.id && !seenIds.has(t.id)) {
                    seenIds.add(t.id);
                    list.push({
                        id: t.id,
                        tag_number: t.tag_number,
                        category_name: t.category_name || (isVisitor ? 'Visitor Pass' : 'Vehicle Pass'),
                        colour: t.colour || '#0a500f',
                        status: t.status
                    });
                }
            });
        }
        if (entry.generated_tag && !isTagNA) {
            const singleId = typeof entry.generated_tag === 'object' ? entry.generated_tag.id : entry.generated_tag;
            if (singleId && !seenIds.has(singleId)) {
                seenIds.add(singleId);
                list.push({
                    id: singleId,
                    tag_number: rawTagNumber,
                    category_name: tagCategory,
                    colour: tagColor,
                    status: 'Unavailable'
                });
            }
        }
        if (list.length === 0 && tagNumber) {
            list.push({
                id: 'primary',
                tag_number: tagNumber,
                category_name: tagCategory,
                colour: tagColor,
                status: 'Unavailable'
            });
        }
        return list;
    }, [entry, rawTagNumber, isTagNA, tagNumber, tagCategory, tagColor, isVisitor]);

    if (!entry) return null;

    const allTagsReturned = entryTags.length === 0 || (entryTags.length > 0 && entryTags.every(t => selectedReturnedTagIds.includes(t.id)));

    const toggleTagReturnSelection = (tagId) => {
        setSelectedReturnedTagIds(prev => {
            const next = prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId];
            setTagReceived(entryTags.length > 0 && next.length === entryTags.length);
            return next;
        });
    };

    // Sync exiting count and physical tags for partial departure (1:1 match)
    const handleUpdateExitingCount = (newVal) => {
        if (newVal === '' || newVal === null) {
            setExitingCount('');
            return;
        }
        const countNum = parseInt(newVal, 10);
        if (isNaN(countNum)) {
            setExitingCount('');
            return;
        }
        const maxVal = Math.max(1, currentInside - 1);
        const clamped = Math.min(maxVal, Math.max(1, countNum));
        setExitingCount(clamped);

        if (entryTags.length > 0) {
            const target = Math.min(clamped, entryTags.length);
            setSelectedReturnedTagIds(prev => {
                const valid = prev.filter(id => entryTags.some(t => t.id === id));
                if (valid.length === target) return valid;
                if (valid.length > target) return valid.slice(0, target);
                const needed = target - valid.length;
                const unselected = entryTags.filter(t => !valid.includes(t.id));
                const toAdd = unselected.slice(0, needed).map(t => t.id);
                return [...valid, ...toAdd];
            });
            setTagReceived(true);
        }
    };

    // Sync selective exiting person count and physical tags for custom departure (1:1 match)
    const handleUpdateSelectivePersonCount = (newVal) => {
        if (newVal === '' || newVal === null) {
            setSelectivePersonCount('');
            return;
        }
        const countNum = typeof newVal === 'function' ? newVal(selectivePersonCount) : parseInt(newVal, 10);
        if (isNaN(countNum)) {
            setSelectivePersonCount('');
            return;
        }
        const clamped = Math.min(currentInside, Math.max(1, countNum));
        setSelectivePersonCount(clamped);

        if (entryTags.length > 0) {
            const target = Math.min(clamped, entryTags.length);
            setSelectedReturnedTagIds(prev => {
                const valid = prev.filter(id => entryTags.some(t => t.id === id));
                if (valid.length === target) return valid;
                if (valid.length > target) return valid.slice(0, target);
                const needed = target - valid.length;
                const unselected = entryTags.filter(t => !valid.includes(t.id));
                const toAdd = unselected.slice(0, needed).map(t => t.id);
                return [...valid, ...toAdd];
            });
            setTagReceived(true);
        }
    };

    // Partial departure tag selection logic with strict 1:1 validation & seamless 1-click swap
    const handlePartialTagClick = (tagId) => {
        const count = parseInt(exitingCount, 10) || 1;
        const targetRequired = Math.min(count, entryTags.length);
        const isSelected = selectedReturnedTagIds.includes(tagId);

        if (isSelected) {
            // Deselect clicked tag
            const updated = selectedReturnedTagIds.filter(id => id !== tagId);
            setSelectedReturnedTagIds(updated);
            setTagReceived(updated.length > 0);
        } else {
            // Select clicked tag
            if (selectedReturnedTagIds.length < targetRequired) {
                // Haven't reached quota yet: simply add
                const updated = [...selectedReturnedTagIds, tagId];
                setSelectedReturnedTagIds(updated);
                setTagReceived(true);
            } else if (targetRequired === 1) {
                // If 1 person exiting: 1-click seamless swap to the new tag
                setSelectedReturnedTagIds([tagId]);
                setTagReceived(true);
            } else {
                // If quota already reached (e.g. 2 of 2): replace the first selected tag
                const updated = [...selectedReturnedTagIds.slice(1), tagId];
                setSelectedReturnedTagIds(updated);
                setTagReceived(true);
            }
        }
    };

    // Auto-match tags to departing count
    const handleAutoMatchTagsWithCount = () => {
        const count = parseInt(exitingCount, 10) || 1;
        const targetRequired = Math.min(count, entryTags.length);
        const autoSelected = entryTags.slice(0, targetRequired).map(t => t.id);
        setSelectedReturnedTagIds(autoSelected);
        setTagReceived(autoSelected.length > 0);
    };

    const handleSelectAllTags = () => {
        const allIds = entryTags.map(t => t.id);
        setSelectedReturnedTagIds(allIds);
        setTagReceived(true);
    };

    const handleClearTags = () => {
        setSelectedReturnedTagIds([]);
        setTagReceived(false);
    };

    const handleToggleAllTagsCheckbox = (checked) => {
        setTagReceived(checked);
        if (checked) {
            setSelectedReturnedTagIds(entryTags.map(t => t.id));
        } else {
            setSelectedReturnedTagIds([]);
        }
    };

    // Receivables / Deposited Belongings / Cargo Materials
    const receivables = (entry.material_details || entry.narration || entry.receivables || entry.materials || '').trim();

    const hasEquipments = Boolean(
        availableEquipments.length > 0 ||
        (Array.isArray(entry?.equipments) && entry.equipments.length > 0) ||
        (Array.isArray(entry?.equipment_details) && entry.equipment_details.length > 0) ||
        Boolean(entry?.equipment_notes && entry.equipment_notes.trim())
    );

    const hasHost = Boolean(entry.employee || entry.appointment || entry.employee_name);
    const isMovementDone = !hasHost || entry.verification_status === 'completed' || Boolean(entry.movement_completed_at);

    // "if number of persons are 1 no need to show that button. more than 1 should write the number of persons count exiting."
    const canPartialExit = currentInside > 1;
    const selectivePersonRemaining = Math.max(0, currentInside - (parseInt(selectivePersonCount, 10) || 0));

    // Multi-vehicle and pedestrian toggle handlers
    const toggleVehicleSelection = (vNum) => {
        if (!vNum) return;
        const clean = vNum.trim();
        const upper = clean.toUpperCase();
        setSelectedVehicles(prev => {
            let updated;
            if (prev.some(p => p.trim().toUpperCase() === upper)) {
                updated = prev.filter(p => p.trim().toUpperCase() !== upper);
            } else {
                updated = [...prev, clean];
            }
            setVehicleNumber(updated.join(', '));
            return updated;
        });
    };

    const handleSelectAllVehicles = () => {
        const all = availableVehicles.map(v => v.vehicle_number).filter(Boolean);
        setSelectedVehicles(all);
        setVehicleNumber(all.join(', '));
    };

    const handleClearVehicles = () => {
        setSelectedVehicles([]);
        setVehicleNumber('');
    };

    // Tools & Equipments selection handlers
    const toggleEquipmentSelection = (eqId) => {
        if (!eqId) return;
        setSelectedEquipmentIds(prev => {
            let updated;
            if (prev.includes(eqId)) {
                updated = prev.filter(id => id !== eqId);
            } else {
                updated = [...prev, eqId];
            }
            return updated;
        });
    };

    const handleSelectAllEquipments = () => {
        setSelectedEquipmentIds(availableEquipments.map(eq => eq.id || eq.value).filter(Boolean));
    };

    const handleClearEquipments = () => {
        setSelectedEquipmentIds([]);
    };

    const handleSwitchToPedestrian = () => {
        setIncludeVehicle(false);
        setIncludePerson(true);
        setSelectedVehicles([]);
        setVehicleNumber('');
    };

    const handleSwitchToVehicle = () => {
        setIncludeVehicle(true);
        if (availableVehicles.length > 0 && selectedVehicles.length === 0) {
            const firstVeh = availableVehicles[0].vehicle_number || '';
            setSelectedVehicles(firstVeh ? [firstVeh] : []);
            setVehicleNumber(firstVeh);
        }
    };

    const toggleIncludeVehicle = () => {
        setIncludeVehicle(prev => {
            const next = !prev;
            if (!next && !includePerson && !includeEquipment) {
                if (currentInside > 0) {
                    setIncludePerson(true);
                } else {
                    return prev;
                }
            }
            if (next && availableVehicles.length > 0 && selectedVehicles.length === 0) {
                const firstVeh = availableVehicles[0].vehicle_number || '';
                setSelectedVehicles(firstVeh ? [firstVeh] : []);
                setVehicleNumber(firstVeh);
            }
            return next;
        });
    };

    const toggleIncludePerson = () => {
        if (currentInside <= 0) return;
        setIncludePerson(prev => {
            const next = !prev;
            if (!next && !includeVehicle && !includeEquipment) {
                if (hasAvailableVehicle) setIncludeVehicle(true);
            }
            return next;
        });
    };

    const toggleIncludeEquipment = () => {
        setIncludeEquipment(prev => {
            const next = !prev;
            if (next && availableEquipments.length > 0 && selectedEquipmentIds.length === 0) {
                setSelectedEquipmentIds(availableEquipments.map(eq => eq.id || eq.value).filter(Boolean));
            }
            return next;
        });
    };

    const handleFullExit = async () => {
        if (!isMovementDone) {
            Swal.fire({
                icon: 'warning',
                title: 'Movement Incomplete',
                text: `Cannot check out: The host official (${entry.employee_name || 'concerned employee'}) must mark this ${isVisitor ? 'visitor' : 'vehicle'}'s movement as completed before checkout.`,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (entryTags.length > 0 && !allTagsReturned) {
            Swal.fire({
                icon: 'warning',
                title: 'Tag Return Required',
                text: entryTags.length === 1 
                    ? `Please check the box confirming physical Tag #${entryTags[0].tag_number} is received back from the visitor before completing exit.`
                    : `Please confirm return of all ${entryTags.length} physical tags (${entryTags.map(t => `#${t.tag_number}`).join(', ')}) before completing checkout.`,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (gates.length > 0 && !selectedExitGate) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Exiting Gate',
                text: 'Please select the gate through which the exit is taking place.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (isCompanyVehicle && checkoutPurpose === 'delivery' && !deliveryNoteNumber.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Delivery Note Required',
                text: 'Please enter the delivery note number for this delivery exit.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (isCompanyVehicle && checkoutPurpose === 'other' && !purposeNote.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Purpose Note Required',
                text: 'Please enter a purpose note for this departure.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        try {
            setSubmitting(true);
            const exitGateId = selectedExitGate ? parseInt(selectedExitGate, 10) : null;
            const numericReturnedTagIds = selectedReturnedTagIds.filter(id => typeof id === 'number');
            const payload = {
                is_partial: false,
                exit_gate: exitGateId,
                returned_tag_ids: numericReturnedTagIds,
                tag_received: true,
                ...(isCompanyVehicle ? {
                    checkout_purpose: checkoutPurpose,
                    purpose_note: checkoutPurpose === 'other' ? purposeNote.trim() : '',
                    delivery_note_number: checkoutPurpose === 'delivery' ? deliveryNoteNumber.trim() : '',
                    delivery_note_photo: (checkoutPurpose === 'delivery' && deliveryNotePhoto) ? deliveryNotePhoto : null
                } : {})
            };
            let exitRes = null;
            if (isVisitor) {
                exitRes = await markExitGateEntry(entry.id, payload);
            } else if (isEmployeeEntry) {
                exitRes = await checkoutEmployeeGateEntry(entry.id, {
                    employee_only: false,
                    exit_mode: 'with_vehicle',
                    include_vehicle: true,
                    exit_gate: exitGateId
                });
            } else {
                exitRes = await markExitVehicleEntry(entry.id, payload);
            }

            // Automatically print Exit Card via connected printing machine (excluded for owner, company, and employee entries)
            if (!shouldSkipPrinting) {
                printExitCard(exitRes || entry);
            }

            playCheckOutSound();
            Swal.fire({
                icon: 'success',
                title: 'Checked Out Successfully',
                text: `${isVisitor ? (entry.visitor_name || 'Visitor') : 'Vehicle'} has fully exited and physical tag has been released.`,
                timer: 2200,
                showConfirmButton: false,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });

            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Checkout error:", error);
            let errorMsg = 'Failed to record exit.';
            if (error.response?.data?.detail) {
                errorMsg = error.response.data.detail;
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            } else if (error.message) {
                errorMsg = error.message;
            }
            Swal.fire({
                icon: 'error',
                title: 'Exit Failed',
                text: Array.isArray(errorMsg) ? errorMsg.join(' ') : errorMsg,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmPartialExit = async (e) => {
        if (e) e.preventDefault();

        if (!isMovementDone) {
            Swal.fire({
                icon: 'warning',
                title: 'Campus Movement Incomplete',
                text: `Cannot check out: The host employee (${entry.employee_name || 'concerned employee'}) must mark this movement as completed before checkout can be performed.`,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        const count = parseInt(exitingCount, 10);
        if (isNaN(count) || count < 1) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Count',
                text: 'Please enter at least 1 person exiting.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (count >= currentInside) {
            Swal.fire({
                icon: 'warning',
                title: 'Choose Full Exit',
                text: `If all ${currentInside} person(s) are leaving, please choose the "Exit" option to complete departure and free the tag.`,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (gates.length > 0 && !selectedExitGate) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Exiting Gate',
                text: 'Please select the exiting gate for departing member(s).',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        const requiredTagsCount = Math.min(count, entryTags.length);
        if (entryTags.length > 0) {
            if (selectedReturnedTagIds.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Surrender Tag Required',
                    text: `Every departing visitor must return their physical tag to gate security. Please select ${requiredTagsCount === 1 ? 'the physical tag' : `${requiredTagsCount} physical tags`} being surrendered.`,
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
                return;
            }
            if (selectedReturnedTagIds.length !== requiredTagsCount) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Tag Selection Mismatch',
                    text: `You have specified ${count} person(s) departing. Please select exactly ${requiredTagsCount} physical tag(s) being surrendered to gate security (currently ${selectedReturnedTagIds.length} selected).`,
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
                return;
            }
        }

        try {
            setSubmitting(true);
            const remaining = currentInside - count;
            const numericReturnedTagIds = selectedReturnedTagIds.filter(id => typeof id === 'number');
            const exitGateId = selectedExitGate ? parseInt(selectedExitGate, 10) : null;
            const payload = {
                is_partial: true,
                exiting_count: count,
                vehicle_number: vehicleNumber.trim(),
                notes: partialNotes.trim(),
                exit_gate: exitGateId,
                returned_tag_ids: numericReturnedTagIds,
                tag_received: numericReturnedTagIds.length > 0
            };
            let partialExitRes = null;
            if (isVisitor) {
                partialExitRes = await markExitGateEntry(entry.id, payload);
            } else {
                partialExitRes = await markExitVehicleEntry(entry.id, payload);
            }

            if (vehicleNumber.trim() && !shouldSkipPrinting) {
                printExitCard(partialExitRes || {
                    ...entry,
                    vehicle_number: vehicleNumber.trim(),
                    exit_time: new Date().toISOString()
                });
            }

            const returnedTagNames = entryTags
                .filter(t => numericReturnedTagIds.includes(t.id))
                .map(t => `#${t.tag_number}`)
                .join(', ');

            playCheckOutSound();
            Swal.fire({
                icon: 'success',
                title: 'Partially Exited',
                html: `Successfully recorded <b>${count}</b> person(s) exiting.<br/>` +
                      (returnedTagNames ? `<div class="mt-2.5 p-2.5 rounded-3" style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; font-size:13px; text-align:left;"><i class="fa fa-check-circle me-1.5 text-success"></i>Physical pass <b>${returnedTagNames}</b> returned to gate and released to Available pool.</div>` : '') +
                      `<br/><span style="color:#059669; font-weight:600;">${remaining} person(s) still inside campus.</span><br/>` +
                      `<small class="text-muted">A new physical tag will be issued if any visitor returns to campus.</small>`,
                confirmButtonColor: '#0a500f',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });

            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Partial exit error:", error);
            let errorMsg = 'Failed to record exit.';
            if (error.response?.data?.detail) {
                errorMsg = error.response.data.detail;
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            } else if (error.message) {
                errorMsg = error.message;
            }
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: Array.isArray(errorMsg) ? errorMsg.join(' ') : errorMsg,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmSelectiveExit = async (e) => {
        if (e) e.preventDefault();

        if (!isMovementDone) {
            Swal.fire({
                icon: 'warning',
                title: 'Campus Movement Incomplete',
                text: `Cannot check out: The host employee (${entry.employee_name || 'concerned employee'}) must mark this movement as completed before checkout can be performed.`,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (!includeVehicle && !includePerson && !includeEquipment) {
            Swal.fire({
                icon: 'warning',
                title: 'No Items Selected',
                text: 'Please select at least one item (Vehicle, Person, or Equipment) to exit.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (!includeVehicle && !includePerson && includeEquipment && selectedEquipmentIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'No Tools Selected',
                text: 'Please select at least one tool / equipment departing campus.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        const exitingVehiclesList = includeVehicle 
            ? (selectedVehicles.length > 0 
                ? selectedVehicles 
                : vehicleNumber.split(',').map(v => v.trim()).filter(Boolean))
            : [];

        if (includeVehicle && exitingVehiclesList.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Vehicle Number Required',
                text: 'Please select or enter at least one vehicle number that is exiting campus, or switch to "Pedestrian (On Foot)" departure.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        if (includePerson && currentInside > 0) {
            const count = parseInt(selectivePersonCount, 10);
            if (isNaN(count) || count < 1) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Count',
                    text: 'Please enter at least 1 person exiting.',
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
                return;
            }
            if (count > currentInside) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Count',
                    text: `Exiting count cannot exceed ${currentInside} person(s) currently inside.`,
                    background: isDark ? '#1a1a2e' : '#fff',
                    color: isDark ? '#fff' : '#000'
                });
                return;
            }

            if (entryTags.length > 0) {
                const requiredTagsCount = Math.min(count, entryTags.length);
                if (selectedReturnedTagIds.length === 0) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Physical Tag Required',
                        text: `Every departing person must surrender their physical tag to gate security. Please select ${requiredTagsCount === 1 ? 'the physical tag' : `all ${requiredTagsCount} physical tags`} being surrendered.`,
                        background: isDark ? '#1a1a2e' : '#fff',
                        color: isDark ? '#fff' : '#000'
                    });
                    return;
                }
                if (selectedReturnedTagIds.length !== requiredTagsCount) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Tag Selection Mismatch',
                        text: `You have specified ${count} person(s) exiting. Please select exactly ${requiredTagsCount} physical tag(s) being surrendered to gate security (currently ${selectedReturnedTagIds.length} selected).`,
                        background: isDark ? '#1a1a2e' : '#fff',
                        color: isDark ? '#fff' : '#000'
                    });
                    return;
                }
            }
        }

        if (gates.length > 0 && !selectedExitGate) {
            Swal.fire({
                icon: 'warning',
                title: 'Select Exiting Gate',
                text: 'Please select the exiting gate for departure.',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
            return;
        }

        try {
            setSubmitting(true);
            const count = (includePerson && currentInside > 0) ? parseInt(selectivePersonCount, 10) : 0;
            const remaining = Math.max(0, currentInside - count);
            const exitGateId = selectedExitGate ? parseInt(selectedExitGate, 10) : null;
            const isVehOnly = includeVehicle && (!includePerson || currentInside <= 0);

            const isAllPersonsLeaving = (currentInside <= 0) || (includePerson && count >= currentInside);
            const exitingVehsUpper = new Set(exitingVehiclesList.map(v => v.trim().toUpperCase()));
            const remainingVehsList = availableVehicles.filter(v => 
                !exitingVehsUpper.has((v.vehicle_number || '').trim().toUpperCase())
            );

            const exitingEquipmentsList = (includeEquipment && availableEquipments.length > 0)
                ? availableEquipments.filter(eq => selectedEquipmentIds.includes(eq.id || eq.value))
                : [];
            const exitingEquipmentNames = exitingEquipmentsList.map(eq => eq.name).filter(Boolean);
            const exitingEquipmentIdsSet = new Set(exitingEquipmentsList.map(eq => String(eq.id || eq.value)));
            const remainingEquipmentsList = availableEquipments.filter(eq => 
                !exitingEquipmentIdsSet.has(String(eq.id || eq.value))
            );

            const hasRemainingVehs = remainingVehsList.length > 0;
            const hasRemainingTools = remainingEquipmentsList.length > 0;
            const isFullExit = isAllPersonsLeaving && !hasRemainingVehs && !hasRemainingTools;
            const isPedestrianExit = !includeVehicle && includePerson && availableVehicles.length > 0;
            const toolsNote = exitingEquipmentNames.length > 0
                ? `Tools Departing: ${exitingEquipmentNames.join(', ')}`
                : '';

            const numericReturnedTagIds = selectedReturnedTagIds.filter(id => typeof id === 'number');
            const payload = {
                is_partial: !isFullExit,
                is_vehicle_only: isVehOnly && !isFullExit,
                exiting_count: count,
                vehicle_number: exitingVehiclesList.join(', '),
                vehicle_numbers: exitingVehiclesList,
                exiting_equipments: exitingEquipmentsList.map(eq => eq.id || eq.value),
                exiting_equipment_names: exitingEquipmentNames,
                notes: [
                    partialNotes.trim(),
                    isPedestrianExit ? 'Exited as Pedestrian (vehicle parked on campus)' : '',
                    toolsNote
                ].filter(Boolean).join(' — '),
                exit_gate: exitGateId,
                returned_tag_ids: numericReturnedTagIds,
                tag_received: isFullExit ? true : ((isAllPersonsLeaving && !includeVehicle) ? (selectiveTagSurrendered || numericReturnedTagIds.length > 0) : (numericReturnedTagIds.length > 0))
            };

            let selExitRes = null;
            if (isVisitor) {
                selExitRes = await markExitGateEntry(entry.id, payload);
            } else if (isEmployeeEntry) {
                selExitRes = await checkoutEmployeeGateEntry(entry.id, {
                    employee_only: !includeVehicle,
                    exit_mode: !includeVehicle ? 'employee_only' : 'with_vehicle',
                    include_vehicle: includeVehicle,
                    exit_gate: exitGateId,
                    remarks: payload.notes
                });
            } else {
                selExitRes = await markExitVehicleEntry(entry.id, payload);
            }

            if ((isFullExit || exitingVehiclesList.length > 0) && !shouldSkipPrinting) {
                printExitCard(selExitRes || {
                    ...entry,
                    vehicle_number: exitingVehiclesList.join(', ') || entry.vehicle_number,
                    exit_time: new Date().toISOString()
                });
            }

            playCheckOutSound();
            let successTitle = 'Departure Recorded';
            let successHtml = '';

            if (isFullExit) {
                successTitle = 'Checkout Completed';
                if (currentInside <= 0) {
                    const exitParts = [];
                    if (exitingVehiclesList.length > 0) exitParts.push(`Vehicle(s) <b>${exitingVehiclesList.join(', ')}</b>`);
                    if (exitingEquipmentNames.length > 0) exitParts.push(`Tool(s) <b>${exitingEquipmentNames.join(', ')}</b>`);
                    successHtml = `${exitParts.length > 0 ? exitParts.join(' and ') : 'Items'} checked out.<br/>All persons had previously departed.<br/><span style="color:#059669; font-weight:600;">Entry full checkout is complete.</span>`;
                } else {
                    const vehPart = exitingVehiclesList.length > 0 ? ` and vehicle(s) <b>${exitingVehiclesList.join(', ')}</b>` : '';
                    const toolPart = exitingEquipmentNames.length > 0 ? ` and tool(s) <b>${exitingEquipmentNames.join(', ')}</b>` : '';
                    successHtml = `All <b>${count}</b> person(s)${vehPart}${toolPart} have exited campus.<br/><span style="color:#059669; font-weight:600;">Entry checkout is complete.</span>`;
                }
            } else if (isAllPersonsLeaving) {
                const parkedVehs = remainingVehsList.map(v => v.vehicle_number).join(', ');
                const remTools = remainingEquipmentsList.map(t => t.name).join(', ');
                if (hasRemainingVehs && hasRemainingTools) {
                    successTitle = 'Unclosed Entry (Vehicle & Tools on Campus)';
                    successHtml = `All <b>${count}</b> person(s) marked as exited.<br/><br/><span style="color:#f59e0b; font-weight:600;">0 persons inside campus.</span><br/><span style="color:#059669; font-weight:600;">Vehicle(s) ${parkedVehs} remain parked on campus.</span><br/><span style="color:#7c3aed; font-weight:600;"><i class="fa fa-tools me-1"></i> Tool(s) ${remTools} remain inside campus.</span><br/><small class="text-muted">Entry remains active in "Active on Campus" tab.</small>`;
                } else if (hasRemainingTools) {
                    successTitle = 'Unclosed Entry (Tools on Campus)';
                    successHtml = `All <b>${count}</b> person(s) marked as exited.<br/><br/><span style="color:#f59e0b; font-weight:600;">0 persons inside campus.</span><br/><span style="color:#7c3aed; font-weight:600;"><i class="fa fa-tools me-1"></i> Tool(s) ${remTools} remain inside campus.</span><br/><small class="text-muted">Entry remains active in "Active on Campus" tab until tools depart.</small>`;
                } else if (isPedestrianExit) {
                    successTitle = 'Pedestrian Exit (Unclosed Entry)';
                    successHtml = `All <b>${count}</b> person(s) marked as exited on foot as pedestrian.<br/><br/><span style="color:#f59e0b; font-weight:600;">0 persons inside campus.</span><br/><span style="color:#059669; font-weight:600;">Vehicle(s) ${parkedVehs} remain parked on campus.</span><br/><small class="text-muted">Entry remains active in "Active on Campus" tab.</small>`;
                } else {
                    successTitle = 'Persons Exited (Unclosed Entry)';
                    const vehMsg = remainingVehsList.map(v => v.vehicle_number).join(', ');
                    const exitedVehMsg = exitingVehiclesList.length > 0 ? ` (Vehicle ${exitingVehiclesList.join(', ')} exited)` : '';
                    successHtml = `All <b>${count}</b> person(s) marked as exited${exitedVehMsg}.<br/><br/><span style="color:#f59e0b; font-weight:600;">0 persons inside campus.</span><br/><span style="color:#059669; font-weight:600;">Vehicle(s) ${vehMsg} remain parked on campus.</span><br/><small class="text-muted">Entry remains active in "Active on Campus" for next-day re-entry.</small>`;
                }
            } else if (isPedestrianExit) {
                const parkedVehs = availableVehicles.map(v => v.vehicle_number).join(', ');
                successTitle = 'Pedestrian Exit Recorded';
                successHtml = `Successfully recorded <b>${count}</b> person(s) exiting on foot as pedestrian.<br/><br/><span style="color:#0a500f; font-weight:600;">${remaining} person(s) still inside campus.</span><br/><span style="color:#059669; font-weight:600;">Vehicle(s) ${parkedVehs} remain parked on campus.</span>`;
            } else if (isVehOnly) {
                successTitle = 'Vehicle(s) Exited';
                successHtml = `Vehicle(s) <b>${exitingVehiclesList.join(', ')}</b> marked as exited.<br/><br/><span style="color:#059669; font-weight:600;">All ${currentInside} person(s) remain inside campus.</span><br/><small class="text-muted">Visitor entry remains active.</small>`;
            } else if (includePerson && includeVehicle) {
                successTitle = 'Persons & Vehicle(s) Exited';
                successHtml = `Recorded <b>${count}</b> person(s) exiting with vehicle(s) <b>${exitingVehiclesList.join(', ')}</b>.<br/><br/><span style="color:#0a500f; font-weight:600;">${remaining} person(s) still inside campus.</span>`;
            } else if (!includePerson && !includeVehicle && includeEquipment) {
                successTitle = 'Tools Departure Recorded';
                successHtml = `Successfully recorded tools departure.<br/><br/><span style="color:#0a500f; font-weight:600;">All ${currentInside} person(s) remain inside campus.</span>`;
            } else {
                successTitle = 'Person(s) Exited';
                successHtml = `Successfully recorded <b>${count}</b> person(s) exiting.<br/><br/><span style="color:#0a500f; font-weight:600;">${remaining} person(s) still inside campus.</span>`;
            }

            if (exitingEquipmentNames.length > 0) {
                successHtml += `<br/><br/><span style="color:#7c3aed; font-weight:600;"><i class="fa fa-tools me-1"></i> Tools departing (${exitingEquipmentNames.length}):</span> ${exitingEquipmentNames.join(', ')}`;
            }

            Swal.fire({
                icon: 'success',
                title: successTitle,
                html: successHtml,
                confirmButtonColor: '#0a500f',
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });

            onHide();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Selective departure error:", error);
            let errorMsg = 'Failed to record departure.';
            if (error.response?.data?.detail) {
                errorMsg = error.response.data.detail;
            } else if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            } else if (error.message) {
                errorMsg = error.message;
            }
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: Array.isArray(errorMsg) ? errorMsg.join(' ') : errorMsg,
                background: isDark ? '#1a1a2e' : '#fff',
                color: isDark ? '#fff' : '#000'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const remainingCalculated = Math.max(0, currentInside - (parseInt(exitingCount, 10) || 0));

    return (
        <Modal
            show={show}
            onHide={() => {
                if (!submitting) onHide();
            }}
            dialogClassName={`checkout-custom-modal item-custom-modal ${isDark ? 'dark-mode-modal' : ''}`}
            backdrop="static"
            keyboard={!submitting}
            centered
            size="lg"
        >
            {/* Modal Header */}
            <div className="modal-header-custom">
                <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                    <div 
                        className="modal-icon-circle" 
                        style={{ 
                            background: mode === 'questions' 
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                                : 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                            boxShadow: mode === 'questions'
                                ? '0 4px 14px rgba(245, 158, 11, 0.3)'
                                : '0 4px 14px rgba(10, 80, 15, 0.3)',
                            width: '52px',
                            height: '52px'
                        }}
                    >
                        <i className={`fa ${mode === 'selective' ? 'fa-sliders-h' : (mode === 'questions' ? 'fa-user-minus' : 'fa-sign-out-alt')} text-white fs-4`}></i>
                    </div>
                    <div>
                        <h4 className="modal-title font-w700 mb-1" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                            {mode === 'selective'
                                ? 'Custom Exit Details'
                                : (mode === 'questions' ? 'Partial Departure Details' : 'Gate Check Out')}
                        </h4>
                        <p className="text-muted mb-0" style={{ fontSize: '14px' }}>
                            {mode === 'selective'
                                ? (currentInside <= 0 ? 'Confirm vehicle departure, tools, and final exit' : 'Select persons count, vehicle, or equipment exiting campus')
                                : (mode === 'questions' ? 'Specify number of members departing while others remain inside' : 'Visitor details, campus status, and exit actions')}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    className="modal-close-x"
                    onClick={onHide}
                    disabled={submitting}
                    title="Close"
                >
                    &times;
                </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body-custom">
                {/* Visitor / Vehicle Summary Card */}
                <div 
                    className="p-4 mb-4 rounded-4" 
                    style={{ 
                        background: isDark ? 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)'
                    }}
                >
                    {/* Header Row: Photo + Name + Badges + Tag */}
                    <div className="d-flex align-items-center mb-4 pb-3.5 border-bottom" style={{ gap: '22px', borderColor: isDark ? '#334155' : '#eef2f6' }}>
                        {isVisitor && (
                            <div 
                                style={{ 
                                    width: '68px', 
                                    height: '68px', 
                                    borderRadius: '18px', 
                                    overflow: 'hidden', 
                                    flexShrink: 0,
                                    marginRight: '6px',
                                    border: '2.5px solid #0a500f',
                                    boxShadow: '0 4px 14px rgba(10, 80, 15, 0.25)',
                                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {entry.visitor_photo ? (
                                    <img 
                                        src={getFullImageUrl(entry.visitor_photo)} 
                                        alt={entry.visitor_name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    <i className="fa fa-user text-muted fs-2"></i>
                                )}
                            </div>
                        )}
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <h5 className="fw-bold mb-2" style={{ fontSize: '20px', color: isDark ? '#f8fafc' : '#0f172a', lineHeight: 1.3 }}>
                                {isVisitor ? entry.visitor_name : (entry.vehicles_data?.[0]?.vehicle_number || 'Vehicle Entry')}
                            </h5>
                            <div className="d-flex flex-wrap align-items-center" style={{ gap: '14px', marginTop: '6px' }}>
                                {isVisitor ? (
                                    <>
                                        {entry.visitor_mobile && (
                                            <span 
                                                className="badge border" 
                                                style={{ 
                                                    backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                    borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                    color: isDark ? '#94a3b8' : '#475569', 
                                                    fontSize: '12.5px', 
                                                    fontWeight: 500,
                                                    borderRadius: '8px',
                                                    padding: '6px 14px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <i className="fa fa-phone-alt text-success" style={{ fontSize: '11px' }}></i>
                                                <span>{entry.visitor_mobile}</span>
                                            </span>
                                        )}
                                        {entry.company_name && (
                                            <span 
                                                className="badge border" 
                                                style={{ 
                                                    backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                    borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                    color: isDark ? '#94a3b8' : '#475569', 
                                                    fontSize: '12.5px', 
                                                    fontWeight: 500,
                                                    borderRadius: '8px',
                                                    padding: '6px 14px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <i className="fa fa-building text-primary" style={{ fontSize: '11px' }}></i>
                                                <span>{entry.company_name}</span>
                                            </span>
                                        )}
                                        {entryVehicles.length > 0 && entryVehicles.map((v, idx) => {
                                            const isExited = alreadyExitedVehicles.has((v.vehicle_number || '').trim().toUpperCase());
                                            return (
                                                <span 
                                                    key={idx}
                                                    className="badge border" 
                                                    style={{ 
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                                        borderColor: isDark ? '#334155' : '#e2e8f0', 
                                                        color: isExited ? (isDark ? '#64748b' : '#94a3b8') : (isDark ? '#93c5fd' : '#1d4ed8'), 
                                                        fontSize: '12.5px', 
                                                        fontWeight: 500,
                                                        borderRadius: '8px',
                                                        padding: '6px 14px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        textDecoration: isExited ? 'line-through' : 'none'
                                                    }}
                                                    title={isExited ? `${v.vehicle_number} (Exited)` : `${v.vehicle_number} (Inside)`}
                                                >
                                                    <i className="fa fa-car text-primary" style={{ fontSize: '11px' }}></i>
                                                    <span>{v.vehicle_number}</span>
                                                    {isExited && <span className="badge bg-secondary-subtle text-muted ms-1" style={{ fontSize: '9.5px', padding: '2px 5px', textDecoration: 'none' }}>Exited</span>}
                                                </span>
                                            );
                                        })}
                                        {entryEquipments.length > 0 && entryEquipments.map((eq, idx) => {
                                            const eqId = String(eq?.id || eq?.value || '');
                                            const isExited = eqId && alreadyExitedEquipmentIds.has(eqId);
                                            const toolName = eq?.name || eq?.equipment_name || (masterEquipments.find(m => String(m.id) === eqId)?.name) || 'Tool';
                                            return (
                                                <span 
                                                    key={eqId || idx}
                                                    className="badge border" 
                                                    style={{ 
                                                        backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#f5f3ff', 
                                                        borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#ddd6fe', 
                                                        color: isExited ? (isDark ? '#64748b' : '#94a3b8') : (isDark ? '#c084fc' : '#7c3aed'), 
                                                        fontSize: '12.5px', 
                                                        fontWeight: 600, 
                                                        borderRadius: '8px', 
                                                        padding: '6px 14px', 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        textDecoration: isExited ? 'line-through' : 'none'
                                                    }}
                                                    title={isExited ? `${toolName} (Exited)` : `${toolName} (Inside)`}
                                                >
                                                    <i className="fa fa-tools" style={{ fontSize: '11px', color: isExited ? (isDark ? '#64748b' : '#94a3b8') : (isDark ? '#c084fc' : '#7c3aed') }}></i>
                                                    <span>{toolName}</span>
                                                    {isExited && <span className="badge bg-secondary-subtle text-muted ms-1" style={{ fontSize: '9.5px', padding: '2px 5px', textDecoration: 'none' }}>Exited</span>}
                                                </span>
                                            );
                                        })}
                                    </>
                                ) : (
                                    <span 
                                        className="badge border" 
                                        style={{ 
                                            backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                            borderColor: isDark ? '#334155' : '#e2e8f0', 
                                            color: isDark ? '#94a3b8' : '#475569', 
                                            fontSize: '12.5px', 
                                            fontWeight: 500,
                                            borderRadius: '8px',
                                            padding: '6px 14px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <i className="fa fa-user text-primary" style={{ fontSize: '11px' }}></i>
                                        <span>Driver: {entry.driver || 'N/A'}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        {rawTagNumber ? (() => {
                            const tagStyle = getSoftTagBadgeStyle(entry.tag_colour, isDark);
                            return (
                                <div className="text-end flex-shrink-0">
                                    <span 
                                        className="badge d-inline-flex align-items-center gap-1.5" 
                                        style={{ 
                                            backgroundColor: isTagNA ? (isDark ? '#334155' : '#f1f5f9') : tagStyle.backgroundColor,
                                            color: isTagNA ? (isDark ? '#94a3b8' : '#64748b') : tagStyle.color,
                                            border: `1.5px solid ${isTagNA ? (isDark ? '#475569' : '#cbd5e1') : tagStyle.borderColor}`,
                                            fontSize: '12.5px',
                                            fontWeight: 600,
                                            letterSpacing: '0.3px',
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            boxShadow: 'none'
                                        }}
                                    >
                                        <i className={`fa ${isTagNA ? 'fa-ban' : 'fa-id-badge'}`} style={{ color: isTagNA ? (isDark ? '#94a3b8' : '#64748b') : tagStyle.dotColor, fontSize: '12px' }}></i>
                                        <span>{isTagNA ? 'Tag: Not Applicable' : `Tag #${tagNumber}`}</span>
                                    </span>
                                </div>
                            );
                        })() : null}
                    </div>

                    {/* Metadata Stat Cards: Clean 4-column layout on wide screens with generous padding */}
                    <div className="row g-3">
                        <div className="col-md-3 col-sm-6">
                            <div 
                                className="p-3 rounded-3 h-100"
                                style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#eef2f6'}`
                                }}
                            >
                                <div className="text-muted d-flex align-items-center gap-2 mb-1.5" style={{ fontSize: '12.5px' }}>
                                    <i className="fa fa-user-tie text-primary" style={{ fontSize: '13px' }}></i> Host Official
                                </div>
                                <div className="fw-bold text-truncate" style={{ fontSize: '14.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                    {entry.employee_name || entry.official_name || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="col-md-3 col-sm-6">
                            <div 
                                className="p-3 rounded-3 h-100"
                                style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#eef2f6'}`
                                }}
                            >
                                <div className="text-muted d-flex align-items-center gap-2 mb-1.5" style={{ fontSize: '12.5px' }}>
                                    <i className="fa fa-door-open text-info" style={{ fontSize: '13px' }}></i> Entry Gate
                                </div>
                                <div className="fw-bold text-truncate" style={{ fontSize: '14.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                    {entry.entry_gate_name || entry.gate_name || 'Main Gate'}
                                </div>
                            </div>
                        </div>

                        <div className="col-md-3 col-sm-6">
                            <div 
                                className="p-3 rounded-3 h-100"
                                style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#eef2f6'}`
                                }}
                            >
                                <div className="text-muted d-flex align-items-center gap-2 mb-1.5" style={{ fontSize: '12.5px' }}>
                                    <i className="fa fa-clock text-warning" style={{ fontSize: '13px' }}></i> Entry Time
                                </div>
                                <div className="fw-bold text-truncate" style={{ fontSize: '13.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                    {formatExactDateTime(entry.entry_time)}
                                </div>
                            </div>
                        </div>

                        <div className="col-md-3 col-sm-6">
                            <div 
                                className="p-3 rounded-3 h-100"
                                style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                                    border: `1px solid ${isDark ? '#334155' : '#eef2f6'}`
                                }}
                            >
                                <div className="text-muted d-flex align-items-center gap-2 mb-1.5" style={{ fontSize: '12.5px' }}>
                                    <i className="fa fa-users text-success" style={{ fontSize: '13px' }}></i> Inside Campus
                                </div>
                                <span 
                                    className="badge" 
                                    style={{ 
                                        backgroundColor: currentInside > 1 ? '#e8fdf4' : '#f0fdf4',
                                        color: currentInside > 1 ? '#047857' : '#15803d',
                                        border: `1px solid ${currentInside > 1 ? '#a7f3d0' : '#bbf7d0'}`,
                                        borderRadius: '8px',
                                        fontSize: '12.5px',
                                        fontWeight: 700,
                                        padding: '4px 10px'
                                    }}
                                >
                                    {currentInside} of {totalPersons} persons
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Movement Approval Status Alert */}
                {!isMovementDone && (
                    <div 
                        className="p-3 mb-3 rounded-3 d-flex align-items-start gap-3"
                        style={{
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fef2f2',
                            border: `1.5px solid ${isDark ? '#ef4444' : '#fca5a5'}`,
                            borderRadius: '10px'
                        }}
                    >
                        <div 
                            style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '50%', 
                                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2', 
                                color: '#ef4444', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontSize: '16px'
                            }}
                        >
                            <i className="fa fa-lock"></i>
                        </div>
                        <div className="flex-grow-1">
                            <div className="fw-bold" style={{ fontSize: '14px', color: isDark ? '#fca5a5' : '#b91c1c' }}>
                                Campus Movement Incomplete
                            </div>
                            <div style={{ fontSize: '13px', color: isDark ? '#f87171' : '#dc2626', marginTop: '2px', lineHeight: '1.45' }}>
                                The host employee {entry.employee_name ? <strong>({entry.employee_name})</strong> : ''} has not completed the visitor movement yet. Checkout actions are locked until the employee marks movement completed.
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tag Return Reminder with Multiple Selection Enabled ── */}
                {entryTags.length > 0 && mode === 'initial' && (
                    <div 
                        className="p-3 mb-3 rounded-3" 
                        style={{ 
                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                            border: `1.5px solid ${allTagsReturned ? (isDark ? '#059669' : '#0a500f') : (isDark ? '#334155' : '#e2e8f0')}`,
                            transition: 'border-color 0.2s ease'
                        }}
                    >
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 pb-2 border-bottom" style={{ borderColor: isDark ? '#334155' : '#eef2f6' }}>
                            <div className="d-flex align-items-center gap-2">
                                <i className="fa fa-id-badge text-primary" style={{ fontSize: '15px' }}></i>
                                <span style={{ fontSize: '13.5px', color: isDark ? '#cbd5e1' : '#475569' }}>
                                    Please collect physical {entryTags.length > 1 ? `${entryTags.length} tags` : <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>Tag #{entryTags[0].tag_number}</strong>} from visitor before allowing exit.
                                </span>
                            </div>
                            <div className="d-flex align-items-center gap-1.5">
                                {entryTags.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-success"
                                            style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                                            onClick={handleSelectAllTags}
                                        >
                                            <i className="fa fa-check-double me-1"></i> Select All
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary"
                                            style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}
                                            onClick={handleClearTags}
                                        >
                                            Clear
                                        </button>
                                    </>
                                )}
                                {entryTags.length === 1 && (
                                    <span 
                                        className="badge" 
                                        style={{ 
                                            backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                            color: isDark ? '#e2e8f0' : '#334155', 
                                            border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                                            fontSize: '12px', 
                                            fontWeight: 600, 
                                            padding: '4px 10px', 
                                            borderRadius: '6px'
                                        }}
                                    >
                                        <i className="fa fa-tag text-primary me-1"></i> Tag #{entryTags[0].tag_number} {entryTags[0].category_name ? `• ${entryTags[0].category_name}` : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Interactive Tag Chips Grid when multiple tags exist */}
                        {entryTags.length > 1 && (
                            <div className="d-flex flex-wrap gap-2 mb-2.5">
                                {entryTags.map(tag => {
                                    const isSelected = selectedReturnedTagIds.includes(tag.id);
                                    return (
                                        <div
                                            key={tag.id}
                                            onClick={() => toggleTagReturnSelection(tag.id)}
                                            className="d-flex align-items-center gap-2 px-3 py-2 rounded-2 transition-all"
                                            style={{
                                                backgroundColor: isSelected 
                                                    ? (isDark ? 'rgba(10, 80, 15, 0.15)' : '#ecfdf5')
                                                    : (isDark ? '#1e293b' : '#ffffff'),
                                                border: `1.5px solid ${isSelected ? '#0a500f' : (isDark ? '#334155' : '#cbd5e1')}`,
                                                boxShadow: isSelected ? '0 2px 6px rgba(10, 80, 15, 0.2)' : 'none',
                                                cursor: 'pointer',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}}
                                                style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0a500f' }}
                                            />
                                            <div
                                                className="rounded-circle flex-shrink-0"
                                                style={{ width: '10px', height: '10px', backgroundColor: tag.colour || '#0a500f' }}
                                            />
                                            <span className="fw-semibold" style={{ fontSize: '13px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                                Tag #{tag.tag_number}
                                            </span>
                                            {tag.category_name && (
                                                <span className="badge bg-light text-muted border ms-1" style={{ fontSize: '10px' }}>
                                                    {tag.category_name}
                                                </span>
                                            )}
                                            {isSelected && (
                                                <span className="badge badge-success light ms-1" style={{ fontSize: '10px' }}>
                                                    <i className="fa fa-check me-0.5"></i> Returned
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Mandatory Tag Return Checkbox */}
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <Form.Check
                                type="checkbox"
                                id="tag-received-checkbox"
                                checked={allTagsReturned}
                                onChange={(e) => handleToggleAllTagsCheckbox(e.target.checked)}
                                label={
                                    <span style={{ 
                                        fontSize: '13.5px', 
                                        fontWeight: 600, 
                                        color: allTagsReturned ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f8fafc' : '#0f172a'),
                                        cursor: 'pointer'
                                    }}>
                                        {entryTags.length > 1
                                            ? `Received all ${entryTags.length} physical tags back from the visitor`
                                            : `Received physical Tag #${entryTags[0].tag_number} back from the visitor`
                                        } <span className="text-danger">*</span>
                                    </span>
                                }
                                className="mb-0 cursor-pointer"
                            />
                            {!allTagsReturned ? (
                                <span 
                                    className="badge" 
                                    style={{ 
                                        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', 
                                        color: isDark ? '#fde68a' : '#b45309', 
                                        border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a'}`,
                                        fontSize: '11px', 
                                        fontWeight: 600, 
                                        padding: '3px 8px', 
                                        borderRadius: '6px'
                                    }}
                                >
                                    {entryTags.length > 1 ? `${selectedReturnedTagIds.length}/${entryTags.length} Tags Returned (Required)` : 'Required for checkout'}
                                </span>
                            ) : (
                                <span className="badge badge-success light" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    ✓ All {entryTags.length} Tag{entryTags.length > 1 ? 's' : ''} Returned
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Question Popup Mode (when clicking Partially Exited) */}
                {mode === 'questions' ? (
                    <Form onSubmit={handleConfirmPartialExit}>
                        <div 
                            className="p-4 mb-3 rounded-4" 
                            style={{ 
                                backgroundColor: isDark ? '#141824' : '#fffbeb',
                                border: `1.5px solid ${isDark ? '#334155' : '#fde68a'}`,
                                boxShadow: '0 4px 18px rgba(245, 158, 11, 0.08)'
                            }}
                        >
                            {/* Question 1: How many people going out? */}
                            <Form.Group className="mb-4">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                    <Form.Label className="form-label-custom font-w600 mb-0" style={{ color: isDark ? '#f8fafc' : '#92400e', fontSize: '14.5px' }}>
                                        1. How many people are leaving now? <span className="text-danger">*</span>
                                    </Form.Label>
                                    <span className="badge" style={{ background: isDark ? '#334155' : '#fef3c7', color: isDark ? '#f8fafc' : '#92400e', fontSize: '11.5px', fontWeight: 600 }}>
                                        Max allowed: {currentInside - 1} of {currentInside} inside
                                    </span>
                                </div>

                                <div className="d-flex align-items-center gap-3 mt-1.5 flex-wrap">
                                    <div className="d-inline-flex align-items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline-secondary"
                                            size="sm"
                                            style={{ 
                                                width: '46px', 
                                                height: '46px', 
                                                borderRadius: '12px',
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                borderColor: isDark ? '#475569' : '#cbd5e1',
                                                color: isDark ? '#cbd5e1' : '#475569',
                                                fontSize: '16px'
                                            }}
                                            onClick={() => handleUpdateExitingCount(Math.max(1, (parseInt(exitingCount, 10) || 1) - 1))}
                                            disabled={exitingCount <= 1 || submitting}
                                        >
                                            <i className="fa fa-minus"></i>
                                        </Button>
                                        <Form.Control
                                            type="number"
                                            min="1"
                                            max={currentInside - 1}
                                            value={exitingCount}
                                            onChange={(e) => handleUpdateExitingCount(e.target.value)}
                                            className="form-control-custom text-center font-w700 fs-4"
                                            style={{ 
                                                width: '105px',
                                                height: '46px',
                                                borderColor: '#f59e0b',
                                                borderRadius: '12px'
                                            }}
                                            disabled={submitting}
                                            autoFocus
                                        />
                                        <Button
                                            type="button"
                                            variant="outline-secondary"
                                            size="sm"
                                            style={{ 
                                                width: '46px', 
                                                height: '46px', 
                                                borderRadius: '12px',
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                borderColor: isDark ? '#475569' : '#cbd5e1',
                                                color: isDark ? '#cbd5e1' : '#475569',
                                                fontSize: '16px'
                                            }}
                                            onClick={() => handleUpdateExitingCount(Math.min(currentInside - 1, (parseInt(exitingCount, 10) || 0) + 1))}
                                            disabled={exitingCount >= currentInside - 1 || submitting}
                                        >
                                            <i className="fa fa-plus"></i>
                                        </Button>
                                    </div>

                                    {/* Quick count chips if currentInside > 2 */}
                                    {currentInside > 2 && (
                                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                            {Array.from({ length: Math.min(5, currentInside - 1) }, (_, i) => i + 1).map((val) => {
                                                const isActive = parseInt(exitingCount, 10) === val;
                                                return (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        className={`btn btn-sm rounded-pill px-3 py-1.5 ${isActive ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                                                        style={{
                                                            fontSize: '12.5px',
                                                            borderColor: isActive ? '#f59e0b' : undefined,
                                                            background: isActive ? '#fef3c7' : undefined
                                                        }}
                                                        onClick={() => handleUpdateExitingCount(val)}
                                                    >
                                                        {val} Person{val > 1 ? 's' : ''}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Calculation indicator */}
                                <div 
                                    className="p-3 px-4 mt-3 rounded-3 d-flex justify-content-between align-items-center small"
                                    style={{ 
                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                                    }}
                                >
                                    <div>
                                        <span className="text-muted" style={{ fontSize: '13.5px' }}>Departing now: </span>
                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle ms-2 px-3 py-1.5 fw-bold" style={{ fontSize: '13px' }}>
                                            -{exitingCount || 0}
                                        </span>
                                    </div>
                                    <i className="fa fa-arrow-right text-muted opacity-50 fs-6"></i>
                                    <div>
                                        <span className="text-muted" style={{ fontSize: '13.5px' }}>Remaining inside campus: </span>
                                        <span className="badge bg-success-subtle text-success border border-success-subtle ms-2 px-3 py-1.5 fw-bold" style={{ fontSize: '13px' }}>
                                            {remainingCalculated} person{remainingCalculated !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            </Form.Group>

                            {/* Question 2: Physical Pass / Tag Return */}
                            {entryTags.length > 0 && (() => {
                                const countNum = parseInt(exitingCount, 10) || 1;
                                const targetRequired = Math.min(countNum, entryTags.length);
                                const isMatched = selectedReturnedTagIds.length === targetRequired;
                                const isUnder = selectedReturnedTagIds.length < targetRequired;

                                return (
                                    <Form.Group className="mb-4">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <Form.Label className="form-label-custom font-w600 mb-0" style={{ color: isDark ? '#f8fafc' : '#92400e', fontSize: '14.5px' }}>
                                                    2. Return Physical Pass / Tag <span className="text-danger">*</span>
                                                </Form.Label>
                                            </div>

                                            {/* Live matching status badge */}
                                            {isMatched ? (
                                                <span 
                                                    className="badge rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5"
                                                    style={{ 
                                                        background: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5', 
                                                        color: isDark ? '#34d399' : '#059669', 
                                                        border: `1px solid ${isDark ? '#059669' : '#a7f3d0'}`,
                                                        fontSize: '12px', 
                                                        fontWeight: 600 
                                                    }}
                                                >
                                                    <i className="fa fa-check-circle text-success"></i>
                                                    {selectedReturnedTagIds.length} of {targetRequired} Tag{targetRequired > 1 ? 's' : ''} Matched
                                                </span>
                                            ) : (
                                                <span 
                                                    className="badge rounded-pill px-3 py-1.5 d-inline-flex align-items-center gap-1.5"
                                                    style={{ 
                                                        background: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fffbeb', 
                                                        color: isDark ? '#fbbf24' : '#b45309', 
                                                        border: `1px solid ${isDark ? '#d97706' : '#fde68a'}`,
                                                        fontSize: '12px', 
                                                        fontWeight: 600 
                                                    }}
                                                >
                                                    <i className="fa fa-exclamation-triangle text-warning"></i>
                                                    {isUnder 
                                                        ? `Select ${targetRequired - selectedReturnedTagIds.length} more tag${(targetRequired - selectedReturnedTagIds.length) > 1 ? 's' : ''}` 
                                                        : `Deselect ${selectedReturnedTagIds.length - targetRequired} tag${(selectedReturnedTagIds.length - targetRequired) > 1 ? 's' : ''}`}
                                                </span>
                                            )}
                                        </div>

                                        <div 
                                            className="p-3.5 rounded-3 position-relative"
                                            style={{
                                                background: isDark ? '#1e293b' : '#ffffff',
                                                border: `1.5px solid ${isMatched ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#d97706' : '#f59e0b')}`,
                                                boxShadow: isMatched ? '0 1px 3px rgba(0, 0, 0, 0.04)' : '0 2px 10px rgba(245, 158, 11, 0.12)',
                                                transition: 'all 0.25s ease'
                                            }}
                                        >
                                            {/* Contextual instruction banner */}
                                            <div 
                                                className="p-2.5 px-3 rounded-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                                                style={{ 
                                                    background: isDark ? 'rgba(245, 158, 11, 0.08)' : '#fffbeb', 
                                                    border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'}` 
                                                }}
                                            >
                                                <div className="small d-flex align-items-center gap-2" style={{ color: isDark ? '#fde68a' : '#92400e', fontSize: '13px' }}>
                                                    <i className="fa fa-hand-holding text-warning fs-6 flex-shrink-0"></i>
                                                    <span>
                                                        Every departing visitor must surrender their physical badge. <strong>Select exactly {targetRequired} tag{targetRequired > 1 ? 's' : ''}</strong> being handed in to gate security.
                                                    </span>
                                                </div>
                                                {entryTags.length > 1 && (
                                                    <div className="d-flex align-items-center gap-1.5 ms-auto">
                                                        <span className="badge rounded-pill bg-light text-muted border" style={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {targetRequired} Tag{targetRequired > 1 ? 's' : ''} for {countNum} Exiting
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Tag Grid (Multi-tag entries) */}
                                            {entryTags.length > 1 ? (
                                                <div>
                                                    <div className="row g-2.5">
                                                        {entryTags.map((tag) => {
                                                            const isSelected = selectedReturnedTagIds.includes(tag.id);
                                                            return (
                                                                <div key={tag.id} className="col-12 col-sm-6 col-md-4">
                                                                    <div
                                                                        onClick={() => handlePartialTagClick(tag.id)}
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePartialTagClick(tag.id); } }}
                                                                        className="p-3 rounded-3 position-relative"
                                                                        style={{
                                                                            cursor: 'pointer',
                                                                            userSelect: 'none',
                                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                            background: isSelected 
                                                                                ? (isDark ? 'linear-gradient(145deg, #2e2312 0%, #1f1a10 100%)' : 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)')
                                                                                : (isDark ? '#0f172a' : '#f8fafc'),
                                                                            border: isSelected 
                                                                                ? '2px solid #f59e0b' 
                                                                                : `1.5px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
                                                                            boxShadow: isSelected 
                                                                                ? '0 4px 14px rgba(245, 158, 11, 0.22)' 
                                                                                : 'none',
                                                                            transform: isSelected ? 'translateY(-1px)' : 'none'
                                                                        }}
                                                                    >
                                                                        {/* Top row: Category with color dot + Surrender / Retained chip */}
                                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                                            <span className="d-flex align-items-center gap-1.5" style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                                                                                <span 
                                                                                    className="rounded-circle d-inline-block flex-shrink-0" 
                                                                                    style={{ width: '8px', height: '8px', backgroundColor: tag.colour || '#0a500f' }} 
                                                                                />
                                                                                {tag.category_name || (isVisitor ? 'Visitor Pass' : 'Vehicle Pass')}
                                                                            </span>
                                                                            <span 
                                                                                className="badge rounded-pill"
                                                                                style={{
                                                                                    fontSize: '10px',
                                                                                    fontWeight: 700,
                                                                                    letterSpacing: '0.4px',
                                                                                    textTransform: 'uppercase',
                                                                                    padding: '3px 9px',
                                                                                    background: isSelected ? '#f59e0b' : (isDark ? '#1e293b' : '#e2e8f0'),
                                                                                    color: isSelected ? '#ffffff' : (isDark ? '#94a3b8' : '#475569')
                                                                                }}
                                                                            >
                                                                                {isSelected ? '✓ Surrender' : 'Retained'}
                                                                            </span>
                                                                        </div>

                                                                        {/* Middle row: Icon + Tag Number */}
                                                                        <div className="d-flex align-items-center gap-2 mb-2">
                                                                            <div 
                                                                                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                                                                style={{
                                                                                    width: '34px',
                                                                                    height: '34px',
                                                                                    background: isSelected ? '#fef3c7' : (isDark ? '#1e293b' : '#e2e8f0'),
                                                                                    color: isSelected ? '#d97706' : (isDark ? '#64748b' : '#94a3b8')
                                                                                }}
                                                                            >
                                                                                <i className={`fa ${isSelected ? 'fa-id-badge text-warning' : 'fa-id-badge'}`} style={{ fontSize: '15px' }}></i>
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-monospace fw-bold" style={{ fontSize: '16px', color: isSelected ? (isDark ? '#fde68a' : '#92400e') : (isDark ? '#e2e8f0' : '#1e293b') }}>
                                                                                    Tag #{tag.tag_number}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Bottom row: Subtitle explaining action */}
                                                                        <div className="pt-2 border-top d-flex align-items-center justify-content-between" style={{ borderColor: isSelected ? 'rgba(245, 158, 11, 0.25)' : (isDark ? '#1e293b' : '#f1f5f9') }}>
                                                                            <span style={{ fontSize: '11px', color: isSelected ? '#b45309' : '#94a3b8', fontWeight: isSelected ? 600 : 500 }}>
                                                                                <i className={`fa ${isSelected ? 'fa-hand-holding me-1 text-warning' : 'fa-users me-1'} `}></i>
                                                                                {isSelected ? 'Exiting with this pass' : 'Stays inside campus'}
                                                                            </span>
                                                                            <i className={`fa ${isSelected ? 'fa-check-circle text-warning' : 'fa-circle text-muted opacity-25'}`} style={{ fontSize: '13px' }}></i>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Quick Action bar below cards */}
                                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3 pt-2.5 border-top" style={{ borderColor: isDark ? '#334155' : '#f1f5f9' }}>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <Button 
                                                                variant="outline-primary" 
                                                                size="sm" 
                                                                className="py-1 px-2.5 rounded-pill d-inline-flex align-items-center gap-1.5"
                                                                style={{ fontSize: '12px', fontWeight: 600 }}
                                                                onClick={handleAutoMatchTagsWithCount}
                                                            >
                                                                <i className="fa fa-magic"></i> Auto-match ({targetRequired} tag{targetRequired > 1 ? 's' : ''})
                                                            </Button>
                                                        </div>
                                                        <span className="small text-muted" style={{ fontSize: '11.5px' }}>
                                                            💡 Click any tag card to select or switch pass directly
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Single tag entry */
                                                <div 
                                                    onClick={() => {
                                                        const singleId = entryTags[0].id;
                                                        if (selectedReturnedTagIds.includes(singleId)) {
                                                            setSelectedReturnedTagIds([]);
                                                            setTagReceived(false);
                                                        } else {
                                                            setSelectedReturnedTagIds([singleId]);
                                                            setTagReceived(true);
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            const singleId = entryTags[0].id;
                                                            if (selectedReturnedTagIds.includes(singleId)) {
                                                                setSelectedReturnedTagIds([]);
                                                                setTagReceived(false);
                                                            } else {
                                                                setSelectedReturnedTagIds([singleId]);
                                                                setTagReceived(true);
                                                            }
                                                        }
                                                    }}
                                                    className="p-3 rounded-3 d-flex align-items-center justify-content-between"
                                                    style={{
                                                        cursor: 'pointer',
                                                        userSelect: 'none',
                                                        transition: 'all 0.2s ease',
                                                        background: selectedReturnedTagIds.includes(entryTags[0].id)
                                                            ? (isDark ? 'linear-gradient(145deg, #2e2312 0%, #1f1a10 100%)' : 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)')
                                                            : (isDark ? '#0f172a' : '#f8fafc'),
                                                        border: selectedReturnedTagIds.includes(entryTags[0].id)
                                                            ? '2px solid #f59e0b'
                                                            : `1.5px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
                                                        boxShadow: selectedReturnedTagIds.includes(entryTags[0].id)
                                                            ? '0 4px 14px rgba(245, 158, 11, 0.22)'
                                                            : 'none'
                                                    }}
                                                >
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div 
                                                            className="rounded-circle d-flex align-items-center justify-content-center"
                                                            style={{
                                                                width: '38px',
                                                                height: '38px',
                                                                background: selectedReturnedTagIds.includes(entryTags[0].id) ? '#fef3c7' : (isDark ? '#1e293b' : '#e2e8f0'),
                                                                color: selectedReturnedTagIds.includes(entryTags[0].id) ? '#d97706' : '#64748b'
                                                            }}
                                                        >
                                                            <i className="fa fa-id-badge fs-5"></i>
                                                        </div>
                                                        <div>
                                                            <div className="font-monospace fw-bold" style={{ fontSize: '16px', color: isDark ? '#f8fafc' : '#0f172a' }}>
                                                                Physical Tag #{entryTags[0].tag_number}
                                                            </div>
                                                            <div className="small text-muted" style={{ fontSize: '12px' }}>
                                                                Surrender this tag back to gate security before departing
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span 
                                                            className="badge rounded-pill"
                                                            style={{
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                padding: '6px 14px',
                                                                background: selectedReturnedTagIds.includes(entryTags[0].id) ? '#f59e0b' : '#94a3b8',
                                                                color: '#ffffff'
                                                            }}
                                                        >
                                                            {selectedReturnedTagIds.includes(entryTags[0].id) ? '✓ Surrendering' : 'Click to Surrender'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Validation alert if count doesn't match */}
                                            {!isMatched && (
                                                <div 
                                                    className="mt-3 p-2.5 px-3 rounded-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
                                                    style={{ 
                                                        background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2', 
                                                        border: `1px solid ${isDark ? '#b91c1c' : '#fecaca'}` 
                                                    }}
                                                >
                                                    <span className="small text-danger fw-semibold d-flex align-items-center gap-1.5" style={{ fontSize: '12.5px' }}>
                                                        <i className="fa fa-exclamation-triangle"></i>
                                                        {isUnder 
                                                            ? `Please select ${targetRequired - selectedReturnedTagIds.length} more physical tag(s) to match the ${countNum} departing visitor(s).` 
                                                            : `Too many tags selected (${selectedReturnedTagIds.length} selected for ${countNum} departing visitors). Please deselect ${selectedReturnedTagIds.length - targetRequired} tag(s).`}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger py-1 px-2.5 rounded-pill fw-bold"
                                                        style={{ fontSize: '11px' }}
                                                        onClick={handleAutoMatchTagsWithCount}
                                                    >
                                                        Auto-Select {targetRequired} Tag{targetRequired > 1 ? 's' : ''}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </Form.Group>
                                );
                            })()}

                            {/* Question 3: Vehicle number if any */}
                            <Form.Group className="mb-4">
                                <Form.Label className="form-label-custom font-w600 mb-2" style={{ color: isDark ? '#f8fafc' : '#92400e', fontSize: '14.5px' }}>
                                    {entryTags.length > 0 ? '3' : '2'}. Vehicle Number (if any)
                                </Form.Label>

                                {(entry?.park_area_name || entry?.parking_location_display || entry?.parking_location) && (
                                    <div className="mb-2.5 d-inline-flex align-items-center gap-2 px-2.5 py-1 rounded-2" style={{ backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe', border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`, color: isDark ? '#7dd3fc' : '#0369a1', fontSize: '12px' }}>
                                        <i className="fa fa-square-parking"></i>
                                        <span><strong>Allocated Parking:</strong> {entry.park_area_name || entry.parking_location_display || entry.parking_location}</span>
                                    </div>
                                )}

                                {/* Quick selection pills if entry has registered vehicles */}
                                {availableVehicles.length > 0 ? (
                                    <div className="d-flex flex-wrap gap-2.5 mb-3">
                                        {availableVehicles.map((v, vIdx) => {
                                            const isSelected = selectedVehicles.some(sv => sv.trim().toUpperCase() === (v.vehicle_number || '').trim().toUpperCase());
                                            return (
                                                <button
                                                    key={vIdx}
                                                    type="button"
                                                    className={`btn btn-sm rounded-pill d-inline-flex align-items-center gap-1.5 ${isSelected ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                                                    style={{ 
                                                        fontSize: '13px', 
                                                        padding: '6px 16px',
                                                        background: isSelected ? '#0a500f' : undefined,
                                                        borderColor: isSelected ? '#0a500f' : undefined
                                                    }}
                                                    onClick={() => toggleVehicleSelection(v.vehicle_number)}
                                                >
                                                    <i className={`fa ${isSelected ? 'fa-check-circle' : 'fa-car'}`}></i>
                                                    {v.vehicle_number}
                                                </button>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            className={`btn btn-sm rounded-pill d-inline-flex align-items-center gap-1.5 ${selectedVehicles.length === 0 && !vehicleNumber ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '13px', padding: '6px 16px' }}
                                            onClick={() => handleClearVehicles()}
                                        >
                                            <i className="fa fa-walking"></i>
                                            None / On Foot
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-muted small mb-2 fst-italic">
                                        <i className="fa fa-walking me-1"></i> No vehicles currently inside campus (on foot / vehicles departed).
                                    </div>
                                )}

                                <Form.Control
                                    type="text"
                                    placeholder="e.g. KL 05 H 4040, KL 78 M 7676 or leave blank if on foot"
                                    value={vehicleNumber}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setVehicleNumber(val);
                                        const parsed = val.split(',').map(s => s.trim()).filter(Boolean);
                                        setSelectedVehicles(parsed);
                                    }}
                                    className="form-control-custom text-uppercase fw-semibold"
                                    style={{ letterSpacing: '0.6px', height: '46px', fontSize: '14px' }}
                                    disabled={submitting}
                                />
                            </Form.Group>

                            {/* Parking Fee & Exit Card Notification */}
                            {(includeVehicle || selectedVehicles.length > 0 || (vehicleNumber && vehicleNumber.trim())) && (entry?.park_area_name || entry?.parking_fee !== undefined) && (
                                <div className="mb-4 p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#f0fdf4', border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.25)' : '#bbf7d0'}` }}>
                                    <div className="d-flex align-items-center gap-2.5">
                                        <div className="p-2 rounded-circle" style={{ backgroundColor: isDark ? 'rgba(10, 80, 15, 0.2)' : '#dcfce7', color: '#16a34a' }}>
                                            <i className="fa fa-receipt"></i>
                                        </div>
                                        <div>
                                            <div className="font-w600" style={{ color: isDark ? '#f8fafc' : '#166534', fontSize: '13px' }}>
                                                Parking Fee & Official Exit Card
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '11.5px' }}>
                                                An official Exit Card will be automatically generated upon checkout.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <span className="badge bg-success text-white px-2.5 py-1.5 font-w600" style={{ fontSize: '13px' }}>
                                            ₹ {Number(entry.parking_fee || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Question 4: Exiting Gate */}
                            <Form.Group className="mb-4">
                                <Form.Label className="form-label-custom font-w600 mb-2" style={{ color: isDark ? '#f8fafc' : '#92400e', fontSize: '14.5px' }}>
                                    {entryTags.length > 0 ? '4' : '3'}. Exiting Gate <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Select
                                    value={selectedExitGate}
                                    onChange={(e) => setSelectedExitGate(e.target.value)}
                                    className="form-control-custom fw-semibold"
                                    style={{ 
                                        height: '46px', 
                                        fontSize: '14px',
                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                        color: isDark ? '#f8fafc' : '#1e293b',
                                        borderColor: !selectedExitGate ? '#f59e0b' : (isDark ? '#475569' : '#cbd5e1')
                                    }}
                                    disabled={submitting}
                                >
                                    <option value="">-- Select Exiting Gate --</option>
                                    {gates.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.name} {g.gate_no ? `(${g.gate_no})` : ''} {g.gate_type ? `• ${g.gate_type}` : ''}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            {/* Remarks (optional) */}
                            <Form.Group className="mb-1">
                                <Form.Label className="form-label-custom text-muted small mb-2" style={{ fontSize: '13.5px' }}>
                                    Notes / Departure remarks (optional)
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. 2 members departing early"
                                    value={partialNotes}
                                    onChange={(e) => setPartialNotes(e.target.value)}
                                    className="form-control-custom"
                                    style={{ height: '46px', fontSize: '14px' }}
                                    disabled={submitting}
                                />
                            </Form.Group>
                        </div>
                    </Form>
                ) : mode === 'selective' ? (
                    <Form onSubmit={handleConfirmSelectiveExit}>
                        {/* 1. Visitors / Persons Card */}
                        {currentInside > 0 && (
                        <div 
                            className="rounded-3" 
                            style={{ 
                                padding: '18px 20px',
                                marginBottom: '18px',
                                backgroundColor: isDark ? '#141824' : '#ffffff', 
                                border: `1px solid ${includePerson ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#1e293b' : '#f1f5f9')}`,
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {/* Card Header */}
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <Form.Check
                                        type="checkbox"
                                        id="include-person-checkbox"
                                        checked={includePerson}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setIncludePerson(checked);
                                            if (!checked && !includeVehicle && !includeEquipment) {
                                                setIncludeVehicle(true);
                                            }
                                        }}
                                        label={
                                            <span className="fw-semibold d-inline-flex align-items-center gap-2" style={{ fontSize: '14.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                <i className="fa fa-users text-primary" style={{ fontSize: '13px' }}></i>
                                                1. Visitors / Persons
                                            </span>
                                        }
                                        className="mb-0 cursor-pointer"
                                        style={{ accentColor: '#0a500f' }}
                                    />
                                    <span 
                                        className="badge rounded-pill px-2.5 py-1 ms-2" 
                                        style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 500,
                                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                                            color: isDark ? '#94a3b8' : '#64748b'
                                        }}
                                    >
                                        {currentInside} on Campus
                                    </span>
                                </div>
                                <span 
                                    className={`badge rounded-pill px-3 py-1.5 ${includePerson ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-light text-muted border'}`} 
                                    style={{ fontSize: '11.5px', fontWeight: 600 }}
                                >
                                    {includePerson ? `${selectivePersonCount} Exiting` : 'Staying Inside'}
                                </span>
                            </div>

                            {includePerson ? (
                                <div className="pt-3 border-top mt-3" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                    {/* Minimal Stepper & Quick Action Row */}
                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 py-1">
                                        <div className="d-flex align-items-center gap-2.5">
                                            <span className="text-muted small fw-medium" style={{ fontSize: '12.5px' }}>Exiting count:</span>
                                            
                                            {/* Minimal Stepper */}
                                            <div 
                                                className="d-inline-flex align-items-center rounded border"
                                                style={{ 
                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                    borderColor: isDark ? '#334155' : '#e2e8f0',
                                                    padding: '2px'
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className="btn btn-xs d-flex align-items-center justify-content-center p-0"
                                                    style={{ 
                                                        width: '26px', 
                                                        height: '26px', 
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                        color: isDark ? '#f8fafc' : '#334155',
                                                        cursor: (selectivePersonCount <= 1 || submitting) ? 'not-allowed' : 'pointer',
                                                        opacity: (selectivePersonCount <= 1 || submitting) ? 0.35 : 1
                                                    }}
                                                    onClick={() => handleUpdateSelectivePersonCount(prev => Math.max(1, (parseInt(prev, 10) || 1) - 1))}
                                                    disabled={selectivePersonCount <= 1 || submitting}
                                                >
                                                    <i className="fa fa-minus" style={{ fontSize: '9px' }}></i>
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={currentInside}
                                                    value={selectivePersonCount}
                                                    onChange={(e) => handleUpdateSelectivePersonCount(e.target.value)}
                                                    style={{ 
                                                        width: '38px',
                                                        border: 'none',
                                                        backgroundColor: 'transparent',
                                                        textAlign: 'center',
                                                        fontWeight: 700,
                                                        fontSize: '14.5px',
                                                        color: isDark ? '#f8fafc' : '#0f172a',
                                                        outline: 'none',
                                                        MozAppearance: 'textfield'
                                                    }}
                                                    disabled={submitting}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-xs d-flex align-items-center justify-content-center p-0"
                                                    style={{ 
                                                        width: '26px', 
                                                        height: '26px', 
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                        color: isDark ? '#f8fafc' : '#334155',
                                                        cursor: (selectivePersonCount >= currentInside || submitting) ? 'not-allowed' : 'pointer',
                                                        opacity: (selectivePersonCount >= currentInside || submitting) ? 0.35 : 1
                                                    }}
                                                    onClick={() => handleUpdateSelectivePersonCount(prev => Math.min(currentInside, (parseInt(prev, 10) || 0) + 1))}
                                                    disabled={selectivePersonCount >= currentInside || submitting}
                                                >
                                                    <i className="fa fa-plus" style={{ fontSize: '9px' }}></i>
                                                </button>
                                            </div>

                                            {selectivePersonRemaining > 0 ? (
                                                <span className="text-muted small ms-1" style={{ fontSize: '11.5px' }}>
                                                    ({selectivePersonRemaining} staying)
                                                </span>
                                            ) : (
                                                <span className="text-success small fw-medium ms-1" style={{ fontSize: '11.5px' }}>
                                                    (All departing)
                                                </span>
                                            )}
                                        </div>

                                        {/* Quick Selection Buttons */}
                                        <div className="d-flex align-items-center gap-2">
                                            <button
                                                type="button"
                                                className={`btn btn-xs rounded-pill px-3 py-1.5 ${selectivePersonCount === 1 ? 'btn-primary text-white' : 'btn-outline-light text-muted border'}`}
                                                style={{ fontSize: '12px', fontWeight: 500 }}
                                                onClick={() => handleUpdateSelectivePersonCount(1)}
                                                disabled={submitting}
                                            >
                                                1 Person
                                            </button>
                                            {currentInside > 1 && (
                                                <button
                                                    type="button"
                                                    className={`btn btn-xs rounded-pill px-3 py-1.5 ${selectivePersonCount === currentInside ? 'btn-primary text-white' : 'btn-outline-light text-muted border'}`}
                                                    style={{ fontSize: '12px', fontWeight: 500 }}
                                                    onClick={() => handleUpdateSelectivePersonCount(currentInside)}
                                                    disabled={submitting}
                                                >
                                                    All {currentInside}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Asset alert if 0 persons remaining but vehicles/tools stay */}
                                    {selectivePersonRemaining === 0 && (() => {
                                        const exitingEqIds = (includeEquipment && availableEquipments.length > 0) ? selectedEquipmentIds.map(String) : [];
                                        const remEqs = availableEquipments.filter(e => !exitingEqIds.includes(String(e.id || e.value)));
                                        const remVehs = !includeVehicle 
                                            ? availableVehicles 
                                            : availableVehicles.filter(v => !selectedVehicles.some(sv => sv.trim().toUpperCase() === (v.vehicle_number || '').trim().toUpperCase()));
                                        
                                        const parts = [];
                                        if (remVehs.length > 0) parts.push(`Vehicle(s) (${remVehs.map(v => v.vehicle_number).join(', ')})`);
                                        if (remEqs.length > 0) parts.push(`Tool(s) (${remEqs.map(e => e.name).join(', ')})`);
                                        
                                        // if (parts.length > 0) {
                                        //     return (
                                        //         <div className="mt-2.5 py-1.5 px-3 rounded-2 d-flex align-items-center gap-2 text-warning small" style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb', fontSize: '11.5px', border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.2)' : '#fde68a'}` }}>
                                        //             <i className="fa fa-info-circle flex-shrink-0"></i>
                                        //             <span>{parts.join(' and ')} will remain inside campus.</span>
                                        //         </div>
                                        //     );
                                        // }
                                        return null;
                                    })()}

                                    {/* Physical Tag Return Row */}
                                    {entryTags.length > 0 && (() => {
                                        const requiredCount = Math.min(parseInt(selectivePersonCount, 10) || 0, entryTags.length);
                                        const isMatch = selectedReturnedTagIds.length === requiredCount && requiredCount > 0;
                                        return (
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2.5 pt-3 border-top mt-3" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <span className="text-muted small fw-medium me-1" style={{ fontSize: '12px' }}>Return Tags:</span>
                                                    {entryTags.map(tag => {
                                                        const isSelected = selectedReturnedTagIds.includes(tag.id);
                                                        return (
                                                            <span
                                                                key={tag.id}
                                                                onClick={() => toggleTagReturnSelection(tag.id)}
                                                                className="badge rounded-pill cursor-pointer d-inline-flex align-items-center"
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    padding: '5px 12px',
                                                                    backgroundColor: isSelected ? (isDark ? 'rgba(10, 80, 15, 0.15)' : '#ecfdf5') : (isDark ? '#1e293b' : '#ffffff'),
                                                                    color: isSelected ? '#10b981' : (isDark ? '#94a3b8' : '#475569'),
                                                                    border: `1px solid ${isSelected ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                                    fontSize: '11.5px',
                                                                    fontWeight: isSelected ? 600 : 500,
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <i className={`fa ${isSelected ? 'fa-check text-success' : 'fa-circle'} me-1.5`} style={{ fontSize: isSelected ? '9.5px' : '6.5px', color: isSelected ? '#10b981' : (tag.colour || '#3b82f6') }}></i>
                                                                Tag #{tag.tag_number}
                                                            </span>
                                                        );
                                                    })}
                                                    {!isMatch && requiredCount > 0 && (
                                                        <span className="text-danger small ms-1.5" style={{ fontSize: '11px' }}>
                                                            ({selectedReturnedTagIds.length}/{requiredCount} selected)
                                                        </span>
                                                    )}
                                                </div>

                                                {entryTags.length > 1 && (
                                                    <div className="d-flex align-items-center gap-2 ms-auto">
                                                        <button
                                                            type="button"
                                                            className="btn btn-link text-primary p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px', fontWeight: 600 }}
                                                            onClick={() => {
                                                                const required = Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length);
                                                                setSelectedReturnedTagIds(entryTags.slice(0, required).map(t => t.id));
                                                                setTagReceived(true);
                                                            }}
                                                        >
                                                            Auto-select
                                                        </button>
                                                        <span className="text-muted small">•</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-link text-muted p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px' }}
                                                            onClick={handleClearTags}
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-muted small pt-3 border-top mt-3 d-flex align-items-center justify-content-between" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                    <span>
                                        <i className="fa fa-info-circle me-1.5 text-muted"></i> All <strong>{currentInside}</strong> person(s) stay inside campus.
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-link text-primary fw-semibold p-0 text-decoration-none"
                                        style={{ fontSize: '12px' }}
                                        onClick={() => setIncludePerson(true)}
                                    >
                                        + Exit Persons
                                    </button>
                                </div>
                            )}
                        </div>
                        )}

                        {/* 2. Vehicles on Campus */}
                        <div 
                            className="rounded-3" 
                            style={{ 
                                padding: '18px 20px',
                                marginBottom: '18px',
                                backgroundColor: isDark ? '#141824' : '#ffffff', 
                                border: `1px solid ${includeVehicle ? (isDark ? '#475569' : '#cbd5e1') : (isDark ? '#334155' : '#e2e8f0')}`,
                                boxShadow: includeVehicle ? '0 4px 16px rgba(0, 0, 0, 0.04)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <Form.Check
                                        type="checkbox"
                                        id="include-vehicle-checkbox"
                                        checked={includeVehicle}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setIncludeVehicle(checked);
                                            if (!checked && !includePerson && !includeEquipment) {
                                                if (currentInside > 0) {
                                                    setIncludePerson(true);
                                                } else {
                                                    setIncludeVehicle(true);
                                                }
                                            }
                                            if (checked && availableVehicles.length > 0 && selectedVehicles.length === 0) {
                                                const firstVeh = availableVehicles[0].vehicle_number || '';
                                                setSelectedVehicles(firstVeh ? [firstVeh] : []);
                                                setVehicleNumber(firstVeh);
                                            }
                                        }}
                                        label={
                                            <span className="fw-semibold d-inline-flex align-items-center gap-2" style={{ fontSize: '14.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                <i className={`fa ${includeVehicle ? 'fa-car text-success' : 'fa-walking text-primary'}`} style={{ fontSize: '13px' }}></i>
                                                {currentInside > 0 ? '2. Vehicle Departure' : '1. Vehicle Departure'}
                                            </span>
                                        }
                                        className="mb-0 cursor-pointer"
                                        style={{ accentColor: '#0a500f' }}
                                    />
                                    {availableVehicles.length > 0 && (
                                        <span className="badge rounded-pill px-2.5 py-1 ms-2" style={{ fontSize: '11px', fontWeight: 500, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b' }}>
                                            {availableVehicles.map(v => v.vehicle_number).join(', ')}
                                        </span>
                                    )}
                                </div>
                                <span 
                                    className={`badge rounded-pill px-3 py-1.5 ${includeVehicle ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'}`} 
                                    style={{ fontSize: '11.5px', fontWeight: 600 }}
                                >
                                    {includeVehicle ? (selectedVehicles.length > 1 ? `${selectedVehicles.length} Exiting Now` : 'Exiting Now') : 'Pedestrian (On Foot)'}
                                </span>
                            </div>

                            {includeVehicle ? (
                                <div className="pt-3 border-top mt-3" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                    {availableVehicles.length > 0 ? (
                                        <>
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2.5">
                                                <div className="text-muted small fw-medium" style={{ fontSize: '12.5px' }}>
                                                    Select exiting vehicle plate(s) (click to select multiple):
                                                </div>
                                                {availableVehicles.length > 1 && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-link text-primary fw-semibold p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px' }}
                                                            onClick={handleSelectAllVehicles}
                                                        >
                                                            Select All ({availableVehicles.length})
                                                        </button>
                                                        <span className="text-muted small">•</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-link text-secondary fw-semibold p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px' }}
                                                            onClick={handleClearVehicles}
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="d-flex align-items-center flex-wrap mb-3" style={{ gap: '10px' }}>
                                                {availableVehicles.map((v, vIdx) => {
                                                    const isSelected = selectedVehicles.some(
                                                        sv => sv.trim().toUpperCase() === (v.vehicle_number || '').trim().toUpperCase()
                                                    );
                                                    return (
                                                        <button
                                                            key={vIdx}
                                                            type="button"
                                                            className="btn btn-sm rounded-pill d-inline-flex align-items-center shadow-none"
                                                            style={{ 
                                                                padding: '6px 14px',
                                                                fontSize: '12.5px', 
                                                                fontWeight: 600,
                                                                letterSpacing: '0.3px',
                                                                border: `1.5px solid ${isSelected ? '#0a500f' : (isDark ? '#334155' : '#e2e8f0')}`,
                                                                backgroundColor: isSelected ? (isDark ? 'rgba(10, 80, 15, 0.15)' : '#ecfdf5') : (isDark ? '#1e293b' : '#ffffff'),
                                                                color: isSelected ? (isDark ? '#34d399' : '#059669') : (isDark ? '#cbd5e1' : '#475569'),
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                            onClick={() => toggleVehicleSelection(v.vehicle_number)}
                                                        >
                                                            <i 
                                                                className={`fa ${isSelected ? 'fa-check' : 'fa-car'}`} 
                                                                style={{ 
                                                                    marginRight: '7px', 
                                                                    fontSize: isSelected ? '11px' : '11.5px',
                                                                    color: isSelected ? '#10b981' : (isDark ? '#94a3b8' : '#64748b') 
                                                                }}
                                                            ></i>
                                                            <span>{isSelected ? `Exit ${v.vehicle_number}` : v.vehicle_number}</span>
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    type="button"
                                                    className="btn btn-sm rounded-pill d-inline-flex align-items-center shadow-none"
                                                    style={{ 
                                                        padding: '6px 14px',
                                                        fontSize: '12.5px', 
                                                        fontWeight: 500,
                                                        border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                        color: isDark ? '#94a3b8' : '#64748b',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onClick={handleSwitchToPedestrian}
                                                    title="Switch to pedestrian departure on foot"
                                                >
                                                    <i 
                                                        className="fa fa-walking" 
                                                        style={{ 
                                                            marginRight: '7px', 
                                                            fontSize: '11.5px', 
                                                            color: isDark ? '#94a3b8' : '#64748b' 
                                                        }}
                                                    ></i>
                                                    <span>On Foot</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-muted small mb-3 fst-italic">
                                            <i className="fa fa-walking me-1.5"></i> No vehicles currently inside campus.
                                        </div>
                                    )}

                                    <Form.Control
                                        type="text"
                                        placeholder="e.g. KL 05 H 4040, KL 78 M 7676 (comma separated for multiple)"
                                        value={vehicleNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            setVehicleNumber(val);
                                            const parsed = val.split(',').map(s => s.trim()).filter(Boolean);
                                            setSelectedVehicles(parsed);
                                        }}
                                        className="form-control-custom text-uppercase fw-semibold mb-1"
                                        style={{ letterSpacing: '0.6px', height: '44px', fontSize: '13.5px', borderRadius: '8px' }}
                                        disabled={submitting}
                                    />

                                    {selectedVehicles.length > 1 && (
                                        <div className="small text-success fw-semibold mt-2 mb-1 d-flex align-items-center gap-2">
                                            <i className="fa fa-check-double"></i>
                                            <span>{selectedVehicles.length} vehicles selected to exit together ({selectedVehicles.join(', ')})</span>
                                        </div>
                                    )}

                                    {currentInside <= 0 && tagNumber && (
                                        <div 
                                            className="mt-3 p-2.5 px-3 rounded-3 d-flex align-items-center justify-content-between"
                                            style={{
                                                backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#f0fdf4',
                                                border: `1px solid ${isDark ? '#059669' : '#bbf7d0'}`
                                            }}
                                        >
                                            <Form.Check
                                                type="checkbox"
                                                id="unclosedEntryTagReceived"
                                                checked={selectiveTagSurrendered}
                                                onChange={(e) => setSelectiveTagSurrendered(e.target.checked)}
                                                label={
                                                    <span style={{ fontSize: '13px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                        Physical Tag <strong className="text-primary">#{tagNumber}</strong> surrendered for final checkout
                                                    </span>
                                                }
                                                className="fw-semibold mb-0 cursor-pointer"
                                            />
                                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                                                Final Exit
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div 
                                    className="rounded-3 mt-3 d-flex align-items-center justify-content-between flex-wrap"
                                    style={{
                                        padding: '14px 18px',
                                        gap: '12px',
                                        backgroundColor: isDark ? 'rgba(14, 165, 233, 0.08)' : '#f0f9ff',
                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd'}`,
                                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(14, 165, 233, 0.04)'
                                    }}
                                >
                                    <div className="d-flex align-items-center" style={{ gap: '12px' }}>
                                        <div 
                                            className="rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: '34px',
                                                height: '34px',
                                                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.18)' : '#e0f2fe',
                                                border: `1px solid ${isDark ? '#0284c7' : '#7dd3fc'}`,
                                                color: isDark ? '#38bdf8' : '#0284c7',
                                                fontSize: '13.5px'
                                            }}
                                        >
                                            <i className="fa fa-walking"></i>
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                                                <span className="fw-semibold" style={{ fontSize: '13.5px', color: isDark ? '#f8fafc' : '#0369a1' }}>
                                                    Exiting as Pedestrian
                                                </span>
                                                <span 
                                                    className="badge rounded-pill" 
                                                    style={{ 
                                                        padding: '3px 8px',
                                                        fontSize: '10.5px', 
                                                        fontWeight: 600,
                                                        backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe',
                                                        color: isDark ? '#38bdf8' : '#0284c7',
                                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#7dd3fc'}`
                                                    }}
                                                >
                                                    On Foot
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '12px', marginTop: '2px', color: isDark ? '#94a3b8' : '#0284c7' }}>
                                                Vehicle <strong style={{ color: isDark ? '#e0f2fe' : '#0c4a6e' }}>{availableVehicles.map(v => v.vehicle_number).join(', ') || 'registered at entry'}</strong> will remain parked on campus grounds.
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-sm rounded-pill d-inline-flex align-items-center shadow-none ms-auto"
                                        style={{ 
                                            padding: '6px 14px',
                                            fontSize: '12px', 
                                            fontWeight: 600,
                                            border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.4)' : '#a7f3d0'}`,
                                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                            color: isDark ? '#34d399' : '#059669',
                                            boxShadow: isDark ? 'none' : '0 1px 3px rgba(16, 185, 129, 0.1)',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onClick={handleSwitchToVehicle}
                                        title="Switch back to vehicle departure"
                                    >
                                        <i className="fa fa-car" style={{ marginRight: '7px', fontSize: '11.5px', color: '#10b981' }}></i>
                                        <span>Switch to Vehicle</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 3. Tools & Equipments */}
                        <div 
                            className="rounded-3" 
                            style={{ 
                                padding: '18px 20px',
                                marginBottom: '18px',
                                backgroundColor: isDark ? '#141824' : '#ffffff', 
                                border: `1px solid ${includeEquipment ? (isDark ? '#475569' : '#cbd5e1') : (isDark ? '#334155' : '#e2e8f0')}`,
                                boxShadow: includeEquipment ? '0 4px 16px rgba(0, 0, 0, 0.04)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-2">
                                    <Form.Check
                                        type="checkbox"
                                        id="include-equipment-checkbox"
                                        checked={includeEquipment}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setIncludeEquipment(checked);
                                            if (checked && availableEquipments.length > 0 && selectedEquipmentIds.length === 0) {
                                                setSelectedEquipmentIds(availableEquipments.map(eq => eq.id || eq.value).filter(Boolean));
                                            }
                                        }}
                                        label={
                                            <span className="fw-semibold d-inline-flex align-items-center gap-2" style={{ fontSize: '14.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                <i className="fa fa-tools text-primary" style={{ fontSize: '13px' }}></i>
                                                {currentInside > 0 ? '3. Tools & Equipments' : '2. Tools & Equipments'}
                                            </span>
                                        }
                                        className="mb-0 cursor-pointer"
                                        style={{ accentColor: '#0a500f' }}
                                    />
                                    {availableEquipments.length > 0 && (
                                        <span className="badge rounded-pill px-2.5 py-1 ms-2" style={{ fontSize: '11px', fontWeight: 500, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b' }}>
                                            {availableEquipments.length} on Campus
                                        </span>
                                    )}
                                </div>
                                <span 
                                    className={`badge rounded-pill px-3 py-1.5 ${includeEquipment ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-light text-muted border'}`} 
                                    style={{ fontSize: '11.5px', fontWeight: 600 }}
                                >
                                    {includeEquipment 
                                        ? (availableEquipments.length > 0 ? `${selectedEquipmentIds.length} Exiting Now` : 'Selected')
                                        : (availableEquipments.length > 0 ? 'Staying Inside' : 'None Logged')}
                                </span>
                            </div>

                            {includeEquipment ? (
                                <div className="pt-3 border-top mt-3" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                    {availableEquipments.length > 0 ? (
                                        <>
                                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2.5">
                                                <div className="text-muted small fw-medium" style={{ fontSize: '12.5px' }}>
                                                    Select tools & equipments departing now (click to toggle):
                                                </div>
                                                {availableEquipments.length > 1 && (
                                                    <div className="d-flex align-items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-link text-primary fw-semibold p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px' }}
                                                            onClick={handleSelectAllEquipments}
                                                        >
                                                            Select All ({availableEquipments.length})
                                                        </button>
                                                        <span className="text-muted small">•</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-link text-secondary fw-semibold p-0 text-decoration-none"
                                                            style={{ fontSize: '11.5px' }}
                                                            onClick={handleClearEquipments}
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Equipment Grid Cards */}
                                            <div className="row g-2.5 mb-2.5">
                                                {availableEquipments.map((eq, eqIdx) => {
                                                    const eqId = eq.id || eq.value || eqIdx;
                                                    const isSelected = selectedEquipmentIds.includes(eqId);
                                                    const imageUrl = eq.image ? getFullImageUrl(eq.image) : null;
                                                    return (
                                                        <div key={eqIdx} className="col-sm-6">
                                                            <div
                                                                onClick={() => toggleEquipmentSelection(eqId)}
                                                                role="button"
                                                                tabIndex={0}
                                                                className="p-2.5 rounded-3 d-flex align-items-center gap-2.5"
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.18s ease',
                                                                    backgroundColor: isSelected 
                                                                        ? (isDark ? 'rgba(10, 80, 15, 0.12)' : '#f0fdf4')
                                                                        : (isDark ? '#1e293b' : '#f8fafc'),
                                                                    border: `1.5px solid ${isSelected 
                                                                        ? (isDark ? '#059669' : '#0a500f')
                                                                        : (isDark ? '#334155' : '#e2e8f0')}`,
                                                                    boxShadow: isSelected ? '0 2px 8px rgba(10, 80, 15, 0.18)' : 'none'
                                                                }}
                                                            >
                                                                {/* Thumbnail */}
                                                                <div 
                                                                    style={{ 
                                                                        width: '46px', 
                                                                        height: '46px', 
                                                                        borderRadius: '10px', 
                                                                        overflow: 'hidden',
                                                                        flexShrink: 0,
                                                                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                                                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    {imageUrl ? (
                                                                        <img 
                                                                            src={imageUrl} 
                                                                            alt={eq.name} 
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                        />
                                                                    ) : (
                                                                        <i className="fa fa-wrench" style={{ color: isSelected ? '#16a34a' : '#64748b', fontSize: '18px' }}></i>
                                                                    )}
                                                                </div>

                                                                {/* Details */}
                                                                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                                    <div className="d-flex align-items-center justify-content-between gap-1">
                                                                        <strong 
                                                                            className="text-truncate d-block" 
                                                                            style={{ 
                                                                                fontSize: '13.5px', 
                                                                                color: isDark ? '#f8fafc' : '#0f172a',
                                                                                fontWeight: 600
                                                                            }}
                                                                            title={eq.name}
                                                                        >
                                                                            {eq.name}
                                                                        </strong>
                                                                        <span 
                                                                            className={`badge rounded-pill px-2.5 py-1 ms-2 flex-shrink-0 ${isSelected ? 'bg-success text-white' : 'bg-light text-muted border'}`}
                                                                            style={{ fontSize: '10.5px', fontWeight: 600 }}
                                                                        >
                                                                            <i className={`fa ${isSelected ? 'fa-check' : 'fa-parking'} me-1.5`}></i>
                                                                            {isSelected ? 'Exiting' : 'Staying Inside'}
                                                                        </span>
                                                                    </div>
                                                                    {eq.code && (
                                                                        <span className="badge bg-secondary-subtle text-secondary me-1 mt-0.5" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                                                            {eq.code}
                                                                        </span>
                                                                    )}
                                                                    {eq.description && (
                                                                        <div 
                                                                            className="text-muted text-truncate mt-0.5" 
                                                                            style={{ fontSize: '11px', lineHeight: 1.2 }}
                                                                            title={eq.description}
                                                                        >
                                                                            {eq.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Summary Ribbon */}
                                            <div 
                                                className="p-2.5 px-3.5 rounded-3 d-flex justify-content-between align-items-center mt-3 mb-1"
                                                style={{ 
                                                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                                                    border: `1px solid ${isDark ? '#334155' : '#edf2f7'}`,
                                                    fontSize: '12.5px'
                                                }}
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="text-muted">Tools exiting now:</span>
                                                    <span className={`badge fw-bold px-2.5 py-1 ms-1.5 ${selectedEquipmentIds.length > 0 ? 'bg-success text-white' : 'bg-secondary text-white'}`} style={{ fontSize: '11.5px' }}>
                                                        {selectedEquipmentIds.length} item{selectedEquipmentIds.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <i className="fa fa-arrow-right text-muted opacity-40 small"></i>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="text-muted">Remaining inside:</span>
                                                    <span className="badge bg-warning-subtle text-warning border border-warning-subtle fw-bold px-2.5 py-1 ms-1.5" style={{ fontSize: '11.5px' }}>
                                                        {entryEquipments.length - selectedEquipmentIds.length} item{entryEquipments.length - selectedEquipmentIds.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {receivables ? (
                                                <div className="small mb-1.5 text-dark fw-semibold d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                                                    <span className="badge bg-light text-dark border px-2 py-1">
                                                        <i className="fa fa-box-open text-muted me-1"></i> Logged Items:
                                                    </span>
                                                    <span>{receivables}</span>
                                                </div>
                                            ) : (
                                                <div className="small text-muted py-1" style={{ fontSize: '12.5px' }}>
                                                    <i className="fa fa-info-circle me-1.5 text-muted"></i> No tools or equipment recorded for this entry.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Entry equipment notes */}
                                    {entry.equipment_notes && (
                                        <div className="mt-2 p-2 px-2.5 rounded-2 bg-light-subtle border text-muted small" style={{ fontSize: '12px' }}>
                                            <i className="fa fa-sticky-note me-1.5 text-primary"></i>
                                            <strong>Equipment Notes:</strong> {entry.equipment_notes}
                                        </div>
                                    )}

                                    {/* Receivables alongside equipment if present */}
                                    {entryEquipments.length > 0 && receivables && (
                                        <div className="mt-2 p-2 px-2.5 rounded-2 bg-light-subtle border text-muted small" style={{ fontSize: '12px' }}>
                                            <i className="fa fa-box-open me-1.5 text-muted"></i>
                                            <strong>Other Logged Materials:</strong> {receivables}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-muted small pt-3 border-top mt-3 d-flex align-items-center justify-content-between" style={{ borderColor: isDark ? '#334155' : '#edf2f7' }}>
                                    <span>
                                        <i className="fa fa-info-circle me-1.5 text-muted"></i>
                                        {entryEquipments.length > 0 
                                            ? `All ${entryEquipments.length} tool(s) stay inside campus. Check the box to record tools departing.` 
                                            : 'No tools or equipment recorded at entry.'}
                                    </span>
                                    {entryEquipments.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-link text-primary fw-semibold p-0 text-decoration-none"
                                            style={{ fontSize: '12px' }}
                                            onClick={() => {
                                                setIncludeEquipment(true);
                                                setSelectedEquipmentIds(entryEquipments.map(eq => eq.id || eq.value).filter(Boolean));
                                            }}
                                        >
                                            + Exit Tools
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 4. Exiting Gate */}
                        <Form.Group className="mb-3">
                            <Form.Label className="form-label-custom font-w600 mb-1.5" style={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: '14px' }}>
                                {currentInside > 0 ? '4. Exiting Gate' : '3. Exiting Gate'} <span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Select
                                value={selectedExitGate}
                                onChange={(e) => setSelectedExitGate(e.target.value)}
                                className="form-control-custom fw-semibold"
                                style={{ 
                                    height: '44px', 
                                    fontSize: '14px',
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                    color: isDark ? '#f8fafc' : '#1e293b',
                                    borderColor: !selectedExitGate ? '#f59e0b' : (isDark ? '#475569' : '#cbd5e1')
                                }}
                                disabled={submitting}
                            >
                                <option value="">-- Select Exiting Gate --</option>
                                {gates.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name} {g.gate_no ? `(${g.gate_no})` : ''} {g.gate_type ? `• ${g.gate_type}` : ''}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        {/* 5. Remarks */}
                        <Form.Group className="mb-1">
                            <Form.Label className="form-label-custom text-muted small mb-1.5" style={{ fontSize: '13px' }}>
                                Notes / Departure remarks (optional)
                            </Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="e.g. Vehicle leaving campus, tools staying inside"
                                value={partialNotes}
                                onChange={(e) => setPartialNotes(e.target.value)}
                                className="form-control-custom"
                                style={{ height: '44px', fontSize: '14px' }}
                                disabled={submitting}
                            />
                        </Form.Group>

                        {/* Departure Summary Ribbon */}
                        <div 
                            className="rounded-3 mt-3 d-flex align-items-center justify-content-between flex-wrap"
                            style={{
                                padding: '12px 16px',
                                gap: '10px',
                                backgroundColor: isDark ? '#141824' : '#f8fafc',
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                            }}
                        >
                            <div className="d-flex align-items-center flex-wrap" style={{ gap: '8px' }}>
                                <span className="fw-semibold text-muted" style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                    Departure Summary:
                                </span>
                                {includePerson && currentInside > 0 && (
                                    <span 
                                        className="badge rounded-pill" 
                                        style={{ 
                                            padding: '4px 9px', 
                                            fontSize: '11.5px', 
                                            fontWeight: 600,
                                            backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                            color: isDark ? '#34d399' : '#059669',
                                            border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                        }}
                                    >
                                        <i className={`fa ${!includeVehicle ? 'fa-walking' : 'fa-users'}`} style={{ marginRight: '5px' }}></i>
                                        {selectivePersonCount} {selectivePersonCount == 1 ? 'Person' : 'Persons'} {!includeVehicle ? '(On Foot)' : ''}
                                    </span>
                                )}
                                {includeVehicle ? (
                                    <span 
                                        className="badge rounded-pill" 
                                        style={{ 
                                            padding: '4px 9px', 
                                            fontSize: '11.5px', 
                                            fontWeight: 600,
                                            backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                            color: isDark ? '#34d399' : '#059669',
                                            border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                        }}
                                    >
                                        <i className="fa fa-car" style={{ marginRight: '5px' }}></i>
                                        {selectedVehicles.length > 0 ? selectedVehicles.join(', ') : (vehicleNumber || 'Vehicle')}
                                    </span>
                                ) : availableVehicles.length > 0 ? (
                                    <span 
                                        className="badge rounded-pill" 
                                        style={{ 
                                            padding: '4px 9px', 
                                            fontSize: '11.5px', 
                                            fontWeight: 500,
                                            backgroundColor: isDark ? 'rgba(14, 165, 233, 0.1)' : '#f0f9ff',
                                            color: isDark ? '#38bdf8' : '#0284c7',
                                            border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`
                                        }}
                                        title={`${availableVehicles.map(v => v.vehicle_number).join(', ')} remains parked on campus grounds`}
                                    >
                                        <i className="fa fa-parking" style={{ marginRight: '5px' }}></i>
                                        Vehicle Parked
                                    </span>
                                ) : null}
                                {includeEquipment && selectedEquipmentIds.length > 0 && (
                                    <span 
                                        className="badge rounded-pill" 
                                        style={{ 
                                            padding: '4px 9px', 
                                            fontSize: '11.5px', 
                                            fontWeight: 600,
                                            backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                            color: isDark ? '#34d399' : '#059669',
                                            border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                        }}
                                    >
                                        <i className="fa fa-tools" style={{ marginRight: '5px' }}></i>
                                        {selectedEquipmentIds.length} {selectedEquipmentIds.length == 1 ? 'Tool' : 'Tools'}
                                    </span>
                                )}
                            </div>
                            {selectedExitGate && (
                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                    <i className="fa fa-door-open me-1 text-primary"></i>
                                    Exit Gate: <strong style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{gates.find(g => g.id == selectedExitGate)?.name || 'Selected'}</strong>
                                </span>
                            )}
                        </div>
                    </Form>
                ) : (
                    /* Initial View: Show action explanation card */
                    <div>
                        {/* Company Vehicle Checkout Purpose & Delivery Note */}
                        {isCompanyVehicle && (
                            <div 
                                className="p-3 mb-3 rounded-4" 
                                style={{ 
                                    backgroundColor: isDark ? '#141824' : '#f8fafc',
                                    border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                                }}
                            >
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2" style={{ borderColor: isDark ? '#334155' : '#eef2f6' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <i className="fa fa-truck text-primary" style={{ fontSize: '15px' }}></i>
                                        <span className="fw-bold" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                            Company Vehicle Departure Purpose <span className="text-danger">*</span>
                                        </span>
                                    </div>
                                    <span className="badge rounded-pill bg-light text-muted border px-2.5 py-1" style={{ fontSize: '11px' }}>
                                        Company Fleet Policy
                                    </span>
                                </div>

                                <div className="row g-3 mb-2">
                                    <div className="col-sm-6">
                                        <div
                                            onClick={() => setCheckoutPurpose('other')}
                                            style={{
                                                border: checkoutPurpose === 'other' ? '2px solid #0d9488' : `1.5px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                                                background: checkoutPurpose === 'other' ? (isDark ? 'rgba(13, 148, 136, 0.15)' : '#f0fdfa') : (isDark ? '#1e293b' : '#ffffff'),
                                                borderRadius: '10px',
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px'
                                            }}
                                        >
                                            <div 
                                                className="rounded-circle d-flex align-items-center justify-content-center"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    background: checkoutPurpose === 'other' ? '#ccfbf1' : '#f1f5f9',
                                                    color: checkoutPurpose === 'other' ? '#0f766e' : '#64748b',
                                                    fontSize: '16px'
                                                }}
                                            >
                                                <i className="fa fa-clipboard-list"></i>
                                            </div>
                                            <div>
                                                <div className="fw-bold" style={{ fontSize: '13.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                    Other Purpose
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                    Servicing, errand, or other visit
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-sm-6">
                                        <div
                                            onClick={() => setCheckoutPurpose('delivery')}
                                            style={{
                                                border: checkoutPurpose === 'delivery' ? '2px solid #0284c7' : `1.5px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                                                background: checkoutPurpose === 'delivery' ? (isDark ? 'rgba(2, 132, 199, 0.15)' : '#f0f9ff') : (isDark ? '#1e293b' : '#ffffff'),
                                                borderRadius: '10px',
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px'
                                            }}
                                        >
                                            <div 
                                                className="rounded-circle d-flex align-items-center justify-content-center"
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    background: checkoutPurpose === 'delivery' ? '#e0f2fe' : '#f1f5f9',
                                                    color: checkoutPurpose === 'delivery' ? '#0284c7' : '#64748b',
                                                    fontSize: '16px'
                                                }}
                                            >
                                                <i className="fa fa-shipping-fast"></i>
                                            </div>
                                            <div>
                                                <div className="fw-bold" style={{ fontSize: '13.5px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                    Delivery
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '11px' }}>
                                                    Goods delivery (Requires Note #)
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {checkoutPurpose === 'other' && (
                                    <div 
                                        className="p-3 rounded-3 mt-3"
                                        style={{
                                            background: isDark ? '#0f172a' : '#ffffff',
                                            border: `1.5px solid ${isDark ? '#334155' : '#cbd5e1'}`
                                        }}
                                    >
                                        <div className="d-flex align-items-center mb-2.5 pb-2 border-bottom" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                            <i className="fa fa-pen-fancy me-2" style={{ fontSize: '13px', color: '#0d9488' }}></i>
                                            <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>Purpose Details</span>
                                        </div>

                                        <Form.Group className="mb-0">
                                            <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: '12.5px' }}>
                                                Purpose Note <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Enter checkout reason / purpose note (e.g. Servicing, Routine Check, Official Errand)..."
                                                value={purposeNote}
                                                onChange={(e) => setPurposeNote(e.target.value)}
                                                className="form-control-custom"
                                                style={{ height: '40px', fontSize: '13px' }}
                                                autoFocus
                                            />
                                            {!purposeNote.trim() && (
                                                <div className="text-danger mt-1" style={{ fontSize: '11px' }}>
                                                    * Please enter a purpose note before completing exit.
                                                </div>
                                            )}
                                        </Form.Group>
                                    </div>
                                )}

                                {checkoutPurpose === 'delivery' && (
                                    <div 
                                        className="p-3 rounded-3 mt-3"
                                        style={{
                                            background: isDark ? '#0f172a' : '#ffffff',
                                            border: `1.5px solid ${isDark ? '#334155' : '#cbd5e1'}`
                                        }}
                                    >
                                        <Form.Group className="mb-2.5">
                                            <Form.Label className="fw-semibold text-dark mb-1" style={{ fontSize: '12.5px' }}>
                                                Delivery Note Number <span className="text-danger">*</span>
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Enter Delivery Note # (e.g. DN-2026-0045)..."
                                                value={deliveryNoteNumber}
                                                onChange={(e) => setDeliveryNoteNumber(e.target.value.toUpperCase())}
                                                className="form-control-custom"
                                                style={{ height: '40px', fontSize: '13px' }}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-1">
                                            <Form.Label className="fw-semibold text-dark mb-1 d-flex justify-content-between align-items-center" style={{ fontSize: '12.5px' }}>
                                                <span>Attach Delivery Note Image / Proof</span>
                                                <span className="text-muted" style={{ fontSize: '11px' }}>Optional</span>
                                            </Form.Label>
                                            {deliveryNotePreview ? (
                                                <div className="p-2 rounded-3 d-flex align-items-center justify-content-between border" style={{ background: isDark ? '#1e293b' : '#f8fafc' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <img src={deliveryNotePreview} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                                        <span className="small text-truncate" style={{ maxWidth: '200px' }}>{deliveryNotePhoto?.name || 'Attached'}</span>
                                                    </div>
                                                    <button type="button" className="btn btn-sm btn-outline-danger py-0.5 px-2" style={{ fontSize: '11px' }} onClick={() => { setDeliveryNotePhoto(null); setDeliveryNotePreview(null); }}>
                                                        Remove
                                                    </button>
                                                </div>
                                            ) : (
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="form-control form-control-sm"
                                                    onChange={(e) => {
                                                        const file = e.target.files && e.target.files[0];
                                                        if (file) {
                                                            setDeliveryNotePhoto(file);
                                                            setDeliveryNotePreview(URL.createObjectURL(file));
                                                        }
                                                    }}
                                                />
                                            )}
                                        </Form.Group>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Exiting Gate Selection Card */}
                        <div 
                            className="p-3 mb-3 rounded-4" 
                            style={{ 
                                backgroundColor: isDark ? '#141824' : '#f8fafc',
                                border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                            }}
                        >
                            <div className="row align-items-center g-3">
                                <div className="col-sm-5">
                                    <div className="d-flex align-items-center" style={{ gap: '12px' }}>
                                        <div 
                                            style={{ 
                                                width: '40px', 
                                                height: '40px', 
                                                borderRadius: '12px', 
                                                background: isDark ? 'rgba(10, 80, 15, 0.15)' : '#e8fdf4',
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                color: '#0a500f',
                                                flexShrink: 0
                                            }}
                                        >
                                            <i className="fa fa-door-open fs-5"></i>
                                        </div>
                                        <div>
                                            <label className="fw-bold mb-0" style={{ fontSize: '14px', color: isDark ? '#f8fafc' : '#1e293b' }}>
                                                Exiting Gate <span className="text-danger">*</span>
                                            </label>
                                            <div className="text-muted" style={{ fontSize: '12px' }}>
                                                Select egress checkpoint
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-sm-7">
                                    <Form.Select
                                        value={selectedExitGate}
                                        onChange={(e) => setSelectedExitGate(e.target.value)}
                                        className="form-control-custom fw-semibold"
                                        style={{ 
                                            height: '44px', 
                                            fontSize: '14px',
                                            borderColor: !selectedExitGate ? '#f59e0b' : (isDark ? '#475569' : '#cbd5e1'),
                                            backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                            color: isDark ? '#f8fafc' : '#1e293b'
                                        }}
                                        disabled={submitting}
                                    >
                                        <option value="">-- Select Exiting Gate --</option>
                                        {gates.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.name} {g.gate_no ? `(${g.gate_no})` : ''} {g.gate_type ? `• ${g.gate_type}` : ''}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </div>
                            </div>
                        </div>

                        {!isMovementDone && (
                            <div 
                                className="p-3 mb-3 rounded-3 d-flex align-items-center gap-3"
                                style={{
                                    background: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                                    border: `1.5px solid ${isDark ? '#d97706' : '#fde68a'}`,
                                    color: isDark ? '#fcd34d' : '#92400e'
                                }}
                            >
                                <i className="fa fa-lock fs-4 flex-shrink-0" style={{ color: '#d97706' }}></i>
                                <div style={{ fontSize: '13px' }}>
                                    <strong>Campus Movement Incomplete:</strong> The host official (<strong>{entry.employee_name || 'concerned staff'}</strong>) must mark this {isVisitor ? 'visitor' : 'vehicle'}'s movement as <em>Completed</em> in the Reallocation module before checkout can be finalized.
                                </div>
                            </div>
                        )}

                        {canPartialExit ? (
                            <div 
                                className="p-4 mb-2 rounded-4" 
                                style={{ 
                                    background: isDark 
                                        ? 'rgba(10, 80, 15, 0.08)' 
                                        : 'linear-gradient(135deg, #f0fdf4 0%, #e6faf1 100%)',
                                    border: `1.5px solid ${isDark ? '#059669' : '#a7f3d0'}`,
                                    boxShadow: '0 4px 18px rgba(10, 80, 15, 0.08)'
                                }}
                            >
                                <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                    <div 
                                        style={{ 
                                            width: '52px', 
                                            height: '52px', 
                                            borderRadius: '14px', 
                                            background: '#d1fae5', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            boxShadow: '0 2px 10px rgba(5, 150, 105, 0.18)'
                                        }}
                                    >
                                        <i className="fa fa-users" style={{ color: '#059669', fontSize: '22px' }}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-1.5" style={{ color: '#047857', fontWeight: 700, fontSize: '16.5px' }}>
                                            {currentInside} Persons Currently Inside Campus
                                        </h6>
                                        <p className="mb-0 text-muted" style={{ fontSize: '13.5px', lineHeight: 1.6 }}>
                                            Click <strong style={{ color: '#059669' }}>All Exited</strong> when checking out.
                                            {tagNumber && (
                                                <span className="d-block mt-1 text-dark fw-semibold" style={{ fontSize: '13px' }}>
                                                    <i className="fa fa-id-badge text-warning me-1"></i> Ensure physical <span className="badge bg-warning-subtle text-dark border border-warning">Tag #{tagNumber}</span> is returned upon full exit.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div 
                                className="p-4 mb-2 rounded-4"
                                style={{ 
                                    background: isDark 
                                        ? 'rgba(239, 68, 68, 0.08)' 
                                        : 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
                                    border: `1.5px solid ${isDark ? '#b91c1c' : '#fecdd3'}`,
                                    boxShadow: '0 4px 18px rgba(239, 68, 68, 0.08)'
                                }}
                            >
                                <div className="d-flex align-items-center" style={{ gap: '18px' }}>
                                    <div 
                                        style={{ 
                                            width: '52px', 
                                            height: '52px', 
                                            borderRadius: '14px', 
                                            background: '#fee2e2', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            boxShadow: '0 2px 10px rgba(220, 38, 38, 0.18)'
                                        }}
                                    >
                                        <i className="fa fa-sign-out-alt" style={{ color: '#dc2626', fontSize: '22px' }}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-1.5" style={{ color: '#b91c1c', fontWeight: 700, fontSize: '16.5px' }}>
                                            Final Departure Checkout
                                        </h6>
                                        <p className="mb-0 text-muted" style={{ fontSize: '13.5px', lineHeight: 1.6 }}>
                                            {currentInside <= 0 
                                                ? `0 persons are inside. All visitors have departed. Only parked vehicle remains on campus.` 
                                                : (currentInside === 1 
                                                    ? `1 person is inside. Confirming checkout will record full exit and release physical ${isVisitor ? `Tag #${tagNumber || ''}` : `Vehicle Pass #${entry.pass_number || tagNumber || ''}`}.` 
                                                    : `Confirming full exit will record departure of all ${currentInside} person(s) and release ${isVisitor ? `visitor Tag #${tagNumber || ''}` : 'vehicle pass'}.`)}
                                            {tagNumber && (
                                                <span className="d-block mt-1 text-danger fw-semibold" style={{ fontSize: '13px' }}>
                                                    <i className="fa fa-exclamation-circle me-1"></i> Watchman: Collect Tag #{tagNumber} before finalizing.
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Footer with buttons matching template */}
            <div className="modal-footer-custom">
                {mode === 'questions' ? (
                    <>
                        <button
                            type="button"
                            className="btn btn-back-custom"
                            onClick={() => setMode('initial')}
                            disabled={submitting}
                            style={{
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                fontWeight: 500,
                                fontSize: '14.5px',
                                padding: '12px 24px',
                                minHeight: '46px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}
                        >
                            <i className="fa fa-arrow-left me-2"></i> Back
                        </button>
                        <button
                            type="button"
                            className="btn btn-partial-custom"
                            onClick={handleConfirmPartialExit}
                            disabled={
                                submitting || 
                                !isMovementDone || 
                                !exitingCount || 
                                exitingCount < 1 || 
                                exitingCount >= currentInside ||
                                (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))
                            }
                            title={
                                !isMovementDone 
                                    ? `Host official (${entry.employee_name || 'concerned staff'}) must mark movement completed first.` 
                                    : (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))
                                        ? `Please select exactly ${Math.min(parseInt(exitingCount, 10) || 1, entryTags.length)} tag(s) to match ${exitingCount} departing person(s).`
                                        : undefined
                            }
                            style={{ 
                                background: (!isMovementDone || (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))) 
                                    ? '#94a3b8' 
                                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: '10px', 
                                padding: '12px 28px', 
                                minHeight: '46px',
                                fontWeight: 700,
                                fontSize: '14.5px',
                                boxShadow: (!isMovementDone || (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))) 
                                    ? 'none' 
                                    : '0 4px 14px rgba(245, 158, 11, 0.28)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                opacity: (!isMovementDone || (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))) ? 0.65 : 1,
                                cursor: (!isMovementDone || (entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(exitingCount, 10) || 1, entryTags.length))) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Recording...
                                </>
                            ) : (
                                <>
                                    <i className={`fa ${!isMovementDone ? 'fa-lock' : 'fa-user-minus'} me-2`}></i>
                                    {!isMovementDone ? `Movement Pending (${entry.employee_name || 'Host'})` : `Confirm Partially Exited (${exitingCount})`}
                                </>
                            )}
                        </button>
                    </>
                ) : mode === 'selective' ? (
                    <div className="d-flex align-items-center justify-content-between flex-wrap w-100" style={{ gap: '14px' }}>
                        {/* Departure Summary Badges (Details displayed outside the button) */}
                        <div className="d-flex align-items-center flex-wrap" style={{ gap: '8px' }}>
                            {includePerson && currentInside > 0 && (
                                <span 
                                    className="badge rounded-pill d-inline-flex align-items-center"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                        color: isDark ? '#34d399' : '#059669',
                                        border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                    }}
                                >
                                    <i className={`fa ${!includeVehicle ? 'fa-walking' : 'fa-users'}`} style={{ marginRight: '6px' }}></i>
                                    <span>{selectivePersonCount} {selectivePersonCount == 1 ? 'Person' : 'Persons'} {!includeVehicle ? '(On Foot)' : ''}</span>
                                </span>
                            )}

                            {includeVehicle ? (
                                <span 
                                    className="badge rounded-pill d-inline-flex align-items-center"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                        color: isDark ? '#34d399' : '#059669',
                                        border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                    }}
                                >
                                    <i className="fa fa-car" style={{ marginRight: '6px' }}></i>
                                    <span>{selectedVehicles.length > 0 ? selectedVehicles.join(', ') : (vehicleNumber || 'Vehicle')}</span>
                                </span>
                            ) : availableVehicles.length > 0 ? (
                                <span 
                                    className="badge rounded-pill d-inline-flex align-items-center"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 500,
                                        backgroundColor: isDark ? 'rgba(14, 165, 233, 0.1)' : '#f0f9ff',
                                        color: isDark ? '#38bdf8' : '#0284c7',
                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'}`
                                    }}
                                    title={`${availableVehicles.map(v => v.vehicle_number).join(', ')} remains parked on campus grounds`}
                                >
                                    <i className="fa fa-parking" style={{ marginRight: '6px' }}></i>
                                    <span>Vehicle Parked</span>
                                </span>
                            ) : null}

                            {includeEquipment && selectedEquipmentIds.length > 0 && (
                                <span 
                                    className="badge rounded-pill d-inline-flex align-items-center"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        backgroundColor: isDark ? 'rgba(10, 80, 15, 0.12)' : '#ecfdf5',
                                        color: isDark ? '#34d399' : '#059669',
                                        border: `1px solid ${isDark ? 'rgba(10, 80, 15, 0.3)' : '#a7f3d0'}`
                                    }}
                                >
                                    <i className="fa fa-tools" style={{ marginRight: '6px' }}></i>
                                    <span>{selectedEquipmentIds.length} {selectedEquipmentIds.length == 1 ? 'Tool' : 'Tools'}</span>
                                </span>
                            )}
                        </div>

                        {/* Buttons (Right aligned) */}
                        <div className="d-flex align-items-center ms-auto" style={{ gap: '10px' }}>
                            <button
                                type="button"
                                className="btn btn-back-custom"
                                onClick={currentInside > 0 ? () => setMode('initial') : onHide}
                                disabled={submitting}
                                style={{
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
                                    color: isDark ? '#cbd5e1' : '#475569',
                                    fontWeight: 500,
                                    fontSize: '14px',
                                    padding: '10px 20px',
                                    minHeight: '44px',
                                    borderRadius: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <i className={`fa ${currentInside > 0 ? 'fa-arrow-left' : 'fa-times'}`} style={{ marginRight: '7px' }}></i>
                                <span>{currentInside > 0 ? 'Back' : 'Cancel'}</span>
                            </button>

                            <button
                                type="button"
                                className="btn btn-all-exit-custom"
                                onClick={handleConfirmSelectiveExit}
                                disabled={
                                    submitting || 
                                    !isMovementDone ||
                                    (!includeVehicle && !includePerson && !includeEquipment) ||
                                    (includeVehicle && !vehicleNumber.trim() && selectedVehicles.length === 0) || 
                                    (includePerson && currentInside > 0 && (!selectivePersonCount || selectivePersonCount < 1 || selectivePersonCount > currentInside)) ||
                                    (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length)) ||
                                    (!includeVehicle && !includePerson && includeEquipment && selectedEquipmentIds.length === 0)
                                }
                                title={
                                    !isMovementDone 
                                        ? `Host official (${entry.employee_name || 'Host'}) must mark movement completed first.` 
                                        : (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length))
                                            ? `Please tick all ${Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length)} physical tag(s) being surrendered by departing person(s).`
                                            : undefined
                                }
                                style={{ 
                                    background: (!isMovementDone || (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length)))
                                        ? (isDark ? '#334155' : '#cbd5e1')
                                        : 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                    border: 'none',
                                    color: '#ffffff',
                                    borderRadius: '8px', 
                                    padding: '10px 26px', 
                                    minHeight: '44px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    boxShadow: (!isMovementDone || (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length)))
                                        ? 'none'
                                        : '0 4px 14px rgba(10, 80, 15, 0.28)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    opacity: (!isMovementDone || (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length))) ? 0.65 : 1,
                                    cursor: (!isMovementDone || (includePerson && currentInside > 0 && entryTags.length > 0 && selectedReturnedTagIds.length !== Math.min(parseInt(selectivePersonCount, 10) || 1, entryTags.length))) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {submitting ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        <span>Recording Exit...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className={`fa ${!isMovementDone ? 'fa-lock' : 'fa-check'}`} style={{ marginRight: '7px' }}></i>
                                        <span>{!isMovementDone ? 'Movement Pending' : 'Confirm Exit'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            className="btn btn-close-custom"
                            onClick={onHide}
                            disabled={submitting}
                            style={{
                                backgroundColor: '#0a500f',
                                border: 'none',
                                color: '#ffffff',
                                fontWeight: 500,
                                fontSize: '14.5px',
                                padding: '12px 30px',
                                minHeight: '46px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center'
                            }}
                        >
                            Cancel
                        </button>

                        {/* Button: Custom Exit (custom departure for vehicle, tools, and persons) */}
                        {(hasAvailableVehicle || hasEquipments) && (
                            <button
                                type="button"
                                className="btn btn-warning text-dark font-w600"
                                style={{ 
                                    backgroundColor: !isMovementDone ? '#cbd5e1' : '#f59e0b',
                                    border: 'none',
                                    color: '#1e293b',
                                    borderRadius: '10px', 
                                    padding: '12px 22px', 
                                    minHeight: '46px',
                                    fontWeight: 600, 
                                    fontSize: '14px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    opacity: !isMovementDone ? 0.55 : 1,
                                    cursor: !isMovementDone ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => {
                                    if (!isMovementDone) return;
                                    setSelectiveSubMode(hasAvailableVehicle ? 'vehicle' : 'equipment');
                                    setIncludeVehicle(hasAvailableVehicle);
                                    setIncludePerson(currentInside > 0);
                                    setIncludeEquipment(hasAvailableEquipment);
                                    setSelectivePersonCount(currentInside > 0 ? currentInside : 0);
                                    if (availableVehicles.length > 0) {
                                        const firstVeh = availableVehicles[0].vehicle_number || '';
                                        setVehicleNumber(firstVeh);
                                        setSelectedVehicles(firstVeh ? [firstVeh] : []);
                                    }
                                    // Pre-select all available tools for departure tracking
                                    if (hasAvailableEquipment && availableEquipments.length > 0) {
                                        setSelectedEquipmentIds(availableEquipments.map(eq => eq.id || eq.value).filter(Boolean));
                                    } else {
                                        setSelectedEquipmentIds([]);
                                    }
                                    setMode('selective');
                                }}
                                disabled={submitting || !isMovementDone}
                                title={!isMovementDone ? `Movement pending completion by host employee (${entry.employee_name || 'Host'})` : 'Customize exit for vehicles, tools, and persons'}
                            >
                                <i className={`fa ${!isMovementDone ? 'fa-lock' : 'fa-sliders-h'} me-2`}></i> Custom Exit
                            </button>
                        )}

                        {/* Button 1: Partially Exited (temporarily hidden as requested) */}
                        {false && canPartialExit && (
                            <button
                                type="button"
                                className="btn btn-partial-custom"
                                onClick={() => {
                                    if (!isMovementDone) return;
                                    setExitingCount(1);
                                    setVehicleNumber('');
                                    if (entryTags.length > 0) {
                                        setSelectedReturnedTagIds([entryTags[0].id]);
                                        setTagReceived(true);
                                    } else {
                                        setSelectedReturnedTagIds([]);
                                        setTagReceived(false);
                                    }
                                    setMode('questions');
                                }}
                                disabled={submitting || !isMovementDone}
                                title={!isMovementDone ? `Movement pending completion by host employee (${entry.employee_name || 'Host'})` : undefined}
                                style={{
                                    background: !isMovementDone ? '#cbd5e1' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    border: 'none',
                                    color: '#ffffff',
                                    fontWeight: 600,
                                    fontSize: '14.5px',
                                    padding: '12px 30px',
                                    minHeight: '46px',
                                    borderRadius: '10px',
                                    boxShadow: !isMovementDone ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.28)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    opacity: !isMovementDone ? 0.55 : 1,
                                    cursor: !isMovementDone ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <i className={`fa ${!isMovementDone ? 'fa-lock' : 'fa-user-minus'} me-2`}></i> Partially Exited
                            </button>
                        )}

                        {/* Button 2: Exit (always available for full checkout) */}
                        <button
                            type="button"
                            className="btn btn-all-exit-custom"
                            onClick={handleFullExit}
                            disabled={submitting || !isMovementDone || (entryTags.length > 0 && !allTagsReturned) || (isCompanyVehicle && ((checkoutPurpose === 'other' && !purposeNote.trim()) || (checkoutPurpose === 'delivery' && !deliveryNoteNumber.trim())))}
                            title={
                                !isMovementDone 
                                    ? `Host official (${entry.employee_name || 'concerned staff'}) must mark movement completed first.` 
                                    : ((entryTags.length > 0 && !allTagsReturned) 
                                        ? (entryTags.length === 1 
                                            ? `Please check the box confirming physical Tag #${entryTags[0].tag_number} is received back.` 
                                            : `Please confirm return of all ${entryTags.length} physical tags before completing checkout.`) 
                                        : undefined)
                            }
                            style={{
                                background: 'linear-gradient(135deg, #0a500f 0%, #20b876 100%)',
                                border: 'none',
                                color: '#ffffff',
                                fontWeight: 600,
                                fontSize: '14.5px',
                                padding: '12px 32px',
                                minHeight: '46px',
                                borderRadius: '10px',
                                boxShadow: '0 4px 14px rgba(10, 80, 15, 0.28)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                ...((!isMovementDone || (entryTags.length > 0 && !allTagsReturned) || (isCompanyVehicle && ((checkoutPurpose === 'other' && !purposeNote.trim()) || (checkoutPurpose === 'delivery' && !deliveryNoteNumber.trim())))) ? { opacity: 0.55, cursor: 'not-allowed' } : {})
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <i className={`fa ${!isMovementDone ? 'fa-lock' : 'fa-sign-out-alt'} me-2`}></i>
                                    {!isMovementDone ? 'Movement Pending' : (canPartialExit ? 'All Exited' : 'Exit')}
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>

            <style>{`
                .checkout-custom-modal.modal-dialog {
                    max-width: 820px !important;
                    width: 95% !important;
                    margin: 2rem auto !important;
                }
                @media (min-width: 992px) {
                    .checkout-custom-modal.modal-dialog {
                        max-width: 860px !important;
                    }
                }
                @media (min-width: 1400px) {
                    .checkout-custom-modal.modal-dialog {
                        max-width: 880px !important;
                    }
                }
                .item-custom-modal .modal-content {
                    border-radius: 20px !important;
                    border: none !important;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.16) !important;
                    overflow: hidden !important;
                }
                .item-custom-modal .modal-header-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 26px 36px 20px 36px !important;
                    border-bottom: 1px solid #f1f5f9 !important;
                    background-color: #ffffff !important;
                    width: 100% !important;
                }
                .item-custom-modal .modal-icon-circle {
                    width: 52px !important;
                    height: 52px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    flex-shrink: 0 !important;
                }
                .item-custom-modal .modal-close-x {
                    border: none !important;
                    background: #f1f5f9 !important;
                    width: 36px !important;
                    height: 36px !important;
                    border-radius: 10px !important;
                    font-size: 24px !important;
                    color: #64748b !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    line-height: 1 !important;
                }
                .item-custom-modal .modal-close-x:hover {
                    background: #fee2e2 !important;
                    color: #ef4444 !important;
                }
                .item-custom-modal .modal-body-custom {
                    padding: 30px 36px !important;
                    background-color: #ffffff !important;
                }
                .item-custom-modal .form-label-custom {
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    color: #4a5568 !important;
                    margin-bottom: 8px !important;
                }
                .item-custom-modal .form-control-custom {
                    border: 1px solid #cbd5e1 !important;
                    border-radius: 10px !important;
                    padding: 10px 16px !important;
                    font-size: 14px !important;
                    color: #334155 !important;
                    background-color: #fff !important;
                    transition: border-color 0.2s, box-shadow 0.2s !important;
                    width: 100%;
                }
                .item-custom-modal .form-control-custom:focus {
                    outline: none !important;
                    border-color: #0a500f !important;
                    box-shadow: 0 0 0 3px rgba(10, 80, 15, 0.15) !important;
                }
                .item-custom-modal .modal-footer-custom {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                    padding: 22px 36px 26px 36px !important;
                    border-top: 1px solid #f1f5f9 !important;
                    background-color: #fafbfc !important;
                    gap: 16px !important;
                }

                /* ── Theme Buttons ── */
                .btn-close-custom {
                    background-color: var(--cancel-btn-color, #dc3545) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 500 !important;
                    font-size: 14.5px !important;
                    padding: 12px 30px !important;
                    min-height: 46px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                    cursor: pointer !important;
                }
                .btn-close-custom:hover, .btn-close-custom:active, .btn-close-custom:focus { background-color: var(--cancel-btn-color, #dc3545) !important; border-color: var(--cancel-btn-color, #dc3545) !important; opacity: 1 !important; box-shadow: none !important; }
                .btn-close-custom:disabled {
                    opacity: 0.65 !important;
                    cursor: not-allowed !important;
                }

                .btn-partial-custom {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14.5px !important;
                    padding: 12px 30px !important;
                    min-height: 46px !important;
                    border-radius: 10px !important;
                    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.28) !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    cursor: pointer !important;
                }
                .btn-partial-custom:hover:not(:disabled) {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 6px 18px rgba(245, 158, 11, 0.38) !important;
                    color: #ffffff !important;
                }
                .btn-partial-custom:disabled {
                    opacity: 0.6 !important;
                    cursor: not-allowed !important;
                }

                .btn-all-exit-custom {
                    background: linear-gradient(135deg, #0a500f 0%, #20b876 100%) !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-weight: 600 !important;
                    font-size: 14.5px !important;
                    padding: 12px 32px !important;
                    min-height: 46px !important;
                    border-radius: 10px !important;
                    box-shadow: 0 4px 14px rgba(10, 80, 15, 0.28) !important;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    cursor: pointer !important;
                }
                .btn-all-exit-custom:hover:not(:disabled) {
                    transform: translateY(-1px) !important;
                    box-shadow: 0 6px 18px rgba(10, 80, 15, 0.38) !important;
                    color: #ffffff !important;
                }
                .btn-all-exit-custom:disabled {
                    opacity: 0.6 !important;
                    cursor: not-allowed !important;
                }

                .btn-back-custom {
                    background-color: #f1f5f9 !important;
                    border: 1px solid #cbd5e1 !important;
                    color: #475569 !important;
                    font-weight: 500 !important;
                    font-size: 14.5px !important;
                    padding: 12px 24px !important;
                    min-height: 46px !important;
                    border-radius: 10px !important;
                    transition: all 0.2s ease !important;
                }
                .btn-back-custom:hover:not(:disabled) {
                    background-color: #e2e8f0 !important;
                    color: #1e293b !important;
                }

                /* Dark mode support */
                .dark-mode-modal .modal-content {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-header-custom {
                    background-color: #1e293b !important;
                    border-bottom-color: #334155 !important;
                }
                .dark-mode-modal .modal-body-custom {
                    background-color: #1e293b !important;
                    color: #f8fafc !important;
                }
                .dark-mode-modal .modal-footer-custom {
                    background-color: #0f172a !important;
                    border-top-color: #334155 !important;
                }
                .dark-mode-modal .form-control-custom {
                    background-color: #0f172a !important;
                    border-color: #334155 !important;
                    color: #f8fafc !important;
                }
            `}</style>
        </Modal>
    );
};

export default CheckoutModal;
