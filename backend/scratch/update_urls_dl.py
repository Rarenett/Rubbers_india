import sys

filepath = r"c:\Paul@Rarenett\glenda_vite\backend\project_app\urls.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

if "delivery_location_customers" not in content:
    content = content.replace("from . import views\nfrom .views import area_customers", "from . import views\nfrom .views import area_customers, delivery_location_customers")
    
    # In case area_customers wasn't exactly like that, just do a generic replace
    content = content.replace("from .views import area_customers", "from .views import area_customers, delivery_location_customers")
    if "from .views import area_customers, delivery_location_customers" not in content:
        content = content.replace("from . import views", "from . import views\nfrom .views import delivery_location_customers")
    
    # Find the urlpatterns list and append
    insert_str = "    path('marketing/orders/delivery-location-customers/', views.delivery_location_customers, name='delivery_location_customers'),\n"
    
    content = content.replace("]\n", insert_str + "]\n")
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added to urls.py")
else:
    print("Already in urls.py")
