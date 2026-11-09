import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { Card, Form, Row, Col, Button, Modal, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import { usePageTitle } from '../../../context/TitleContext';
import CreateButton from '../../../components/permissions/CreateButton';
import EditButton from '../../../components/permissions/EditButton';
import DeleteButton from '../../../components/permissions/DeleteButton';
import { usePermission } from '../../../hooks/usePermission';

const DEFAULT_OWNER_TYPE_OPTIONS = [
  { value: 'Employee', label: 'Employee' },
  { value: 'Vendor', label: 'Vendor' },
  { value: 'Distributor', label: 'Distributor' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

const WalletCreation = () => {
  usePageTitle('Wallet Creation');
  const { can } = usePermission();

  // ──────────────────────────────────────────
  // List State
  // ──────────────────────────────────────────
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ──────────────────────────────────────────
  // Modal / Form State
  // ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);

  const [walletCode, setWalletCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);

  const [ownerTypeOptions, setOwnerTypeOptions] = useState(DEFAULT_OWNER_TYPE_OPTIONS);
  const [loadingOwnerTypes, setLoadingOwnerTypes] = useState(false);
  const [selectedOwnerType, setSelectedOwnerType] = useState(DEFAULT_OWNER_TYPE_OPTIONS[0]); // Default Employee
  const [ownersList, setOwnersList] = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const [ownerId, setOwnerId] = useState('');
  const [ownerNameText, setOwnerNameText] = useState('');
  const [walletName, setWalletName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const [openingPoints, setOpeningPoints] = useState('0');
  const [dailyDeductionLimit, setDailyDeductionLimit] = useState('0');
  const [pointsExpiryDays, setPointsExpiryDays] = useState('');
  const [pointsExpiryDate, setPointsExpiryDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(STATUS_OPTIONS[0]);
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const ownerTypeVal = (selectedOwnerType?.value || '').trim().toLowerCase();
  const isOtherType = ownerTypeVal === 'other' || ownerTypeVal === 'others';

  // ──────────────────────────────────────────
  // 1. Fetch Wallets List & Active Owner Types
  // ──────────────────────────────────────────
  const fetchOwnerTypes = useCallback(async () => {
    try {
      setLoadingOwnerTypes(true);
      const res = await WalletService.getActiveOwnerTypes();
      const list = Array.isArray(res) ? res : (res?.results || []);
      if (list && list.length > 0) {
        const dynamicOptions = list.map((ot) => ({
          value: ot.owner_type,
          label: ot.owner_type,
        }));
        setOwnerTypeOptions(dynamicOptions);
        return dynamicOptions;
      }
    } catch (err) {
      console.error('Failed to load active owner types from master:', err);
    } finally {
      setLoadingOwnerTypes(false);
    }
    return DEFAULT_OWNER_TYPE_OPTIONS;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await WalletService.getWallets();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setWallets(list);
    } catch (err) {
      console.error('Error fetching wallets:', err);
      Swal.fire('Error', 'Failed to fetch wallets list.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchOwnerTypes();
  }, [fetchData, fetchOwnerTypes]);

  // ──────────────────────────────────────────
  // 2. Fetch Next Sequential Code
  // ──────────────────────────────────────────
  const fetchNextCode = useCallback(async () => {
    try {
      setLoadingCode(true);
      const res = await WalletService.getNextWalletCode();
      if (res?.next_code) {
        setWalletCode(res.next_code);
      }
    } catch (err) {
      console.error('Failed to generate wallet code:', err);
      setWalletCode('WLT-00001');
    } finally {
      setLoadingCode(false);
    }
  }, []);

  // ──────────────────────────────────────────
  // 3. Fetch Owners
  // ──────────────────────────────────────────
  const fetchOwners = useCallback(async (ownerType) => {
    if (!ownerType) {
      setOwnersList([]);
      return;
    }
    try {
      setLoadingOwners(true);
      const data = await WalletService.getOwners(ownerType);
      const list = Array.isArray(data) ? data : (data?.results || []);
      setOwnersList(list);
    } catch (err) {
      console.error(`Failed to load ${ownerType} owners:`, err);
      setOwnersList([]);
    } finally {
      setLoadingOwners(false);
    }
  }, []);

  // ──────────────────────────────────────────
  // Modal Open/Close Handlers
  // ──────────────────────────────────────────
  const handleShowModal = async (wallet = null) => {
    setErrors({});
    const types = await fetchOwnerTypes();
    const availableTypes = (types && types.length > 0) ? types : ownerTypeOptions;

    if (wallet) {
      setEditId(wallet.id);
      setWalletCode(wallet.wallet_code || '');
      const oType = availableTypes.find((t) => t.value.toLowerCase() === (wallet.owner_type || '').toLowerCase()) ||
        { value: wallet.owner_type, label: wallet.owner_type };
      const isOther = (oType.value || '').trim().toLowerCase() === 'other' || (oType.value || '').trim().toLowerCase() === 'others';
      if (!isOther) {
        fetchOwners(oType.value);
        setSelectedOwner({
          value: wallet.owner_record_id,
          record_id: wallet.owner_record_id,
          owner_id: wallet.owner_id,
          name: wallet.wallet_name?.split(' - ')[0] || wallet.wallet_name,
          mobile: wallet.mobile,
          email: wallet.email,
          label: `${wallet.wallet_name} (${wallet.owner_id})`,
        });
      } else {
        setSelectedOwner(null);
        setOwnerNameText(wallet.wallet_name?.split(' - ')[0] || wallet.wallet_name || '');
      }
      setOwnerId(wallet.owner_id || '');
      setWalletName(wallet.wallet_name || '');
      setMobile(wallet.mobile || '');
      setEmail(wallet.email || '');
      setOpeningPoints(wallet.opening_points || '0');
      setDailyDeductionLimit(wallet.daily_deduction_limit || '0');
      setPointsExpiryDays(wallet.points_expiry_days !== null && wallet.points_expiry_days !== undefined ? String(wallet.points_expiry_days) : '');
      setPointsExpiryDate(wallet.points_expiry_date || '');
      const st = STATUS_OPTIONS.find((s) => s.value === wallet.status) || STATUS_OPTIONS[0];
      setSelectedStatus(st);
      setRemarks(wallet.remarks || '');
    } else {
      setEditId(null);
      const defaultType = availableTypes.find((t) => t.value.toLowerCase() === 'employee') || availableTypes[0] || DEFAULT_OWNER_TYPE_OPTIONS[0];
      setSelectedOwnerType(defaultType);
      setSelectedOwner(null);
      setOwnerNameText('');
      setOwnerId('');
      setWalletName('');
      setMobile('');
      setEmail('');
      setOpeningPoints('0');
      setDailyDeductionLimit('0');
      setPointsExpiryDays('');
      setPointsExpiryDate('');
      setSelectedStatus(STATUS_OPTIONS[0]);
      setRemarks('');
      fetchNextCode();
      fetchOwners(defaultType.value);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setShowModal(false);
      setEditId(null);
    }
  };

  // Reset / Clear Form inside Modal
  const handleClear = () => {
    const defaultType = ownerTypeOptions.find((t) => t.value.toLowerCase() === 'employee') || ownerTypeOptions[0] || DEFAULT_OWNER_TYPE_OPTIONS[0];
    setSelectedOwnerType(defaultType);
    setSelectedOwner(null);
    setOwnerNameText('');
    setOwnerId('');
    setWalletName('');
    setMobile('');
    setEmail('');
    setOpeningPoints('0');
    setDailyDeductionLimit('0');
    setPointsExpiryDays('');
    setPointsExpiryDate('');
    setSelectedStatus(STATUS_OPTIONS[0]);
    setRemarks('');
    setErrors({});
    if (!editId) {
      fetchNextCode();
    }
    fetchOwners(defaultType.value);
  };

  // Handle Owner Type change
  const handleOwnerTypeChange = (opt) => {
    setSelectedOwnerType(opt);
    setSelectedOwner(null);
    setOwnerNameText('');
    setOwnerId('');
    setWalletName('');
    setMobile('');
    setEmail('');
    setErrors((prev) => ({ ...prev, ownerType: null, ownerName: null }));
    const val = (opt?.value || '').trim().toLowerCase();
    if (val && val !== 'other' && val !== 'others') {
      fetchOwners(opt.value);
    } else {
      setOwnersList([]);
    }
  };

  // Handle Owner selection
  const handleOwnerChange = (opt) => {
    setSelectedOwner(opt);
    setErrors((prev) => ({ ...prev, ownerName: null }));

    if (opt) {
      const actualOwnerId = opt.owner_id || '';
      const actualName = opt.name || opt.label || '';
      setOwnerId(actualOwnerId);
      // Auto-fill: Owner Name - Wallet Code (e.g. Boby - WLT-00001)
      setWalletName(walletCode ? `${actualName} - ${walletCode}` : actualName);
      setMobile(opt.mobile || '');
      setEmail(opt.email || '');
    } else {
      setOwnerId('');
      setWalletName('');
      setMobile('');
      setEmail('');
    }
  };

  // Handle text input for Other owner name
  const handleOtherOwnerNameChange = (e) => {
    const text = e.target.value;
    setOwnerNameText(text);
    setErrors((prev) => ({ ...prev, ownerName: null }));
    if (walletCode && !editId) {
      setWalletName(text.trim() ? `${text.trim()} - ${walletCode}` : '');
    } else if (!editId) {
      setWalletName(text.trim());
    }
  };

  // Auto-update wallet name when walletCode or owner changes
  useEffect(() => {
    if (!editId && walletCode) {
      if (isOtherType && ownerNameText.trim()) {
        setWalletName(`${ownerNameText.trim()} - ${walletCode}`);
      } else if (selectedOwner) {
        const actualName = selectedOwner.name || selectedOwner.label || '';
        setWalletName(`${actualName} - ${walletCode}`);
      }
    }
  }, [walletCode, selectedOwner, ownerNameText, isOtherType, editId]);

  // Set expiry days
  const handleExpiryDaysChange = (val) => {
    setPointsExpiryDays(val);
    const numDays = parseInt(val, 10);
    if (!isNaN(numDays) && numDays > 0) {
      const target = new Date();
      target.setDate(target.getDate() + numDays);
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, '0');
      const dd = String(target.getDate()).padStart(2, '0');
      setPointsExpiryDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setPointsExpiryDate('');
    }
  };

  // Delete Wallet
  const handleDelete = async (wallet) => {
    const pointsCount = wallet?.points_entries_count || 0;
    const txnCount = wallet?.transaction_count || 0;

    if (pointsCount > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Delete Wallet',
        html: `The wallet <b>"${wallet.wallet_name}"</b> is already associated with <b>${pointsCount}</b> point ${pointsCount === 1 ? 'entry' : 'entries'}.<br/><br/><span class="text-muted small">Wallets connected to points entries cannot be deleted to preserve ledger integrity. Please deactivate the wallet instead if it is no longer in use.</span>`,
        confirmButtonColor: '#2ece8a',
        confirmButtonText: 'Understood',
      });
      return;
    }

    if (txnCount > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Delete Wallet',
        html: `The wallet <b>"${wallet.wallet_name}"</b> is already associated with <b>${txnCount}</b> financial ${txnCount === 1 ? 'transaction' : 'transactions'}.<br/><br/><span class="text-muted small">Wallets with recorded financial transactions cannot be deleted to preserve audit history. Please deactivate the wallet instead.</span>`,
        confirmButtonColor: '#2ece8a',
        confirmButtonText: 'Understood',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete Wallet?',
      text: `Are you sure you want to delete "${wallet.wallet_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it',
    });

    if (result.isConfirmed) {
      try {
        await WalletService.deleteWallet(wallet.id);
        Swal.fire('Deleted!', 'Wallet deleted successfully.', 'success');
        fetchData();
      } catch (err) {
        console.error('Failed to delete wallet:', err);
        const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to delete wallet.';
        Swal.fire('Cannot Delete', msg, 'error');
      }
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors = {};

    if (!walletCode || !walletCode.trim()) {
      newErrors.walletCode = 'Wallet Code is required.';
    }

    if (!selectedOwnerType || !selectedOwnerType.value) {
      newErrors.ownerType = 'Owner Type is mandatory.';
    }

    if (isOtherType) {
      if (!ownerNameText || !ownerNameText.trim()) {
        newErrors.ownerName = 'Owner Name is mandatory.';
      }
    } else {
      if (!selectedOwner || !selectedOwner.value) {
        newErrors.ownerName = 'Owner Name is mandatory.';
      }
    }

    const openPts = openingPoints === '' ? 0 : parseFloat(openingPoints);
    if (isNaN(openPts) || openPts < 0) {
      newErrors.openingPoints = 'Opening Points cannot be negative.';
    }

    const limit = dailyDeductionLimit === '' ? 0 : parseFloat(dailyDeductionLimit);
    if (isNaN(limit) || limit < 0) {
      newErrors.dailyDeductionLimit = 'Daily Deduction Limit cannot be negative.';
    }

    if (pointsExpiryDays) {
      const days = parseInt(pointsExpiryDays, 10);
      if (isNaN(days) || days < 0) {
        newErrors.pointsExpiryDays = 'Expiry days must be a non-negative number.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const finalOwnerName = isOtherType ? ownerNameText.trim() : (selectedOwner?.name || selectedOwner?.label || '');
    const finalWalletName = walletName.trim() || (walletCode ? `${finalOwnerName} - ${walletCode}` : finalOwnerName);

    const payload = {
      wallet_code: walletCode.trim(),
      owner_type: selectedOwnerType.value,
      owner_id: isOtherType ? (ownerId.trim() || null) : (ownerId.trim() || null),
      owner_record_id: isOtherType ? null : (selectedOwner?.record_id || null),
      wallet_name: finalWalletName,
      mobile: mobile.trim() || null,
      email: email.trim() || null,
      opening_points: parseFloat(openingPoints || 0).toFixed(2),
      daily_deduction_limit: parseFloat(dailyDeductionLimit || 0).toFixed(2),
      points_expiry_days: pointsExpiryDays ? parseInt(pointsExpiryDays, 10) : null,
      points_expiry_date: pointsExpiryDate || null,
      status: selectedStatus?.value || 'Active',
      remarks: remarks.trim() || null,
    };

    try {
      if (editId) {
        await WalletService.updateWallet(editId, payload);
        Swal.fire({
          icon: 'success',
          title: 'Wallet Updated',
          text: `Wallet "${payload.wallet_name}" updated successfully.`,
          confirmButtonColor: '#2ece8a',
        });
      } else {
        await WalletService.createWallet(payload);
        Swal.fire({
          icon: 'success',
          title: 'Wallet Created',
          text: `Wallet "${payload.wallet_name}" created successfully.`,
          confirmButtonColor: '#2ece8a',
        });
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      console.error('Wallet save failed:', err);
      const resData = err?.response?.data;
      let errorMsg = 'Failed to save wallet. Please try again.';

      if (resData) {
        if (typeof resData === 'string') {
          errorMsg = resData;
        } else if (typeof resData === 'object') {
          const detailed = Object.entries(resData)
            .map(([field, msg]) => `<strong>${field}:</strong> ${Array.isArray(msg) ? msg.join(', ') : msg}`)
            .join('<br/>');
          errorMsg = detailed || errorMsg;
        }
      }

      Swal.fire({
        icon: 'error',
        title: 'Operation Failed',
        html: errorMsg,
        confirmButtonColor: '#2ece8a',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Options for Owner Select
  const ownerSelectOptions = ownersList.map((item) => {
    let subtitle = item.department ? item.department : item.owner_id;
    if (item.company_name && item.contact_person) {
      subtitle = `${item.company_name} • ${item.owner_id}`;
    }
    return {
      value: item.record_id,
      record_id: item.record_id,
      owner_id: item.owner_id,
      name: item.name,
      department: item.department,
      mobile: item.mobile,
      email: item.email,
      label: `${item.name}${subtitle ? ` (${subtitle})` : ''}${item.has_wallet && (!editId || editId !== item.wallet_id) ? ' — [Wallet Exists]' : ''}`,
      isDisabled: item.has_wallet && (!editId || editId !== item.wallet_id),
    };
  });

  // Standard React-Select Styles
  const selectStyles = (hasError) => ({
    control: (base, state) => ({
      ...base,
      height: '38px',
      minHeight: '38px',
      borderColor: hasError ? '#dc3545' : state.isFocused ? '#2ece8a' : '#cbd5e1',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(46, 206, 138, 0.2)' : 'none',
      '&:hover': { borderColor: '#2ece8a' },
      borderRadius: '8px',
      fontSize: '13px',
      backgroundColor: '#ffffff',
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 12px',
      display: 'flex',
      alignItems: 'center',
    }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    placeholder: (base) => ({ ...base, color: '#94a3b8', fontSize: '13px', margin: 0 }),
    singleValue: (base) => ({ ...base, margin: 0, fontSize: '13px', color: '#1e293b' }),
    indicatorsContainer: (base) => ({ ...base, height: '36px' }),
    dropdownIndicator: (base) => ({ ...base, padding: '0 8px' }),
    clearIndicator: (base) => ({ ...base, padding: '0 4px' }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      fontSize: '13px',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? '#2ece8a' : state.isFocused ? '#eefdf6' : 'white',
      color: state.isDisabled ? '#94a3b8' : state.isSelected ? '#ffffff' : '#334155',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      padding: '8px 14px',
    }),
  });

  // Client-side Filter & Pagination
  const filteredWallets = wallets.filter((w) => {
    const term = (searchTerm || '').toLowerCase();
    return (
      (w.wallet_code || '').toLowerCase().includes(term) ||
      (w.wallet_name || '').toLowerCase().includes(term) ||
      (w.owner_id || '').toLowerCase().includes(term) ||
      (w.owner_type || '').toLowerCase().includes(term) ||
      (w.mobile || '').toLowerCase().includes(term) ||
      (w.email || '').toLowerCase().includes(term)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentWallets = filteredWallets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredWallets.length / itemsPerPage) || 1;

  return (
    <Fragment>
      <style>{`
        /* Standard Matrix Table & Header matching Glenda ERP */
        .wallet-matrix-header-container {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: wrap !important;
          gap: 15px !important;
        }
        .wallet-matrix-controls-wrapper {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
        }
        .wallet-matrix-search-bar {
          width: 280px !important;
          position: relative !important;
        }
        .wallet-matrix-table th {
          white-space: nowrap !important;
        }

        @media (max-width: 767px) {
          .wallet-matrix-header-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .wallet-matrix-controls-wrapper {
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 8px !important;
          }
          .wallet-matrix-search-bar {
            width: 100% !important;
            order: 2 !important;
            margin-top: 4px !important;
          }
          .wallet-matrix-add-btn {
            width: auto !important;
            flex-grow: 0 !important;
            order: 1 !important;
            font-size: 12px !important;
            padding: 0 12px !important;
            justify-content: center !important;
          }
          .wallet-matrix-table {
            min-width: 600px !important;
          }
        }

        /* Standard Modal Styles matching existing task/finance modals */
        .item-custom-modal .modal-content {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
          overflow: hidden;
        }
        .item-custom-modal .modal-header-custom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 28px 16px 28px;
          border-bottom: 1px solid #f1f5f9;
        }
        .item-custom-modal .modal-icon-circle {
          width: 44px;
          height: 44px;
          background-color: #2ece8a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
          color: white;
          font-size: 18px;
        }
        .item-custom-modal .modal-close-x {
          border: none;
          background: transparent;
          font-size: 24px;
          color: #aaa;
          cursor: pointer;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }
        .item-custom-modal .modal-close-x:hover {
          color: #555;
        }
        .item-custom-modal .modal-body-custom {
          padding: 22px 28px;
          max-height: 75vh;
          overflow-y: auto;
        }
        .item-custom-modal .modal-footer-custom {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 18px 28px 22px 28px;
          border-top: 1px solid #f1f5f9;
          background-color: #fafbfc;
          gap: 12px;
        }
        .item-custom-modal .form-label-custom {
          font-size: 13px;
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 6px;
        }
        .item-custom-modal .form-control-custom {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: #334155;
          background-color: #fff;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
          height: 38px;
        }
        .item-custom-modal .form-control-custom:focus {
          outline: none;
          border-color: #2ece8a;
          box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.15);
        }
        .item-custom-modal .btn-close-custom {
          background-color: #7A70BA !important;
          color: white !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          padding: 9px 22px !important;
          border: none !important;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .item-custom-modal .btn-close-custom:hover {
          background-color: #6357a7 !important;
        }
        .item-custom-modal .btn-save-custom {
          background-color: #2ece8a !important;
          color: white !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          padding: 9px 24px !important;
          border: none !important;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .item-custom-modal .btn-save-custom:hover {
          background-color: #26b277 !important;
        }
      `}</style>

      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12">
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center wallet-matrix-header-container">
                <Card.Title className="mb-0">Wallet Creation</Card.Title>
                <div className="d-flex align-items-center gap-2 wallet-matrix-controls-wrapper">
                  <div className="wallet-matrix-search-bar">
                    <i
                      className="fa fa-search position-absolute text-muted"
                      style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                    ></i>
                    <Form.Control
                      type="text"
                      placeholder="Search wallets..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                    />
                  </div>
                  <CreateButton
                    module="wallet_creation"
                    onClick={() => handleShowModal()}
                    className="wallet-matrix-add-btn"
                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                  >
                    Wallet
                  </CreateButton>
                </div>
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : (
                  <div className="table-responsive pb-4">
                    <table className="table table-responsive-md wallet-matrix-table">
                      <thead>
                        <tr>
                          <th><strong>Sl.No</strong></th>
                          <th><strong>WALLET NAME</strong></th>
                          <th><strong>OWNER TYPE</strong></th>
                          <th><strong>MOBILE</strong></th>
                          <th><strong>EMAIL</strong></th>
                          <th className="text-end"><strong>OPENING PTS</strong></th>
                          <th><strong>STATUS</strong></th>
                          <th className="text-end"><strong>ACTIONS</strong></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWallets.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="text-center py-4 text-muted">
                              No entries found
                            </td>
                          </tr>
                        ) : (
                          currentWallets.map((w, idx) => (
                            <tr key={w.id || idx}>
                              <td>{indexOfFirstItem + idx + 1}</td>
                              <td>
                                <strong>{w.wallet_name}</strong>
                              </td>
                              <td>
                                <span className={`badge light badge-${w.owner_type === 'Employee' ? 'primary' : w.owner_type === 'Vendor' ? 'info' : 'warning'}`}>
                                  {w.owner_type}
                                </span>
                              </td>
                              <td>{w.mobile || '—'}</td>
                              <td>{w.email || '—'}</td>
                              <td className="text-end">
                                {parseFloat(w.opening_points || 0).toFixed(2)}
                              </td>
                              <td>
                                <span className={`badge light badge-${w.status === 'Active' ? 'success' : 'danger'}`}>
                                  {w.status}
                                </span>
                              </td>
                              <td className="text-end">
                                <div className="d-flex justify-content-end align-items-center">
                                  <EditButton
                                    module="wallet_creation"
                                    onClick={() => handleShowModal(w)}
                                    className="me-1"
                                  />
                                  <DeleteButton
                                    module="wallet_creation"
                                    onClick={() => handleDelete(w)}
                                    title={
                                      w.points_entries_count > 0
                                        ? `Cannot delete: connected to ${w.points_entries_count} point ${w.points_entries_count === 1 ? 'entry' : 'entries'}`
                                        : w.transaction_count > 0
                                        ? `Cannot delete: connected to ${w.transaction_count} financial ${w.transaction_count === 1 ? 'transaction' : 'transactions'}`
                                        : 'Delete Wallet'
                                    }
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {filteredWallets.length > 0 && (
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div className="dataTables_info" style={{ fontSize: '13px', color: '#6e6e6e' }}>
                          Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredWallets.length)} of {filteredWallets.length} entries
                        </div>
                        {totalPages > 1 && (
                          <nav>
                            <ul className="pagination pagination-gutter pagination-primary no-bg mb-0">
                              <li className={`page-item page-indicator ${currentPage === 1 ? 'disabled' : ''}`}>
                                <button
                                  type="button"
                                  className="page-link"
                                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                  disabled={currentPage === 1}
                                  style={{ border: 'none', background: 'none' }}
                                >
                                  <i className="la la-angle-left" />
                                </button>
                              </li>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                                if (
                                  pageNumber === 1 ||
                                  pageNumber === totalPages ||
                                  (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                                ) {
                                  return (
                                    <li
                                      key={pageNumber}
                                      className={`page-item ${currentPage === pageNumber ? 'active' : ''}`}
                                    >
                                      <button
                                        type="button"
                                        className="page-link"
                                        onClick={() => setCurrentPage(pageNumber)}
                                        style={{ border: 'none' }}
                                      >
                                        {pageNumber}
                                      </button>
                                    </li>
                                  );
                                } else if (
                                  pageNumber === currentPage - 2 ||
                                  pageNumber === currentPage + 2
                                ) {
                                  return (
                                    <li key={pageNumber} className="page-item disabled">
                                      <span className="page-link" style={{ border: 'none', background: 'none' }}>...</span>
                                    </li>
                                  );
                                }
                                return null;
                              })}
                              <li className={`page-item page-indicator ${currentPage === totalPages ? 'disabled' : ''}`}>
                                <button
                                  type="button"
                                  className="page-link"
                                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                  disabled={currentPage === totalPages}
                                  style={{ border: 'none', background: 'none' }}
                                >
                                  <i className="la la-angle-right" />
                                </button>
                              </li>
                            </ul>
                          </nav>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL POPUP: WALLET CREATION / EDIT FORM
      ───────────────────────────────────────────────────────────── */}
      <Modal
        show={showModal}
        onHide={handleCloseModal}
        dialogClassName="item-custom-modal"
        backdrop="static"
        keyboard={false}
        centered
        size="xl"
      >
        <div className="modal-header-custom">
          <div className="d-flex align-items-center gap-3">
            <div className="modal-icon-circle">
              <i className="fa fa-wallet"></i>
            </div>
            <div>
              <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                {editId ? 'Edit Wallet' : 'Add New Wallet'}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                Enter details to manage rewards & points wallet
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-x" onClick={handleCloseModal}>
            &times;
          </button>
        </div>

        <Form onSubmit={handleSubmit}>
          <div className="modal-body-custom">
            {/* ── ROW 1: 4 Fields (Wallet Code | Owner Type | Owner Name | Owner ID) ── */}
            <Row className="g-3 mb-4">
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalWalletCodeInput">
                  <Form.Label className="form-label-custom">
                    Wallet Code <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={walletCode}
                    readOnly
                    placeholder={loadingCode ? 'Generating...' : 'e.g. WLT-00001'}
                    className={`form-control-custom ${errors.walletCode ? 'is-invalid' : ''}`}
                    style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                  />
                  {errors.walletCode && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.walletCode}
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalOwnerTypeSelect">
                  <Form.Label className="form-label-custom">
                    Owner Type <span className="text-danger">*</span>
                  </Form.Label>
                  <Select
                    options={ownerTypeOptions}
                    value={selectedOwnerType}
                    onChange={handleOwnerTypeChange}
                    styles={selectStyles(!!errors.ownerType)}
                    isLoading={loadingOwnerTypes}
                    isClearable={false}
                  />
                  {errors.ownerType && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.ownerType}
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalOwnerNameSelect">
                  <Form.Label className="form-label-custom">
                    Owner Name <span className="text-danger">*</span>
                  </Form.Label>
                  {isOtherType ? (
                    <Form.Control
                      type="text"
                      placeholder="Enter owner name"
                      value={ownerNameText}
                      onChange={handleOtherOwnerNameChange}
                      className={`form-control-custom ${errors.ownerName ? 'is-invalid' : ''}`}
                    />
                  ) : (
                    <Select
                      placeholder={`Select ${selectedOwnerType?.value || 'owner'}`}
                      options={ownerSelectOptions}
                      value={selectedOwner}
                      onChange={handleOwnerChange}
                      styles={selectStyles(!!errors.ownerName)}
                      isLoading={loadingOwners}
                      isClearable
                    />
                  )}
                  {errors.ownerName && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.ownerName}
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalOwnerIdInput">
                  <Form.Label className="form-label-custom">Owner ID</Form.Label>
                  <Form.Control
                    type="text"
                    value={ownerId}
                    readOnly
                    placeholder="e.g. EMP-0001"
                    className="form-control-custom"
                    style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* ── ROW 2: 4 Fields (Wallet Name | Mobile | Email | Opening Points) ── */}
            <Row className="g-3 mb-4">
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalWalletNameInput">
                  <Form.Label className="form-label-custom">Wallet Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={walletName}
                    readOnly
                    placeholder="e.g. Boby - WLT-00001"
                    className="form-control-custom"
                    style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                  />
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalMobileInput">
                  <Form.Label className="form-label-custom">Mobile</Form.Label>
                  <Form.Control
                    type="text"
                    value={mobile}
                    onChange={(e) => isOtherType && setMobile(e.target.value)}
                    readOnly={!isOtherType}
                    placeholder="Owner mobile number"
                    className="form-control-custom"
                    style={!isOtherType ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : {}}
                  />
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalEmailInput">
                  <Form.Label className="form-label-custom">Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => isOtherType && setEmail(e.target.value)}
                    readOnly={!isOtherType}
                    placeholder="Owner email address"
                    className="form-control-custom"
                    style={!isOtherType ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : {}}
                  />
                </Form.Group>
              </Col>

              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalOpeningPointsInput">
                  <Form.Label className="form-label-custom">Opening Points</Form.Label>
                  <Form.Control
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={openingPoints}
                    onFocus={() => {
                      if (openingPoints === '0' || openingPoints === '0.00' || openingPoints === 0) {
                        setOpeningPoints('');
                      }
                    }}
                    onBlur={() => {
                      if (openingPoints === '' || openingPoints === null) {
                        setOpeningPoints('0');
                      }
                    }}
                    onChange={(e) => {
                      setOpeningPoints(e.target.value);
                      setErrors((p) => ({ ...p, openingPoints: null }));
                    }}
                    className={`form-control-custom ${errors.openingPoints ? 'is-invalid' : ''}`}
                  />
                  {errors.openingPoints && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.openingPoints}
                    </div>
                  )}
                </Form.Group>
              </Col>
            </Row>

            {/* ── ROW 3: Daily Deduction Limit | Points Expiry (Days) | Status ── */}
            <Row className="g-3 mb-4">
              <Col xl={4} lg={4} md={4} sm={12}>
                <Form.Group controlId="modalDailyDeductionLimitInput">
                  <Form.Label className="form-label-custom">Daily Deduction Limit</Form.Label>
                  <Form.Control
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0 (0 = No Limit)"
                    value={dailyDeductionLimit}
                    onFocus={() => {
                      if (dailyDeductionLimit === '0' || dailyDeductionLimit === '0.00' || dailyDeductionLimit === 0) {
                        setDailyDeductionLimit('');
                      }
                    }}
                    onBlur={() => {
                      if (dailyDeductionLimit === '' || dailyDeductionLimit === null) {
                        setDailyDeductionLimit('0');
                      }
                    }}
                    onChange={(e) => {
                      setDailyDeductionLimit(e.target.value);
                      setErrors((p) => ({ ...p, dailyDeductionLimit: null }));
                    }}
                    className={`form-control-custom ${errors.dailyDeductionLimit ? 'is-invalid' : ''}`}
                  />
                  {errors.dailyDeductionLimit && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.dailyDeductionLimit}
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col xl={4} lg={4} md={4} sm={12}>
                <Form.Group controlId="modalExpiryDaysInput">
                  <Form.Label className="form-label-custom">Points Expiry (Days)</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 30, 60, 90, 365"
                    value={pointsExpiryDays}
                    onChange={(e) => {
                      handleExpiryDaysChange(e.target.value);
                      setErrors((p) => ({ ...p, pointsExpiryDays: null }));
                    }}
                    className={`form-control-custom ${errors.pointsExpiryDays ? 'is-invalid' : ''}`}
                  />
                  {errors.pointsExpiryDays && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.pointsExpiryDays}
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col xl={4} lg={4} md={4} sm={12}>
                <Form.Group controlId="modalStatusSelect">
                  <Form.Label className="form-label-custom">Status</Form.Label>
                  <Select
                    options={STATUS_OPTIONS}
                    value={selectedStatus}
                    onChange={(opt) => setSelectedStatus(opt)}
                    styles={selectStyles(false)}
                    isClearable={false}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* ── ROW 4: Remarks (Full-width Textarea) ── */}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group controlId="modalRemarksInput">
                  <Form.Label className="form-label-custom">Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Add any specific remarks or notes regarding this wallet..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="form-control-custom"
                    style={{ minHeight: '80px', height: 'auto', resize: 'vertical' }}
                  />
                </Form.Group>
              </Col>
            </Row>
          </div>

          <div className="modal-footer-custom">
            <Button
              type="button"
              className="btn-close-custom"
              onClick={handleCloseModal}
              disabled={submitting}
            >
              Close
            </Button>
            <Button
              type="submit"
              className="btn-save-custom"
              disabled={submitting || loadingCode}
            >
              {submitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                editId ? 'Update' : 'Save'
              )}
            </Button>
          </div>
        </Form>
      </Modal>
    </Fragment>
  );
};

export default WalletCreation;
