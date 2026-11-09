from rest_framework import views, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import SalesOrder, SalesOrderItem, SalesOrderTransaction, DeliveryLocation, DailyEntry, SalesReturn, TallySyncConfig
from .serializers import SalesOrderSerializer, SalesOrderTransactionSerializer, DeliveryLocationSerializer, DailyEntrySerializer,SalesReturnSerializer
# pyrefly: ignore [missing-import]


class SalesOrderListView(views.APIView):
    """
    GET  /api/sales/orders/  → list all sales orders
    POST /api/sales/orders/  → create a new sales order with items
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = SalesOrder.objects.all().order_by('-created_at')
        
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        del_from_date = request.query_params.get('del_from_date')
        del_to_date = request.query_params.get('del_to_date')
        
        if from_date:
            orders = orders.filter(entry_date__gte=from_date)
        if to_date:
            orders = orders.filter(entry_date__lte=to_date)
            
        if del_from_date:
            orders = orders.filter(preferred_delivery_date__gte=del_from_date)
        if del_to_date:
            # Assume to_date is end of day if it's just a date
            orders = orders.filter(preferred_delivery_date__lte=f"{del_to_date} 23:59:59")
            
        status_param = request.query_params.get('status')
        print(f"DEBUG SalesOrderListView: status_param_value = {status_param}")
        if status_param:
            orders = orders.filter(status=status_param)
            
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            orders = orders.filter(customer_ledger_id=customer_id)
            
        exclude_fully_invoiced = request.query_params.get('exclude_fully_invoiced')
        if exclude_fully_invoiced and exclude_fully_invoiced.lower() == 'true':
            include_order_ids = request.query_params.get('include_order_ids')
            if include_order_ids:
                from django.db.models import Q
                include_ids = [i.strip() for i in str(include_order_ids).split(',') if i.strip()]
                orders = orders.filter(Q(id__in=include_ids) | ~Q(invoice_status='Fully Invoiced'))
            else:
                orders = orders.exclude(invoice_status='Fully Invoiced')
            
        serializer = SalesOrderSerializer(orders, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        from django.db import transaction
        with transaction.atomic():
            customer_id = request.data.get('customer_ledger')
            if customer_id:
                from finance_app.models import Ledger
                try:
                    Ledger.objects.select_for_update().get(id=customer_id)
                except Exception:
                    pass
            
            serializer = SalesOrderSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SalesOrderDetailView(views.APIView):
    """
    GET    /api/sales/orders/<pk>/  → retrieve single sales order
    PUT    /api/sales/orders/<pk>/  → full update sales order with items
    PATCH  /api/sales/orders/<pk>/  → partial update sales order with items
    DELETE /api/sales/orders/<pk>/  → delete sales order
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return SalesOrder.objects.get(pk=pk)
        except SalesOrder.DoesNotExist:
            return None

    def get(self, request, pk):
        order = self.get_object(pk)
        if not order:
            return Response(
                {'detail': 'Sales order not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = SalesOrderSerializer(order)
        return Response(serializer.data)

    def put(self, request, pk):
        order = self.get_object(pk)
        if not order:
            return Response(
                {'detail': 'Sales order not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        from django.db import transaction
        with transaction.atomic():
            customer_id = request.data.get('customer_ledger') or order.customer_ledger_id
            if customer_id:
                from finance_app.models import Ledger
                try:
                    Ledger.objects.select_for_update().get(id=customer_id)
                except Exception:
                    pass
            
            serializer = SalesOrderSerializer(order, data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        order = self.get_object(pk)
        if not order:
            return Response(
                {'detail': 'Sales order not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        from django.db import transaction
        with transaction.atomic():
            customer_id = request.data.get('customer_ledger') or order.customer_ledger_id
            if customer_id:
                from finance_app.models import Ledger
                try:
                    Ledger.objects.select_for_update().get(id=customer_id)
                except Exception:
                    pass
                    
            serializer = SalesOrderSerializer(order, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        order = self.get_object(pk)
        if not order:
            return Response(
                {'detail': 'Sales order not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        order.delete()
        return Response(
            {'detail': 'Sales order deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )


class SalesOrderTransactionListView(views.APIView):
    """
    GET  /api/sales/transactions/  → list all sales order transactions
    POST /api/sales/transactions/  → create a new sales order transaction
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        transactions = SalesOrderTransaction.objects.all().order_by('-created_at')
        serializer = SalesOrderTransactionSerializer(transactions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = SalesOrderTransactionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SalesOrderTransactionDetailView(views.APIView):
    """
    GET    /api/sales/transactions/<pk>/  → retrieve single transaction
    PUT    /api/sales/transactions/<pk>/  → update transaction
    PATCH  /api/sales/transactions/<pk>/  → partial update transaction
    DELETE /api/sales/transactions/<pk>/  → delete transaction
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return SalesOrderTransaction.objects.get(pk=pk)
        except SalesOrderTransaction.DoesNotExist:
            return None

    def get(self, request, pk):
        tx = self.get_object(pk)
        if not tx:
            return Response(
                {'detail': 'Transaction not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = SalesOrderTransactionSerializer(tx)
        return Response(serializer.data)

    def put(self, request, pk):
        tx = self.get_object(pk)
        if not tx:
            return Response(
                {'detail': 'Transaction not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = SalesOrderTransactionSerializer(tx, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        tx = self.get_object(pk)
        if not tx:
            return Response(
                {'detail': 'Transaction not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = SalesOrderTransactionSerializer(tx, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        tx = self.get_object(pk)
        if not tx:
            return Response(
                {'detail': 'Transaction not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        tx.delete()
        return Response(
            {'detail': 'Transaction deleted successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )


class SalesOrderNextNoView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        order_type = request.query_params.get('order_type')
        prefix_config_id = request.query_params.get('prefix_config_id')
        next_no = SalesOrder.generate_next_so_no(order_type=order_type, prefix_config_id=prefix_config_id)
        return Response({'next_so_no': next_no}, status=status.HTTP_200_OK)


class SalesOrderBulkUpdateView(views.APIView):
    """
    POST /api/sales/orders/bulk-update/
    Accepts: { order_ids: [1, 2, 3], driver: 5, vehicle: 2 }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_ids = request.data.get('order_ids', [])
        driver_id = request.data.get('driver')
        vehicle_id = request.data.get('vehicle')

        if not order_ids or not isinstance(order_ids, list):
            return Response({'detail': 'order_ids list is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        update_data = {}
        if driver_id:
            update_data['driver_id'] = driver_id
        if vehicle_id:
            update_data['vehicle_id'] = vehicle_id
            from logistics_app.models import Vehicle
            v = Vehicle.objects.filter(id=vehicle_id).first()
            if v and v.vehicle_number:
                update_data['dispatch_through'] = v.vehicle_number
            
        if not update_data:
            return Response({'detail': 'No fields to update.'}, status=status.HTTP_400_BAD_REQUEST)

        # Bulk update records
        updated_count = SalesOrder.objects.filter(id__in=order_ids).update(**update_data)
        
        return Response({
            'detail': f'Successfully updated {updated_count} orders.',
            'updated_count': updated_count
        }, status=status.HTTP_200_OK)


from .models import SalesInvoice
from .serializers import SalesInvoiceSerializer

class SalesInvoiceListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        invoices = SalesInvoice.objects.all().order_by('-created_at')
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            invoices = invoices.filter(customer_ledger_id=customer_id)
            
        distributor_only = request.query_params.get('distributor_only')
        if distributor_only and distributor_only.lower() == 'true':
            invoices = invoices.filter(customer_ledger__email=request.user.email)
            
        serializer = SalesInvoiceSerializer(invoices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = SalesInvoiceSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class DeliveryLocationListView(views.APIView):
    """
    GET  /api/sales/delivery-locations/?customer_id=<id>  → list (filtered)
    POST /api/sales/delivery-locations/                   → create new location
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = DeliveryLocation.objects.select_related('customer').all()
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        serializer = DeliveryLocationSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DeliveryLocationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DeliveryLocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = DeliveryLocation.objects.all()
    serializer_class = DeliveryLocationSerializer
    permission_classes = [IsAuthenticated]

class SalesInvoiceDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return SalesInvoice.objects.get(pk=pk)
        except SalesInvoice.DoesNotExist:
            return None

    def get(self, request, pk):
        invoice = self.get_object(pk)
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SalesInvoiceSerializer(invoice)
        return Response(serializer.data)

    def put(self, request, pk):
        invoice = self.get_object(pk)
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SalesInvoiceSerializer(invoice, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        invoice = self.get_object(pk)
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SalesInvoiceSerializer(invoice, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        invoice = self.get_object(pk)
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
        invoice.delete()
        return Response({'detail': 'Invoice deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

class SalesInvoiceNextNoView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config_id = request.query_params.get('config_id')
        next_no = SalesInvoice.generate_next_invoice_no(config_id=config_id)
        return Response({'next_invoice_no': next_no}, status=status.HTTP_200_OK)


class DailyEntryListView(views.APIView):
    """
    GET  /api/sales/daily-entries/  → list all daily entries
    POST /api/sales/daily-entries/  → create a new daily entry with production items
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = DailyEntry.objects.all().order_by('-entry_date')
        serializer = DailyEntrySerializer(entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DailyEntrySerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


 
class SalesReturnListCreateView(views.APIView):
    """
    GET  /api/sales/returns/  → list all sales returns
    POST /api/sales/returns/  → create a new sales return with items
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        qs = SalesReturn.objects.select_related(
            'customer_ledger', 'sales_ledger',
            'gst_ledger_1', 'gst_ledger_2',
            'created_by', 'edited_by',
        ).prefetch_related('items').order_by('-created_at')
 
        customer_id = request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_ledger_id=customer_id)
 
        sales_invoice_no = request.query_params.get('sales_invoice_no')
        if sales_invoice_no:
            qs = qs.filter(sales_invoice_no=sales_invoice_no)

        serializer = SalesReturnSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
 
    def post(self, request):
        data = request.data.copy()
        if not data.get('return_no'):
            prefix_id = data.get('prefix_config_id')
            data['return_no'] = SalesReturn.generate_next_return_no(prefix_id=prefix_id)
            
        serializer = SalesReturnSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DailyEntryDetailView(views.APIView):
    """
    GET    /api/sales/daily-entries/<pk>/  → retrieve single daily entry
    PUT    /api/sales/daily-entries/<pk>/  → update daily entry
    DELETE /api/sales/daily-entries/<pk>/  → delete daily entry
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DailyEntry.objects.get(pk=pk)
        except DailyEntry.DoesNotExist:
            return None

    def get(self, request, pk):
        entry = self.get_object(pk)
        if not entry:
            return Response({'detail': 'Daily entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DailyEntrySerializer(entry)
        return Response(serializer.data)

    def put(self, request, pk):
        entry = self.get_object(pk)
        if not entry:
            return Response({'detail': 'Daily entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DailyEntrySerializer(entry, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        entry = self.get_object(pk)
        if not entry:
            return Response({'detail': 'Daily entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductSalesQuantitiesView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entry_date = request.query_params.get('date')
        if not entry_date:
            return Response({'detail': 'Date parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.db.models import Sum
        from .models import SalesInvoiceItem
        
        items = SalesInvoiceItem.objects.filter(
            invoice__entry_date=entry_date
        ).values('product_id').annotate(total_qty=Sum('quantity'))
        
        data = {item['product_id']: float(item['total_qty']) for item in items}
        return Response(data, status=status.HTTP_200_OK)


class SalesReturnDetailView(views.APIView):
    """
    GET    /api/sales/returns/<pk>/  → retrieve single sales return
    PUT    /api/sales/returns/<pk>/  → full update
    PATCH  /api/sales/returns/<pk>/  → partial update
    DELETE /api/sales/returns/<pk>/  → delete
    """
    permission_classes = [IsAuthenticated]
 
    def get_object(self, pk):
        try:
            return SalesReturn.objects.select_related(
                'customer_ledger', 'sales_ledger',
                'gst_ledger_1', 'gst_ledger_2',
                'created_by', 'edited_by',
            ).prefetch_related('items').get(pk=pk)
        except SalesReturn.DoesNotExist:
            return None
 
    def get(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SalesReturnSerializer(obj).data)
 
    def put(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SalesReturnSerializer(obj, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        entry = self.get_object(pk)
        if not entry:
            return Response({'detail': 'Daily entry not found.'}, status=status.HTTP_404_NOT_FOUND)
        entry.delete()
        return Response({'detail': 'Daily entry deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

 
    def patch(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SalesReturnSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
    def delete(self, request, pk):
        obj = self.get_object(pk)
        if not obj:
            return Response({'detail': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)
        inv_no = obj.sales_invoice_no
        obj.delete()
        if inv_no:
            from sales_app.serializers import recalculate_points_entries_for_invoice
            recalculate_points_entries_for_invoice(inv_no)
        return Response({'detail': 'Sales return deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)
 
 
class SalesReturnNextNoView(views.APIView):
    """
    GET /api/sales/returns/next-return-no/  → preview next auto-generated return_no
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        prefix_id = request.query_params.get('prefix_id')
        next_no = SalesReturn.generate_next_return_no(prefix_id=prefix_id)
        return Response({'next_return_no': next_no}, status=status.HTTP_200_OK)
 
 
class SalesReturnResolveGstHsnView(views.APIView):
    """
    GET /api/sales/returns/resolve-gst-hsn/?product_id=<id>&date=<YYYY-MM-DD>
 
    Returns applicable GST % and HSN for a StockItem on a given date.
    Same cascade lookup as SalesReturnItem.save().
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        product_id = request.query_params.get('product_id')
        date_str = request.query_params.get('date')
 
        if not product_id:
            return Response({'error': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
 
        try:
            from inventory_app.models import StockItem, StockItemHSN, StockGroupHSN, StockCategoryHSN, StockItemGST, StockGroupGST, StockCategoryGST
            import datetime
 
            product = StockItem.objects.get(pk=product_id)
 
            lookup_date = None
            if date_str:
                try:
                    lookup_date = datetime.date.fromisoformat(date_str)
                except ValueError:
                    pass
 
            # ── Resolve HSN (same 6-step cascade) ───────────────────────────
            hsn_number = None
 
            qs = StockItemHSN.objects.filter(stock_item=product)
            if lookup_date:
                qs = qs.filter(applicable_date__lte=lookup_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                hsn_number = rec.hsn_number
 
            if not hsn_number and product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=product.stock_group)
                if lookup_date:
                    qs = qs.filter(applicable_date__lte=lookup_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number
 
            if not hsn_number and product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=product.stock_category)
                if lookup_date:
                    qs = qs.filter(applicable_date__lte=lookup_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number
 
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=product).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number
 
            if not hsn_number and product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=product.stock_group).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number
 
            if not hsn_number and product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=product.stock_category).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number
 
            # ── Resolve GST % ────────────────────────────────────────────────
            gst_percent = 0.00
            
            # 1. Check Item GST applicable as of lookup_date
            rec_gst = StockItemGST.objects.filter(
                stock_item=product
            )
            if lookup_date:
                rec_gst = rec_gst.filter(applicable_date__lte=lookup_date)
            rec_gst = rec_gst.order_by('-applicable_date').first()
            if rec_gst:
                gst_percent = float(rec_gst.igst_percent)
                
            # 2. Check Group GST applicable as of lookup_date
            if not rec_gst and product.stock_group:
                rec_gst = StockGroupGST.objects.filter(
                    stock_group=product.stock_group
                )
                if lookup_date:
                    rec_gst = rec_gst.filter(applicable_date__lte=lookup_date)
                rec_gst = rec_gst.order_by('-applicable_date').first()
                if rec_gst:
                    gst_percent = float(rec_gst.igst_percent)
                    
            # 3. Check Category GST applicable as of lookup_date
            if not rec_gst and product.stock_category:
                rec_gst = StockCategoryGST.objects.filter(
                    stock_category=product.stock_category
                )
                if lookup_date:
                    rec_gst = rec_gst.filter(applicable_date__lte=lookup_date)
                rec_gst = rec_gst.order_by('-applicable_date').first()
                if rec_gst:
                    gst_percent = float(rec_gst.igst_percent)
 
            return Response({
                'hsn': hsn_number or '',
                'gst_percent': round(gst_percent, 2),
            }, status=status.HTTP_200_OK)
 
        except StockItem.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TallySyncConfigView(views.APIView):
    """
    GET: Retrieve Tally sync configuration and statistics for Sales Order, Sales Invoice, or Sales Return.
    POST / PATCH: Update auto_push_on_save and/or tally_url for the given voucher_type.
    """
    permission_classes = [IsAuthenticated]

    def _build_response(self, request, voucher_type):
        from .services.tally_service import get_tally_config, normalize_voucher_type
        norm_type = normalize_voucher_type(voucher_type)
        config = get_tally_config(norm_type)

        from_date = request.query_params.get('from_date') or (request.data.get('from_date') if hasattr(request, 'data') and isinstance(request.data, dict) else None)
        to_date = request.query_params.get('to_date') or (request.data.get('to_date') if hasattr(request, 'data') and isinstance(request.data, dict) else None)

        if config.voucher_type == 'Sales Invoice':
            base_qs = SalesInvoice.objects.all()
        elif config.voucher_type == 'Sales Return':
            base_qs = SalesReturn.objects.all()
        else:
            base_qs = SalesOrder.objects.all()

        if from_date:
            base_qs = base_qs.filter(entry_date__gte=from_date)
        if to_date:
            base_qs = base_qs.filter(entry_date__lte=to_date)

        total_orders = base_qs.count()
        synced_orders = base_qs.filter(is_synced=True).count()
        failed_orders = base_qs.filter(sync_status='failed').count()
        pending_orders = base_qs.filter(is_synced=False).exclude(sync_status='failed').count()
        unsynced_total = base_qs.filter(is_synced=False).count()

        return Response({
            'voucher_type': config.voucher_type,
            'auto_push_on_save': bool(config.auto_push_on_save),
            'tally_url': config.tally_url,
            'last_sync_at': config.last_sync_at,
            'agent_last_seen': config.agent_last_seen,
            'agent_company': config.agent_company,
            'agent_key': config.agent_key,
            'total_orders': total_orders,
            'synced_orders': synced_orders,
            'pending_orders': pending_orders,
            'failed_orders': failed_orders,
            'unsynced_total': unsynced_total,
        })

    def get(self, request):
        voucher_type = request.query_params.get('voucher_type') or (request.data.get('voucher_type') if hasattr(request, 'data') and isinstance(request.data, dict) else None) or 'Sales Order'
        return self._build_response(request, voucher_type)

    def post(self, request):
        from .services.tally_service import get_tally_config, normalize_voucher_type
        raw_type = request.data.get('voucher_type') or request.query_params.get('voucher_type') or 'Sales Order'
        norm_type = normalize_voucher_type(raw_type)
        config = get_tally_config(norm_type)

        if 'auto_push_on_save' in request.data:
            val = request.data.get('auto_push_on_save')
            if isinstance(val, str):
                config.auto_push_on_save = val.strip().lower() in ('true', '1', 'yes')
            else:
                config.auto_push_on_save = bool(val)

        if 'tally_url' in request.data and request.data['tally_url']:
            config.tally_url = str(request.data['tally_url']).strip()

        if 'agent_key' in request.data and request.data['agent_key']:
            config.agent_key = str(request.data['agent_key']).strip()

        config.save()
        return self._build_response(request, config.voucher_type)

    def patch(self, request):
        return self.post(request)


class TallySyncPushView(views.APIView):
    """
    POST: Triggers manual push of pending sales orders or sales invoices to Tally,
    or queues them for the client-side Tally Agent.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from sales_app.services.tally_service import (
            push_sales_order_to_tally,
            push_pending_sales_orders,
            push_sales_invoice_to_tally,
            push_pending_sales_invoices,
            push_sales_return_to_tally,
            push_pending_sales_returns
        )

        voucher_type = request.data.get('voucher_type', 'Sales Order')
        action = request.data.get('action')
        order_id = request.data.get('order_id')
        order_ids = request.data.get('order_ids')
        invoice_id = request.data.get('invoice_id')
        invoice_ids = request.data.get('invoice_ids')
        return_id = request.data.get('return_id')
        return_ids = request.data.get('return_ids')
        from_date = request.data.get('from_date')
        to_date = request.data.get('to_date')

        from django.utils import timezone
        from sales_app.models import TallySyncConfig

        # Check if Tally Agent is connected (heartbeat seen within last 90 seconds)
        config = TallySyncConfig.objects.first()
        agent_connected = bool(
            config and config.agent_last_seen and
            (timezone.now() - config.agent_last_seen).total_seconds() < 90
        )

        # If agent is connected OR action is 'queue', queue vouchers so the client agent pushes them
        if agent_connected or action == 'queue':
            count = 0
            if voucher_type == 'Sales Return' or return_id or return_ids:
                qs = SalesReturn.objects.all()
                if return_id:
                    qs = qs.filter(pk=return_id)
                elif return_ids:
                    qs = qs.filter(pk__in=return_ids)
                elif from_date or to_date:
                    if from_date: qs = qs.filter(entry_date__gte=from_date)
                    if to_date: qs = qs.filter(entry_date__lte=to_date)
                else:
                    qs = qs.filter(is_synced=False)
                count = qs.update(sync_status='pending', is_synced=False)
                label = 'sales return(s)'
            elif voucher_type == 'Sales Invoice' or invoice_id or invoice_ids:
                qs = SalesInvoice.objects.all()
                if invoice_id:
                    qs = qs.filter(pk=invoice_id)
                elif invoice_ids:
                    qs = qs.filter(pk__in=invoice_ids)
                elif from_date or to_date:
                    if from_date: qs = qs.filter(entry_date__gte=from_date)
                    if to_date: qs = qs.filter(entry_date__lte=to_date)
                else:
                    qs = qs.filter(is_synced=False)
                count = qs.update(sync_status='pending', is_synced=False)
                label = 'sales invoice(s)'
            else:
                qs = SalesOrder.objects.all()
                if order_id:
                    qs = qs.filter(pk=order_id)
                elif order_ids:
                    qs = qs.filter(pk__in=order_ids)
                elif from_date or to_date:
                    if from_date: qs = qs.filter(entry_date__gte=from_date)
                    if to_date: qs = qs.filter(entry_date__lte=to_date)
                else:
                    qs = qs.filter(is_synced=False)
                count = qs.update(sync_status='pending', is_synced=False)
                label = 'sales order(s)'

            if order_id or invoice_id or return_id:
                msg = f"Voucher queued for Tally Agent. It will be pushed to Tally Prime in a few seconds."
            else:
                msg = f"{count} {label} queued for Tally Agent. They will be pushed to Tally Prime in a few seconds."

            return Response({
                'success': True,
                'queued': True,
                'queued_count': count,
                'synced_count': count,
                'failed_count': 0,
                'total': count,
                'message': msg
            }, status=status.HTTP_200_OK)

        # Handle Sales Return push
        if voucher_type == 'Sales Return' or return_id or return_ids:
            if return_id:
                try:
                    sales_return = SalesReturn.objects.get(pk=return_id)
                    res = push_sales_return_to_tally(sales_return, user=request.user, push_type='manual')
                    return Response(res, status=status.HTTP_200_OK if res.get('success') else status.HTTP_400_BAD_REQUEST)
                except SalesReturn.DoesNotExist:
                    return Response({'error': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)

            res = push_pending_sales_returns(return_ids=return_ids, from_date=from_date, to_date=to_date, user=request.user, push_type='manual')
            return Response(res, status=status.HTTP_200_OK)

        # Handle Sales Invoice push
        if voucher_type == 'Sales Invoice' or invoice_id or invoice_ids:
            if invoice_id:
                try:
                    invoice = SalesInvoice.objects.get(pk=invoice_id)
                    res = push_sales_invoice_to_tally(invoice, user=request.user, push_type='manual')
                    return Response(res, status=status.HTTP_200_OK if res.get('success') else status.HTTP_400_BAD_REQUEST)
                except SalesInvoice.DoesNotExist:
                    return Response({'error': 'Sales invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

            res = push_pending_sales_invoices(invoice_ids=invoice_ids, from_date=from_date, to_date=to_date, user=request.user, push_type='manual')
            return Response(res, status=status.HTTP_200_OK)

        # Handle Sales Order push
        if order_id:
            try:
                order = SalesOrder.objects.get(pk=order_id)
                res = push_sales_order_to_tally(order, user=request.user, push_type='manual')
                return Response(res, status=status.HTTP_200_OK if res.get('success') else status.HTTP_400_BAD_REQUEST)
            except SalesOrder.DoesNotExist:
                return Response({'error': 'Sales order not found.'}, status=status.HTTP_404_NOT_FOUND)

        res = push_pending_sales_orders(order_ids=order_ids, from_date=from_date, to_date=to_date, user=request.user, push_type='manual')
        return Response(res, status=status.HTTP_200_OK)


def _get_user_display_name(u):
    if not u:
        return None
    full = f"{getattr(u, 'first_name', '')} {getattr(u, 'last_name', '')}".strip()
    return full if full else getattr(u, 'username', None)


class TallySyncOrdersView(views.APIView):
    """
    GET: Returns sales orders with Tally synchronization status and last log info.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        qs = SalesOrder.objects.select_related('customer_ledger').prefetch_related('sync_logs__synced_by').order_by('-created_at')

        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)

        if status_filter == 'synced':
            qs = qs.filter(is_synced=True)
        elif status_filter == 'pending':
            qs = qs.filter(is_synced=False).exclude(sync_status='failed')
        elif status_filter == 'failed':
            qs = qs.filter(sync_status='failed')
        elif status_filter == 'unsynced':
            qs = qs.filter(is_synced=False)

        if search_query:
            qs = qs.filter(
                models.Q(so_no__icontains=search_query) |
                models.Q(customer_ledger__name__icontains=search_query)
            )

        data = []
        for order in qs[:150]:
            all_logs = list(order.sync_logs.order_by('-attempted_at')[:6])
            last_log = all_logs[0] if all_logs else None
            sync_history = [
                {
                    'id': l.id,
                    'attempted_at': l.attempted_at,
                    'status': l.status,
                    'error_message': l.error_message,
                    'tally_response': l.tally_response,
                    'synced_by_id': l.synced_by_id,
                    'synced_by_name': _get_user_display_name(l.synced_by),
                    'push_type': l.push_type,
                }
                for l in all_logs
            ]
            data.append({
                'id': order.id,
                'so_no': order.so_no,
                'entry_date': order.entry_date,
                'customer_name': order.customer_ledger.name if order.customer_ledger else 'N/A',
                'total_amount': str(order.total_amount),
                'sync_status': order.sync_status,
                'is_synced': order.is_synced,
                'last_attempted_at': last_log.attempted_at if last_log else None,
                'last_error': last_log.error_message if last_log else None,
                'last_response': last_log.tally_response if last_log else None,
                'last_synced_by': _get_user_display_name(last_log.synced_by) if last_log else None,
                'last_push_type': last_log.push_type if last_log else None,
                'sync_history': sync_history,
                'created_at': order.created_at,
            })

        return Response(data, status=status.HTTP_200_OK)


class TallySyncInvoicesView(views.APIView):
    """
    GET: Returns sales invoices with Tally synchronization status and last log info.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        qs = SalesInvoice.objects.select_related('customer_ledger').prefetch_related('sync_logs__synced_by').order_by('-created_at')

        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)

        if status_filter == 'synced':
            qs = qs.filter(is_synced=True)
        elif status_filter == 'pending':
            qs = qs.filter(is_synced=False).exclude(sync_status='failed')
        elif status_filter == 'failed':
            qs = qs.filter(sync_status='failed')
        elif status_filter == 'unsynced':
            qs = qs.filter(is_synced=False)

        if search_query:
            qs = qs.filter(
                models.Q(invoice_no__icontains=search_query) |
                models.Q(customer_ledger__name__icontains=search_query)
            )

        data = []
        for inv in qs[:150]:
            all_logs = list(inv.sync_logs.order_by('-attempted_at')[:6])
            last_log = all_logs[0] if all_logs else None
            sync_history = [
                {
                    'id': l.id,
                    'attempted_at': l.attempted_at,
                    'status': l.status,
                    'error_message': l.error_message,
                    'tally_response': l.tally_response,
                    'synced_by_id': l.synced_by_id,
                    'synced_by_name': _get_user_display_name(l.synced_by),
                    'push_type': l.push_type,
                }
                for l in all_logs
            ]
            data.append({
                'id': inv.id,
                'invoice_no': inv.invoice_no,
                'entry_date': inv.entry_date,
                'customer_name': inv.customer_ledger.name if inv.customer_ledger else 'N/A',
                'total_amount': str(inv.total_amount),
                'sync_status': inv.sync_status,
                'is_synced': inv.is_synced,
                'last_attempted_at': last_log.attempted_at if last_log else None,
                'last_error': last_log.error_message if last_log else None,
                'last_response': last_log.tally_response if last_log else None,
                'last_synced_by': _get_user_display_name(last_log.synced_by) if last_log else None,
                'last_push_type': last_log.push_type if last_log else None,
                'sync_history': sync_history,
                'created_at': inv.created_at,
            })

        return Response(data, status=status.HTTP_200_OK)


class TallySyncReturnsView(views.APIView):
    """
    GET: Returns sales returns with Tally synchronization status and last log info.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        qs = SalesReturn.objects.select_related('customer_ledger').prefetch_related('sync_logs__synced_by').order_by('-created_at')

        if from_date:
            qs = qs.filter(entry_date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_date__lte=to_date)

        if status_filter == 'synced':
            qs = qs.filter(is_synced=True)
        elif status_filter == 'pending':
            qs = qs.filter(is_synced=False).exclude(sync_status='failed')
        elif status_filter == 'failed':
            qs = qs.filter(sync_status='failed')
        elif status_filter == 'unsynced':
            qs = qs.filter(is_synced=False)

        if search_query:
            qs = qs.filter(
                models.Q(return_no__icontains=search_query) |
                models.Q(customer_ledger__name__icontains=search_query)
            )

        data = []
        for sr in qs[:150]:
            all_logs = list(sr.sync_logs.order_by('-attempted_at')[:6])
            last_log = all_logs[0] if all_logs else None
            sync_history = [
                {
                    'id': l.id,
                    'attempted_at': l.attempted_at,
                    'status': l.status,
                    'error_message': l.error_message,
                    'tally_response': l.tally_response,
                    'synced_by_id': l.synced_by_id,
                    'synced_by_name': _get_user_display_name(l.synced_by),
                    'push_type': l.push_type,
                }
                for l in all_logs
            ]
            data.append({
                'id': sr.id,
                'return_no': sr.return_no,
                'entry_date': sr.entry_date,
                'customer_name': sr.customer_ledger.name if sr.customer_ledger else 'N/A',
                'total_amount': str(sr.total_amount),
                'sync_status': sr.sync_status,
                'is_synced': sr.is_synced,
                'last_attempted_at': last_log.attempted_at if last_log else None,
                'last_error': last_log.error_message if last_log else None,
                'last_response': last_log.tally_response if last_log else None,
                'last_synced_by': _get_user_display_name(last_log.synced_by) if last_log else None,
                'last_push_type': last_log.push_type if last_log else None,
                'sync_history': sync_history,
                'created_at': sr.created_at,
            })

        return Response(data, status=status.HTTP_200_OK)


class TallyTestConnectionView(views.APIView):
    """
    POST: Tests HTTP connection to Tally server.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .services.tally_service import test_tally_connection
        tally_url = request.data.get('tally_url')
        result = test_tally_connection(tally_url=tally_url)
        return Response(result, status=status.HTTP_200_OK)

def validate_agent_key(request):
    """
    Validates agent key against TallySyncConfig.
    If no agent_key is configured in DB, defaults to 'glenda-tally-secret'.
    """
    key = (
        request.headers.get('X-Tally-Agent-Key') or 
        request.query_params.get('agent_key') or 
        request.data.get('agent_key')
    )
    from .models import TallySyncConfig
    config = TallySyncConfig.objects.first()
    expected_key = getattr(config, 'agent_key', None) if config else 'glenda-tally-secret'
    expected_key = expected_key or 'glenda-tally-secret'
    return key == expected_key


class TallyAgentHeartbeatView(views.APIView):
    """
    POST: Pings cPanel backend from local client Tally Agent.
    Updates agent_last_seen timestamp and active company name.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not validate_agent_key(request):
            return Response({'error': 'Unauthorized: Invalid agent key.'}, status=status.HTTP_401_UNAUTHORIZED)

        company_name = request.data.get('company_name', '')
        tally_status = request.data.get('tally_status', 'active')

        from django.utils import timezone
        from .models import TallySyncConfig, SalesOrder, SalesInvoice, SalesReturn
        now = timezone.now()
        try:
            TallySyncConfig.objects.all().update(
                agent_last_seen=now,
                agent_company=company_name
            )
        except Exception:
            pass

        pending_orders = SalesOrder.objects.filter(is_synced=False, sync_status__in=['queued', 'processing']).count()
        pending_invoices = SalesInvoice.objects.filter(is_synced=False, sync_status__in=['queued', 'processing']).count()
        pending_returns = SalesReturn.objects.filter(is_synced=False, sync_status__in=['queued', 'processing']).count()

        return Response({
            'status': 'ok',
            'agent_status': 'connected',
            'company_name': company_name,
            'pending_orders': pending_orders,
            'pending_invoices': pending_invoices,
            'pending_returns': pending_returns,
            'total_pending': pending_orders + pending_invoices + pending_returns
        }, status=status.HTTP_200_OK)


# ── Tally XML templates for import commands sent to the agent ──────────────
_LEDGER_FETCH_XML = """<ENVELOPE>
<HEADER>
<VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE>
<ID>LedgerCol</ID>
</HEADER>
<BODY>
<DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<TDL>
<TDLMESSAGE>
<COLLECTION NAME="LedgerCol">
<TYPE>Ledger</TYPE>
<FETCH>Name,Parent,IsBillwiseOn,CreditLimit,OpeningBalance,StateName,CountryName,PinCode,MailingName,Email,LedgerPhone,LedgerMobile,PartyGSTIN,Address</FETCH>
</COLLECTION>
</TDLMESSAGE>
</TDL>
</DESC>
</BODY>
</ENVELOPE>"""

_STOCK_FETCH_XML = """<ENVELOPE>
<HEADER>
<VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE>
<ID>StockCol</ID>
</HEADER>
<BODY>
<DESC>
<STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES>
<TDL>
<TDLMESSAGE>
<COLLECTION NAME="StockCol">
<TYPE>StockItem</TYPE>
<FETCH>Name,Parent,Category,BaseUnits,AdditionalUnits,OpeningBalance,OpeningValue,OpeningRate,HSNCode</FETCH>
</COLLECTION>
</TDLMESSAGE>
</TDL>
</DESC>
</BODY>
</ENVELOPE>"""


class TallyAgentPollView(views.APIView):
    """
    GET: Returns the next pending command or voucher XML for the client-side Tally agent.
    Priority:
      0. Import commands (fetch_ledgers / fetch_stock) — highest priority
      1. Sales Orders (if any pending)
      2. Sales Invoices (if any pending)
      3. Sales Returns (if any pending)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        if not validate_agent_key(request):
            return Response({'error': 'Unauthorized: Invalid agent key.'}, status=status.HTTP_401_UNAUTHORIZED)

        import logging
        from django.utils import timezone
        from .models import (
            TallySyncConfig,
            SalesOrder, SalesInvoice, SalesReturn,
            SalesOrderSyncLog, SalesInvoiceSyncLog, SalesReturnSyncLog
        )
        from sales_app.utils.tally_xml import (
            generate_sales_order_xml,
            generate_sales_invoice_xml,
            generate_sales_return_xml,
        )

        logger = logging.getLogger('tally_sync')

        # 0. Priority: Import commands (fetch_ledgers / fetch_stock)
        try:
            config = TallySyncConfig.objects.filter(pending_import_command__isnull=False, import_command_status='pending').first()
        except Exception:
            config = None

        if config:
            cmd = config.pending_import_command
            xml_request = _LEDGER_FETCH_XML if cmd == 'fetch_ledgers' else _STOCK_FETCH_XML
            TallySyncConfig.objects.update(import_command_status='processing')
            return Response({
                'has_item': True,
                'command_type': cmd,
                'xml_request': xml_request,
            }, status=status.HTTP_200_OK)

        # 1. Check queued Sales Orders
        order = SalesOrder.objects.filter(is_synced=False, sync_status='queued').order_by('id').first()
        if order:
            try:
                xml_payload = generate_sales_order_xml(order)
                order.sync_status = 'processing'
                order.save(update_fields=['sync_status'])
                return Response({
                    'has_item': True,
                    'voucher_type': 'Sales Order',
                    'voucher_id': order.id,
                    'voucher_no': order.so_no,
                    'xml_payload': xml_payload,
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error generating XML for Sales Order {order.so_no}: {e}")
                order.sync_status = 'failed'
                order.save(update_fields=['sync_status'])
                SalesOrderSyncLog.objects.create(
                    sales_order=order,
                    status='failed',
                    error_message=f"XML generation failed: {str(e)}"
                )

        # 2. Check queued Sales Invoices
        invoice = SalesInvoice.objects.filter(is_synced=False, sync_status='queued').order_by('id').first()
        if invoice:
            try:
                xml_payload = generate_sales_invoice_xml(invoice)
                invoice.sync_status = 'processing'
                invoice.save(update_fields=['sync_status'])
                return Response({
                    'has_item': True,
                    'voucher_type': 'Sales Invoice',
                    'voucher_id': invoice.id,
                    'voucher_no': invoice.invoice_no,
                    'xml_payload': xml_payload,
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error generating XML for Sales Invoice {invoice.invoice_no}: {e}")
                invoice.sync_status = 'failed'
                invoice.save(update_fields=['sync_status'])
                SalesInvoiceSyncLog.objects.create(
                    sales_invoice=invoice,
                    status='failed',
                    error_message=f"XML generation failed: {str(e)}"
                )

        # 3. Check queued Sales Returns
        sales_return = SalesReturn.objects.filter(is_synced=False, sync_status='queued').order_by('id').first()
        if sales_return:
            try:
                xml_payload = generate_sales_return_xml(sales_return)
                sales_return.sync_status = 'processing'
                sales_return.save(update_fields=['sync_status'])
                return Response({
                    'has_item': True,
                    'voucher_type': 'Sales Return',
                    'voucher_id': sales_return.id,
                    'voucher_no': sales_return.return_no,
                    'xml_payload': xml_payload,
                }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error generating XML for Sales Return {sales_return.return_no}: {e}")
                sales_return.sync_status = 'failed'
                sales_return.save(update_fields=['sync_status'])
                SalesReturnSyncLog.objects.create(
                    sales_return=sales_return,
                    status='failed',
                    error_message=f"XML generation failed: {str(e)}"
                )

        return Response({'has_item': False}, status=status.HTTP_200_OK)


class TallyAgentResultView(views.APIView):
    """
    POST: Processes the Tally response submitted by the client-side Tally agent.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not validate_agent_key(request):
            return Response({'error': 'Unauthorized: Invalid agent key.'}, status=status.HTTP_401_UNAUTHORIZED)

        import re
        from .models import (
            SalesOrder, SalesInvoice, SalesReturn,
            SalesOrderSyncLog, SalesInvoiceSyncLog, SalesReturnSyncLog
        )
        from sales_app.services.tally_service import parse_tally_response

        voucher_type = request.data.get('voucher_type')
        voucher_id = request.data.get('voucher_id')
        tally_response = request.data.get('tally_response', '')
        error_message = request.data.get('error_message')
        xml_payload = request.data.get('xml_payload', '')

        if not voucher_type or not voucher_id:
            return Response({'error': 'Missing voucher_type or voucher_id.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Handle Sales Order
        if voucher_type == 'Sales Order':
            try:
                order = SalesOrder.objects.get(pk=voucher_id)
            except SalesOrder.DoesNotExist:
                return Response({'error': 'Sales order not found.'}, status=status.HTTP_404_NOT_FOUND)

            if error_message and not tally_response:
                order.sync_status = 'failed'
                order.is_synced = False
                order.save(update_fields=['sync_status', 'is_synced'])
                SalesOrderSyncLog.objects.create(
                    sales_order=order,
                    status='failed',
                    error_message=error_message
                )
                return Response({'status': 'failed', 'message': error_message}, status=status.HTTP_200_OK)

            is_success, msg = parse_tally_response(tally_response, order=order)
            order.sync_status = 'synced' if is_success else 'failed'
            order.is_synced = is_success
            update_fields = ['sync_status', 'is_synced']
            if is_success and not order.tally_guid and xml_payload:
                guid_m = re.search(r'REMOTEID="([^"]+)"', xml_payload)
                if guid_m:
                    order.tally_guid = guid_m.group(1)
                    update_fields.append('tally_guid')
            order.save(update_fields=update_fields)

            last_log = order.sync_logs.order_by('-attempted_at').first()
            synced_by_user = last_log.synced_by if last_log else getattr(order, 'created_by', None)
            push_type = getattr(last_log, 'push_type', 'manual')

            SalesOrderSyncLog.objects.create(
                sales_order=order,
                tally_response=tally_response,
                error_message=None if is_success else msg,
                status='success' if is_success else 'failed',
                synced_by=synced_by_user,
                push_type=push_type
            )
            return Response({
                'status': 'synced' if is_success else 'failed',
                'message': msg,
                'voucher_no': order.so_no
            }, status=status.HTTP_200_OK)

        # 2. Handle Sales Invoice
        elif voucher_type == 'Sales Invoice':
            try:
                invoice = SalesInvoice.objects.get(pk=voucher_id)
            except SalesInvoice.DoesNotExist:
                return Response({'error': 'Sales invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

            if error_message and not tally_response:
                invoice.sync_status = 'failed'
                invoice.is_synced = False
                invoice.save(update_fields=['sync_status', 'is_synced'])
                last_log = invoice.sync_logs.order_by('-attempted_at').first()
                synced_by_user = last_log.synced_by if last_log else getattr(invoice, 'created_by', None)
                push_type = getattr(last_log, 'push_type', 'manual')
                SalesInvoiceSyncLog.objects.create(
                    sales_invoice=invoice,
                    status='failed',
                    error_message=error_message,
                    synced_by=synced_by_user,
                    push_type=push_type
                )
                return Response({'status': 'failed', 'message': error_message}, status=status.HTTP_200_OK)

            is_success, msg = parse_tally_response(tally_response, invoice=invoice)
            invoice.sync_status = 'synced' if is_success else 'failed'
            invoice.is_synced = is_success
            update_fields = ['sync_status', 'is_synced']
            if is_success and not invoice.tally_guid and xml_payload:
                guid_m = re.search(r'REMOTEID="([^"]+)"', xml_payload)
                if guid_m:
                    invoice.tally_guid = guid_m.group(1)
                    update_fields.append('tally_guid')
            invoice.save(update_fields=update_fields)

            last_log = invoice.sync_logs.order_by('-attempted_at').first()
            synced_by_user = last_log.synced_by if last_log else getattr(invoice, 'created_by', None)
            push_type = getattr(last_log, 'push_type', 'manual')

            SalesInvoiceSyncLog.objects.create(
                sales_invoice=invoice,
                tally_response=tally_response,
                error_message=None if is_success else msg,
                status='success' if is_success else 'failed',
                synced_by=synced_by_user,
                push_type=push_type
            )
            return Response({
                'status': 'synced' if is_success else 'failed',
                'message': msg,
                'voucher_no': invoice.invoice_no
            }, status=status.HTTP_200_OK)

        # 3. Handle Sales Return
        elif voucher_type == 'Sales Return':
            try:
                sales_return = SalesReturn.objects.get(pk=voucher_id)
            except SalesReturn.DoesNotExist:
                return Response({'error': 'Sales return not found.'}, status=status.HTTP_404_NOT_FOUND)

            if error_message and not tally_response:
                sales_return.sync_status = 'failed'
                sales_return.is_synced = False
                sales_return.save(update_fields=['sync_status', 'is_synced'])
                last_log = sales_return.sync_logs.order_by('-attempted_at').first()
                synced_by_user = last_log.synced_by if last_log else getattr(sales_return, 'created_by', None)
                push_type = getattr(last_log, 'push_type', 'manual')
                SalesReturnSyncLog.objects.create(
                    sales_return=sales_return,
                    status='failed',
                    error_message=error_message,
                    synced_by=synced_by_user,
                    push_type=push_type
                )
                return Response({'status': 'failed', 'message': error_message}, status=status.HTTP_200_OK)

            is_success, msg = parse_tally_response(tally_response, return_obj=sales_return)
            sales_return.sync_status = 'synced' if is_success else 'failed'
            sales_return.is_synced = is_success
            update_fields = ['sync_status', 'is_synced']
            if is_success and not sales_return.tally_guid and xml_payload:
                guid_m = re.search(r'REMOTEID="([^"]+)"', xml_payload)
                if guid_m:
                    sales_return.tally_guid = guid_m.group(1)
                    update_fields.append('tally_guid')
            sales_return.save(update_fields=update_fields)

            last_log = sales_return.sync_logs.order_by('-attempted_at').first()
            synced_by_user = last_log.synced_by if last_log else getattr(sales_return, 'created_by', None)
            push_type = getattr(last_log, 'push_type', 'manual')

            SalesReturnSyncLog.objects.create(
                sales_return=sales_return,
                tally_response=tally_response,
                error_message=None if is_success else msg,
                status='success' if is_success else 'failed',
                synced_by=synced_by_user,
                push_type=push_type
            )
            return Response({
                'status': 'synced' if is_success else 'failed',
                'message': msg,
                'voucher_no': sales_return.return_no
            }, status=status.HTTP_200_OK)

        return Response({'error': f'Unsupported voucher_type: {voucher_type}'}, status=status.HTTP_400_BAD_REQUEST)


class TallyAgentImportResultView(views.APIView):
    """
    POST: Called by the client-side Tally Agent after it fetched raw Tally XML
    for a 'fetch_ledgers' or 'fetch_stock' command.
    Stores the XML and immediately processes it (creates/updates DB records).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        if not validate_agent_key(request):
            return Response({'error': 'Unauthorized: Invalid agent key.'}, status=status.HTTP_401_UNAUTHORIZED)

        from django.utils import timezone
        import logging
        logger = logging.getLogger('tally_sync')
        from .models import TallySyncConfig

        command_type = request.data.get('command_type')
        xml_data = request.data.get('xml_data', '')
        error_message = request.data.get('error_message', '')

        if not command_type:
            return Response({'error': 'Missing command_type.'}, status=status.HTTP_400_BAD_REQUEST)

        config = TallySyncConfig.objects.filter(
            pending_import_command=command_type
        ).first() or TallySyncConfig.objects.first()

        if not config:
            return Response({'error': f'No active import command of type {command_type} found.'}, status=status.HTTP_404_NOT_FOUND)

        if error_message and not xml_data:
            TallySyncConfig.objects.update(
                import_command_status='failed',
                import_command_error=error_message,
                pending_import_command=None,
                import_command_at=timezone.now(),
            )
            return Response({'status': 'failed', 'message': error_message}, status=status.HTTP_200_OK)

        try:
            if command_type == 'fetch_ledgers':
                result = _process_agent_ledger_import(xml_data)
            elif command_type == 'fetch_stock':
                result = _process_agent_stock_import(xml_data)
            else:
                result = {'error': f'Unknown command_type: {command_type}'}

            if 'error' in result:
                TallySyncConfig.objects.update(
                    import_command_status='failed',
                    import_command_error=result['error'],
                    pending_import_command=None,
                    import_command_at=timezone.now(),
                )
            else:
                msg = result.get('message', 'Import completed successfully.')
                TallySyncConfig.objects.update(
                    import_command_status='done',
                    import_command_error=None,
                    import_command_result=msg,
                    pending_import_command=None,
                    import_command_at=timezone.now(),
                )
            return Response({'status': 'done' if 'error' not in result else 'failed', **result}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"TallyAgentImportResultView: Processing failed: {e}")
            TallySyncConfig.objects.update(
                import_command_status='failed',
                import_command_error=str(e),
                pending_import_command=None,
                import_command_at=timezone.now(),
            )
            return Response({'status': 'failed', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _process_agent_ledger_import(xml_data: str) -> dict:
    """Parse Tally ledger XML (from agent) and create/update Ledger records in Django."""
    import re
    import xml.etree.ElementTree as ET
    from finance_app.models import Ledger, AccountGroup

    STATE_CODE_MAP = {
        'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', 'assam': 'AS', 'bihar': 'BR',
        'chhattisgarh': 'CG', 'goa': 'GA', 'gujarat': 'GJ', 'haryana': 'HR',
        'himachal pradesh': 'HP', 'jharkhand': 'JH', 'karnataka': 'KA', 'kerala': 'KL',
        'madhya pradesh': 'MP', 'maharashtra': 'MH', 'manipur': 'MN', 'meghalaya': 'ML',
        'mizoram': 'MZ', 'nagaland': 'NL', 'odisha': 'OR', 'punjab': 'PB',
        'rajasthan': 'RJ', 'sikkim': 'SK', 'tamil nadu': 'TN', 'telangana': 'TG',
        'tripura': 'TR', 'uttar pradesh': 'UP', 'uttarakhand': 'UT', 'west bengal': 'WB',
        'andaman and nicobar islands': 'AN', 'chandigarh': 'CH',
        'dadra and nagar haveli and daman and diu': 'DH', 'delhi': 'DL',
        'jammu and kashmir': 'JK', 'ladakh': 'LA', 'lakshadweep': 'LD', 'puducherry': 'PY',
    }

    clean = re.sub(r'&#[0-9]+;', '', xml_data)
    clean = re.sub(r'&#x[0-9a-fA-F]+;', '', clean)
    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', clean)

    try:
        root = ET.fromstring(clean)
    except ET.ParseError as e:
        return {'error': f'XML parse error: {e}'}

    existing_ledgers = {l.name: l for l in Ledger.objects.select_related('accountGroup').prefetch_related('contact_details').all()}
    new_count = 0
    update_count = 0

    for ledger_el in root.findall('.//LEDGER'):
        name = ledger_el.get('NAME') or ledger_el.get('Name')
        if not name:
            name_el = ledger_el.find('NAME')
            if name_el is not None:
                name = name_el.text
        if not name or not str(name).strip():
            continue
        name = str(name).strip()

        def _txt(tag):
            el = ledger_el.find(tag)
            return el.text.strip() if el is not None and el.text else None

        parent = _txt('PARENT')
        state_name = _txt('STATENAME') or _txt('PRISTATENAME')
        gstin = _txt('PARTYGSTIN')
        country_name = _txt('COUNTRYNAME')
        pincode = _txt('PINCODE')
        mailing_name = _txt('MAILINGNAME')
        email_address = _txt('EMAIL')
        phone = _txt('LEDGERPHONE') or _txt('LEDGERMOBILE')
        addr_lines = [el.text.strip() for el in ledger_el.findall('.//ADDRESS') if el.text and el.text.strip()]
        address = ' '.join(addr_lines)

        bill_wise_el = ledger_el.find('ISBILLWISEON')
        bill_wise = str(bill_wise_el.text).lower() == 'yes' if bill_wise_el is not None else False

        cl_el = ledger_el.find('CREDITLIMIT')
        try:
            cl = abs(float(cl_el.text)) if cl_el is not None and cl_el.text else 0.0
        except Exception:
            cl = 0.0

        ob_el = ledger_el.find('OPENINGBALANCE')
        try:
            ob = abs(float(ob_el.text)) if ob_el is not None and ob_el.text else 0.0
        except Exception:
            ob = 0.0

        group_obj = None
        if parent:
            group_obj, _ = AccountGroup.objects.get_or_create(name=parent, defaults={'nature': 'Asset'})

        parsed_state = str(state_name)[:100] if state_name else None
        if parsed_state:
            parsed_state = STATE_CODE_MAP.get(parsed_state.lower().strip(), parsed_state)

        parsed_country = None
        if country_name:
            parsed_country = 'IN' if str(country_name).lower().strip() == 'india' else str(country_name)[:100]

        parsed_gstin = str(gstin)[:100] if gstin else None
        parsed_reg_type = 'registered' if parsed_gstin and parsed_gstin.strip() else 'unregistered'

        if name in existing_ledgers:
            ledger = existing_ledgers[name]
            updated = False
            for attr, val in [
                ('accountGroup', group_obj), ('state', parsed_state), ('country', parsed_country),
                ('placeofsupply', parsed_state), ('pincode', str(pincode)[:100] if pincode else None),
                ('mailing_name', str(mailing_name)[:100] if mailing_name else None),
                ('email', str(email_address)[:100] if email_address else None),
                ('registration_type', parsed_reg_type),
                ('phone', str(phone)[:100] if phone else None),
                ('gst_number', parsed_gstin),
                ('address', str(address)[:100] if address else None),
                ('maintain_biilwise_details', bill_wise),
            ]:
                if getattr(ledger, attr) != val:
                    setattr(ledger, attr, val)
                    updated = True
            if float(ledger.credit_limit or 0) != cl:
                ledger.credit_limit = cl
                updated = True
            if float(ledger.opening_balance or 0) != ob:
                ledger.opening_balance = ob
                updated = True
            if updated:
                ledger.save()
                update_count += 1
        else:
            Ledger(
                name=name, accountGroup=group_obj, maintain_biilwise_details=bill_wise,
                state=parsed_state, country=parsed_country, placeofsupply=parsed_state,
                pincode=str(pincode)[:100] if pincode else None,
                mailing_name=str(mailing_name)[:100] if mailing_name else None,
                email=str(email_address)[:100] if email_address else None,
                registration_type=parsed_reg_type,
                phone=str(phone)[:100] if phone else None,
                credit_limit=cl, opening_balance=ob,
                address=str(address)[:100] if address else None,
                gst_number=parsed_gstin,
            ).save()
            new_count += 1

    return {
        'new_count': new_count, 'update_count': update_count,
        'message': f'Imported {new_count} new ledgers, updated {update_count} existing.',
    }


def _process_agent_stock_import(xml_data: str) -> dict:
    """Parse Tally stock item XML (from agent) and create/update StockItem records in Django."""
    import re
    import datetime
    import xml.etree.ElementTree as ET
    from inventory_app.models import StockGroup, StockCategory, Unit, StockItem, StockItemHSN

    clean = re.sub(r'&#[0-9]+;', '', xml_data)
    clean = re.sub(r'&#x[0-9a-fA-F]+;', '', clean)
    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', clean)

    try:
        root = ET.fromstring(clean)
    except ET.ParseError as e:
        return {'error': f'XML parse error: {e}'}

    existing_items = {i.name.lower(): i for i in StockItem.objects.select_related('stock_group', 'stock_category', 'base_unit').all()}
    groups_cache = {g.name.lower(): g for g in StockGroup.objects.all()}
    categories_cache = {c.name.lower(): c for c in StockCategory.objects.all()}
    units_cache = {u.name.lower(): u for u in Unit.objects.all()}
    new_count = 0
    update_count = 0
    today = datetime.date.today()

    def _get_or_create_group(gname):
        gl = gname.lower()
        if gl not in groups_cache:
            obj, _ = StockGroup.objects.get_or_create(name=gname)
            groups_cache[gl] = obj
        return groups_cache[gl]

    def _get_or_create_unit(uname):
        ul = uname.lower()
        if ul not in units_cache:
            obj, _ = Unit.objects.get_or_create(name=uname, defaults={'uqc_code': uname[:10].upper(), 'decimal_places': 2})
            units_cache[ul] = obj
        return units_cache[ul]

    for item_el in root.findall('.//STOCKITEM'):
        name = item_el.get('NAME') or item_el.get('Name')
        if not name:
            name_el = item_el.find('NAME')
            if name_el is not None:
                name = name_el.text
        if not name or not str(name).strip():
            continue
        name = str(name).strip()

        def _txt(tag):
            el = item_el.find(tag)
            return el.text.strip() if el is not None and el.text else None

        parent = _txt('PARENT')
        base_units = _txt('BASEUNITS')
        stock_category = _txt('CATEGORY')
        add_units = _txt('ADDITIONALUNITS')
        hsn_code = _txt('HSNCODE')

        try:
            ob = abs(float(_txt('OPENINGBALANCE') or 0))
        except Exception:
            ob = 0.0
        try:
            ov = abs(float(_txt('OPENINGVALUE') or 0))
        except Exception:
            ov = 0.0
        try:
            or_ = abs(float(_txt('OPENINGRATE') or 0))
        except Exception:
            or_ = 0.0

        group_obj = _get_or_create_group(parent) if parent else _get_or_create_group('Primary')

        category_obj = None
        if stock_category and stock_category not in ('None', 'Not Applicable') and '\x04' not in stock_category:
            cl = stock_category.lower()
            if cl not in categories_cache:
                obj, _ = StockCategory.objects.get_or_create(name=stock_category)
                categories_cache[cl] = obj
            category_obj = categories_cache[cl]

        unit_obj = _get_or_create_unit(base_units) if base_units else _get_or_create_unit('Nos')
        alt_unit_obj = None
        if add_units and add_units not in ('None', 'Not Applicable') and '\x04' not in add_units:
            alt_unit_obj = _get_or_create_unit(add_units)

        name_lower = name.lower()
        if name_lower in existing_items:
            item = existing_items[name_lower]
            updated = False
            for attr, val in [
                ('stock_group', group_obj), ('stock_category', category_obj),
                ('base_unit', unit_obj), ('alternate_unit', alt_unit_obj),
            ]:
                if getattr(item, attr) != val:
                    setattr(item, attr, val)
                    updated = True
            for attr, val in [('opening_stock', ob), ('opening_value', ov), ('opening_rate', or_)]:
                if float(getattr(item, attr) or 0) != val:
                    setattr(item, attr, val)
                    updated = True
            if updated:
                item.save()
                update_count += 1
        else:
            item = StockItem(
                name=name, stock_group=group_obj, stock_category=category_obj,
                base_unit=unit_obj, alternate_unit=alt_unit_obj,
                opening_stock=ob, opening_value=ov, opening_rate=or_
            )
            item.save()
            new_count += 1

        if hsn_code and hsn_code not in ('None', ''):
            StockItemHSN.objects.update_or_create(
                stock_item=item, applicable_date=today,
                defaults={'hsn_number': hsn_code}
            )

    return {
        'new_count': new_count, 'update_count': update_count,
        'message': f'Imported {new_count} new stock items, updated {update_count} existing.',
    }

class DistributorTopPickListView(generics.ListAPIView):
    """
    GET: Fetch all top picks across all ledgers.
    """
    permission_classes = [IsAuthenticated]
    from .serializers import DistributorTopPickListSerializer
    serializer_class = DistributorTopPickListSerializer

    def get_queryset(self):
        from .models import DistributorTopPick
        return DistributorTopPick.objects.select_related('ledger').prefetch_related('products').all().order_by('-updated_at')

class DistributorTopPickView(views.APIView):
    """
    GET: Fetch top picks for a given ledger.
    POST: Update top picks for a given ledger.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, ledger_id):
        from .models import DistributorTopPick
        from .serializers import DistributorTopPickSerializer
        try:
            top_pick = DistributorTopPick.objects.get(ledger_id=ledger_id)
            serializer = DistributorTopPickSerializer(top_pick)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except DistributorTopPick.DoesNotExist:
            return Response({'ledger': ledger_id, 'products': []}, status=status.HTTP_200_OK)

    def post(self, request, ledger_id):
        from .models import DistributorTopPick
        from .serializers import DistributorTopPickSerializer
        product_ids = request.data.get('products', [])
        
        top_pick, created = DistributorTopPick.objects.get_or_create(ledger_id=ledger_id)
        top_pick.products.set(product_ids)
        top_pick.save()
        
        serializer = DistributorTopPickSerializer(top_pick)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, ledger_id):
        from .models import DistributorTopPick
        try:
            top_pick = DistributorTopPick.objects.get(ledger_id=ledger_id)
            top_pick.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except DistributorTopPick.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
