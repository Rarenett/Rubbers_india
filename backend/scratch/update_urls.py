import sys

filepath = r"c:\Paul@Rarenett\glenda_vite\backend\project_app\urls.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

if "area_customers" not in content:
    content = content.replace("from . import views", "from . import views\nfrom .views import area_customers")
    
    # Find the urlpatterns list and append
    insert_str = "    path('marketing/orders/area-customers/', views.area_customers, name='area_customers'),\n"
    
    # Let's just put it near assigned-shops
    if "assigned-shops/" in content:
        content = content.replace(
            "path('marketing/orders/assigned-shops/', views.assigned_shops, name='assigned_shops'),",
            "path('marketing/orders/assigned-shops/', views.assigned_shops, name='assigned_shops'),\n" + insert_str
        )
    else:
        # Fallback to end of file before ]
        content = content.replace("]\n", insert_str + "]\n")
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added to urls.py")
else:
    print("Already in urls.py")
