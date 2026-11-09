import React, { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Card, Form, Row, Col, Button, Modal, Spinner, Nav } from 'react-bootstrap';
import Select from 'react-select';
import Swal from 'sweetalert2';
import WalletService from '../../../services/WalletService';
import SalesService from '../../../services/SalesService';
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

const DEFAULT_REASON_OPTIONS = [
  { value: 'Reward / Incentive', label: 'Reward / Incentive' },
  { value: 'Purchase credit', label: 'Purchase credit' },
  { value: 'Bulk allocation', label: 'Bulk allocation' },
  { value: 'Refund / Reversal', label: 'Refund / Reversal' },
  { value: 'Manual adjustment', label: 'Manual adjustment' },
];

const getTodayFormatted = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateToDMY = (isoDateStr) => {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDateStr;
};

const WalletPointsEntry = () => {
  usePageTitle('Points Entry');
  const { can } = usePermission();

  // ──────────────────────────────────────────
  // List State
  // ──────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ──────────────────────────────────────────
  // Modal / Form State
  // ──────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [entryNumber, setEntryNumber] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);

  const [ownerTypeOptions, setOwnerTypeOptions] = useState(DEFAULT_OWNER_TYPE_OPTIONS);
  const [loadingOwnerTypes, setLoadingOwnerTypes] = useState(false);
  const [selectedOwnerType, setSelectedOwnerType] = useState(DEFAULT_OWNER_TYPE_OPTIONS[0]); // Default: Employee
  const [wallets, setWallets] = useState([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const [schemes, setSchemes] = useState([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [selectedCriteria, setSelectedCriteria] = useState(null);
  const [showSchemeDetailModal, setShowSchemeDetailModal] = useState(false);
  const [schemeDetailTab, setSchemeDetailTab] = useState('criteria');

  const [currentBalance, setCurrentBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Sales Invoices state & Quantity-based calculation breakdown
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceBreakdown, setInvoiceBreakdown] = useState([]);

  const [entryType, setEntryType] = useState('Addition'); // 'Addition' | 'Deduction'
  const [points, setPoints] = useState('0');
  const [reasonOptions, setReasonOptions] = useState(DEFAULT_REASON_OPTIONS);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [selectedReason, setSelectedReason] = useState(DEFAULT_REASON_OPTIONS[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [entryDate, setEntryDate] = useState(getTodayFormatted());
  const [remarks, setRemarks] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // ──────────────────────────────────────────
  // 1. Fetch Points Entries List
  // ──────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await WalletService.getPointsEntries();
      const list = Array.isArray(res) ? res : (res?.results || []);
      setEntries(list);
    } catch (err) {
      console.error('Error fetching points entries:', err);
      Swal.fire('Error', 'Failed to fetch points entries list.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────
  // 2. Fetch Active Wallets & Schemes
  // ──────────────────────────────────────────
  const fetchActiveWallets = useCallback(async (ownerType = 'Employee') => {
    try {
      setLoadingWallets(true);
      const params = ownerType ? { owner_type: ownerType } : {};
      const data = await WalletService.getActiveWallets(params);
      const list = Array.isArray(data) ? data : (data?.results || []);
      setWallets(list);
      return list;
    } catch (err) {
      console.error('Failed to load active wallets:', err);
      setWallets([]);
      return [];
    } finally {
      setLoadingWallets(false);
    }
  }, []);

  // Fetch active owner types from master
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

  // Fetch active reasons from wallet_reason master
  const fetchReasonOptions = useCallback(async () => {
    try {
      setLoadingReasons(true);
      const res = await WalletService.getActiveReasons();
      const list = Array.isArray(res) ? res : (res?.results || []);
      if (list && list.length > 0) {
        const dynamicOptions = list.map((item) => ({
          value: item.reason,
          label: item.reason,
        }));
        setReasonOptions(dynamicOptions);
        return dynamicOptions;
      }
    } catch (err) {
      console.error('Failed to load active wallet reasons:', err);
    } finally {
      setLoadingReasons(false);
    }
    return DEFAULT_REASON_OPTIONS;
  }, []);

  // Fetch active, non-expired schemes from wallet_schemes
  const fetchSchemes = useCallback(async () => {
    try {
      setLoadingSchemes(true);
      const data = await WalletService.getActiveSchemes();
      const list = Array.isArray(data) ? data : (data?.results || []);
      setSchemes(list);
    } catch (err) {
      console.error('Failed to load active schemes:', err);
    } finally {
      setLoadingSchemes(false);
    }
  }, []);

  // ──────────────────────────────────────────
  // 3. Fetch Next Sequential Entry Number
  // ──────────────────────────────────────────
  const fetchNextEntryNumber = useCallback(async () => {
    try {
      setLoadingCode(true);
      const res = await WalletService.getNextPointsEntryNumber();
      if (res?.next_entry_number) {
        setEntryNumber(res.next_entry_number);
      }
    } catch (err) {
      console.error('Failed to fetch next points entry number:', err);
      setEntryNumber('PE-00001');
    } finally {
      setLoadingCode(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchSchemes();
    fetchOwnerTypes();
    fetchReasonOptions();
  }, [fetchEntries, fetchSchemes, fetchOwnerTypes, fetchReasonOptions]);

  // Fetch balance for selected wallet
  const fetchWalletBalance = useCallback(async (walletId) => {
    if (!walletId) {
      setCurrentBalance(0);
      return;
    }
    try {
      setLoadingBalance(true);
      const data = await WalletService.getWalletById(walletId);
      const balance = parseFloat(data?.current_balance || 0);
      setCurrentBalance(isNaN(balance) ? 0 : balance);
    } catch (err) {
      console.error('Failed to fetch wallet balance:', err);
      setCurrentBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }, []);

  // Handle Owner Type Change: clears current selected wallet and re-fetches wallets for that type
  const handleOwnerTypeChange = async (opt) => {
    setSelectedOwnerType(opt);
    setSelectedWallet(null);
    setCurrentBalance(0);
    setErrors((prev) => ({ ...prev, wallet: null }));
    if (opt?.value) {
      await fetchActiveWallets(opt.value);
    } else {
      setWallets([]);
    }
  };

  // Modal Open/Close (Create or Edit)
  const handleOpenModal = async (entry = null) => {
    setErrors({});
    const typesPromise = fetchOwnerTypes();
    const reasonsPromise = fetchReasonOptions();
    const [types, reasons] = await Promise.all([typesPromise, reasonsPromise]);

    const availableTypes = (types && types.length > 0) ? types : ownerTypeOptions;
    const availableReasons = (reasons && reasons.length > 0) ? reasons : reasonOptions;
    const isEdit = entry && !entry.nativeEvent && !entry.preventDefault && entry.id;

    if (isEdit) {
      setEditId(entry.id);
      setEntryNumber(entry.entry_number || (entry.id ? `PE-${String(entry.id).padStart(5, '0')}` : ''));
      setEntryDate(entry.entry_date || getTodayFormatted());

      // If wallet has owner_type or find from wallet info
      let ownerTypeOpt = availableTypes[0] || DEFAULT_OWNER_TYPE_OPTIONS[0];
      let wDetail = null;
      try {
        if (entry.wallet) {
          wDetail = await WalletService.getWalletById(entry.wallet);
          if (wDetail?.owner_type) {
            ownerTypeOpt = availableTypes.find((ot) => ot.value.toLowerCase() === wDetail.owner_type.toLowerCase()) ||
              { value: wDetail.owner_type, label: wDetail.owner_type };
          }
        }
      } catch (e) {
        console.error('Failed to resolve wallet details for edit:', e);
      }

      setSelectedOwnerType(ownerTypeOpt);
      await fetchActiveWallets(ownerTypeOpt.value);

      const currentWalletObj = wDetail || null;
      setSelectedWallet({
        value: entry.wallet,
        label: entry.wallet_name || entry.wallet_code,
        wallet: currentWalletObj,
      });
      fetchWalletBalance(entry.wallet);
      const loadedWalletData = await fetchInvoicesForWallet(currentWalletObj);
      const invoicesList = loadedWalletData?.invoices || [];
      const returnsList = loadedWalletData?.returns || [];

      const foundScheme = entry.scheme ? schemes.find((s) => s.id === entry.scheme) : null;
      if (entry.scheme) {
        setSelectedScheme({
          value: entry.scheme,
          label: entry.scheme_name || (foundScheme ? foundScheme.name : 'Scheme'),
          scheme: foundScheme,
        });
      } else {
        setSelectedScheme(null);
      }

      // Check if reference_no matches an existing invoice
      if (entry.reference_no && invoicesList && invoicesList.length > 0) {
        const matchedInv = invoicesList.find((inv) => inv.invoice_no === entry.reference_no);
        if (matchedInv) {
          setSelectedInvoice({
            value: matchedInv.id,
            label: `${matchedInv.invoice_no}${matchedInv.entry_date ? ` (${formatDateToDMY(matchedInv.entry_date)})` : ''} — ₹${parseFloat(matchedInv.total_amount || 0).toLocaleString('en-IN')}`,
            invoice: matchedInv,
          });
          if (foundScheme) {
            const { totalPoints, breakdown } = calculateSchemePoints(foundScheme, matchedInv, null, returnsList);
            setInvoiceBreakdown(breakdown);
            // Whenever the sales invoice was edited, auto-reflect latest calculated points
            if (breakdown.length > 0) {
              setPoints(totalPoints.toFixed(2));
            } else {
              setPoints('0.00');
            }
          } else {
            setPoints(entry.points ? String(parseFloat(entry.points)) : '0');
          }
        } else {
          setSelectedInvoice(null);
          setInvoiceBreakdown([]);
          setPoints(entry.points ? String(parseFloat(entry.points)) : '0');
        }
      } else {
        setSelectedInvoice(null);
        setInvoiceBreakdown([]);
        setPoints(entry.points ? String(parseFloat(entry.points)) : '0');
      }

      setSelectedCriteria(null);
      setEntryType(entry.entry_type || 'Addition');
      const foundReason =
        availableReasons.find((r) => r.value.toLowerCase() === (entry.reason || '').toLowerCase()) ||
        DEFAULT_REASON_OPTIONS.find((r) => r.value.toLowerCase() === (entry.reason || '').toLowerCase()) ||
        (entry.reason ? { value: entry.reason, label: entry.reason } : (availableReasons[0] || DEFAULT_REASON_OPTIONS[0]));
      setSelectedReason(foundReason);
      setReferenceNo(entry.reference_no || '');
      setRemarks(entry.remarks || '');
    } else {
      setEditId(null);
      const defaultOwnerType = availableTypes.find((t) => t.value.toLowerCase() === 'employee') || availableTypes[0] || DEFAULT_OWNER_TYPE_OPTIONS[0];
      setSelectedOwnerType(defaultOwnerType);
      setSelectedWallet(null);
      setSelectedInvoice(null);
      setInvoiceBreakdown([]);
      setSalesInvoices([]);
      setSelectedScheme(null);
      setSelectedCriteria(null);
      setCurrentBalance(0);
      setEntryType('Addition');
      setPoints('0');
      setSelectedReason(availableReasons[0] || DEFAULT_REASON_OPTIONS[0]);
      setReferenceNo('');
      setEntryDate(getTodayFormatted());
      setRemarks('');
      fetchNextEntryNumber();
      fetchActiveWallets(defaultOwnerType.value);
    }
    fetchSchemes();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setShowModal(false);
      setEditId(null);
    }
  };

  // Delete Points Entry
  const handleDelete = async (itemOrId, codeArg) => {
    const isObj = typeof itemOrId === 'object' && itemOrId !== null;
    const id = isObj ? itemOrId.id : itemOrId;
    const code = isObj ? (itemOrId.entry_number || itemOrId.id) : (codeArg || itemOrId);
    const refNo = isObj ? itemOrId.reference_no : null;

    let confirmText = `Are you sure you want to delete entry "${code}"?`;
    if (refNo) {
      confirmText = `Entry "${code}" is connected to reference document "${refNo}". Are you sure you want to delete this entry?`;
    }

    const result = await Swal.fire({
      title: 'Delete Points Entry?',
      text: confirmText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it',
    });

    if (result.isConfirmed) {
      try {
        await WalletService.deletePointsEntry(id);
        Swal.fire('Deleted!', 'Points entry deleted successfully.', 'success');
        fetchEntries();
      } catch (err) {
        console.error('Failed to delete entry:', err);
        const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to delete points entry.';
        Swal.fire({
          icon: 'warning',
          title: 'Cannot Delete Entry',
          text: msg,
          confirmButtonColor: '#2ece8a',
        });
      }
    }
  };

  // Fetch sales invoices and sales returns for a selected wallet's owner ledger
  const fetchInvoicesForWallet = useCallback(async (walletObj) => {
    if (!walletObj) {
      setSalesInvoices([]);
      setSalesReturns([]);
      setSelectedInvoice(null);
      return { invoices: [], returns: [] };
    }
    const customerLedgerId = walletObj.owner_record_id;
    if (!customerLedgerId) {
      setSalesInvoices([]);
      setSalesReturns([]);
      setSelectedInvoice(null);
      return { invoices: [], returns: [] };
    }
    try {
      setLoadingInvoices(true);
      const [invRes, retRes] = await Promise.all([
        SalesService.getSalesInvoices(customerLedgerId),
        SalesService.getSalesReturns(customerLedgerId).catch((err) => {
          console.warn('Failed to load sales returns for wallet owner:', err);
          return [];
        }),
      ]);
      const list = Array.isArray(invRes) ? invRes : (invRes?.data || invRes?.results || []);
      const retList = Array.isArray(retRes) ? retRes : (retRes?.data || retRes?.results || []);
      setSalesInvoices(list);
      setSalesReturns(retList);
      return { invoices: list, returns: retList };
    } catch (err) {
      console.error('Failed to load sales invoices for wallet owner:', err);
      setSalesInvoices([]);
      setSalesReturns([]);
      return { invoices: [], returns: [] };
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // Helper: Calculate scheme points (Quantity-based or Value-based) from Sales Invoice(s) and Scheme / Specific Criteria
  // Supports deducting applicable Sales Return items (Net Eligible Quantity & Net Eligible Value)
  // Requirements:
  // - Quantity-based:
  //   * Net Eligible Qty = Total Eligible Sales Invoice Qty - Total Applicable Sales Return Qty (minimum 0)
  //   * If netQty < critQty, not chosen (0 points).
  //   * If netQty >= critQty: Points = (netQty / critQty) * critPts.
  // - Value-based:
  //   * Net Eligible Value = Total Eligible Sales Invoice Value - Total Applicable Sales Return Value (minimum 0)
  //   * If netValue < critValue, not chosen (0 points).
  //   * If netValue >= critValue: Points = (netValue / critValue) * critPts.
  const calculateSchemePoints = useCallback((schemeObj, invoiceInput, specificCriteria = null, returnsInput = null) => {
    if (!schemeObj || !invoiceInput) {
      return { totalPoints: 0, breakdown: [] };
    }

    const cType = schemeObj.criteria_type || 'Quantity';
    let qRows = [];
    let vRows = [];

    if (specificCriteria) {
      // Determine if specificCriteria is quantity or value based
      if (specificCriteria.criteria_group === 'quantity' || specificCriteria.quantity || (!specificCriteria.value && specificCriteria.points)) {
        qRows = [specificCriteria];
      } else {
        vRows = [specificCriteria];
      }
    } else {
      if (cType === 'Quantity' || cType === 'Both') {
        qRows = schemeObj.criteria_rows || schemeObj.criteria_list || [];
      }
      if (cType === 'Value' || cType === 'Both') {
        vRows = schemeObj.criteria_values || schemeObj.criteria_rows_2 || [];
      }
    }

    const invoiceList = Array.isArray(invoiceInput) ? invoiceInput : [invoiceInput];
    const availableReturns = returnsInput !== null ? returnsInput : salesReturns;
    const breakdown = [];
    let totalPoints = 0;

    const isConsolidated = Boolean(schemeObj.is_consolidated);

    if (isConsolidated) {
      // ─────────────────────────────────────────────────────────────
      // CONSOLIDATED SCHEME CALCULATION
      // 1. Collect all invoice items matching eligible products defined in criteria.
      // 2. Sum net eligible quantities or values across all matching products.
      // 3. Compare consolidated net total against scheme threshold and award points.
      // ─────────────────────────────────────────────────────────────

      // A. Consolidated Quantity-Based
      if (qRows.length > 0) {
        // Collect all criteria product IDs (or all if wildcard)
        const eligibleProductIds = new Set(
          qRows.map((cr) => String(cr.product || cr.product_id)).filter((id) => id && id !== 'undefined' && id !== 'null')
        );

        // Reference threshold and points from the first criteria row or scheme total
        const primaryRow = qRows[0];
        const critQty = parseFloat(primaryRow.quantity || 0);
        const critPts = parseFloat(primaryRow.points || 0);

        let sumGrossQty = 0;
        let sumReturnQty = 0;
        let sumNetQty = 0;
        let sumGrossVal = 0;
        let sumReturnVal = 0;
        let sumNetVal = 0;
        const matchingProductNames = [];

        invoiceList.forEach((inv) => {
          const invItems = inv.items || [];
          const invNo = inv.invoice_no;
          const applicableReturns = availableReturns.filter((r) => r.sales_invoice_no === invNo);
          const returnItems = [];
          applicableReturns.forEach((ret) => {
            if (Array.isArray(ret.items)) returnItems.push(...ret.items);
          });

          invItems.forEach((item) => {
            const pId = String(item.product || item.product_id);
            const isMatch = eligibleProductIds.size === 0 || eligibleProductIds.has(pId);
            if (isMatch) {
              const grossQty = parseFloat(item.quantity || 0);
              const grossVal = parseFloat(item.amount || item.total_amount || 0);

              let retQty = 0;
              let retVal = 0;
              returnItems.forEach((ri) => {
                if (String(ri.product || ri.product_id) === pId) {
                  retQty += parseFloat(ri.quantity || 0);
                  retVal += parseFloat(ri.amount || 0);
                }
              });

              const netQty = Math.max(0, grossQty - retQty);
              const netVal = Math.max(0, grossVal - retVal);

              sumGrossQty += grossQty;
              sumReturnQty += retQty;
              sumNetQty += netQty;

              sumGrossVal += grossVal;
              sumReturnVal += retVal;
              sumNetVal += netVal;

              const pName = item.product_name || `Product #${pId}`;
              if (!matchingProductNames.includes(pName)) {
                matchingProductNames.push(pName);
              }
            }
          });
        });

        if (critQty > 0) {
          const isEligible = sumNetQty >= critQty;
          const earned = isEligible ? (sumNetQty / critQty) * critPts : 0;
          totalPoints += earned;

          const hasReturn = sumReturnQty > 0;
          const qtyFormula = hasReturn
            ? `((${sumGrossQty.toFixed(2)} - ${sumReturnQty.toFixed(2)}) / ${critQty.toFixed(2)}) × ${critPts.toFixed(2)} pts`
            : `(${sumNetQty.toFixed(2)} / ${critQty.toFixed(2)}) × ${critPts.toFixed(2)} pts`;

          breakdown.push({
            type: 'Quantity',
            isConsolidated: true,
            invoiceNo: invoiceList.length === 1 ? invoiceList[0].invoice_no : `${invoiceList.length} Invoices`,
            productId: null,
            productName: `Consolidated (${matchingProductNames.length} Product${matchingProductNames.length !== 1 ? 's' : ''}: ${matchingProductNames.slice(0, 3).join(', ')}${matchingProductNames.length > 3 ? '...' : ''})`,
            invoiceQty: sumGrossQty,
            returnQty: sumReturnQty,
            netQty: sumNetQty,
            criteriaQty: critQty,
            invoiceValue: sumGrossVal,
            returnValue: sumReturnVal,
            netValue: sumNetVal,
            criteriaValue: 0,
            criteriaPoints: critPts,
            earnedPoints: earned,
            isEligible: isEligible,
            formulaText: isEligible ? qtyFormula : `Below threshold (${sumNetQty.toFixed(2)} / ${critQty.toFixed(2)})`,
            statusText: isEligible ? `Eligible (${(sumNetQty / critQty).toFixed(2)}x base)` : 'Below Threshold',
          });
        }
      }

      // B. Consolidated Value-Based
      if (vRows.length > 0) {
        const eligibleProductIds = new Set(
          vRows.map((cr) => String(cr.product || cr.product_id)).filter((id) => id && id !== 'undefined' && id !== 'null')
        );

        const primaryRow = vRows[0];
        const critVal = parseFloat(primaryRow.value || 0);
        const critPts = parseFloat(primaryRow.points || 0);

        let sumGrossQty = 0;
        let sumReturnQty = 0;
        let sumNetQty = 0;
        let sumGrossVal = 0;
        let sumReturnVal = 0;
        let sumNetVal = 0;
        const matchingProductNames = [];

        invoiceList.forEach((inv) => {
          const invItems = inv.items || [];
          const invNo = inv.invoice_no;
          const applicableReturns = availableReturns.filter((r) => r.sales_invoice_no === invNo);
          const returnItems = [];
          applicableReturns.forEach((ret) => {
            if (Array.isArray(ret.items)) returnItems.push(...ret.items);
          });

          invItems.forEach((item) => {
            const pId = String(item.product || item.product_id);
            const isMatch = eligibleProductIds.size === 0 || eligibleProductIds.has(pId);
            if (isMatch) {
              const grossQty = parseFloat(item.quantity || 0);
              const grossVal = parseFloat(item.amount || item.total_amount || 0);

              let retQty = 0;
              let retVal = 0;
              returnItems.forEach((ri) => {
                if (String(ri.product || ri.product_id) === pId) {
                  retQty += parseFloat(ri.quantity || 0);
                  retVal += parseFloat(ri.amount || 0);
                }
              });

              const netQty = Math.max(0, grossQty - retQty);
              const netVal = Math.max(0, grossVal - retVal);

              sumGrossQty += grossQty;
              sumReturnQty += retQty;
              sumNetQty += netQty;

              sumGrossVal += grossVal;
              sumReturnVal += retVal;
              sumNetVal += netVal;

              const pName = item.product_name || `Product #${pId}`;
              if (!matchingProductNames.includes(pName)) {
                matchingProductNames.push(pName);
              }
            }
          });
        });

        if (critVal > 0) {
          const isEligible = sumNetVal >= critVal;
          const earned = isEligible ? (sumNetVal / critVal) * critPts : 0;
          totalPoints += earned;

          const hasReturn = sumReturnVal > 0;
          const valFormula = hasReturn
            ? `((₹${sumGrossVal.toFixed(2)} - ₹${sumReturnVal.toFixed(2)}) / ₹${critVal.toFixed(2)}) × ${critPts.toFixed(2)} pts`
            : `(₹${sumNetVal.toFixed(2)} / ₹${critVal.toFixed(2)}) × ${critPts.toFixed(2)} pts`;

          breakdown.push({
            type: 'Value',
            isConsolidated: true,
            invoiceNo: invoiceList.length === 1 ? invoiceList[0].invoice_no : `${invoiceList.length} Invoices`,
            productId: null,
            productName: `Consolidated (${matchingProductNames.length} Product${matchingProductNames.length !== 1 ? 's' : ''}: ${matchingProductNames.slice(0, 3).join(', ')}${matchingProductNames.length > 3 ? '...' : ''})`,
            invoiceQty: sumGrossQty,
            returnQty: sumReturnQty,
            netQty: sumNetQty,
            criteriaQty: 0,
            invoiceValue: sumGrossVal,
            returnValue: sumReturnVal,
            netValue: sumNetVal,
            criteriaValue: critVal,
            criteriaPoints: critPts,
            earnedPoints: earned,
            isEligible: isEligible,
            formulaText: isEligible ? valFormula : `Below threshold (₹${sumNetVal.toFixed(2)} / ₹${critVal.toFixed(2)})`,
            statusText: isEligible ? `Eligible (${(sumNetVal / critVal).toFixed(2)}x base)` : 'Below Threshold',
          });
        }
      }

      return { totalPoints, breakdown };
    }

    // ─────────────────────────────────────────────────────────────
    // INDIVIDUAL SCHEME CALCULATION (is_consolidated: false)
    // Preserves existing per-product evaluation exactly as implemented
    // ─────────────────────────────────────────────────────────────
    invoiceList.forEach((inv) => {
      const invItems = inv.items || [];
      const invNo = inv.invoice_no;

      // Filter applicable returns matching this specific invoice
      const applicableReturns = availableReturns.filter((r) => r.sales_invoice_no === invNo);
      const returnItems = [];
      applicableReturns.forEach((ret) => {
        if (Array.isArray(ret.items)) {
          returnItems.push(...ret.items);
        }
      });

      invItems.forEach((item) => {
        const pId = item.product || item.product_id;

        // Calculate returned quantity and returned value for this product
        let returnQty = 0;
        let returnValue = 0;
        returnItems.forEach((ri) => {
          if (String(ri.product || ri.product_id) === String(pId)) {
            returnQty += parseFloat(ri.quantity || 0);
            returnValue += parseFloat(ri.amount || 0);
          }
        });

        // 1. Check Quantity Criteria Match
        if (qRows.length > 0) {
          const matchedQ = qRows.find((cr) => String(cr.product || cr.product_id) === String(pId));
          if (matchedQ) {
            const grossQty = parseFloat(item.quantity || 0);
            const netQty = Math.max(0, grossQty - returnQty);
            const critQty = parseFloat(matchedQ.quantity || 0);
            const critPts = parseFloat(matchedQ.points || 0);

            if (critQty > 0) {
              const isEligible = netQty >= critQty;
              if (isEligible) {
                const itemEarnedPoints = (netQty / critQty) * critPts;
                totalPoints += itemEarnedPoints;
                const hasReturn = returnQty > 0;
                const qtyFormula = hasReturn
                  ? `((${grossQty.toFixed(2)} - ${returnQty.toFixed(2)}) / ${critQty.toFixed(2)}) × ${critPts.toFixed(2)} pts`
                  : `(${netQty.toFixed(2)} / ${critQty.toFixed(2)}) × ${critPts.toFixed(2)} pts`;

                breakdown.push({
                  type: 'Quantity',
                  invoiceNo: inv.invoice_no,
                  productId: pId,
                  productName: item.product_name || matchedQ.product_name || `Product #${pId}`,
                  invoiceQty: grossQty,
                  returnQty: returnQty,
                  netQty: netQty,
                  criteriaQty: critQty,
                  invoiceValue: parseFloat(item.amount || 0),
                  returnValue: returnValue,
                  netValue: Math.max(0, parseFloat(item.amount || 0) - returnValue),
                  criteriaValue: 0,
                  criteriaPoints: critPts,
                  earnedPoints: itemEarnedPoints,
                  isEligible: true,
                  formulaText: qtyFormula,
                  statusText: `Eligible (${(netQty / critQty).toFixed(2)}x base)`,
                });
              }
            }
          }
        }

        // 2. Check Value Criteria Match
        if (vRows.length > 0) {
          const matchedV = vRows.find((cr) => String(cr.product || cr.product_id) === String(pId));
          if (matchedV) {
            const grossVal = parseFloat(item.amount || item.total_amount || 0);
            const netVal = Math.max(0, grossVal - returnValue);
            const critVal = parseFloat(matchedV.value || 0);
            const critPts = parseFloat(matchedV.points || 0);

            if (critVal > 0) {
              const isEligible = netVal >= critVal;
              if (isEligible) {
                const itemEarnedPoints = (netVal / critVal) * critPts;
                totalPoints += itemEarnedPoints;
                const hasReturn = returnValue > 0;
                const valFormula = hasReturn
                  ? `((₹${grossVal.toFixed(2)} - ₹${returnValue.toFixed(2)}) / ₹${critVal.toFixed(2)}) × ${critPts.toFixed(2)} pts`
                  : `(₹${netVal.toFixed(2)} / ₹${critVal.toFixed(2)}) × ${critPts.toFixed(2)} pts`;

                breakdown.push({
                  type: 'Value',
                  invoiceNo: inv.invoice_no,
                  productId: pId,
                  productName: item.product_name || matchedV.product_name || `Product #${pId}`,
                  invoiceQty: parseFloat(item.quantity || 0),
                  returnQty: returnQty,
                  netQty: Math.max(0, parseFloat(item.quantity || 0) - returnQty),
                  criteriaQty: 0,
                  invoiceValue: grossVal,
                  returnValue: returnValue,
                  netValue: netVal,
                  criteriaValue: critVal,
                  criteriaPoints: critPts,
                  earnedPoints: itemEarnedPoints,
                  isEligible: true,
                  formulaText: valFormula,
                  statusText: `Eligible (${(netVal / critVal).toFixed(2)}x base)`,
                });
              }
            }
          }
        }
      });
    });

    return { totalPoints, breakdown };
  }, [salesReturns]);

  const handleWalletChange = async (opt) => {
    setSelectedWallet(opt);
    setSelectedInvoice(null);
    setInvoiceBreakdown([]);
    setErrors((prev) => ({ ...prev, wallet: null }));
    if (opt?.value) {
      fetchWalletBalance(opt.value);
      const fullWallet = opt.wallet || wallets.find((w) => w.id === opt.value);
      const loadedData = await fetchInvoicesForWallet(fullWallet);
      const invList = loadedData?.invoices || [];
      const retList = loadedData?.returns || [];
      // If a scheme is already chosen, calculate across loaded invoices immediately
      if (selectedScheme?.scheme && invList && invList.length > 0) {
        const { totalPoints, breakdown } = calculateSchemePoints(selectedScheme.scheme, invList, selectedCriteria?.criteria || null, retList);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        }
      }
    } else {
      setCurrentBalance(0);
      setSalesInvoices([]);
      setSalesReturns([]);
    }
  };

  // Handle Sales Invoice Selection
  const handleInvoiceChange = (opt) => {
    setSelectedInvoice(opt);
    if (opt?.invoice) {
      // Auto-populate reference no with invoice number
      setReferenceNo(opt.invoice.invoice_no || '');
      setErrors((prev) => ({ ...prev, points: null }));

      // If a scheme or criteria is already selected, perform points calculation for this invoice
      const currentSchemeObj = selectedScheme?.scheme;
      if (currentSchemeObj) {
        const targetCriteria = selectedCriteria?.criteria || null;
        const { totalPoints, breakdown } = calculateSchemePoints(currentSchemeObj, opt.invoice, targetCriteria);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        } else if (targetCriteria) {
          setPoints('0.00');
        } else {
          setPoints('0.00');
        }
      }
    } else {
      // Cleared specific invoice: recalculate across all sales invoices for this wallet
      setReferenceNo('');
      if (selectedScheme?.scheme && salesInvoices.length > 0) {
        const targetCriteria = selectedCriteria?.criteria || null;
        const { totalPoints, breakdown } = calculateSchemePoints(selectedScheme.scheme, salesInvoices, targetCriteria);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        } else {
          const defaultTotal = parseFloat(selectedScheme.scheme.total_criteria_points || 0);
          setPoints(defaultTotal > 0 ? String(defaultTotal) : '0');
        }
      } else {
        setInvoiceBreakdown([]);
      }
    }
  };

  // Handle Scheme Change
  const handleSchemeChange = async (opt) => {
    setSelectedScheme(opt);
    setSelectedCriteria(null);
    setErrors((prev) => ({ ...prev, points: null }));

    if (opt?.scheme) {
      const schemeObj = opt.scheme;
      const cType = schemeObj.criteria_type || 'Quantity';
      const qRows = (cType === 'Quantity' || cType === 'Both')
        ? (schemeObj.criteria_rows || schemeObj.criteria_list || [])
        : [];
      const vRows = (cType === 'Value' || cType === 'Both')
        ? (schemeObj.criteria_values || schemeObj.criteria_rows_2 || [])
        : [];
      const criteriaList = [...qRows, ...vRows];

      // Re-fetch latest invoices for wallet to pick up any newly added invoice products or returns
      let currentInvoices = salesInvoices;
      let currentReturns = salesReturns;
      if (selectedWallet) {
        const fullWallet = selectedWallet.wallet || wallets.find((w) => w.id === selectedWallet.value);
        if (fullWallet) {
          const freshData = await fetchInvoicesForWallet(fullWallet);
          if (freshData?.invoices && freshData.invoices.length > 0) {
            currentInvoices = freshData.invoices;
          }
          if (freshData?.returns) {
            currentReturns = freshData.returns;
          }
        }
      }

      // Determine target invoices: if user selected a specific invoice, use it; otherwise use ALL invoices for wallet
      const targetInvoices = selectedInvoice?.invoice ? [selectedInvoice.invoice] : currentInvoices;

      if (targetInvoices.length > 0 && criteriaList.length > 0) {
        const { totalPoints, breakdown } = calculateSchemePoints(schemeObj, targetInvoices, null, currentReturns);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        } else {
          const defaultTotal = parseFloat(schemeObj.total_criteria_points || 0);
          setPoints(defaultTotal > 0 ? String(defaultTotal) : '0');
        }
      } else {
        setInvoiceBreakdown([]);
        if (criteriaList.length === 1) {
          const singleCrit = criteriaList[0];
          const pts = parseFloat(singleCrit.points || 0);
          setSelectedCriteria({
            value: `${singleCrit.id}_${singleCrit.criteria_group || 'val'}`,
            label: `${singleCrit.product_name || 'All Products'}: ${pts} pts`,
            points: singleCrit.points,
            criteria: singleCrit,
          });
          setPoints(pts > 0 ? String(pts) : '0');
        } else if (criteriaList.length > 1) {
          // If scheme has multiple criteria, default to total criteria points
          const total = parseFloat(schemeObj.total_criteria_points || 0);
          setPoints(total > 0 ? String(total) : '0');
        } else {
          setPoints('0');
        }
      }

      // Determine default tab based on whether quantity or value criteria exists according to criteria_type
      if (cType === 'Value') {
        setSchemeDetailTab('criteria_2');
      } else if (cType === 'Quantity') {
        setSchemeDetailTab('criteria');
      } else {
        // Both: default to criteria with rows
        setSchemeDetailTab(qRows.length > 0 ? 'criteria' : 'criteria_2');
      }
    } else {
      setSelectedCriteria(null);
      setInvoiceBreakdown([]);
      setPoints('0');
      setShowSchemeDetailModal(false);
    }
  };

  const handleCriteriaChange = (opt) => {
    setSelectedCriteria(opt);
    setErrors((prev) => ({ ...prev, points: null }));

    const targetInvoices = selectedInvoice?.invoice ? [selectedInvoice.invoice] : salesInvoices;

    if (opt?.criteria) {
      if (targetInvoices.length > 0 && selectedScheme?.scheme) {
        const { totalPoints, breakdown } = calculateSchemePoints(selectedScheme.scheme, targetInvoices, opt.criteria);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        } else {
          // Chosen product criteria not found in the invoice(s)
          setPoints('0.00');
        }
      } else {
        // No invoices available: default to criteria points
        const pts = parseFloat(opt.points || opt.criteria.points || 0);
        setPoints(!isNaN(pts) && pts > 0 ? String(pts) : '0');
      }
    } else {
      // Cleared specific criteria: recalculate across all invoice items or fallback to scheme total
      if (targetInvoices.length > 0 && selectedScheme?.scheme) {
        const { totalPoints, breakdown } = calculateSchemePoints(selectedScheme.scheme, targetInvoices, null);
        setInvoiceBreakdown(breakdown);
        if (breakdown.length > 0) {
          setPoints(totalPoints.toFixed(2));
        } else {
          const total = parseFloat(selectedScheme.scheme.total_criteria_points || 0);
          setPoints(total > 0 ? String(total) : '0');
        }
      } else if (selectedScheme?.scheme?.total_criteria_points) {
        setPoints(String(parseFloat(selectedScheme.scheme.total_criteria_points) || 0));
      } else {
        setPoints('0');
      }
    }
  };

  // Balance Calculations
  const numericPoints = useMemo(() => {
    const val = parseFloat(points);
    return isNaN(val) ? 0 : val;
  }, [points]);

  const balanceAfter = useMemo(() => {
    if (entryType === 'Addition') {
      return currentBalance + numericPoints;
    } else {
      return currentBalance - numericPoints;
    }
  }, [currentBalance, numericPoints, entryType]);

  const isDeductionOverdraft = useMemo(() => {
    return entryType === 'Deduction' && numericPoints > currentBalance;
  }, [entryType, numericPoints, currentBalance]);

  // Reset / Clear Form
  const handleClear = () => {
    setSelectedWallet(null);
    setSelectedInvoice(null);
    setInvoiceBreakdown([]);
    setSalesInvoices([]);
    setSelectedScheme(null);
    setSelectedCriteria(null);
    setShowSchemeDetailModal(false);
    setCurrentBalance(0);
    setEntryType('Addition');
    setPoints('0');
    setSelectedReason(reasonOptions[0] || DEFAULT_REASON_OPTIONS[0]);
    setReferenceNo('');
    setEntryDate(getTodayFormatted());
    setRemarks('');
    setErrors({});
    fetchNextEntryNumber();
  };

  // Form Validation
  const validateForm = () => {
    const newErrors = {};

    if (!selectedWallet) {
      newErrors.wallet = 'Please select a wallet.';
    }

    if (!points || numericPoints <= 0) {
      newErrors.points = 'Points must be a positive quantity greater than 0.';
    }

    if (entryType === 'Deduction' && numericPoints > currentBalance) {
      newErrors.points = `Deduction points (${numericPoints.toFixed(2)}) cannot exceed available balance (${currentBalance.toFixed(2)}).`;
    }

    if (!selectedReason || !selectedReason.value) {
      newErrors.reason = 'Please select a reason.';
    }

    if (!entryDate) {
      newErrors.entryDate = 'Please select an entry date.';
    }

    if (selectedScheme && selectedScheme.value) {
      const schemeObj = schemes.find((s) => s.id === selectedScheme.value);
      if (schemeObj) {
        if (schemeObj.end_date && entryDate > schemeObj.end_date) {
          newErrors.scheme = `Scheme '${schemeObj.name}' expired on ${formatDateToDMY(schemeObj.end_date)}.`;
        } else if (schemeObj.start_date && entryDate < schemeObj.start_date) {
          newErrors.scheme = `Scheme '${schemeObj.name}' is only valid from ${formatDateToDMY(schemeObj.start_date)}.`;
        }
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

    const payload = {
      wallet: selectedWallet.value,
      scheme: selectedScheme ? selectedScheme.value : null,
      entry_type: entryType,
      points: numericPoints.toFixed(2),
      reason: selectedReason.value,
      reference_no: referenceNo.trim() || null,
      entry_date: entryDate,
      remarks: remarks.trim() || null,
    };

    try {
      let response;
      if (editId) {
        response = await WalletService.updatePointsEntry(editId, payload);
        Swal.fire({
          icon: 'success',
          title: 'Points Entry Updated!',
          text: `Entry "${response?.entry_number || entryNumber}" updated successfully.`,
          confirmButtonColor: '#2ece8a',
        });
      } else {
        response = await WalletService.createPointsEntry(payload);
        Swal.fire({
          icon: 'success',
          title: 'Entry Posted Successfully!',
          html: `
            <div style="font-size: 14px; text-align: left; margin-top: 10px;">
              <p style="margin-bottom: 6px;"><strong>Entry ID:</strong> <span class="badge bg-light text-dark border">${response?.entry_number || entryNumber}</span></p>
              <p style="margin-bottom: 6px;"><strong>Wallet:</strong> ${selectedWallet.label}</p>
              ${selectedScheme ? `<p style="margin-bottom: 6px;"><strong>Scheme:</strong> ${selectedScheme.label}</p>` : ''}
              <p style="margin-bottom: 6px;"><strong>Type:</strong> <span style="color: ${entryType === 'Addition' ? '#10b981' : '#ef4444'}; font-weight: 600;">${entryType}</span></p>
              <p style="margin-bottom: 6px;"><strong>Points:</strong> ${numericPoints.toFixed(2)}</p>
              <p style="margin-bottom: 6px;"><strong>Reason:</strong> ${selectedReason.value}</p>
              <p style="margin-bottom: 0;"><strong>New Balance:</strong> <strong>${parseFloat(response?.current_balance || balanceAfter).toFixed(2)}</strong></p>
            </div>
          `,
          confirmButtonColor: '#2ece8a',
          confirmButtonText: 'Done',
        });
      }

      setShowModal(false);
      fetchEntries();
      handleClear();
    } catch (err) {
      console.error('Submission failed:', err);
      const resData = err?.response?.data;
      let errorMsg = 'Failed to post points entry. Please try again.';

      if (resData) {
        if (typeof resData === 'string') {
          errorMsg = resData;
        } else if (typeof resData === 'object') {
          const detailed = Object.entries(resData)
            .map(([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(', ') : msg}`)
            .join('<br/>');
          errorMsg = detailed || errorMsg;
        }
      }

      Swal.fire({
        icon: 'error',
        title: 'Transaction Failed',
        html: errorMsg,
        confirmButtonColor: '#2ece8a',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const walletSelectOptions = wallets.map((w) => ({
    value: w.id,
    label: w.wallet_name || w.wallet_code,
    wallet: w,
  }));

  const salesInvoiceSelectOptions = salesInvoices.map((inv) => ({
    value: inv.id,
    label: `${inv.invoice_no}${inv.entry_date ? ` (${formatDateToDMY(inv.entry_date)})` : ''} — ₹${parseFloat(inv.total_amount || 0).toLocaleString('en-IN')}`,
    invoice: inv,
  }));

  const schemeSelectOptions = schemes.map((s) => ({
    value: s.id,
    label: `${s.is_consolidated ? '[Consolidated] ' : ''}${s.name}${s.criteria ? ` — (${s.criteria})` : ''}`,
    scheme: s,
    is_consolidated: Boolean(s.is_consolidated),
  }));

  const criteriaSelectOptions = useMemo(() => {
    if (!selectedScheme?.scheme) return [];
    const schemeObj = selectedScheme.scheme;
    const cType = schemeObj.criteria_type || 'Quantity';
    // Target invoices for checking eligibility: selected invoice or all sales invoices for the wallet
    const activeInvoices = selectedInvoice?.invoice ? [selectedInvoice.invoice] : salesInvoices;

    const qRows = (cType === 'Quantity' || cType === 'Both')
      ? (schemeObj.criteria_rows || [])
          .filter((c) => {
            // If invoices are available, ONLY show eligible products where invoice item qty >= critQty
            if (activeInvoices.length > 0) {
              const critQty = parseFloat(c.quantity || 0);
              const cPId = c.product || c.product_id;
              // Check if any invoice has this item with qty >= critQty
              const hasEligibleItem = activeInvoices.some((inv) => {
                const items = inv.items || [];
                const matched = items.find((it) => String(it.product || it.product_id) === String(cPId));
                return matched && parseFloat(matched.quantity || 0) >= critQty;
              });
              return hasEligibleItem;
            }
            return true;
          })
          .map((c, i) => {
            const pts = parseFloat(c.points || 0);
            const critQty = parseFloat(c.quantity || 0);
            const detailStr = critQty > 0 ? ` (Qty: ${critQty})` : '';

            return {
              value: `q_${c.id || i}`,
              label: `[Qty] ${c.product_name || 'All Products'}${detailStr}: ${pts.toFixed(2)} pts`,
              points: c.points,
              criteria: c,
              isEligible: true,
            };
          })
      : [];

    const vRows = (cType === 'Value' || cType === 'Both')
      ? (schemeObj.criteria_values || schemeObj.criteria_rows_2 || [])
          .filter((v) => {
            // If invoices are available, ONLY show eligible products where invoice item amount >= critVal
            if (activeInvoices.length > 0) {
              const critVal = parseFloat(v.value || 0);
              const cPId = v.product || v.product_id;
              // Check if any invoice has this item with amount >= critVal
              const hasEligibleItem = activeInvoices.some((inv) => {
                const items = inv.items || [];
                const matched = items.find((it) => String(it.product || it.product_id) === String(cPId));
                return matched && parseFloat(matched.amount || matched.total_amount || 0) >= critVal;
              });
              return hasEligibleItem;
            }
            return true;
          })
          .map((v, i) => {
            const pts = parseFloat(v.points || 0);
            const critVal = parseFloat(v.value || 0);
            const detailStr = critVal > 0 ? ` (Val: ₹${critVal})` : '';
            return {
              value: `v_${v.id || i}`,
              label: `[Val] ${v.product_name || 'All Products'}${detailStr}: ${pts.toFixed(2)} pts`,
              points: v.points,
              criteria: v,
              isEligible: true,
            };
          })
      : [];

    const combined = [...qRows, ...vRows];
    if (combined.length > 0) return combined;

    // Fallback if criteria_list is used
    return (schemeObj.criteria_list || []).map((c, i) => ({
      value: `c_${c.id || i}`,
      label: `${c.product_name || 'All Products'}: ${parseFloat(c.points || 0).toFixed(2)} pts`,
      points: c.points,
      criteria: c,
    }));
  }, [selectedScheme, selectedInvoice, salesInvoices]);

  // Select dropdown styles matching ERP standard
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
  const filteredEntries = entries.filter((e) => {
    const term = (searchTerm || '').toLowerCase();
    return (
      (e.entry_number || '').toLowerCase().includes(term) ||
      (e.wallet_name || '').toLowerCase().includes(term) ||
      (e.wallet_code || '').toLowerCase().includes(term) ||
      (e.scheme_name || '').toLowerCase().includes(term) ||
      (e.reference_no || '').toLowerCase().includes(term) ||
      (e.reason || '').toLowerCase().includes(term) ||
      (e.remarks || '').toLowerCase().includes(term)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEntries = filteredEntries.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;

  return (
    <Fragment>
      <style>{`
        /* Standard Matrix Table & Header matching Glenda ERP */
        .points-matrix-header-container {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: wrap !important;
          gap: 15px !important;
        }
        .points-matrix-controls-wrapper {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
        }
        .points-matrix-search-bar {
          width: 280px !important;
          position: relative !important;
        }
        .points-matrix-table th {
          white-space: nowrap !important;
        }

        @media (max-width: 767px) {
          .points-matrix-header-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .points-matrix-controls-wrapper {
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 8px !important;
          }
          .points-matrix-search-bar {
            width: 100% !important;
            order: 2 !important;
            margin-top: 4px !important;
          }
          .points-matrix-add-btn {
            width: auto !important;
            flex-grow: 0 !important;
            order: 1 !important;
            font-size: 12px !important;
            padding: 0 12px !important;
            justify-content: center !important;
          }
          .points-matrix-table {
            min-width: 650px !important;
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

        /* Segmented buttons for Addition / Deduction */
        .points-segmented-group {
          display: inline-flex;
          align-items: center;
          background: #f1f5f9;
          padding: 2px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          height: 38px;
          width: 100%;
        }
        .points-segmented-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 32px;
          font-size: 12.5px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .points-segmented-btn.active.addition {
          background: #2ece8a;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(46, 206, 138, 0.35);
        }
        .points-segmented-btn.active.deduction {
          background: #ef4444;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);
        }

        /* Balance summary cards inside modal */
        .balance-summary-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          background: #f8fafc;
          transition: border-color 0.2s;
        }
        .balance-card-title {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .balance-card-value {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }

        /* Scheme Preview Modal Styles */
        .wallet-scheme-modal.modal-dialog {
          max-width: 960px !important;
          width: 95vw !important;
          margin: 1.75rem auto !important;
          max-height: calc(100vh - 3.5rem) !important;
          max-height: calc(100dvh - 3.5rem) !important;
          display: flex !important;
          align-items: center !important;
        }
        .wallet-scheme-modal .modal-content {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
          max-height: calc(100vh - 3.5rem) !important;
          max-height: calc(100dvh - 3.5rem) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          background: #fff;
        }
        .wallet-scheme-modal .modal-header-custom {
          flex-shrink: 0 !important;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px 14px 24px;
          border-bottom: 1px solid #f1f5f9;
          background: #fff;
        }
        .wallet-scheme-modal .modal-icon-circle {
          width: 42px;
          height: 42px;
          background-color: #2ece8a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
          flex-shrink: 0;
        }
        .wallet-scheme-modal .modal-close-x {
          border: none;
          background: transparent;
          font-size: 22px;
          color: #aaa;
          cursor: pointer;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          flex-shrink: 0;
        }
        .wallet-scheme-modal .modal-close-x:hover {
          color: #555;
        }
        .wallet-scheme-modal .modal-body-custom {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .wallet-scheme-modal .scheme-custom-tabs {
          flex-shrink: 0 !important;
          border-bottom: 1px solid #e2e8f0;
          padding: 0 24px;
          background: #fff;
        }
        .wallet-scheme-modal .scheme-custom-tabs .nav-link {
          text-decoration: none !important;
          color: #64748b;
          font-weight: 500;
          font-size: 13.5px;
          border: none !important;
          border-bottom: 2px solid transparent !important;
          padding: 10px 18px;
          margin-bottom: -1px;
          background-color: transparent !important;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .wallet-scheme-modal .scheme-custom-tabs .nav-link:hover {
          text-decoration: none !important;
          color: #2ece8a;
          border-bottom-color: #cbd5e1 !important;
        }
        .wallet-scheme-modal .scheme-custom-tabs .nav-link.active {
          text-decoration: none !important;
          color: #2ece8a !important;
          font-weight: 600;
          background-color: transparent !important;
          border: none !important;
          border-bottom: 2px solid #2ece8a !important;
        }
        .wallet-scheme-modal .scheme-tab-content {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          max-height: min(380px, 50vh) !important;
          padding: 18px 24px;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar {
          width: 6px;
        }
        .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .wallet-scheme-modal .scheme-tab-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .wallet-scheme-modal .modal-footer-custom {
          flex-shrink: 0 !important;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 12px 24px 14px 24px;
          border-top: 1px solid #f1f5f9;
          background-color: #fafbfc;
          gap: 10px;
        }
      `}</style>

      <div className="container-fluid">
        <div className="row">
          <div className="col-lg-12">
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center points-matrix-header-container">
                <Card.Title className="mb-0">Points Entry</Card.Title>
                <div className="d-flex align-items-center gap-2 points-matrix-controls-wrapper">
                  <div className="points-matrix-search-bar">
                    <i
                      className="fa fa-search position-absolute text-muted"
                      style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}
                    ></i>
                    <Form.Control
                      type="text"
                      placeholder="Search points entries..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      style={{ height: '38px', borderRadius: '6px', paddingLeft: '35px', fontSize: '13px' }}
                    />
                  </div>
                  <CreateButton
                    module="wallet_points_entry"
                    onClick={() => handleOpenModal()}
                    className="points-matrix-add-btn"
                    style={{ height: '38px', borderRadius: '6px', whiteSpace: 'nowrap', padding: '0 16px' }}
                  >
                    Points Entry
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
                    <table className="table table-responsive-md points-matrix-table">
                      <thead>
                        <tr>
                          <th><strong>Sl.No</strong></th>
                          <th><strong>DATE</strong></th>
                          <th><strong>WALLET</strong></th>
                          <th><strong>SCHEME</strong></th>
                          <th><strong>TYPE</strong></th>
                          <th className="text-end"><strong>POINTS</strong></th>
                          <th className="text-end"><strong>ACTIONS</strong></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEntries.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-4 text-muted">
                              No entries found
                            </td>
                          </tr>
                        ) : (
                          currentEntries.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td>{indexOfFirstItem + idx + 1}</td>
                              <td>{formatDateToDMY(item.entry_date)}</td>
                              <td>
                                <strong>{item.wallet_name || item.wallet_code}</strong>
                              </td>
                              <td>
                                {item.scheme_name ? (
                                  <div className="d-flex align-items-center gap-1 flex-wrap">
                                    <span className="badge light badge-info" style={{ fontSize: '11.5px' }}>
                                      {item.scheme_name}
                                    </span>
                                    {item.scheme_is_consolidated && (
                                      <span
                                        className="badge"
                                        style={{
                                          backgroundColor: '#e0e7ff',
                                          color: '#4338ca',
                                          border: '1px solid #c7d2fe',
                                          fontSize: '10px',
                                          padding: '2px 5px',
                                          borderRadius: '4px',
                                          fontWeight: '600',
                                        }}
                                        title="Consolidated Scheme"
                                      >
                                        Consolidated
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted">—</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge light badge-${item.entry_type === 'Addition' ? 'success' : 'danger'}`}>
                                  {item.entry_type === 'Addition' ? '+ Addition' : '− Deduction'}
                                </span>
                              </td>
                              <td className="text-end font-w600" style={{ color: item.entry_type === 'Addition' ? '#2ece8a' : '#ef4444' }}>
                                {item.entry_type === 'Addition' ? `+${parseFloat(item.points || 0).toFixed(2)}` : `-${parseFloat(item.points || 0).toFixed(2)}`}
                              </td>
                              <td className="text-end">
                                <div className="d-flex justify-content-end align-items-center">
                                  <EditButton
                                    module="wallet_points_entry"
                                    onClick={() => handleOpenModal(item)}
                                    className="me-1"
                                  />
                                  <DeleteButton
                                    module="wallet_points_entry"
                                    onClick={() => handleDelete(item)}
                                    title={item.reference_no ? `Connected to ${item.reference_no}` : "Delete Points Entry"}
                                  />
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {filteredEntries.length > 0 && (
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div className="dataTables_info" style={{ fontSize: '13px', color: '#6e6e6e' }}>
                          Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredEntries.length)} of {filteredEntries.length} entries
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
          MODAL POPUP: POINTS ENTRY FORM
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
              <i className="fa fa-coins"></i>
            </div>
            <div>
              <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '18px', color: '#1e293b' }}>
                {editId ? 'Edit Points Entry' : 'Add Points Entry'}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
                {editId ? 'Modify points entry details and recalculate balances' : 'Credit or debit reward points to an active wallet account'}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-x" onClick={handleCloseModal}>
            &times;
          </button>
        </div>

        <Form onSubmit={handleSubmit}>
          <div className="modal-body-custom">
            {/* ── ROW 1: Entry ID (Auto) | Date | Owner Type | Wallet | Scheme ── */}
            <Row className="g-3 mb-4">
              {/* Field 1: Entry ID */}
              <Col xl={2} lg={2} md={6} sm={12}>
                <Form.Group controlId="modalEntryNumberInput">
                  <Form.Label className="form-label-custom">
                    Entry ID <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={entryNumber}
                    readOnly
                    placeholder={loadingCode ? 'Generating...' : 'e.g. PE-00001'}
                    className="form-control-custom"
                    style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', fontWeight: '600' }}
                  />
                </Form.Group>
              </Col>

              {/* Field 2: Entry Date */}
              <Col xl={2} lg={2} md={6} sm={12}>
                <Form.Group controlId="modalEntryDateInput">
                  <Form.Label className="form-label-custom">
                    Date <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className={`form-control-custom ${errors.entryDate ? 'is-invalid' : ''}`}
                  />
                  {errors.entryDate && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.entryDate}
                    </div>
                  )}
                </Form.Group>
              </Col>

              {/* Field 3: Owner Type */}
              <Col xl={2} lg={2} md={6} sm={12}>
                <Form.Group controlId="modalOwnerTypeSelect">
                  <Form.Label className="form-label-custom">
                    Owner Type <span className="text-danger">*</span>
                  </Form.Label>
                  <Select
                    placeholder="Owner type"
                    options={ownerTypeOptions}
                    value={selectedOwnerType}
                    onChange={handleOwnerTypeChange}
                    styles={selectStyles(false)}
                    isLoading={loadingOwnerTypes}
                    isClearable={false}
                  />
                </Form.Group>
              </Col>

              {/* Field 4: Wallet */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalWalletSelect">
                  <Form.Label className="form-label-custom">
                    Wallet <span className="text-danger">*</span>
                  </Form.Label>
                  <Select
                    placeholder={loadingWallets ? 'Loading wallets...' : 'Select wallet'}
                    options={walletSelectOptions}
                    value={selectedWallet}
                    onChange={handleWalletChange}
                    styles={selectStyles(!!errors.wallet)}
                    isLoading={loadingWallets}
                    isClearable
                    noOptionsMessage={() => `No active ${selectedOwnerType?.label || ''} wallets`}
                  />
                  {errors.wallet && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.wallet}
                    </div>
                  )}
                </Form.Group>
              </Col>

              {/* Field 5: Scheme */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalSchemeSelect">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <Form.Label className="form-label-custom mb-0">Scheme</Form.Label>
                    {selectedScheme?.scheme && (
                      <button
                        type="button"
                        className="btn btn-link p-0 text-success fw-semibold"
                        style={{ fontSize: '11.5px', textDecoration: 'none' }}
                        onClick={() => {
                          const cType = selectedScheme.scheme?.criteria_type || 'Quantity';
                          if (cType === 'Value') {
                            setSchemeDetailTab('criteria_2');
                          } else {
                            setSchemeDetailTab('criteria');
                          }
                          setShowSchemeDetailModal(true);
                        }}
                        title="Click to view Scheme Criteria"
                      >
                        <i className="fa fa-list-check me-1"></i>View Scheme Criteria
                      </button>
                    )}
                  </div>
                  <Select
                    placeholder="Select scheme"
                    options={schemeSelectOptions}
                    value={selectedScheme}
                    onChange={handleSchemeChange}
                    styles={selectStyles(false)}
                    isLoading={loadingSchemes}
                    isClearable
                    formatOptionLabel={(option) => (
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <span>
                          {option.scheme?.name || option.label}
                          {option.scheme?.criteria ? (
                            <span className="text-muted ms-1" style={{ fontSize: '11.5px' }}>
                              ({option.scheme.criteria})
                            </span>
                          ) : null}
                        </span>
                        {option.is_consolidated && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#e0e7ff',
                              color: '#4338ca',
                              border: '1px solid #c7d2fe',
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: '600',
                              letterSpacing: '0.2px',
                            }}
                          >
                            Consolidated
                          </span>
                        )}
                      </div>
                    )}
                  />
                </Form.Group>
              </Col>
            </Row>

            {/* ── SCHEME CRITERIA BANNER (If scheme is selected) ── */}
            {selectedScheme && (
              <div
                className="p-3 mb-4 rounded-3 border"
                style={{
                  backgroundColor: '#f0fdf4',
                  borderColor: '#bbf7d0',
                }}
              >
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success" style={{ fontSize: '12px' }}>
                      <i className="fa fa-award me-1"></i> Active Scheme
                    </span>
                    <strong className="text-dark" style={{ fontSize: '13.5px' }}>
                      {selectedScheme.scheme?.name}
                    </strong>
                    {selectedScheme.scheme?.is_consolidated && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          letterSpacing: '0.2px',
                        }}
                      >
                        Consolidated
                      </span>
                    )}
                    {selectedScheme.scheme?.criteria && (
                      <span className="text-muted" style={{ fontSize: '13px' }}>
                        — Criteria: <em>{selectedScheme.scheme.criteria}</em>
                      </span>
                    )}
                  </div>
                  <div className="text-success fw-bold" style={{ fontSize: '13px' }}>
                    <i className="fa fa-coins me-1"></i>
                    Scheme Criteria Points: {parseFloat(selectedScheme.scheme?.total_criteria_points || 0).toFixed(2)} pts
                  </div>
                </div>

                {!selectedScheme.scheme?.is_consolidated && criteriaSelectOptions.length > 0 && (
                  <Row className="g-2 align-items-center mt-1">
                    <Col md={criteriaSelectOptions.length > 1 ? 7 : 12}>
                      <Form.Group controlId="modalCriteriaSelect">
                        <Form.Label className="form-label-custom mb-1" style={{ fontSize: '12.5px' }}>
                          Select Applicable Product Criteria:
                        </Form.Label>
                        <Select
                          placeholder="Select product criteria (auto-fills points)"
                          options={criteriaSelectOptions}
                          value={selectedCriteria}
                          onChange={handleCriteriaChange}
                          styles={selectStyles(false)}
                          isClearable
                        />
                      </Form.Group>
                    </Col>
                    {criteriaSelectOptions.length > 1 && (
                      <Col md={5}>
                        <div className="d-flex gap-2 align-items-end" style={{ height: '100%', paddingTop: '22px' }}>
                          <Button
                            type="button"
                            variant="outline-success"
                            size="sm"
                            onClick={() => {
                              setSelectedCriteria(null);
                              const targetInvoices = selectedInvoice?.invoice ? [selectedInvoice.invoice] : salesInvoices;
                              if (targetInvoices.length > 0 && selectedScheme?.scheme) {
                                const { totalPoints, breakdown } = calculateSchemePoints(selectedScheme.scheme, targetInvoices, null);
                                setInvoiceBreakdown(breakdown);
                                if (breakdown.length > 0) {
                                  setPoints(totalPoints.toFixed(2));
                                } else {
                                  const total = parseFloat(selectedScheme.scheme?.total_criteria_points || 0);
                                  setPoints(total > 0 ? String(total) : '0');
                                }
                              } else {
                                const total = parseFloat(selectedScheme.scheme?.total_criteria_points || 0);
                                setPoints(total > 0 ? String(total) : '0');
                              }
                            }}
                            style={{ borderRadius: '6px', fontSize: '12px' }}
                          >
                            Use All Products ({parseFloat(selectedScheme.scheme?.total_criteria_points || 0).toFixed(2)} criteria pts)
                          </Button>
                        </div>
                      </Col>
                    )}
                  </Row>
                )}
              </div>
            )}

            {/* ── ROW 2: Entry Type | Points | Reason | Reference No ── */}
            <Row className="g-3 mb-4">
              {/* Field 5: Entry Type */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalEntryTypeSelect">
                  <Form.Label className="form-label-custom">
                    Entry Type <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="points-segmented-group">
                    <button
                      type="button"
                      className={`points-segmented-btn ${entryType === 'Addition' ? 'active addition' : ''}`}
                      onClick={() => {
                        setEntryType('Addition');
                        setErrors((p) => ({ ...p, points: null }));
                      }}
                    >
                      <i className="fa fa-plus"></i>
                      Addition
                    </button>
                    <button
                      type="button"
                      className={`points-segmented-btn ${entryType === 'Deduction' ? 'active deduction' : ''}`}
                      onClick={() => {
                        setEntryType('Deduction');
                        setErrors((p) => ({ ...p, points: null }));
                      }}
                    >
                      <i className="fa fa-minus"></i>
                      Deduction
                    </button>
                  </div>
                </Form.Group>
              </Col>

              {/* Field 6: Points */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalPointsInput">
                  <Form.Label className="form-label-custom">
                    Points <span className="text-danger">*</span>
                    {selectedScheme && (
                      <span className="badge bg-success-subtle text-success ms-2" style={{ fontSize: '10.5px' }}>
                        <i className="fa fa-lock me-1"></i>Auto-calculated
                      </span>
                    )}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={points}
                    readOnly={!!selectedScheme}
                    disabled={!!selectedScheme}
                    style={selectedScheme ? { backgroundColor: '#f8fafc', cursor: 'not-allowed', color: '#0f172a', fontWeight: '600' } : {}}
                    onFocus={() => {
                      if (!selectedScheme && (points === '0' || points === '0.00' || points === 0)) {
                        setPoints('');
                      }
                    }}
                    onBlur={() => {
                      if (!selectedScheme && (points === '' || points === null)) {
                        setPoints('0');
                      }
                    }}
                    onChange={(e) => {
                      if (!selectedScheme) {
                        setPoints(e.target.value);
                        setErrors((p) => ({ ...p, points: null }));
                      }
                    }}
                    className={`form-control-custom ${errors.points ? 'is-invalid' : ''}`}
                  />
                  {selectedScheme && (
                    <small className="text-muted d-block mt-1" style={{ fontSize: '11px' }}>
                      <i className="fa fa-info-circle me-1"></i>
                      Calculated automatically from scheme criteria.
                    </small>
                  )}
                  {errors.points && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.points}
                    </div>
                  )}
                </Form.Group>
              </Col>

              {/* Field 7: Reason */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalReasonSelect">
                  <Form.Label className="form-label-custom">
                    Reason <span className="text-danger">*</span>
                  </Form.Label>
                  <Select
                    options={reasonOptions}
                    isLoading={loadingReasons}
                    value={selectedReason}
                    onChange={(opt) => {
                      setSelectedReason(opt);
                      setErrors((p) => ({ ...p, reason: null }));
                    }}
                    styles={selectStyles(!!errors.reason)}
                    isClearable={false}
                  />
                  {errors.reason && (
                    <div className="text-danger mt-1" style={{ fontSize: '12px' }}>
                      {errors.reason}
                    </div>
                  )}
                </Form.Group>
              </Col>

              {/* Field 8: Reference No / Sales Invoice Selector */}
              <Col xl={3} lg={3} md={6} sm={12}>
                <Form.Group controlId="modalReferenceNoInput">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <Form.Label className="form-label-custom mb-0">Reference / Invoice</Form.Label>
                    {salesInvoices.length > 0 && (
                      <span className="text-muted" style={{ fontSize: '11px' }}>
                        {salesInvoices.length} invoice{salesInvoices.length > 1 ? 's' : ''} available
                      </span>
                    )}
                  </div>
                  {salesInvoices.length > 0 ? (
                    <Select
                      placeholder="Select sales invoice or enter ref"
                      options={salesInvoiceSelectOptions}
                      value={selectedInvoice}
                      onChange={handleInvoiceChange}
                      styles={selectStyles(false)}
                      isLoading={loadingInvoices}
                      isClearable
                      noOptionsMessage={() => 'No sales invoices for this wallet'}
                    />
                  ) : (
                    <Form.Control
                      type="text"
                      placeholder="Invoice / order / ticket"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="form-control-custom"
                    />
                  )}
                </Form.Group>
              </Col>
            </Row>

            {/* ── SCHEME CRITERIA CALCULATION BREAKDOWN BANNER ── */}
            {invoiceBreakdown.length > 0 && (
              <div
                className="p-3 mb-4 rounded-3 border"
                style={{
                  backgroundColor: '#f8fafc',
                  borderColor: '#cbd5e1',
                }}
              >
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary" style={{ fontSize: '12px' }}>
                      <i className="fa fa-calculator me-1"></i> Points Calculation Breakdown
                    </span>
                    <strong className="text-dark" style={{ fontSize: '13px' }}>
                      {selectedInvoice?.invoice ? `Invoice: ${selectedInvoice.invoice.invoice_no}` : `Wallet Invoices (${salesInvoices.length} available)`}
                    </strong>
                    <span className="text-muted" style={{ fontSize: '12.5px' }}>
                      (Scheme: <em>{selectedScheme?.scheme?.name}</em>)
                    </span>
                    {selectedScheme?.scheme?.is_consolidated && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe',
                          fontSize: '10.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          letterSpacing: '0.2px',
                        }}
                      >
                        Consolidated
                      </span>
                    )}
                  </div>
                  <div className="text-primary fw-bold" style={{ fontSize: '13.5px' }}>
                    <i className="fa fa-coins me-1"></i>
                    Calculated Points: {invoiceBreakdown.reduce((sum, item) => sum + item.earnedPoints, 0).toFixed(2)} pts
                  </div>
                </div>

                <div className="table-responsive mt-2">
                  <table className="table table-sm table-bordered mb-0" style={{ fontSize: '12px', background: '#fff' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Criteria Type</th>
                        <th className="text-center">Invoice Value / Qty</th>
                        <th className="text-center">Criteria Target</th>
                        <th className="text-center">Criteria Pts</th>
                        <th className="text-end">Calculation Formula</th>
                        <th className="text-end">Earned Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceBreakdown.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{row.productName}</strong>
                            {row.invoiceNo && !selectedInvoice?.invoice && (
                              <span className="text-muted ms-1" style={{ fontSize: '11px' }}>({row.invoiceNo})</span>
                            )}
                          </td>
                          <td className="text-center">
                            <span className={`badge light badge-${row.type === 'Value' ? 'warning' : 'info'}`} style={{ fontSize: '11px' }}>
                              {row.type}
                            </span>
                          </td>
                          <td className="text-center font-monospace">
                            {row.type === 'Value' ? (
                              row.returnValue > 0 ? (
                                <div>
                                  <strong className="text-dark">₹{row.netValue.toFixed(2)}</strong>
                                  <div className="text-muted" style={{ fontSize: '10px' }}>
                                    (Gross: ₹{row.invoiceValue.toFixed(2)}, Ret: -₹{row.returnValue.toFixed(2)})
                                  </div>
                                </div>
                              ) : (
                                `₹${row.invoiceValue.toFixed(2)}`
                              )
                            ) : (
                              row.returnQty > 0 ? (
                                <div>
                                  <strong className="text-dark">{row.netQty.toFixed(2)}</strong>
                                  <div className="text-muted" style={{ fontSize: '10px' }}>
                                    (Gross: {row.invoiceQty.toFixed(2)}, Ret: -{row.returnQty.toFixed(2)})
                                  </div>
                                </div>
                              ) : (
                                row.invoiceQty.toFixed(2)
                              )
                            )}
                          </td>
                          <td className="text-center font-monospace">
                            {row.type === 'Value' ? `₹${row.criteriaValue.toFixed(2)}` : row.criteriaQty.toFixed(2)}
                          </td>
                          <td className="text-center font-monospace">{row.criteriaPoints.toFixed(2)}</td>
                          <td className="text-end text-muted font-monospace">
                            {row.formulaText || (row.type === 'Value'
                              ? `(₹${row.invoiceValue.toFixed(2)} / ₹${row.criteriaValue.toFixed(2)}) × ${row.criteriaPoints.toFixed(2)}`
                              : `(${row.invoiceQty.toFixed(2)} / ${row.criteriaQty.toFixed(2)}) × ${row.criteriaPoints.toFixed(2)}`)}
                          </td>
                          <td className="text-end fw-bold text-success font-monospace">
                            +{row.earnedPoints.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <th colSpan="6" className="text-end">Total Points:</th>
                        <th className="text-end text-success fw-bold font-monospace" style={{ fontSize: '13px' }}>
                          +{invoiceBreakdown.reduce((sum, item) => sum + item.earnedPoints, 0).toFixed(2)}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── ROW 3: Balance Summary Cards ── */}
            <div className="mb-4">
              <Row className="g-3">
                <Col md={4} sm={12}>
                  <div className="balance-summary-card">
                    <div className="balance-card-title">
                      <span>Current Balance</span>
                      <i className="fa fa-wallet text-muted"></i>
                    </div>
                    <div className="balance-card-value">
                      {loadingBalance ? (
                        <Spinner animation="border" size="sm" variant="secondary" />
                      ) : (
                        currentBalance.toFixed(2)
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                      {selectedWallet ? 'Available points' : 'Select wallet to view balance'}
                    </div>
                  </div>
                </Col>

                <Col md={4} sm={12}>
                  <div className="balance-summary-card">
                    <div className="balance-card-title">
                      <span>This Entry</span>
                      <i className={`fa ${entryType === 'Addition' ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger'}`}></i>
                    </div>
                    <div
                      className="balance-card-value"
                      style={{ color: entryType === 'Addition' ? '#2ece8a' : '#ef4444' }}
                    >
                      {entryType === 'Addition' ? `+${numericPoints.toFixed(2)}` : `−${numericPoints.toFixed(2)}`}
                    </div>
                    <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                      {entryType === 'Addition' ? 'Credit addition quantity' : 'Debit deduction quantity'}
                    </div>
                  </div>
                </Col>

                <Col md={4} sm={12}>
                  <div
                    className="balance-summary-card"
                    style={{
                      borderColor: isDeductionOverdraft ? '#ef4444' : '#e2e8f0',
                      backgroundColor: isDeductionOverdraft ? '#fef2f2' : '#f8fafc',
                    }}
                  >
                    <div className="balance-card-title">
                      <span>Balance After</span>
                      <i className={`fa fa-calculator ${isDeductionOverdraft ? 'text-danger' : 'text-muted'}`}></i>
                    </div>
                    <div
                      className="balance-card-value"
                      style={{ color: isDeductionOverdraft ? '#ef4444' : '#1e293b' }}
                    >
                      {balanceAfter.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11px', marginTop: '2px' }}>
                      {isDeductionOverdraft ? (
                        <span className="text-danger fw-semibold">
                          <i className="fa fa-exclamation-triangle me-1"></i> Deduction exceeds balance!
                        </span>
                      ) : (
                        <span className="text-muted">Projected resulting balance</span>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            {/* ── ROW 4: Remarks (Full-width Textarea) ── */}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group controlId="modalRemarksInput">
                  <Form.Label className="form-label-custom">Remarks</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Add any specific remarks or notes regarding this points entry..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="form-control-custom"
                    style={{ minHeight: '65px', height: 'auto', resize: 'vertical' }}
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
              disabled={submitting || isDeductionOverdraft || loadingCode}
            >
              {submitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  {editId ? 'Updating...' : 'Posting...'}
                </>
              ) : (
                editId ? 'Update Entry' : 'Post Entry'
              )}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL POPUP: SCHEME DETAILS (VIEW SCHEME IN POPUP)
      ───────────────────────────────────────────────────────────── */}
      <Modal
        show={showSchemeDetailModal}
        onHide={() => setShowSchemeDetailModal(false)}
        dialogClassName="wallet-scheme-modal"
        backdrop={true}
        keyboard={true}
        centered
        size="lg"
      >
        <div className="modal-header-custom">
          <div className="d-flex align-items-center gap-3">
            <div className="modal-icon-circle" style={{ backgroundColor: '#2ece8a' }}>
              <i className="fa fa-list-check text-white" style={{ fontSize: '18px' }}></i>
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h4 className="modal-title font-w600 mb-0" style={{ fontSize: '17px', color: '#1e293b' }}>
                  {selectedScheme?.scheme?.name ? `${selectedScheme.scheme.name} — Criteria` : 'Scheme Criteria'}
                </h4>
                {selectedScheme?.scheme?.is_consolidated && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#e0e7ff',
                      color: '#4338ca',
                      border: '1px solid #c7d2fe',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      boxShadow: '0 1px 2px rgba(99, 102, 241, 0.08)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    Consolidated
                  </span>
                )}
                {(selectedScheme?.scheme?.start_date || selectedScheme?.scheme?.end_date) && (
                  <span
                    className="badge d-inline-flex align-items-center"
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      boxShadow: '0 1px 2px rgba(59, 130, 246, 0.08)',
                      letterSpacing: '0.2px'
                    }}
                  >
                    <i className="fa fa-calendar-days me-1.5 text-primary" style={{ fontSize: '12px' }}></i>
                    <span>
                      {selectedScheme.scheme.start_date ? formatDateToDMY(selectedScheme.scheme.start_date) : 'Start'}
                      <span className="mx-1 text-muted" style={{ fontWeight: '400' }}>to</span>
                      {selectedScheme.scheme.end_date ? formatDateToDMY(selectedScheme.scheme.end_date) : 'End'}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-muted mb-0" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                {selectedScheme?.scheme?.criteria_type === 'Both'
                  ? 'Criteria defined for Quantity and Value'
                  : selectedScheme?.scheme?.criteria_type === 'Value'
                  ? 'Value Based Criteria table'
                  : 'Quantity Based Criteria table'}
                {selectedScheme?.scheme?.total_criteria_points ? ` • Total Points: ${parseFloat(selectedScheme.scheme.total_criteria_points).toFixed(2)} pts` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-x"
            onClick={() => setShowSchemeDetailModal(false)}
            title="Close popup"
          >
            &times;
          </button>
        </div>

        <div className="modal-body-custom">
          {selectedScheme?.scheme ? (
            <div>
              {/* If Scheme has both criteria types or if tabs are needed, render the tabs */}
              {selectedScheme.scheme?.criteria_type === 'Both' && (
                <Nav className="scheme-custom-tabs">
                  <Nav.Item>
                    <Nav.Link
                      className={schemeDetailTab === 'criteria' ? 'active' : ''}
                      onClick={() => setSchemeDetailTab('criteria')}
                    >
                      Quantity Based Criteria
                      {(selectedScheme.scheme?.criteria_rows || []).length > 0 && (
                        <span className="badge badge-xs badge-info ms-2" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
                          {(selectedScheme.scheme?.criteria_rows || []).length}
                        </span>
                      )}
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link
                      className={schemeDetailTab === 'criteria_2' ? 'active' : ''}
                      onClick={() => setSchemeDetailTab('criteria_2')}
                    >
                      Value Based Criteria
                      {((selectedScheme.scheme?.criteria_values || selectedScheme.scheme?.criteria_rows_2 || []).length) > 0 && (
                        <span className="badge badge-xs badge-info ms-2" style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>
                          {(selectedScheme.scheme?.criteria_values || selectedScheme.scheme?.criteria_rows_2 || []).length}
                        </span>
                      )}
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              )}

              {/* Tab Contents: Only Criteria */}
              <div className="scheme-tab-content">
                {/* 1. Quantity Based Criteria Tab */}
                {schemeDetailTab === 'criteria' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold mb-1 text-primary" style={{ fontSize: '13.5px' }}>
                        <i className="fa fa-boxes-stacked me-2"></i>
                        Quantity Based Criteria
                      </h6>
                      <span className="badge bg-light text-dark border" style={{ fontSize: '11px' }}>
                        {(selectedScheme.scheme?.criteria_rows || []).length} Rows Defined
                      </span>
                    </div>

                    {(selectedScheme.scheme?.criteria_rows || []).length === 0 ? (
                      <div className="text-center py-4 text-muted border rounded bg-light">
                        No quantity-based criteria defined for this scheme.
                      </div>
                    ) : (
                      <div className="table-responsive border rounded">
                        <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                          <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                              <th style={{ width: '40px' }} className="text-center">#</th>
                              <th>Product</th>
                              <th style={{ width: '120px' }}>Quantity</th>
                              <th style={{ width: '130px' }}>Discount %</th>
                              <th style={{ width: '130px' }}>Discount Value</th>
                              <th style={{ width: '120px' }} className="text-end">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedScheme.scheme.criteria_rows.map((r, idx) => (
                              <tr key={r.id || idx}>
                                <td className="text-center text-muted">{idx + 1}</td>
                                <td>
                                  <strong>{r.product_name || 'All Products'}</strong>
                                  {r.product_code && <span className="text-muted ms-1">({r.product_code})</span>}
                                </td>
                                <td>{r.quantity ? parseFloat(r.quantity).toFixed(2) : '-'}</td>
                                <td>{r.percentage ? `${parseFloat(r.percentage).toFixed(2)}%` : '-'}</td>
                                <td>{r.value ? parseFloat(r.value).toFixed(2) : '-'}</td>
                                <td className="text-end fw-bold text-success">
                                  {r.points ? parseFloat(r.points).toFixed(2) : '0.00'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Value Based Criteria Tab */}
                {schemeDetailTab === 'criteria_2' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold mb-1 text-primary" style={{ fontSize: '13.5px' }}>
                        <i className="fa fa-receipt me-2"></i>
                        Value Based Criteria
                      </h6>
                      <span className="badge bg-light text-dark border" style={{ fontSize: '11px' }}>
                        {(selectedScheme.scheme?.criteria_values || selectedScheme.scheme?.criteria_rows_2 || []).length} Rows Defined
                      </span>
                    </div>

                    {(selectedScheme.scheme?.criteria_values || selectedScheme.scheme?.criteria_rows_2 || []).length === 0 ? (
                      <div className="text-center py-4 text-muted border rounded bg-light">
                        No value-based criteria defined for this scheme.
                      </div>
                    ) : (
                      <div className="table-responsive border rounded">
                        <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: '13px' }}>
                          <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                              <th style={{ width: '40px' }} className="text-center">#</th>
                              <th>Product</th>
                              <th style={{ width: '130px' }}>Value</th>
                              <th style={{ width: '130px' }}>Discount %</th>
                              <th style={{ width: '130px' }}>Discount Value</th>
                              <th style={{ width: '120px' }} className="text-end">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedScheme.scheme.criteria_values || selectedScheme.scheme.criteria_rows_2).map((r, idx) => (
                              <tr key={r.id || idx}>
                                <td className="text-center text-muted">{idx + 1}</td>
                                <td>
                                  <strong>{r.product_name || 'All Products'}</strong>
                                  {r.product_code && <span className="text-muted ms-1">({r.product_code})</span>}
                                </td>
                                <td>{r.value ? parseFloat(r.value).toFixed(2) : '-'}</td>
                                <td>{r.discount_percentage ? `${parseFloat(r.discount_percentage).toFixed(2)}%` : (r.percentage ? `${parseFloat(r.percentage).toFixed(2)}%` : '-')}</td>
                                <td>{r.discount_value ? parseFloat(r.discount_value).toFixed(2) : '-'}</td>
                                <td className="text-end fw-bold text-success">
                                  {r.points ? parseFloat(r.points).toFixed(2) : '0.00'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted">No scheme selected.</div>
          )}
        </div>

        <div className="modal-footer-custom">
          <Button
            type="button"
            className="btn-save-custom"
            onClick={() => setShowSchemeDetailModal(false)}
          >
            Done
          </Button>
        </div>
      </Modal>
    </Fragment>
  );
};

export default WalletPointsEntry;
