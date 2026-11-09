import React, { useState, useEffect, Fragment, useContext, useCallback } from 'react';

import { Card, Button, Form, Row, Col, Table, Modal, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Swal from 'sweetalert2';
import Select from 'react-select';
import { ThemeContext } from '../../../context/ThemeContext';
import {
    getLedgers,
    getAccountGroups,
    bulkMapPriceList,
    getPriceListMappings,
    deletePriceListMapping,
    updatePriceListMapping
} from '../../../services/FinanceService';
import { getPriceLists } from '../../../services/InventoryService';
import { formatDate } from '../../../utils/dateUtils';
import { usePermission } from '../../../hooks/usePermission';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import CreateButton from '../../../components/permissions/CreateButton';
import CompanyDatePicker from '../Common/CompanyDatePicker.jsx';

const getDebtorCreditorGroupIds = (groups) => {
    if (!groups || !Array.isArray(groups)) return new Set();
    const targetNames = ['sundry debtors', 'sundry creditors', 'sundry debtor', 'sundry creditor', 'debtors', 'creditors', 'debtor', 'creditor'];
    const validIds = new Set();
    const rootGroups = groups.filter(g => {
        const name = (g.name || '').toLowerCase().trim();
        return targetNames.some(t => name === t || name.includes(t));
    });
    rootGroups.forEach(rg => {
        validIds.add(rg.id);
        validIds.add(String(rg.id));
        validIds.add(Number(rg.id));
    });
    let added;
    do {
        added = false;
        groups.forEach(g => {
            const parentId = g.parent || g.parent_id;
            if (parentId && (validIds.has(parentId) || validIds.has(String(parentId)) || validIds.has(Number(parentId)))) {
                if (!validIds.has(g.id)) {
                    validIds.add(g.id);
                    validIds.add(String(g.id));
                    validIds.add(Number(g.id));
                    added = true;
                }
            }
        });
    } while (added);
    return validIds;
};

const PriceListMapping = () => {
    const { can } = usePermission();
    const { background } = useContext(ThemeContext);
    const isDark = background?.value === 'dark';

    const [ledgers, setLedgers] = useState([]);
    const [priceLists, setPriceLists] = useState([]);
    const [accountGroups, setAccountGroups] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form selection states
    const [selectedPriceList, setSelectedPriceList] = useState(null);
    const [applicableDate, setApplicableDate] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedLedgerIds, setSelectedLedgerIds] = useState([]);
    const [selectedSourceMappingKey, setSelectedSourceMappingKey] = useState('');

    // Keep track of what was initially selected for the chosen PriceList + Date
    const [initialLedgerIdsForPriceList, setInitialLedgerIdsForPriceList] = useState([]);

    // Form Modal state
    const [showFormModal, setShowFormModal] = useState(false);

    // Bulk Edit Mapping states
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [originalMappingDetails, setOriginalMappingDetails] = useState(null);

    // Modal to view all mapped ledgers list states
    const [showViewLedgersModal, setShowViewLedgersModal] = useState(false);
    const [selectedMappingForView, setSelectedMappingForView] = useState(null);
    const [viewLedgersSearchTerm, setViewLedgersSearchTerm] = useState('');

    // Mappings table states
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Group mappings by unique combination of (price_list_id, applicable_date)
    const groupedMappings = React.useMemo(() => {
        const groups = {};
        mappings.forEach(item => {
            const key = `${item.price_list}_${item.applicable_date}`;
            if (!groups[key]) {
                groups[key] = {
                    key: key,
                    price_list: item.price_list,
                    price_list_name: item.price_list_name,
                    applicable_date: item.applicable_date,
                    ledger_count: 0,
                    ledgers: []
                };
            }
            groups[key].ledger_count += 1;
            groups[key].ledgers.push({
                id: item.ledger,
                name: item.ledger_name,
                account_group_name: item.account_group_name
            });
        });
        return Object.values(groups);
    }, [mappings]);

    const fetchCheckedStates = useCallback(async () => {
        if (!selectedPriceList || !applicableDate) {
            setSelectedLedgerIds([]);
            setInitialLedgerIdsForPriceList([]);
            return;
        }

        try {
            const activeMappings = await getPriceListMappings({
                applicable_date: applicableDate,
                price_list_id: selectedPriceList.id
            });
            const mappedIds = activeMappings.map(m => m.ledger);
            setSelectedLedgerIds(mappedIds);
            setInitialLedgerIdsForPriceList(mappedIds);
        } catch (error) {
            console.error("Error fetching active mappings:", error);
        }
    }, [selectedPriceList, applicableDate]);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [ledgersData, priceListsData, groupsData, mappingsData] = await Promise.all([
                getLedgers(),
                getPriceLists(),
                getAccountGroups(),
                getPriceListMappings()
            ]);
            setLedgers(ledgersData);
            setPriceLists(priceListsData);
            setAccountGroups(groupsData);
            setMappings(mappingsData);
        } catch (error) {
            console.error("Error fetching data:", error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load page data' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch active mapping selections whenever price list or date changes
    useEffect(() => {
        if (!bulkEditMode) {
            fetchCheckedStates();
        }
    }, [bulkEditMode, fetchCheckedStates]);

    // When price list changes, pre-fill selected price list and reset date or set default
    const handlePriceListChange = (selectedOption) => {
        const plId = selectedOption ? selectedOption.value : null;
        const pl = priceLists.find(p => String(p.id) === String(plId)) || null;
        setSelectedPriceList(pl);
        setApplicableDate(pl ? pl.applicable_date : '');
    };

    // Build options for copying ledgers from previously mapped price lists
    const sourceMappingOptions = React.useMemo(() => {
        return groupedMappings.map(g => ({
            value: g.key,
            label: `${g.price_list_name}${g.applicable_date ? ` (${formatDate(g.applicable_date)})` : ''} — ${g.ledger_count} ${g.ledger_count === 1 ? 'Ledger' : 'Ledgers'}`
        }));
    }, [groupedMappings]);

    // Handle copying mapped ledgers from a selected previous price list mapping
    const handleSourceMappingChange = (selectedOption) => {
        const key = selectedOption ? selectedOption.value : '';
        setSelectedSourceMappingKey(key);
        if (!key) return;

        const sourceGroup = groupedMappings.find(g => g.key === key);
        if (sourceGroup && Array.isArray(sourceGroup.ledgers)) {
            const copiedIds = sourceGroup.ledgers.map(l => l.id);
            setSelectedLedgerIds(copiedIds);
            Swal.fire({
                icon: 'success',
                title: 'Ledgers Copied',
                text: `Loaded ${copiedIds.length} ledger(s) from "${sourceGroup.price_list_name}". You can tick more or untick ledgers now.`,
                timer: 2000,
                showConfirmButton: false,
                position: 'center'
            });
        }
    };

    const debtorCreditorGroupIds = React.useMemo(() => getDebtorCreditorGroupIds(accountGroups), [accountGroups]);

    const debtorCreditorAccountGroups = React.useMemo(() => {
        return accountGroups.filter(g => debtorCreditorGroupIds.has(g.id) || debtorCreditorGroupIds.has(String(g.id)) || debtorCreditorGroupIds.has(Number(g.id)));
    }, [accountGroups, debtorCreditorGroupIds]);

    const debtorCreditorLedgers = React.useMemo(() => {
        return ledgers.filter(ledger => {
            const gVal = ledger.accountGroup ?? ledger.account_group;
            if (gVal && (debtorCreditorGroupIds.has(gVal) || debtorCreditorGroupIds.has(String(gVal)) || debtorCreditorGroupIds.has(Number(gVal)))) return true;
            const gName = (ledger.account_group_name || ledger.accountGroup?.name || ledger.group_name || '').toLowerCase().trim();
            return gName.includes('debtor') || gName.includes('deptor') || gName.includes('creditor');
        });
    }, [ledgers, debtorCreditorGroupIds]);

    // Filter ledgers shown in the checklist based on Account Group selection (Sundry Debtors & Creditors)
    const filteredLedgersForChecklist = React.useMemo(() => {
        return debtorCreditorLedgers.filter(ledger => {
            if (!selectedGroup) return true;
            return String(ledger.accountGroup ?? ledger.account_group) === String(selectedGroup);
        });
    }, [debtorCreditorLedgers, selectedGroup]);

    const handleCheckboxChange = (ledgerId) => {
        setSelectedLedgerIds(prev => {
            if (prev.includes(ledgerId)) {
                return prev.filter(id => id !== ledgerId);
            } else {
                return [...prev, ledgerId];
            }
        });
    };

    const handleSelectAllAction = (select) => {
        const visibleIds = filteredLedgersForChecklist.map(l => l.id);
        if (select) {
            setSelectedLedgerIds(prev => {
                const newSelection = [...prev];
                visibleIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                        newSelection.push(id);
                    }
                });
                return newSelection;
            });
        } else {
            setSelectedLedgerIds(prev => prev.filter(id => !visibleIds.includes(id)));
        }
    };

    const handleSaveMapping = async () => {
        if (!selectedPriceList) {
            Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please select a Price List.' });
            return;
        }
        if (!applicableDate) {
            Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please enter an Applicable Date.' });
            return;
        }

        try {
            setSubmitting(true);
            
            const visibleIds = filteredLedgersForChecklist.map(l => l.id);
            const ledgerIdsToMap = selectedLedgerIds.filter(id => visibleIds.includes(id));
            const unmapLedgerIds = initialLedgerIdsForPriceList.filter(id => 
                visibleIds.includes(id) && !selectedLedgerIds.includes(id)
            );

            await bulkMapPriceList({
                price_list_id: selectedPriceList.id,
                applicable_date: applicableDate,
                ledger_ids: ledgerIdsToMap,
                unmap_ledger_ids: unmapLedgerIds
            });

            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Price list mappings saved successfully',
                timer: 1500,
                showConfirmButton: false
            });

            setShowFormModal(false);

            // Reload all mappings list
            const updatedMappings = await getPriceListMappings();
            setMappings(updatedMappings);

            // Re-fetch checked states
            await fetchCheckedStates();

        } catch (error) {
            console.error("Error mapping price list:", error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to map price list.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnmapGroup = async (mapping) => {
        const result = await Swal.fire({
            title: 'Delete Mappings?',
            text: `Are you sure you want to remove all ${mapping.ledger_count} ledger mappings for "${mapping.price_list_name}" on ${mapping.applicable_date}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete mappings'
        });

        if (result.isConfirmed) {
            try {
                await deletePriceListMapping(null, {
                    price_list_id: mapping.price_list,
                    applicable_date: mapping.applicable_date
                });
                Swal.fire({ icon: 'success', title: 'Deleted', text: 'Mappings deleted successfully', timer: 1500, showConfirmButton: false });
                
                // Reload mappings table
                const updatedMappings = await getPriceListMappings();
                setMappings(updatedMappings);
                
                // Refresh checked states
                await fetchCheckedStates();
            } catch (error) {
                console.error("Error deleting group mappings:", error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete mapping records.' });
            }
        }
    };

    const handleAddNewClick = () => {
        setBulkEditMode(false);
        setOriginalMappingDetails(null);
        setSelectedPriceList(null);
        setApplicableDate('');
        setSelectedLedgerIds([]);
        setInitialLedgerIdsForPriceList([]);
        setSelectedSourceMappingKey('');
        setShowFormModal(true);
    };

    const handleCloseFormModal = () => {
        setShowFormModal(false);
        setBulkEditMode(false);
        setOriginalMappingDetails(null);
        setSelectedPriceList(null);
        setApplicableDate('');
        setSelectedLedgerIds([]);
        setInitialLedgerIdsForPriceList([]);
        setSelectedSourceMappingKey('');
    };

    const handleLoadMappingDetails = async (mapping) => {
        setBulkEditMode(true);
        setOriginalMappingDetails({
            price_list_id: mapping.price_list,
            price_list_name: mapping.price_list_name,
            applicable_date: mapping.applicable_date
        });

        const pl = priceLists.find(p => String(p.id) === String(mapping.price_list));
        setSelectedPriceList(pl || { id: mapping.price_list, name: mapping.price_list_name });
        setApplicableDate(mapping.applicable_date);

        setShowFormModal(true);

        // Force fetch checklist for this specific loaded mapping
        try {
            const activeMappings = await getPriceListMappings({
                applicable_date: mapping.applicable_date,
                price_list_id: mapping.price_list
            });
            const mappedIds = activeMappings.map(m => m.ledger);
            setSelectedLedgerIds(mappedIds);
            setInitialLedgerIdsForPriceList(mappedIds);
        } catch (error) {
            console.error("Error loading checklist for mapping:", error);
        }
    };



    const handleSaveBulkUpdate = async () => {
        if (!selectedPriceList) {
            Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please select a Price List.' });
            return;
        }
        if (!applicableDate) {
            Swal.fire({ icon: 'warning', title: 'Selection Required', text: 'Please enter an Applicable Date.' });
            return;
        }

        try {
            setSubmitting(true);
            await updatePriceListMapping(null, {
                old_price_list_id: originalMappingDetails.price_list_id,
                old_applicable_date: originalMappingDetails.applicable_date,
                new_price_list_id: selectedPriceList.id,
                new_applicable_date: applicableDate,
                ledger_ids: selectedLedgerIds
            });

            Swal.fire({
                icon: 'success',
                title: 'Updated',
                text: 'Price list mappings updated successfully',
                timer: 1500,
                showConfirmButton: false
            });

            setBulkEditMode(false);
            setOriginalMappingDetails(null);
            setShowFormModal(false);

            // Reload all mappings list
            const updatedMappings = await getPriceListMappings();
            setMappings(updatedMappings);

            // Re-fetch checked states
            await fetchCheckedStates();

        } catch (error) {
            console.error("Error updating bulk mapping:", error);
            const errorMsg = error.response?.data?.detail || 'Failed to update bulk price list mappings.';
            Swal.fire({ icon: 'error', title: 'Error', text: errorMsg });
        } finally {
            setSubmitting(false);
        }
    };

    const filteredMappings = groupedMappings.filter(mapping => 
        (mapping.price_list_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mapping.applicable_date || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedMappings = filteredMappings.slice(startIndex, startIndex + itemsPerPage);

    // react-select custom styles
    const customSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: isDark ? '#24292D' : '#ffffff',
            borderColor: state.isFocused 
                ? 'var(--cc-primary, #2bc155)' 
                : (isDark ? '#636363' : '#ececec'),
            color: isDark ? '#ffffff' : '#2f3f50',
            minHeight: '45px',
            height: '45px',
            borderRadius: '0.5rem',
            boxShadow: 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'var(--cc-primary, #2bc155)' : (isDark ? '#636363' : '#ececec'),
            }
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0.1rem 1rem',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
            fontSize: '14px',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: isDark ? '#888888' : '#7e7e7e',
            fontSize: '14px',
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: isDark ? '#2F363E' : '#ffffff',
            borderColor: isDark ? '#636363' : '#ececec',
            zIndex: 9999
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--cc-primary, #2bc155)'
                : state.isFocused
                    ? (isDark ? '#24292D' : '#f8f9fa')
                    : 'transparent',
            color: state.isSelected
                ? '#ffffff'
                : (isDark ? '#ffffff' : '#2f3f50'),
            cursor: 'pointer',
            '&:active': {
                backgroundColor: 'var(--cc-primary, #2bc155)',
                color: '#ffffff'
            }
        }),
        input: (provided) => ({
            ...provided,
            color: isDark ? '#ffffff' : '#2f3f50',
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (provided) => ({
            ...provided,
            color: isDark ? '#636363' : '#ececec',
            '&:hover': {
                color: isDark ? '#ffffff' : '#7e7e7e'
            }
        })
    };

    const visibleLedgerIds = filteredLedgersForChecklist.map(l => l.id);
    const allVisibleSelected = visibleLedgerIds.length > 0 && visibleLedgerIds.every(id => selectedLedgerIds.includes(id));



    return (
        <div className="container-fluid">

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <Row>
                    {/* Full Width Column: Separate Table for Mappings */}
                    <Col lg={12}>
                        <Card>
                            <Card.Header className="d-flex align-items-center justify-content-between border-0 pb-0">
                                <div>
                                    <Card.Title className="mb-0">Mapped Ledgers History</Card.Title>
                                    <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Currently configured mappings history</p>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <div style={{ width: '300px', position: 'relative' }}>
                                        <i className="fa fa-search position-absolute text-muted" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}></i>
                                        <Form.Control
                                            type="text"
                                            placeholder="Search mapping..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                                        />
                                    </div>
                                    <CreateButton module="finance" onClick={handleAddNewClick}>
                                     Mapping
                                    </CreateButton>
                                </div>
                            </Card.Header>
                            <Card.Body>

                                <div className="table-responsive" style={{ minHeight: '350px' }}>
                                    <Table hover className="align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '60px', padding: '12px 16px', fontSize: '13px' }}><strong>SL NO</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>PRICE LIST</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>APPLICABLE DATE</strong></th>
                                                <th style={{ padding: '12px 16px', fontSize: '13px' }}><strong>MAPPED LEDGERS</strong></th>
                                                <th className="text-end" style={{ padding: '12px 16px', fontSize: '13px' }}><strong>ACTION</strong></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredMappings.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" className="text-center py-5 text-muted" style={{ padding: '10px 16px' }}>No mappings found</td>
                                                </tr>
                                            ) : (
                                                paginatedMappings.map((mapping, idx) => (
                                                    <tr key={mapping.key}>
                                                        <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}><strong>{startIndex + idx + 1}</strong></td>
                                                        <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}><strong>{mapping.price_list_name}{mapping.applicable_date ? ` (${formatDate(mapping.applicable_date)})` : ''}</strong></td>
                                                        <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>{mapping.applicable_date ? formatDate(mapping.applicable_date) : '-'}</td>
                                                        <td style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                            <OverlayTrigger
                                                                placement="top"
                                                                overlay={
                                                                    <Tooltip id={`tooltip-${mapping.key}`}>
                                                                        <div style={{ textAlign: 'left', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                                                                            {mapping.ledgers.map((l, idx) => (
                                                                                <div key={idx}>{l.name}</div>
                                                                            ))}
                                                                        </div>
                                                                    </Tooltip>
                                                                }
                                                            >
                                                                <span 
                                                                    className="badge badge-light light text-muted font-w600 mb-1" 
                                                                    style={{ fontSize: '13px', cursor: 'pointer' }}
                                                                    onClick={() => {
                                                                        setSelectedMappingForView(mapping);
                                                                        setShowViewLedgersModal(true);
                                                                    }}
                                                                    title="Click to view all"
                                                                >
                                                                    {mapping.ledger_count} {mapping.ledger_count === 1 ? 'Ledger' : 'Ledgers'}
                                                                </span>
                                                            </OverlayTrigger>
                                                            <div 
                                                                className="text-muted" 
                                                                style={{ fontSize: '11px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                                onClick={() => {
                                                                    setSelectedMappingForView(mapping);
                                                                    setShowViewLedgersModal(true);
                                                                }}
                                                                title="Click to view all mapped ledgers"
                                                            >
                                                                {mapping.ledgers.map(l => l.name).slice(0, 3).join(', ') + (mapping.ledgers.length > 3 ? ` and ${mapping.ledgers.length - 3} more` : '')}
                                                            </div>
                                                        </td>
                                                        <td className="text-end" style={{ padding: '10px 16px', verticalAlign: 'middle' }}>
                                                            {can('finance', 'edit') || can('finance', 'delete') ? (
                                                                <div className="d-flex justify-content-end gap-1">
                                                                    <EditButton 
                                                                        module="finance" 
                                                                        onClick={() => handleLoadMappingDetails(mapping)} 
                                                                        className="me-1" 
                                                                    />
                                                                    <DeleteButton 
                                                                        module="finance" 
                                                                        onClick={() => handleUnmapGroup(mapping)} 
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <span className="badge badge-danger light">No Access</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>

                                {filteredMappings.length > 0 && (
                                    <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top flex-wrap gap-2 mb-3">
                                        <span className="text-muted" style={{ fontSize: '13px' }}>
                                            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredMappings.length)} of {filteredMappings.length} mappings
                                        </span>
                                        {totalPages > 1 && (
                                            <div className="d-flex gap-1">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                >
                                                    Previous
                                                </Button>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Price List Mapping Popup Modal */}
            <Modal show={showFormModal} onHide={handleCloseFormModal} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-link text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1" style={{ color: isDark ? '#fff' : '#333' }}>{bulkEditMode ? 'Edit Price List Mapping' : 'Price List Mapping'}</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    {bulkEditMode
                                        ? 'Update price list, date, and mapped ledger selections'
                                        : 'Map a price list to multiple ledger accounts for a specific date'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        {/* Fields Column */}
                        <Col md={5}>
                            <Form.Group className="mb-3">
                                <Form.Label>Price List <span className="text-danger">*</span></Form.Label>
                                <Select
                                    classNamePrefix="react-select"
                                    options={priceLists.map(pl => ({
                                        value: pl.id,
                                        label: `${pl.name}${pl.applicable_date ? ` (${formatDate(pl.applicable_date)})` : ''}`
                                    }))}
                                    value={
                                        selectedPriceList
                                            ? {
                                                value: selectedPriceList.id,
                                                label: `${selectedPriceList.name}${selectedPriceList.applicable_date ? ` (${formatDate(selectedPriceList.applicable_date)})` : ''}`
                                              }
                                            : null
                                    }
                                    onChange={handlePriceListChange}
                                    placeholder="Select Price List..."
                                    isSearchable
                                    styles={customSelectStyles}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>Applicable Date <span className="text-danger">*</span></Form.Label>
                                <CompanyDatePicker
                                    name="applicableDate"
                                    value={applicableDate}
                                    onChange={(e, val) => setApplicableDate(val || (e && e.target ? e.target.value : ''))}
                                    disabled={!selectedPriceList}
                                    style={{ height: '45px', borderRadius: '0.5rem', backgroundColor: isDark ? '#24292D' : '#ffffff', color: isDark ? '#fff' : '#495057' }}
                                />
                            </Form.Group>

                            {sourceMappingOptions.length > 0 && (
                                <Form.Group className="mb-3">
                                    <Form.Label className="d-flex justify-content-between align-items-center">
                                        <span>Copy Previous Mapping</span>
                                        <span className="text-muted" style={{ fontSize: '11px', fontWeight: 'normal' }}>(Optional)</span>
                                    </Form.Label>
                                    <Select
                                        classNamePrefix="react-select"
                                        options={sourceMappingOptions}
                                        value={
                                            selectedSourceMappingKey
                                                ? sourceMappingOptions.find(o => o.value === selectedSourceMappingKey) || null
                                                : null
                                        }
                                        onChange={handleSourceMappingChange}
                                        placeholder="Select mapping to copy..."
                                        isSearchable
                                        isClearable
                                        styles={customSelectStyles}
                                    />
                                </Form.Group>
                            )}

                            <Form.Group className="mb-3">
                                <Form.Label>Filter by Account Group</Form.Label>
                                <Form.Select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    style={{ height: '45px', borderRadius: '0.5rem', backgroundColor: isDark ? '#24292D' : '#ffffff', borderColor: isDark ? '#636363' : '#ececec', color: isDark ? '#fff' : '#495057' }}
                                >
                                    <option value="">All Debtors & Creditors</option>
                                    {debtorCreditorAccountGroups.map(group => (
                                        <option key={group.id} value={group.id}>{group.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        {/* Checklist Column */}
                        <Col md={7} className="d-flex flex-column" style={{ minHeight: '300px' }}>
                            <Form.Label>Ledger Accounts</Form.Label>
                            <div className="border rounded p-3 d-flex flex-column flex-grow-1" style={{ minHeight: '280px', maxHeight: '350px', backgroundColor: isDark ? '#24292D' : '#fafafa' }}>
                                <div className="d-flex align-items-center justify-content-between border-bottom pb-2 mb-2 w-100">
                                    <Form.Check
                                        type="checkbox"
                                        id="select-all-ledgers"
                                        label={<strong className="ms-1" style={{ color: isDark ? '#fff' : '#2f3f50' }}>Select All</strong>}
                                        checked={allVisibleSelected}
                                        onChange={(e) => handleSelectAllAction(e.target.checked)}
                                        disabled={!selectedPriceList || !applicableDate || filteredLedgersForChecklist.length === 0}
                                    />
                                    <span className="text-muted font-w600" style={{ fontSize: '13px' }}>
                                        {selectedLedgerIds.length} Selected
                                    </span>
                                </div>

                                {!selectedPriceList ? (
                                    <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted text-center p-4">
                                        Please select a Price List first to enable mappings
                                    </div>
                                ) : !applicableDate ? (
                                    <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted text-center p-4">
                                        Please enter an Applicable Date to enable mappings
                                    </div>
                                ) : filteredLedgersForChecklist.length === 0 ? (
                                    <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted text-center p-4">
                                        No Ledgers found in this Account Group
                                    </div>
                                ) : (
                                    <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '230px' }}>
                                        {filteredLedgersForChecklist.map((ledger) => (
                                            <div key={ledger.id} className="d-flex align-items-center py-2 border-bottom border-light">
                                                <Form.Check
                                                    type="checkbox"
                                                    id={`ledger-check-${ledger.id}`}
                                                    checked={selectedLedgerIds.includes(ledger.id)}
                                                    onChange={() => handleCheckboxChange(ledger.id)}
                                                    label={
                                                        <div className="ms-2">
                                                            <div className="font-w600" style={{ color: isDark ? '#fff' : '#333' }}>{ledger.name}</div>
                                                            <small className="text-muted">{ledger.account_group_name}</small>
                                                        </div>
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseFormModal}>
                        Cancel
                    </Button>
                    {bulkEditMode ? (
                        <Button
                            variant="success"
                            onClick={handleSaveBulkUpdate}
                            disabled={submitting || !selectedPriceList || !applicableDate}
                            className="text-white"
                            style={{ backgroundColor: '#2bc155', borderColor: '#2bc155' }}
                        >
                            {submitting ? 'Updating...' : 'Update'}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleSaveMapping}
                            disabled={submitting || !selectedPriceList || !applicableDate}
                        >
                            {submitting ? 'Saving...' : 'Save'}
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Modal to view all mapped ledgers list */}
            <Modal 
                show={showViewLedgersModal} 
                onHide={() => { setShowViewLedgersModal(false); setViewLedgersSearchTerm(''); }} 
                size="md" 
                centered
            >
                <Modal.Header closeButton style={{ backgroundColor: isDark ? '#2F363E' : '#ffffff', borderBottom: isDark ? '1px solid #444' : '1px solid #dee2e6' }}>
                    <Modal.Title className="w-100">
                        <div className="d-flex align-items-center">
                            <div
                                className="d-flex align-items-center justify-content-center rounded-circle me-3 form-icon-circle"
                                style={{ width: '48px', height: '48px' }}
                            >
                                <i className="fa fa-list text-white fs-4"></i>
                            </div>
                            <div>
                                <h4 className="mb-1" style={{ color: isDark ? '#fff' : '#333' }}>Mapped Ledgers List</h4>
                                <p className="mb-0 text-muted" style={{ fontSize: '13px', fontWeight: 'normal' }}>
                                    Full list of ledgers mapped to this price list configuration
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ backgroundColor: isDark ? '#24292D' : '#ffffff' }}>
                    {selectedMappingForView && (
                        <div>
                            <div className="mb-3 p-3 rounded" style={{ backgroundColor: isDark ? '#2F363E' : '#f8f9fa', border: isDark ? '1px solid #444' : '1px solid #e9ecef' }}>
                                <div className="mb-1"><strong>Price List:</strong> <span className="text-primary">{selectedMappingForView.price_list_name}</span></div>
                                <div><strong>Applicable Date:</strong> <span className="text-primary">{selectedMappingForView.applicable_date || '-'}</span></div>
                            </div>
                            <Form.Control
                                type="text"
                                placeholder="Search mapped ledgers..."
                                value={viewLedgersSearchTerm}
                                onChange={(e) => setViewLedgersSearchTerm(e.target.value)}
                                className="mb-3"
                                style={{ height: '42px', borderRadius: '0.5rem', backgroundColor: isDark ? '#24292D' : '#ffffff', borderColor: isDark ? '#555' : '#ccc', color: isDark ? '#fff' : '#000' }}
                            />
                            <div className="border rounded" style={{ maxHeight: '350px', overflowY: 'auto', backgroundColor: isDark ? '#24292D' : '#ffffff', borderColor: isDark ? '#444' : '#dee2e6' }}>
                                {selectedMappingForView.ledgers
                                    .filter(l => l.name.toLowerCase().includes(viewLedgersSearchTerm.toLowerCase()))
                                    .map((l, index) => (
                                        <div key={l.id || index} className="py-2 px-3 border-bottom border-light d-flex align-items-center justify-content-between" style={{ borderBottomColor: isDark ? '#444' : '#f1f1f1' }}>
                                            <span className="font-w600" style={{ color: isDark ? '#fff' : '#333' }}>
                                                {index + 1}. {l.name}
                                            </span>
                                            {l.account_group_name && (
                                                <span className="badge badge-light light text-muted font-w600" style={{ fontSize: '11px' }}>
                                                    {l.account_group_name}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                {selectedMappingForView.ledgers.filter(l => l.name.toLowerCase().includes(viewLedgersSearchTerm.toLowerCase())).length === 0 && (
                                    <div className="text-center py-4 text-muted">No matching ledgers found</div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer style={{ backgroundColor: isDark ? '#2F363E' : '#ffffff', borderTop: isDark ? '1px solid #444' : '1px solid #dee2e6' }}>
                    <Button variant="secondary" onClick={() => { setShowViewLedgersModal(false); setViewLedgersSearchTerm(''); }}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default PriceListMapping;
