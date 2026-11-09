import re

views_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/views.py'
with open(views_path, 'r', encoding='utf-8') as f:
    content = f.read()

action_code = """
    @action(detail=False, methods=['get'])
    def approved_prices(self, request):
        ledger_id = request.query_params.get('ledger_id')
        if not ledger_id:
            return Response([])
        approved_items = MarketingWishlist.objects.filter(customer_ledger_id=ledger_id, approval_status='Accepted')
        serializer = self.get_serializer(approved_items, many=True)
        return Response(serializer.data)
"""

if "def approved_prices" not in content:
    if "from rest_framework.decorators import action" not in content:
        content = "from rest_framework.decorators import action\nfrom rest_framework.response import Response\n" + content
    
    content = content.replace(
        "class MarketingWishlistViewSet(viewsets.ModelViewSet):\n    queryset = MarketingWishlist.objects.all()\n    serializer_class = MarketingWishlistSerializer",
        "class MarketingWishlistViewSet(viewsets.ModelViewSet):\n    queryset = MarketingWishlist.objects.all()\n    serializer_class = MarketingWishlistSerializer\n" + action_code
    )
    with open(views_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Action added")
else:
    print("Action already exists")
