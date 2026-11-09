from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import PurchaseOrder, PurchaseInvoice, PurchaseReturn, PurchaseInvoiceItem, PurchaseTallySyncConfig, PurchaseInvoiceSyncLog, PurchaseReturnSyncLog
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderListSerializer,
    PurchaseInvoiceSerializer,
    PurchaseInvoiceListSerializer,
    PurchaseReturnSerializer,
    PurchaseReturnListSerializer,
    MobilePurchaseOrderSerializer
)


def generate_next_purchase_invoice_no(prefix_id):
    """
    Compute the next invoice number for a given Purchase Invoice category
    (prefix_id -> settings_app.PrefixConfiguration id, e.g. B2B / B2C / IGST).

    This is the single source of truth for Purchase Invoice numbering and is
    used both for the "preview" the form shows when the Invoice Category is
    changed (NextPurchaseInvoiceNumberView) and for the number actually
    persisted on save (PurchaseInvoiceListCreateView.post). Keeping both call
    sites on this one function guarantees every category keeps its own
    independent, gap-free sequence instead of quietly falling back to a
    shared/global "PI" counter.

    Returns None if prefix_id doesn't resolve to a valid PrefixConfiguration,
    so callers can decide how to handle that (e.g. fall back to a generic
    scheme only when no category was supplied at all).
    """
    import re
    from settings_app.models import PrefixConfiguration

    try:
        prefix_config = PrefixConfiguration.objects.get(id=prefix_id)
    except (PrefixConfiguration.DoesNotExist, ValueError, TypeError):
        return None

    prefix = prefix_config.prefix or ''
    padding = prefix_config.number_padding or 4
    starting = prefix_config.starting_number or 1
    postfix = prefix_config.postfix or ''

    # Scope strictly to invoices saved under THIS category's prefix_id.
    # This is what keeps B2B / B2C / IGST as independent series instead of
    # sharing one counter.
    potential_pis = PurchaseInvoice.objects.filter(voucher_type=str(prefix_config.id))

    max_num = 0
    found_match = False
    for pi in potential_pis:
        # Case-insensitive prefix strip so mixed-case historical invoice_nos
        # (e.g. 'PI0004' stored under a prefix configured as 'Pi') are still
        # parsed correctly instead of falling back to the full invoice_no string.
        if prefix and pi.invoice_no.lower().startswith(prefix.lower()):
            num_str = pi.invoice_no[len(prefix):]
        else:
            num_str = pi.invoice_no
        if postfix:
            if num_str.endswith(postfix):
                num_str = num_str[:-len(postfix)]
            else:
                continue
        match = re.search(r'(\d+)$', num_str)
        if match:
            val = int(match.group(1))
            if not found_match or val > max_num:
                max_num = val
                found_match = True

    next_num = (max_num + 1) if found_match else starting
    next_pi = f"{prefix}{next_num:0{padding}d}{postfix}"

    # Guard against stray duplicates (e.g. manually entered invoice_no that
    # happens to collide) — but scope the check to THIS category only so that
    # two categories sharing a prefix (e.g. old 'Pi' for B2C and IGST) cannot
    # run up each other's counter indefinitely.
    while PurchaseInvoice.objects.filter(
        invoice_no=next_pi,
        voucher_type=str(prefix_config.id),
    ).exists():
        next_num += 1
        next_pi = f"{prefix}{next_num:0{padding}d}{postfix}"

    return next_pi


class NextPurchaseOrderNumberView(APIView):
    def get(self, request):
        prefix_id = request.query_params.get('prefix_id')
        if prefix_id:
            from settings_app.models import PrefixConfiguration
            try:
                prefix_config = PrefixConfiguration.objects.get(id=prefix_id)
                prefix = prefix_config.prefix or ''
                padding = prefix_config.number_padding or 4
                starting = prefix_config.starting_number or 1
                postfix = prefix_config.postfix or ''
                
                sub_name = ''
                if hasattr(prefix_config, 'subvoucher_type') and prefix_config.subvoucher_type:
                    sub_name = getattr(prefix_config.subvoucher_type, 'type_name', '') or ''
                
                # robustly find highest number for this prefix
                last_po = None
                if prefix:
                    potential_pos = PurchaseOrder.objects.filter(po_no__startswith=prefix).order_by('-id')[:50]
                    for po in potential_pos:
                        num_str = po.po_no[len(prefix):]
                        if postfix:
                            if num_str.endswith(postfix):
                                num_str = num_str[:-len(postfix)]
                            else:
                                continue
                        if num_str.isdigit():
                            last_po = po
                            break
                else:
                    last_po = PurchaseOrder.objects.all().order_by('-id').first()

                if last_po:
                    num_str = last_po.po_no[len(prefix):] if prefix else last_po.po_no
                    if postfix:
                        num_str = num_str[:-len(postfix)] if num_str.endswith(postfix) else num_str
                    try:
                        # Extract trailing digits if there's no clear prefix
                        import re
                        match = re.search(r'(\d+)$', num_str)
                        if match:
                            last_num = int(match.group(1))
                            next_num = last_num + 1
                            # Reconstruct replacing the last digits
                            base_str = num_str[:match.start()]
                            next_po_no = f"{prefix}{base_str}{next_num:0{padding}d}{postfix}"
                        else:
                            next_po_no = f"{prefix}{starting:0{padding}d}{postfix}"
                    except ValueError:
                        next_num = starting
                        next_po_no = f"{prefix}{next_num:0{padding}d}{postfix}"
                else:
                    next_po_no = f"{prefix}{starting:0{padding}d}{postfix}"

                return Response({'next_po_no': next_po_no}, status=status.HTTP_200_OK)
            except PrefixConfiguration.DoesNotExist:
                pass

        last_po = PurchaseOrder.objects.filter(po_no__startswith='PO').order_by('-id').first()
        if last_po and last_po.po_no:
            try:
                last_number = int(last_po.po_no.replace('PO', ''))
                next_po = f"PO{last_number + 1:05d}"
            except ValueError:
                next_po = "PO00001"
        else:
            next_po = "PO00001"
        return Response({'next_po_no': next_po}, status=status.HTTP_200_OK)

class NextPurchaseInvoiceNumberView(APIView):
    def get(self, request):
        prefix_id = request.query_params.get('prefix_id')
        if prefix_id:
            next_pi = generate_next_purchase_invoice_no(prefix_id)
            if next_pi is not None:
                return Response({'next_invoice_no': next_pi}, status=status.HTTP_200_OK)
            # Invalid/unknown prefix_id — fall through to the generic scheme
            # below rather than silently returning a stale/global number.

        import re
        max_num = 0
        found_match = False
        potential_pis = PurchaseInvoice.objects.filter(invoice_no__startswith='PI')
        for pi in potential_pis:
            match = re.search(r'(\d+)$', pi.invoice_no)
            if match:
                val = int(match.group(1))
                if not found_match or val > max_num:
                    max_num = val
                    found_match = True

        if found_match:
            next_num = max_num + 1
        else:
            next_num = 1

        next_pi = f"PI{next_num:05d}"
        while PurchaseInvoice.objects.filter(invoice_no=next_pi).exists():
            next_num += 1
            next_pi = f"PI{next_num:05d}"

        return Response({'next_invoice_no': next_pi}, status=status.HTTP_200_OK)

class NextPurchaseReturnNumberView(APIView):
    def get(self, request):
        prefix_id = request.query_params.get('prefix_id')
        if prefix_id:
            from settings_app.models import PrefixConfiguration
            try:
                prefix_config = PrefixConfiguration.objects.get(id=prefix_id)
                prefix = prefix_config.prefix or ''
                padding = prefix_config.number_padding or 4
                starting = prefix_config.starting_number or 1
                postfix = prefix_config.postfix or ''
                
                sub_name = ''
                if hasattr(prefix_config, 'subvoucher_type') and prefix_config.subvoucher_type:
                    sub_name = getattr(prefix_config.subvoucher_type, 'type_name', '') or ''

                # robustly find highest number for this prefix
                last_pr = None
                if prefix:
                    potential_prs = PurchaseReturn.objects.filter(return_no__startswith=prefix).order_by('-id')[:50]
                    for pr in potential_prs:
                        num_str = pr.return_no[len(prefix):]
                        if postfix:
                            if num_str.endswith(postfix):
                                num_str = num_str[:-len(postfix)]
                            else:
                                continue
                        if num_str.isdigit():
                            last_pr = pr
                            break
                else:
                    last_pr = PurchaseReturn.objects.all().order_by('-id').first()

                if last_pr:
                    num_str = last_pr.return_no[len(prefix):] if prefix else last_pr.return_no
                    if postfix:
                        num_str = num_str[:-len(postfix)] if num_str.endswith(postfix) else num_str
                    try:
                        import re
                        match = re.search(r'(\d+)$', num_str)
                        if match:
                            last_num = int(match.group(1))
                            next_num = last_num + 1
                            base_str = num_str[:match.start()]
                            next_pr_no = f"{prefix}{base_str}{next_num:0{padding}d}{postfix}"
                        else:
                            next_pr_no = f"{prefix}{starting:0{padding}d}{postfix}"
                    except ValueError:
                        next_num = starting
                        next_pr_no = f"{prefix}{next_num:0{padding}d}{postfix}"
                else:
                    next_pr_no = f"{prefix}{starting:0{padding}d}{postfix}"

                return Response({'next_return_no': next_pr_no}, status=status.HTTP_200_OK)
            except PrefixConfiguration.DoesNotExist:
                pass

        last_pr = PurchaseReturn.objects.order_by('-id').first()
        if last_pr and last_pr.return_no:
            try:
                last_number = int(last_pr.return_no.replace('PR', ''))
                next_pr = f"PR{last_number + 1:05d}"
            except ValueError:
                next_pr = "PR00001"
        else:
            next_pr = "PR00001"
        return Response({'next_return_no': next_pr}, status=status.HTTP_200_OK)

class MobilePurchaseOrderCreateView(APIView):
    def post(self, request):
        data = request.data.copy()
        
        # Ensure po_no is present
        if not data.get('po_no'):
            last_po = PurchaseOrder.objects.filter(po_no__startswith='PO').order_by('-id').first()
            if last_po:
                try:
                    last_number = int(last_po.po_no.replace('PO', ''))
                    data['po_no'] = f"PO{last_number + 1:05d}"
                except ValueError:
                    data['po_no'] = "PO00001"
            else:
                data['po_no'] = "PO00001"
                
        serializer = MobilePurchaseOrderSerializer(data=data)
        if serializer.is_valid():
            serializer.save(created_by=request.user if request.user.is_authenticated else None)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PurchaseOrderListCreateView(APIView):

    def get(self, request):

        supplier_id = request.query_params.get('supplier_ledger_id') or request.query_params.get('supplier_ledger')
        include_completed = request.query_params.get('include_completed', 'false').lower() == 'true'

        purchase_orders = PurchaseOrder.objects.all().order_by('-id')
        if supplier_id:
            purchase_orders = purchase_orders.filter(supplier_ledger_id=supplier_id)
            if not include_completed:
                from decimal import Decimal
                active_po_ids = []
                for po in purchase_orders:
                    if po.status != 'COMPLETED' and po.remaining_quantity_total > Decimal('0.00'):
                        active_po_ids.append(po.id)
                purchase_orders = purchase_orders.filter(id__in=active_po_ids)

        serializer = PurchaseOrderSerializer(
            purchase_orders,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        data = request.data.copy()

        if not data.get('po_no'):

            last_po = PurchaseOrder.objects.filter(po_no__startswith='PO').order_by('-id').first()

            if last_po:
                try:
                    last_number = int(
                        last_po.po_no.replace('PO', '')
                    )
                    data['po_no'] = f"PO{last_number + 1:05d}"
                except:
                    data['po_no'] = "PO00001"
            else:
                data['po_no'] = "PO00001"

        serializer = PurchaseOrderSerializer(
            data=data
        )

        if serializer.is_valid():

            serializer.save(
                created_by=request.user
                if request.user.is_authenticated
                else None
            )

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        print("Purchase Order Save Errors:", serializer.errors)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class PurchaseOrderDetailView(APIView):

    def get_object(self, pk):

        try:
            return PurchaseOrder.objects.get(pk=pk)
        except PurchaseOrder.DoesNotExist:
            return None

    def get(self, request, pk):

        purchase_order = self.get_object(pk)

        if not purchase_order:
            return Response(
                {"error": "Purchase Order not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseOrderSerializer(
            purchase_order
        )

        return Response(serializer.data)

    def put(self, request, pk):

        purchase_order = self.get_object(pk)

        if not purchase_order:
            return Response(
                {"error": "Purchase Order not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseOrderSerializer(
            purchase_order,
            data=request.data
        )

        if serializer.is_valid():

            serializer.save(
                edited_by=request.user
                if request.user.is_authenticated
                else None
            )

            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):

        purchase_order = self.get_object(pk)

        if not purchase_order:
            return Response(
                {"error": "Purchase Order not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        purchase_order.delete()

        return Response(
            {"message": "Purchase Order deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )


class PurchaseOrderResolveGstHsnView(APIView):
    """
    API endpoint to dynamically resolve the GST% and HSN code for a given
    stock item and entry date. Checks item, group, and category level definitions.
    """
    def get(self, request):
        product_id = request.query_params.get('product_id')
        entry_date_str = request.query_params.get('date')
        
        if not product_id or not entry_date_str:
            return Response(
                {"error": "product_id and date parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from django.utils.dateparse import parse_date
        entry_date = parse_date(entry_date_str)
        if not entry_date:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        from inventory_app.models import (
            StockItem, StockItemGST, StockItemHSN,
            StockGroupGST, StockGroupHSN,
            StockCategoryGST, StockCategoryHSN
        )
        
        try:
            product = StockItem.objects.get(pk=product_id)
        except StockItem.DoesNotExist:
            return Response(
                {"error": "Product not found."},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # 1. Resolve GST%
        gst_percent = 0.00

        # Check Item GST applicable as of entry_date
        rec_gst = StockItemGST.objects.filter(
            stock_item=product, applicable_date__lte=entry_date
        ).order_by('-applicable_date').first()
        if rec_gst:
            gst_percent = float(rec_gst.igst_percent)

        # Check Group GST applicable as of entry_date
        if not rec_gst and product.stock_group:
            rec_gst = StockGroupGST.objects.filter(
                stock_group=product.stock_group, applicable_date__lte=entry_date
            ).order_by('-applicable_date').first()
            if rec_gst:
                gst_percent = float(rec_gst.igst_percent)

        # Check Category GST applicable as of entry_date
        if not rec_gst and product.stock_category:
            rec_gst = StockCategoryGST.objects.filter(
                stock_category=product.stock_category, applicable_date__lte=entry_date
            ).order_by('-applicable_date').first()
            if rec_gst:
                gst_percent = float(rec_gst.igst_percent)

        # Fallback to latest overall if none applicable <= entry_date
        if not rec_gst:
            rec_gst = StockItemGST.objects.filter(stock_item=product).order_by('-applicable_date').first()
            if rec_gst:
                gst_percent = float(rec_gst.igst_percent)
            elif product.stock_group:
                rec_gst = StockGroupGST.objects.filter(stock_group=product.stock_group).order_by('-applicable_date').first()
                if rec_gst:
                    gst_percent = float(rec_gst.igst_percent)
                elif product.stock_category:
                    rec_gst = StockCategoryGST.objects.filter(stock_category=product.stock_category).order_by('-applicable_date').first()
                    if rec_gst:
                        gst_percent = float(rec_gst.igst_percent)
            elif product.stock_category:
                rec_gst = StockCategoryGST.objects.filter(stock_category=product.stock_category).order_by('-applicable_date').first()
                if rec_gst:
                    gst_percent = float(rec_gst.igst_percent)

        # 2. Resolve HSN Code
        hsn_number = ""
        
        # Check Item HSN
        qs_hsn = StockItemHSN.objects.filter(stock_item=product, applicable_date__lte=entry_date)
        rec_hsn = qs_hsn.order_by('-applicable_date').first()
        if rec_hsn:
            hsn_number = rec_hsn.hsn_number
        else:
            # Check Group HSN
            if product.stock_group:
                qs_hsn = StockGroupHSN.objects.filter(stock_group=product.stock_group, applicable_date__lte=entry_date)
                rec_hsn = qs_hsn.order_by('-applicable_date').first()
                if rec_hsn:
                    hsn_number = rec_hsn.hsn_number
                else:
                    # Check Category HSN
                    if product.stock_category:
                        qs_hsn = StockCategoryHSN.objects.filter(stock_category=product.stock_category, applicable_date__lte=entry_date)
                        rec_hsn = qs_hsn.order_by('-applicable_date').first()
                        if rec_hsn:
                            hsn_number = rec_hsn.hsn_number
            else:
                # Check Category HSN if no group
                if product.stock_category:
                    qs_hsn = StockCategoryHSN.objects.filter(stock_category=product.stock_category, applicable_date__lte=entry_date)
                    rec_hsn = qs_hsn.order_by('-applicable_date').first()
                    if rec_hsn:
                        hsn_number = rec_hsn.hsn_number
                        
        # Fallback to latest overall if none applicable <= date
        if not hsn_number:
            rec_hsn = StockItemHSN.objects.filter(stock_item=product).order_by('-applicable_date').first()
            if rec_hsn:
                hsn_number = rec_hsn.hsn_number
            elif product.stock_group:
                rec_hsn = StockGroupHSN.objects.filter(stock_group=product.stock_group).order_by('-applicable_date').first()
                if rec_hsn:
                    hsn_number = rec_hsn.hsn_number
                elif product.stock_category:
                    rec_hsn = StockCategoryHSN.objects.filter(stock_category=product.stock_category).order_by('-applicable_date').first()
                    if rec_hsn:
                        hsn_number = rec_hsn.hsn_number
            elif product.stock_category:
                rec_hsn = StockCategoryHSN.objects.filter(stock_category=product.stock_category).order_by('-applicable_date').first()
                if rec_hsn:
                    hsn_number = rec_hsn.hsn_number
                    
        return Response({
            "gst_percent": gst_percent,
            "hsn": hsn_number
        }, status=status.HTTP_200_OK)


class PurchaseInvoiceResolveGstHsnView(PurchaseOrderResolveGstHsnView):
    pass


class PurchaseInvoiceListCreateView(APIView):

    def get(self, request):
        supplier_ledger_id = request.query_params.get('supplier_ledger_id')
        if supplier_ledger_id:
            purchase_invoices = PurchaseInvoice.objects.filter(supplier_ledger_id=supplier_ledger_id)
        else:
            purchase_invoices = PurchaseInvoice.objects.select_related('supplier_ledger').prefetch_related('sync_logs')

        if request.user.is_authenticated and not request.user.is_superuser:
            purchase_invoices = purchase_invoices.filter(created_by=request.user)

        purchase_invoices = purchase_invoices.order_by('-created_at')

        serializer = PurchaseInvoiceListSerializer(
            purchase_invoices,
            many=True
        )
        return Response(serializer.data)

    def post(self, request):
        data = request.data.copy()

        if not data.get('invoice_no'):
            # Always try to number within the invoice's own category
            # (voucher_type -> PrefixConfiguration id) first, so B2B/B2C/IGST
            # each keep their own independent sequence. Only fall back to the
            # generic global "PI" counter if no category was submitted at all.
            next_pi = None
            voucher_type_val = data.get('voucher_type')
            if voucher_type_val:
                next_pi = generate_next_purchase_invoice_no(voucher_type_val)

            if next_pi is None:
                import re
                max_num = 0
                found_match = False
                potential_pis = PurchaseInvoice.objects.filter(invoice_no__startswith='PI')
                for pi in potential_pis:
                    match = re.search(r'(\d+)$', pi.invoice_no)
                    if match:
                        val = int(match.group(1))
                        if not found_match or val > max_num:
                            max_num = val
                            found_match = True

                if found_match:
                    next_num = max_num + 1
                else:
                    next_num = 1

                next_pi = f"PI{next_num:05d}"
                while PurchaseInvoice.objects.filter(invoice_no=next_pi).exists():
                    next_num += 1
                    next_pi = f"PI{next_num:05d}"

            data['invoice_no'] = next_pi

        serializer = PurchaseInvoiceSerializer(
            data=data
        )

        if serializer.is_valid():
            serializer.save(
                created_by=request.user
                if request.user.is_authenticated
                else None
            )
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class PurchaseInvoiceDetailView(APIView):

    def get_object(self, pk):
        try:
            return PurchaseInvoice.objects.get(pk=pk)
        except PurchaseInvoice.DoesNotExist:
            return None

    def get(self, request, pk):
        purchase_invoice = self.get_object(pk)

        if not purchase_invoice:
            return Response(
                {"error": "Purchase Invoice not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseInvoiceSerializer(
            purchase_invoice
        )
        return Response(serializer.data)

    def put(self, request, pk):
        purchase_invoice = self.get_object(pk)

        if not purchase_invoice:
            return Response(
                {"error": "Purchase Invoice not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseInvoiceSerializer(
            purchase_invoice,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save(
                edited_by=request.user
                if request.user.is_authenticated
                else None
            )
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        purchase_invoice = self.get_object(pk)

        if not purchase_invoice:
            return Response(
                {"error": "Purchase Invoice not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        purchase_invoice.delete()
        return Response(
            {"message": "Purchase Invoice deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )


class PurchaseInvoiceLookupView(APIView):
    def get(self, request):
        supplier_ledger_id = request.query_params.get('supplier_ledger')
        supplier_invoice_no = request.query_params.get('supplier_invoice_no')
        supplier_invoice_date = request.query_params.get('supplier_invoice_date')

        if not all([supplier_ledger_id, supplier_invoice_no, supplier_invoice_date]):
            return Response(
                {"error": "supplier_ledger, supplier_invoice_no, and supplier_invoice_date are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invoice = PurchaseInvoice.objects.get(
                supplier_ledger_id=supplier_ledger_id,
                supplier_invoice_no=supplier_invoice_no,
                supplier_invoice_date=supplier_invoice_date
            )
        except PurchaseInvoice.DoesNotExist:
            return Response(
                {"error": "No matching Purchase Invoice found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseInvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)




class PurchaseInvoiceBatchListView(APIView):
    def get(self, request):
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get unique, non-empty batch numbers for this product across all purchase invoices
        batches = PurchaseInvoiceItem.objects.filter(
            product_id=product_id
        ).exclude(
            batch_number__isnull=True
        ).exclude(
            batch_number__exact=''
        ).values_list('batch_number', flat=True).distinct()

        from inventory_app.models import StockTableDuplicate
        inv_batches = StockTableDuplicate.objects.filter(
            item_id=product_id,
            is_active=True
        ).exclude(
            batch_number__isnull=True
        ).exclude(
            batch_number__exact=''
        ).values_list('batch_number', flat=True).distinct()

        all_batches = sorted(list(set(batches) | set(inv_batches)))

        return Response(all_batches, status=status.HTTP_200_OK)

class PurchaseReturnResolveGstHsnView(PurchaseOrderResolveGstHsnView):
    pass


class PurchaseReturnListCreateView(APIView):

    def get(self, request):
        if request.user.is_authenticated and request.user.is_superuser:
            purchase_returns = PurchaseReturn.objects.all().order_by('-id')
        elif request.user.is_authenticated:
            purchase_returns = PurchaseReturn.objects.filter(created_by=request.user).order_by('-id')
        else:
            purchase_returns = PurchaseReturn.objects.none()
            
        serializer = PurchaseReturnListSerializer(
            purchase_returns,
            many=True
        )
        return Response(serializer.data)

    def post(self, request):
        data = request.data.copy()

        if not data.get('return_no'):
            last_pr = PurchaseReturn.objects.order_by('-id').first()
            if last_pr:
                try:
                    last_number = int(
                        last_pr.return_no.replace('PR', '')
                    )
                    data['return_no'] = f"PR{last_number + 1:05d}"
                except:
                    data['return_no'] = "PR00001"
            else:
                data['return_no'] = "PR00001"

        serializer = PurchaseReturnSerializer(
            data=data
        )

        if serializer.is_valid():
            serializer.save(
                created_by=request.user
                if request.user.is_authenticated
                else None
            )
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class PurchaseReturnDetailView(APIView):

    def get_object(self, pk):
        try:
            return PurchaseReturn.objects.get(pk=pk)
        except PurchaseReturn.DoesNotExist:
            return None

    def get(self, request, pk):
        purchase_return = self.get_object(pk)

        if not purchase_return:
            return Response(
                {"error": "Purchase Return not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseReturnSerializer(
            purchase_return
        )
        return Response(serializer.data)

    def put(self, request, pk):
        purchase_return = self.get_object(pk)

        if not purchase_return:
            return Response(
                {"error": "Purchase Return not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PurchaseReturnSerializer(
            purchase_return,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save(
                edited_by=request.user
                if request.user.is_authenticated
                else None
            )
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def delete(self, request, pk):
        purchase_return = self.get_object(pk)

        if not purchase_return:
            return Response(
                {"error": "Purchase Return not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        purchase_return.delete()
        return Response(
            {"message": "Purchase Return deleted successfully"},
            status=status.HTTP_204_NO_CONTENT
        )



# ─────────────────────────────────────────────────────────────────────────
# Tally Synchronization — Purchase Invoice
#
# Reuses the already-existing XML generation (tally.xml_builder) and HTTP
# push (tally.tally_client) that power the agent/local-mode sync, adding a
# synchronous, user-authenticated layer for the "Tally Synchronization"
# screen (manual "Push to Tally", live status list, connection test).
# Purchase Order is intentionally NOT synced to Tally (never posted there).
# Purchase Return sync will be added later.
# ─────────────────────────────────────────────────────────────────────────

from django.db import models as django_models
from rest_framework.permissions import IsAuthenticated


def _get_purchase_tally_config():
    config, _ = PurchaseTallySyncConfig.objects.get_or_create(
        voucher_type='Purchase Invoice',
        defaults={
            'auto_push_on_save': False,
            'tally_url': 'http://localhost:9000',
        }
    )
    return config


def _push_purchase_invoice_to_tally(invoice, tally_url=None):
    """
    Generates the Tally XML for a single PurchaseInvoice and posts it to
    Tally synchronously, logging the result. Returns a result dict.
    """
    from tally.xml_builder import generate_purchase_invoice_xml
    from tally.tally_client import send_xml_to_tally

    if not tally_url:
        tally_url = _get_purchase_tally_config().tally_url or 'http://localhost:9000'

    invoice.sync_status = 'processing'
    invoice.save(update_fields=['sync_status'])

    try:
        xml_data = generate_purchase_invoice_xml(invoice)
    except Exception as e:
        err_msg = f"XML generation error: {str(e)}"
        invoice.sync_status = 'failed'
        invoice.is_synced = False
        invoice.save(update_fields=['sync_status', 'is_synced'])
        PurchaseInvoiceSyncLog.objects.create(
            invoice=invoice, error_message=err_msg, status='failed'
        )
        return {
            'success': False,
            'invoice_id': invoice.id,
            'invoice_no': invoice.invoice_no,
            'status': 'failed',
            'message': err_msg,
        }

    success, response_text, error_message = send_xml_to_tally(xml_data, tally_url)

    try:
        invoice.sync_status = 'synced' if success else 'failed'
        invoice.is_synced = success
        invoice.save(update_fields=['sync_status', 'is_synced'])

        PurchaseInvoiceSyncLog.objects.create(
            invoice=invoice,
            tally_response=response_text,
            error_message=None if success else error_message,
            status='success' if success else 'failed'
        )
    except Exception as db_err:
        import logging
        logger = logging.getLogger('tally_sync')
        logger.error(
            f"Bookkeeping error updating status/log after Tally push for invoice {invoice.invoice_no}: {str(db_err)}",
            exc_info=True
        )
        if not success:
            raise db_err

    return {
        'success': success,
        'invoice_id': invoice.id,
        'invoice_no': invoice.invoice_no,
        'status': 'synced' if success else 'failed',
        'message': 'Purchase invoice successfully synced to Tally.' if success else error_message,
        'tally_response': response_text,
    }


def _scope_purchase_invoices_to_user(qs, request):
    """
    Returns the purchase invoice queryset scoped to the requesting user.
    - Admins (is_staff / is_superuser) see ALL invoices.
    - Regular users see only the invoices they created (created_by=request.user).
    """
    user = request.user
    if user.is_superuser:
        return qs
    return qs.filter(created_by=user)


class PurchaseTallySyncConfigView(APIView):
    """
    GET: Retrieve Tally sync configuration and statistics for Purchase Invoice.
    POST: Update auto_push_on_save and/or tally_url.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = _get_purchase_tally_config()

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        base_qs = PurchaseInvoice.objects.all()
        base_qs = _scope_purchase_invoices_to_user(base_qs, request)
        if from_date:
            base_qs = base_qs.filter(entry_date__gte=from_date)
        if to_date:
            base_qs = base_qs.filter(entry_date__lte=to_date)

        total_invoices = base_qs.count()
        synced_invoices = base_qs.filter(is_synced=True).count()
        failed_invoices = base_qs.filter(sync_status='failed').count()
        pending_invoices = base_qs.filter(is_synced=False).exclude(sync_status='failed').count()
        unsynced_total = base_qs.filter(is_synced=False).count()

        return Response({
            'voucher_type': config.voucher_type,
            'auto_push_on_save': config.auto_push_on_save,
            'tally_url': config.tally_url,
            'last_sync_at': config.last_sync_at,
            'total_orders': total_invoices,
            'synced_orders': synced_invoices,
            'pending_orders': pending_invoices,
            'failed_orders': failed_invoices,
            'unsynced_total': unsynced_total,
        })

    def post(self, request):
        config = _get_purchase_tally_config()

        if 'auto_push_on_save' in request.data:
            val = request.data.get('auto_push_on_save')
            if isinstance(val, str):
                config.auto_push_on_save = val.lower() in ('true', '1', 'yes')
            else:
                config.auto_push_on_save = bool(val)

        if 'tally_url' in request.data and request.data['tally_url']:
            config.tally_url = str(request.data['tally_url']).strip()

        config.save()
        return self.get(request)


class PurchaseTallySyncPushView(APIView):
    """
    POST: Triggers a manual push of one, several, or all pending Purchase
    Invoices to Tally, synchronously.
    Body: { invoice_id } | { invoice_ids: [...] } | { from_date, to_date } | {}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone as dj_timezone

        invoice_id = request.data.get('invoice_id')
        invoice_ids = request.data.get('invoice_ids')
        from_date = request.data.get('from_date')
        to_date = request.data.get('to_date')

        config = _get_purchase_tally_config()
        tally_url = config.tally_url or 'http://localhost:9000'

        if invoice_id:
            try:
                invoice = _scope_purchase_invoices_to_user(
                    PurchaseInvoice.objects.all(), request
                ).get(pk=invoice_id)
            except PurchaseInvoice.DoesNotExist:
                return Response({'error': 'Purchase invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
            try:
                res = _push_purchase_invoice_to_tally(invoice, tally_url=tally_url)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': f'Unhandled error while pushing invoice {invoice.invoice_no}: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(res, status=status.HTTP_200_OK if res.get('success') else status.HTTP_400_BAD_REQUEST)

        if invoice_ids:
            invoices = _scope_purchase_invoices_to_user(
                PurchaseInvoice.objects.filter(id__in=invoice_ids), request
            )
        else:
            invoices = _scope_purchase_invoices_to_user(
                PurchaseInvoice.objects.filter(is_synced=False), request
            ).order_by('created_at')
            if from_date:
                invoices = invoices.filter(entry_date__gte=from_date)
            if to_date:
                invoices = invoices.filter(entry_date__lte=to_date)

        inv_list = list(invoices)
        results = []
        synced_count = 0
        failed_count = 0
        for inv in inv_list:
            res = _push_purchase_invoice_to_tally(inv, tally_url=tally_url)
            results.append(res)
            if res.get('success'):
                synced_count += 1
            else:
                failed_count += 1

        config.last_sync_at = dj_timezone.now()
        config.save(update_fields=['last_sync_at'])

        return Response({
            'total': len(inv_list),
            'synced_count': synced_count,
            'failed_count': failed_count,
            'results': results,
        }, status=status.HTTP_200_OK)


class PurchaseTallySyncInvoicesView(APIView):
    """
    GET: Returns purchase invoices with Tally synchronization status and last log info.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        qs = PurchaseInvoice.objects.select_related('supplier_ledger').prefetch_related('sync_logs').order_by('-created_at')
        qs = _scope_purchase_invoices_to_user(qs, request)

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
                django_models.Q(invoice_no__icontains=search_query) |
                django_models.Q(supplier_ledger__name__icontains=search_query)
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
                }
                for l in all_logs
            ]
            data.append({
                'id': inv.id,
                'invoice_no': inv.invoice_no,
                'entry_date': inv.entry_date,
                'supplier_name': inv.supplier_ledger.name if inv.supplier_ledger else 'N/A',
                'total_amount': str(inv.total_amount),
                'sync_status': inv.sync_status,
                'is_synced': inv.is_synced,
                'last_attempted_at': last_log.attempted_at if last_log else None,
                'last_error': last_log.error_message if last_log else None,
                'last_response': last_log.tally_response if last_log else None,
                'sync_history': sync_history,
                'created_at': inv.created_at,
            })

        return Response(data, status=status.HTTP_200_OK)

### POST: Tests HTTP connection to the Tally server for Purchase Invoice sync.

class PurchaseTallyTestConnectionView(APIView):
    """
    POST: Tests HTTP connection to the Tally server for Purchase Invoice sync.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import socket
        from urllib.parse import urlparse
        import requests

        tally_url = request.data.get('tally_url') or _get_purchase_tally_config().tally_url or 'http://localhost:9000'

        parsed = urlparse(tally_url)
        host = parsed.hostname or '127.0.0.1'
        port = parsed.port or 9000
        connect_host = '127.0.0.1' if host in ('localhost', '127.0.0.1') else host

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.5)
        try:
            s.connect((connect_host, port))
            s.close()
        except Exception:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Could not reach Tally on {host}:{port}. Please ensure Tally is open and port {port} is enabled in F12 / Advanced Configuration.",
                'error': 'ConnectionRefused'
            })

        test_xml = (
            "<ENVELOPE>"
            "<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>"
            "<BODY><EXPORTDATA><REQUESTDESC>"
            "<REPORTNAME>List of Companies</REPORTNAME>"
            "<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>"
            "</REQUESTDESC></EXPORTDATA></BODY>"
            "</ENVELOPE>"
        )
        request_url = tally_url.replace('localhost', '127.0.0.1')
        try:
            response = requests.post(
                request_url,
                data=test_xml.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=4
            )
            if response.status_code == 200:
                return Response({
                    'connected': True,
                    'is_idle': False,
                    'message': f"Connected successfully to Tally at {tally_url}!",
                    'status_code': response.status_code
                })
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Tally responded with HTTP status {response.status_code}.",
                'status_code': response.status_code
            })
        except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
            return Response({
                'connected': True,
                'is_idle': True,
                'message': (
                    f"Tally server is running on port {port}, but is waiting on a screen or no company is opened. "
                    "Please open your company in Tally (so the Gateway of Tally is visible) and close any prompt."
                )
            })
        except requests.exceptions.ConnectionError:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Could not connect to Tally server at {tally_url}.",
                'error': 'ConnectionError'
            })
        except Exception as e:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Connection test error: {str(e)}",
                'error': str(e)
            })

# ─────────────────────────────────────────────────────────────────────────
# Tally Synchronization — Purchase Return
# ─────────────────────────────────────────────────────────────────────────

def _get_purchase_return_tally_config():
    config, _ = PurchaseTallySyncConfig.objects.get_or_create(
        voucher_type='Purchase Return',
        defaults={
            'auto_push_on_save': False,
            'tally_url': 'http://localhost:9000',
        }
    )
    return config

def _push_purchase_return_to_tally(purchase_return, tally_url=None):
    from tally.utils.tally_purchaseReturn_xml import generate_purchase_return_xml
    from tally.tally_client import send_xml_to_tally

    if not tally_url:
        tally_url = _get_purchase_return_tally_config().tally_url or 'http://localhost:9000'

    purchase_return.sync_status = 'processing'
    purchase_return.save(update_fields=['sync_status'])

    try:
        xml_data = generate_purchase_return_xml(purchase_return)
    except Exception as e:
        err_msg = f"XML generation error: {str(e)}"
        purchase_return.sync_status = 'failed'
        purchase_return.is_synced = False
        purchase_return.save(update_fields=['sync_status', 'is_synced'])
        PurchaseReturnSyncLog.objects.create(
            purchase_return=purchase_return, error_message=err_msg, status='failed'
        )
        return {
            'success': False,
            'return_id': purchase_return.id,
            'return_no': purchase_return.return_no,
            'status': 'failed',
            'message': err_msg,
        }

    success, response_text, error_message = send_xml_to_tally(xml_data, tally_url)

    purchase_return.sync_status = 'synced' if success else 'failed'
    purchase_return.is_synced = success
    purchase_return.save(update_fields=['sync_status', 'is_synced'])

    PurchaseReturnSyncLog.objects.create(
        purchase_return=purchase_return,
        tally_response=response_text,
        error_message=None if success else error_message,
        status='success' if success else 'failed'
    )

    return {
        'success': success,
        'return_id': purchase_return.id,
        'return_no': purchase_return.return_no,
        'status': 'synced' if success else 'failed',
        'message': 'Purchase return successfully synced to Tally.' if success else error_message,
        'tally_response': response_text,
    }


class PurchaseReturnTallySyncConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = _get_purchase_return_tally_config()

        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        base_qs = PurchaseReturn.objects.all()
        if from_date:
            base_qs = base_qs.filter(entry_date__gte=from_date)
        if to_date:
            base_qs = base_qs.filter(entry_date__lte=to_date)

        total_returns = base_qs.count()
        synced_returns = base_qs.filter(is_synced=True).count()
        failed_returns = base_qs.filter(sync_status='failed').count()
        pending_returns = base_qs.filter(is_synced=False).exclude(sync_status='failed').count()
        unsynced_total = base_qs.filter(is_synced=False).count()

        return Response({
            'voucher_type': config.voucher_type,
            'auto_push_on_save': config.auto_push_on_save,
            'tally_url': config.tally_url,
            'last_sync_at': config.last_sync_at,
            'total_orders': total_returns,
            'synced_orders': synced_returns,
            'pending_orders': pending_returns,
            'failed_orders': failed_returns,
            'unsynced_total': unsynced_total,
        })

    def post(self, request):
        config = _get_purchase_return_tally_config()

        if 'auto_push_on_save' in request.data:
            val = request.data.get('auto_push_on_save')
            if isinstance(val, str):
                config.auto_push_on_save = val.lower() in ('true', '1', 'yes')
            else:
                config.auto_push_on_save = bool(val)

        if 'tally_url' in request.data and request.data['tally_url']:
            config.tally_url = str(request.data['tally_url']).strip()

        config.save()
        return self.get(request)


class PurchaseReturnTallySyncPushView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone as dj_timezone

        return_id = request.data.get('return_id')
        return_ids = request.data.get('return_ids')
        from_date = request.data.get('from_date')
        to_date = request.data.get('to_date')

        config = _get_purchase_return_tally_config()
        tally_url = config.tally_url or 'http://localhost:9000'

        if return_id:
            try:
                purchase_return = PurchaseReturn.objects.get(pk=return_id)
            except PurchaseReturn.DoesNotExist:
                return Response({'error': 'Purchase return not found.'}, status=status.HTTP_404_NOT_FOUND)
            res = _push_purchase_return_to_tally(purchase_return, tally_url=tally_url)
            return Response(res, status=status.HTTP_200_OK if res.get('success') else status.HTTP_400_BAD_REQUEST)

        if return_ids:
            returns = PurchaseReturn.objects.filter(id__in=return_ids)
        else:
            returns = PurchaseReturn.objects.filter(is_synced=False).order_by('created_at')
            if from_date:
                returns = returns.filter(entry_date__gte=from_date)
            if to_date:
                returns = returns.filter(entry_date__lte=to_date)

        ret_list = list(returns)
        results = []
        synced_count = 0
        failed_count = 0
        for ret in ret_list:
            res = _push_purchase_return_to_tally(ret, tally_url=tally_url)
            results.append(res)
            if res.get('success'):
                synced_count += 1
            else:
                failed_count += 1

        config.last_sync_at = dj_timezone.now()
        config.save(update_fields=['last_sync_at'])

        return Response({
            'total': len(ret_list),
            'synced_count': synced_count,
            'failed_count': failed_count,
            'results': results,
        }, status=status.HTTP_200_OK)


class PurchaseReturnTallySyncReturnsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status', 'all').lower()
        search_query = request.query_params.get('search', '').strip()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        qs = PurchaseReturn.objects.select_related('supplier_ledger').prefetch_related('sync_logs').order_by('-created_at')
        
        if not (request.user.is_authenticated and request.user.is_superuser):
            if request.user.is_authenticated:
                qs = qs.filter(created_by=request.user)
            else:
                qs = qs.none()


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
                django_models.Q(return_no__icontains=search_query) |
                django_models.Q(supplier_ledger__name__icontains=search_query)
            )

        data = []
        for ret in qs[:150]:
            all_logs = list(ret.sync_logs.order_by('-attempted_at')[:6])
            last_log = all_logs[0] if all_logs else None
            sync_history = [
                {
                    'id': l.id,
                    'attempted_at': l.attempted_at,
                    'status': l.status,
                    'error_message': l.error_message,
                    'tally_response': l.tally_response,
                }
                for l in all_logs
            ]
            data.append({
                'id': ret.id,
                'return_no': ret.return_no,
                'entry_date': ret.entry_date,
                'supplier_name': ret.supplier_ledger.name if ret.supplier_ledger else 'N/A',
                'total_amount': str(ret.total_amount),
                'sync_status': ret.sync_status,
                'is_synced': ret.is_synced,
                'last_attempted_at': last_log.attempted_at if last_log else None,
                'last_error': last_log.error_message if last_log else None,
                'last_response': last_log.tally_response if last_log else None,
                'sync_history': sync_history,
                'created_at': ret.created_at,
            })

        return Response(data, status=status.HTTP_200_OK)


class PurchaseReturnTallyTestConnectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import socket
        from urllib.parse import urlparse
        import requests

        tally_url = request.data.get('tally_url') or _get_purchase_return_tally_config().tally_url or 'http://localhost:9000'

        parsed = urlparse(tally_url)
        host = parsed.hostname or '127.0.0.1'
        port = parsed.port or 9000
        connect_host = '127.0.0.1' if host in ('localhost', '127.0.0.1') else host

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.5)
        try:
            s.connect((connect_host, port))
            s.close()
        except Exception:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Could not reach Tally on {host}:{port}. Please ensure Tally is open and port {port} is enabled in F12 / Advanced Configuration.",
                'error': 'ConnectionRefused'
            })

        test_xml = (
            "<ENVELOPE>"
            "<HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>"
            "<BODY><EXPORTDATA><REQUESTDESC>"
            "<REPORTNAME>List of Companies</REPORTNAME>"
            "<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>"
            "</REQUESTDESC></EXPORTDATA></BODY>"
            "</ENVELOPE>"
        )
        request_url = tally_url.replace('localhost', '127.0.0.1')
        try:
            response = requests.post(
                request_url,
                data=test_xml.encode('utf-8'),
                headers={'Content-Type': 'text/xml'},
                timeout=4
            )
            if response.status_code == 200:
                return Response({
                    'connected': True,
                    'is_idle': False,
                    'message': f"Connected successfully to Tally at {tally_url}!",
                    'status_code': response.status_code
                })
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Tally responded with HTTP status {response.status_code}.",
                'status_code': response.status_code
            })
        except (requests.exceptions.Timeout, requests.exceptions.ReadTimeout):
            return Response({
                'connected': True,
                'is_idle': True,
                'message': (
                    f"Tally server is running on port {port}, but is waiting on a screen or no company is opened. "
                    "Please open your company in Tally (so the Gateway of Tally is visible) and close any prompt."
                )
            })
        except requests.exceptions.ConnectionError:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Could not connect to Tally server at {tally_url}.",
                'error': 'ConnectionError'
            })
        except Exception as e:
            return Response({
                'connected': False,
                'is_idle': False,
                'message': f"Connection test error: {str(e)}",
                'error': str(e)
            })