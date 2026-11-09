export const emptyRow = () => ({
    _key: Date.now() + Math.random(),
    stock_item: '',
    stock_item_obj: null,
    quantity: '',
    rate: '',
    amount: 0,
    warehouse: null,
    batch_number: '',
    expiry_date: null,
    manufacture_date: null,
    splits: [],
    // popup trigger state (not sent to backend)
    _popupOpen: false,
    _pendingItemId: null,
});
