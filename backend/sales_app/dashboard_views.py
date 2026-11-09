import datetime
from django.db.models import Sum, Count, F
from django.db.models.functions import TruncMonth, ExtractWeekDay, TruncDay
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from sales_app.models import SalesInvoice, SalesOrder, SalesInvoiceItem, DailyProductionItem
from purchase_app.models import PurchaseOrder
from finance_app.models import PaymentVoucherDetail
from inventory_app.models import StockItem, StockTable, Warehouse
from register_app.models import CustomUser

class CommonDashboardAPIView(APIView):
    """
    Provides aggregated, real-time data for the Executive Dashboard.
    Supports dynamic date filtering.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        today = timezone.now().date()
        
        # Parse date range from frontend
        start_date_str = request.GET.get('start_date')
        end_date_str = request.GET.get('end_date')
        
        if start_date_str and end_date_str:
            try:
                start_date = parse_date(start_date_str)
                end_date = parse_date(end_date_str)
            except:
                start_date = today.replace(day=1)
                end_date = today
        else:
            start_date = today.replace(day=1)
            end_date = today

        # Calculate previous period for % change comparison
        delta = end_date - start_date
        prev_end_date = start_date - datetime.timedelta(days=1)
        prev_start_date = prev_end_date - delta

        # Helper to calculate % change
        def calc_change(current, previous):
            current, previous = float(current), float(previous)
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        # --- KPI Calculations ---
        # 1. Total Revenue
        current_revenue = SalesInvoice.objects.filter(
            entry_date__gte=start_date, entry_date__lte=end_date
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        prev_revenue = SalesInvoice.objects.filter(
            entry_date__gte=prev_start_date, entry_date__lte=prev_end_date
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # 2. Total Orders
        current_orders = SalesOrder.objects.filter(
            entry_date__gte=start_date, entry_date__lte=end_date
        ).count()
        prev_orders = SalesOrder.objects.filter(
            entry_date__gte=prev_start_date, entry_date__lte=prev_end_date
        ).count()

        # 3. Total Expenses
        current_expenses = PaymentVoucherDetail.objects.filter(
            ledger__accountGroup__nature='Expense',
            voucher__voucher_date__gte=start_date,
            voucher__voucher_date__lte=end_date
        ).aggregate(total=Sum('debit_amount'))['total'] or 0
        
        prev_expenses = PaymentVoucherDetail.objects.filter(
            ledger__accountGroup__nature='Expense',
            voucher__voucher_date__gte=prev_start_date,
            voucher__voucher_date__lte=prev_end_date
        ).aggregate(total=Sum('debit_amount'))['total'] or 0

        # 4. Net Profit
        current_profit = float(current_revenue) - float(current_expenses)
        prev_profit = float(prev_revenue) - float(prev_expenses)

        # --- Analytics Row & Sparklines ---
        # 5. Sales & Revenue Overview (Line/Bar Chart)
        is_daily = delta.days <= 60
        trunc_func = TruncDay if is_daily else TruncMonth
        
        earned_data = SalesInvoice.objects.filter(entry_date__gte=start_date, entry_date__lte=end_date)\
            .annotate(period=trunc_func('entry_date'))\
            .values('period')\
            .annotate(total=Sum('total_amount'))\
            .order_by('period')
            
        orders_data = SalesOrder.objects.filter(entry_date__gte=start_date, entry_date__lte=end_date)\
            .annotate(period=trunc_func('entry_date'))\
            .values('period')\
            .annotate(count=Count('id'))\
            .order_by('period')

        expenses_data = PaymentVoucherDetail.objects.filter(
            ledger__accountGroup__nature='Expense',
            voucher__voucher_date__gte=start_date,
            voucher__voucher_date__lte=end_date
        ).annotate(period=trunc_func('voucher__voucher_date'))\
         .values('period')\
         .annotate(total=Sum('debit_amount'))\
         .order_by('period')

        chart_dict = {}
        date_format = '%d %b' if is_daily else '%b %Y'
        
        for item in earned_data:
            p_name = item['period'].strftime(date_format)
            chart_dict[p_name] = {'name': p_name, 'revenue': float(item['total']), 'orders': 0, 'expenses': 0, 'profit': float(item['total'])}
            
        for item in orders_data:
            p_name = item['period'].strftime(date_format)
            if p_name not in chart_dict:
                chart_dict[p_name] = {'name': p_name, 'revenue': 0, 'orders': 0, 'expenses': 0, 'profit': 0}
            chart_dict[p_name]['orders'] = item['count']

        for item in expenses_data:
            p_name = item['period'].strftime(date_format)
            if p_name not in chart_dict:
                chart_dict[p_name] = {'name': p_name, 'revenue': 0, 'orders': 0, 'expenses': 0, 'profit': 0}
            chart_dict[p_name]['expenses'] = float(item['total'])
            chart_dict[p_name]['profit'] -= float(item['total'])

        line_chart_data = list(chart_dict.values())
        line_chart_data.sort(key=lambda x: datetime.datetime.strptime(x['name'], date_format))
        
        # Sparklines
        rev_spark = [{"val": item['revenue']} for item in line_chart_data]
        ord_spark = [{"val": item['orders']} for item in line_chart_data]
        exp_spark = [{"val": item['expenses']} for item in line_chart_data]
        prof_spark = [{"val": item['profit']} for item in line_chart_data]

        kpis = {
            "revenue": {
                "current": float(current_revenue),
                "change": calc_change(current_revenue, prev_revenue),
                "sparkline": rev_spark if rev_spark else [{"val": float(current_revenue)}]
            },
            "orders": {
                "current": current_orders,
                "change": calc_change(current_orders, prev_orders),
                "sparkline": ord_spark if ord_spark else [{"val": current_orders}]
            },
            "expenses": {
                "current": float(current_expenses),
                "change": calc_change(current_expenses, prev_expenses),
                "sparkline": exp_spark if exp_spark else [{"val": float(current_expenses)}]
            },
            "profit": {
                "current": current_profit,
                "change": calc_change(current_profit, prev_profit),
                "sparkline": prof_spark if prof_spark else [{"val": current_profit}]
            }
        }

        # 6. Sales by Category
        category_sales = SalesInvoiceItem.objects.filter(invoice__entry_date__gte=start_date, invoice__entry_date__lte=end_date)\
            .values(cat_name=F('product__stock_group__name'))\
            .annotate(total=Sum('amount'))\
            .order_by('-total')[:5]
            
        colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#6b7280"]
        category_pie_data = []
        for i, cat in enumerate(category_sales):
            category_pie_data.append({
                "name": cat['cat_name'] or "General",
                "value": float(cat['total']),
                "color": colors[i % len(colors)]
            })

        # --- Details Row ---
        # 7. Top Selling Products
        top_products_qs = SalesInvoiceItem.objects.filter(invoice__entry_date__gte=start_date, invoice__entry_date__lte=end_date)\
            .values(product_name=F('product__name'))\
            .annotate(total_qty=Sum('quantity'), total_amt=Sum('amount'))\
            .order_by('-total_amt')[:5]
            
        top_products = [{"name": p['product_name'] or "Unknown", "quantity": float(p['total_qty']), "amount": float(p['total_amt'])} for p in top_products_qs]

        # 8. Recent Orders
        recent_orders_qs = SalesOrder.objects.filter(entry_date__gte=start_date, entry_date__lte=end_date).order_by('-entry_date', '-id')[:5]
        recent_orders = []
        for order in recent_orders_qs:
            status = "Pending"
            if order.is_posted:
                status = "Delivered" if getattr(order, 'is_delivered', False) else "Shipped" # Approximated status mapping
            
            recent_orders.append({
                "id": order.id,
                "order_no": order.so_no,
                "customer": order.customer_ledger.name if order.customer_ledger else "Unknown",
                "date": order.entry_date.strftime("%d %b %Y"),
                "amount": float(order.total_amount),
                "status": status
            })

        # 9. Inventory Summary (Current snapshot)
        total_items = StockItem.objects.count()
        warehouses_count = Warehouse.objects.count() if hasattr(Warehouse, 'objects') else 0
        
        stock_in = StockTable.objects.filter(movement_type='IN').aggregate(total=Sum('quantity'))['total'] or 0
        stock_out = StockTable.objects.filter(movement_type='OUT').aggregate(total=Sum('quantity'))['total'] or 0
        total_stock_qty = float(stock_in - stock_out)
        
        # Inventory value approximation
        total_value = float(StockTable.objects.aggregate(val=Sum(F('quantity') * F('rate')))['val'] or 0)

        from django.db.models import Q
        low_stock_items = StockItem.objects.annotate(
            qty=(Sum('stock_item__quantity', filter=Q(stock_item__movement_type='IN')) or 0) -
                (Sum('stock_item__quantity', filter=Q(stock_item__movement_type='OUT')) or 0)
        ).filter(qty__lt=10, qty__gte=0).count()
        
        inventory_summary = {
            "total_items": total_items,
            "warehouses": warehouses_count,
            "total_stock_qty": total_stock_qty,
            "total_value": total_value,
            "low_stock_items": low_stock_items,
        }

        # 10. Alerts (Live events)
        alerts = []
        if low_stock_items > 0:
            alerts.append({"id": 1, "type": "danger", "message": f"Low Stock Alert: {low_stock_items} items", "time": "Just now"})
            
        recent_pos = PurchaseOrder.objects.filter(status='Pending').order_by('-entry_date')[:1]
        if recent_pos.exists():
            alerts.append({"id": 2, "type": "warning", "message": f"Pending PO #{recent_pos.first().po_no}", "time": "Recent"})
            
        recent_payments = PaymentVoucherDetail.objects.filter(ledger__accountGroup__nature='Income').order_by('-voucher__voucher_date')[:1]
        if recent_payments.exists():
            alerts.append({"id": 3, "type": "success", "message": f"Payment Received ₹ {float(recent_payments.first().credit_amount)}", "time": "Recent"})
            
        if not alerts:
            alerts.append({"id": 0, "type": "info", "message": "All systems operational", "time": "Just now"})

        return Response({
            "kpis": kpis,
            "line_chart": line_chart_data,
            "categories": category_pie_data,
            "top_products": top_products,
            "recent_orders": recent_orders,
            "inventory": inventory_summary,
            "alerts": alerts
        })
