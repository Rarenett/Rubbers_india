from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.conf import settings
from purchase_app.models import PurchaseReturn
from .sync_log import get_pending_ids, update_status
from .utils.tally_purchaseReturn_xml import generate_purchase_return_xml

class HasTallyAgentKey(permissions.BasePermission):
    """
    Allows access only to requests with the correct X-API-Key header.
    """
    def has_permission(self, request, view):
        agent_key = getattr(settings, 'TALLY_AGENT_API_KEY', '')
        if not agent_key:
            return False
        return request.headers.get('X-API-Key') == agent_key

class PendingPurchaseReturnsView(APIView):
    authentication_classes = []
    permission_classes = [HasTallyAgentKey]

    def get(self, request, *args, **kwargs):
        all_prs = PurchaseReturn.objects.all().values_list('id', flat=True)
        pending_ids = get_pending_ids(list(all_prs))
        
        pending_qs = PurchaseReturn.objects.filter(id__in=pending_ids)
        result = []
        
        for pr in pending_qs:
            try:
                xml_data = generate_purchase_return_xml(pr)
                result.append({
                    "id": pr.id,
                    "return_no": pr.return_no,
                    "xml": xml_data
                })
            except Exception as e:
                update_status(pr.id, status="failed", error_message=f"XML generation failed: {str(e)}")
                
        return Response(result)

class ReportSyncStatusView(APIView):
    authentication_classes = []
    permission_classes = [HasTallyAgentKey]

    def post(self, request, *args, **kwargs):
        pr_id = request.data.get('id')
        status = request.data.get('status')
        tally_response = request.data.get('tally_response')
        error_message = request.data.get('error_message')
        
        if not pr_id or not status:
            return Response({"error": "Missing id or status"}, status=400)
            
        update_status(
            purchase_return_id=pr_id,
            status=status,
            tally_response=tally_response,
            error_message=error_message
        )
        
        return Response({"success": True})
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
from purchase_app.models import PurchaseInvoice, PurchaseInvoiceSyncLog
from .xml_builder import generate_purchase_invoice_xml

logger = logging.getLogger('tally_sync')


def check_agent_token(request):
    """
    Validates agent token passed in request headers.
    Accepts header 'X-Tally-Token' or 'Authorization: Bearer <token>'.
    """
    configured_token = getattr(settings, 'TALLY_AGENT_API_TOKEN', '')
    if not configured_token:
        # If no token is configured on server, block unauthenticated access by default for safety
        logger.warning("TALLY_AGENT_API_TOKEN is empty in settings. Rejecting agent request.")
        return False

    auth_header = request.headers.get('Authorization', '')
    token_header = request.headers.get('X-Tally-Token', '')

    provided_token = ""
    if token_header:
        provided_token = token_header.strip()
    elif auth_header.startswith('Bearer '):
        provided_token = auth_header[7:].strip()
    elif auth_header:
        provided_token = auth_header.strip()

    return provided_token == configured_token


class PendingPurchaseInvoicesView(APIView):
    """
    Endpoint for Tally Agent to fetch pending Purchase Invoices in server mode.
    GET /api/tally/purchase-invoices/pending/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not check_agent_token(request):
            return Response(
                {"error": "Unauthorized. Invalid or missing Tally agent API token."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        pending_invoices = PurchaseInvoice.objects.filter(
            sync_status__in=['pending', 'failed'],
            is_synced=False
        )

        result = []
        for invoice in pending_invoices:
            try:
                # Flip status to processing FIRST to prevent duplicate processing
                invoice.sync_status = 'processing'
                invoice.save(update_fields=['sync_status'])

                xml_data = generate_purchase_invoice_xml(invoice)

                result.append({
                    "id": invoice.id,
                    "invoice_no": invoice.invoice_no,
                    "xml": xml_data,
                })
            except Exception as e:
                logger.error(f"Error generating XML for Invoice {invoice.invoice_no}: {e}")
                invoice.sync_status = 'failed'
                invoice.is_synced = False
                invoice.save(update_fields=['sync_status', 'is_synced'])

                PurchaseInvoiceSyncLog.objects.create(
                    invoice=invoice,
                    error_message=f"XML generation error: {str(e)}",
                    status='failed'
                )

        return Response(result, status=status.HTTP_200_OK)


class ReportPurchaseInvoiceSyncView(APIView):
    """
    Endpoint for Tally Agent to report sync results in server mode.
    POST /api/tally/purchase-invoices/report/
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not check_agent_token(request):
            return Response(
                {"error": "Unauthorized. Invalid or missing Tally agent API token."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        data = request.data
        invoice_id = data.get("invoice_id")
        success = data.get("success", False)
        response_text = data.get("response_text", "")
        error_message = data.get("error_message", None)

        if not invoice_id:
            return Response(
                {"error": "invoice_id is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            invoice = PurchaseInvoice.objects.get(id=invoice_id)
        except PurchaseInvoice.DoesNotExist:
            return Response(
                {"error": f"PurchaseInvoice with id {invoice_id} not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if success:
            invoice.sync_status = 'synced'
            invoice.is_synced = True
            log_status = 'success'
        else:
            invoice.sync_status = 'failed'
            invoice.is_synced = False
            log_status = 'failed'

        invoice.save(update_fields=['sync_status', 'is_synced'])

        PurchaseInvoiceSyncLog.objects.create(
            invoice=invoice,
            tally_response=response_text,
            error_message=error_message,
            status=log_status
        )

        return Response({
            "status": "ok",
            "invoice_id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "sync_status": invoice.sync_status
        }, status=status.HTTP_200_OK)