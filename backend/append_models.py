import os

models_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/models.py'
with open(models_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_models = """

class MarketingOrder(models.Model):
    order_no = models.CharField(max_length=50, unique=True, blank=True, null=True)
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_orders', null=True, blank=True)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, null=True, blank=True)
    new_customer_name = models.CharField(max_length=255, null=True, blank=True)
    entry_date = models.DateField(default=get_current_date)
    narration = models.TextField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Adding fields similar to SalesOrder
    delivery_location = models.CharField(max_length=255, null=True, blank=True)
    vehicle_type = models.CharField(max_length=100, null=True, blank=True)
    terms_of_delivery = models.CharField(max_length=255, null=True, blank=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.order_no:
            self.order_no = f"MKO-{self.id:04d}"
            MarketingOrder.objects.filter(id=self.id).update(order_no=self.order_no)

class MarketingOrderItem(models.Model):
    marketing_order = models.ForeignKey(MarketingOrder, on_delete=models.CASCADE, related_name='items')
    stock_item = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
"""
if "class MarketingOrder" not in content:
    with open(models_path, 'a', encoding='utf-8') as f:
        f.write(new_models)
    print("Added MarketingOrder models")
else:
    print("MarketingOrder already exists")
