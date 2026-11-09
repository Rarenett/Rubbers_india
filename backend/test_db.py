import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.utils import timezone
from sales_app.models import SalesInvoice, SalesOrder, SalesInvoiceItem
from purchase_app.models import PurchaseOrder
from finance_app.models import PaymentVoucherDetail

print("Total SalesInvoices:", SalesInvoice.objects.count())
print("Total SalesOrders:", SalesOrder.objects.count())
print("Total PaymentVoucherDetail:", PaymentVoucherDetail.objects.count())
