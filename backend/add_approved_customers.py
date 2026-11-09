import re

file_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/views.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_action = """
    @action(detail=False, methods=['get'])
    def approved_customers(self, request):
        approved_ledgers = MarketingWishlist.objects.filter(approval_status='Accepted', customer_ledger__isnull=False).values_list('customer_ledger_id', flat=True).distinct()
        return Response(list(approved_ledgers))
"""

content = content.replace("def approved_prices(self, request):", new_action + "\n    def approved_prices(self, request):")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added approved_customers endpoint")
