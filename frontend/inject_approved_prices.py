import re

file_path = 'c:/Paul@Rarenett/glenda_vite1/frontend/src/jsx/components/MarketingConnect/OrdersModule.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

state_code = """    const [customerLedger, setCustomerLedger] = useState('');
    const [approvedPrices, setApprovedPrices] = useState({});
    
    useEffect(() => {
        if (!customerLedger) {
            setApprovedPrices({});
            return;
        }
        axiosInstance.get('/api/project/marketing/wishlist/approved_prices/?ledger_id=' + customerLedger)
            .then(res => {
                const map = {};
                if (Array.isArray(res.data)) {
                    res.data.forEach(x => { map[x.stock_item] = parseFloat(x.negotiated_price); });
                }
                setApprovedPrices(map);
            }).catch(e => console.error("Error fetching approved prices", e));
    }, [customerLedger]);
"""

content = content.replace("const [customerLedger, setCustomerLedger] = useState('');", state_code)

old_rate = "priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0)"
new_rate = "approvedPrices[item.id] !== undefined ? approvedPrices[item.id] : (priceListRates[item.id] !== undefined ? priceListRates[item.id] : (parseFloat(item.ss_rate) || 0))"
content = content.replace(old_rate, new_rate)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Applied approvedPrices to OrdersModule.jsx')
