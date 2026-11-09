import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

with open('project_app/urls.py', 'r') as f:
    content = f.read()

if 'marketing_visit_report' not in content:
    content = content.replace("from .views import (", "from .views import (\n    marketing_visit_report,")
    content = content.replace("urlpatterns = [", "urlpatterns = [\n    path('api/project/marketing/visit_report/', marketing_visit_report, name='marketing_visit_report'),")
    with open('project_app/urls.py', 'w') as f:
        f.write(content)

with open('project_app/views.py', 'r') as f:
    content = f.read()

if 'def marketing_visit_report' not in content:
    view_code = """
from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import datetime
from .models import MarketingWishlist, MarketingShopVisit

@api_view(['GET'])
def marketing_visit_report(request):
    # Retrieve all wishlists
    wishlists = MarketingWishlist.objects.select_related('stock_item', 'customer_ledger').all().order_by('-created_at')
    
    # Filter by date if provided
    filter_date = request.GET.get('date')
    if filter_date:
        try:
            wishlists = wishlists.filter(created_at__date=filter_date)
        except:
            pass

    # Build the report data
    report_data = []
    
    for w in wishlists:
        phone = w.new_customer_phone if w.is_new_customer else (w.customer_ledger.mobile_number if w.customer_ledger and hasattr(w.customer_ledger, 'mobile_number') else getattr(w.customer_ledger, 'phone', ''))
        
        # Find matching visit
        visit = MarketingShopVisit.objects.filter(
            mobile_number=phone,
            visit_date=w.created_at.date()
        ).first()

        row = {
            'visited_date': w.created_at.date().strftime('%Y-%m-%d'),
            'shop_name': visit.shop_name if visit else (w.new_customer_name if w.is_new_customer else (w.customer_ledger.ledger_name if w.customer_ledger else 'N/A')),
            'shop_type': visit.shop_type if visit else 'N/A',
            'gst_number': visit.gst_number if visit else 'N/A',
            'address': visit.address if visit else 'N/A',
            'city': visit.city if visit else 'N/A',
            'state': visit.state if visit else 'N/A',
            'mobile_number': phone,
            'stock_item_id': w.stock_item.stock_item_code if w.stock_item and hasattr(w.stock_item, 'stock_item_code') else (w.stock_item.id if w.stock_item else 'N/A'),
            'stock_item_name': w.stock_item.stock_name if w.stock_item else 'N/A',
            'quantity': w.quantity,
            'negotiated_price': str(w.negotiated_price) if w.negotiated_price else 'N/A',
            'original_price': str(w.stock_item.selling_price) if w.stock_item and hasattr(w.stock_item, 'selling_price') else 'N/A'
        }
        report_data.append(row)

    return Response(report_data)
"""
    with open('project_app/views.py', 'a') as f:
        f.write(view_code)

print("Done backend.")
