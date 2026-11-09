import sys

filepath = r"c:\Paul@Rarenett\glenda_vite\backend\project_app\views.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

new_api = """
@api_view(['GET'])
def area_customers(request):
    route_name = request.GET.get('route_name')
    if not route_name:
        return Response([])

    from rarenett_app.models import Employee
    from area_app.models import SalesmanVisiting, AreaLocationMapping, Area
    from logistics_app.models import RouteStopMaster
    from sales_app.models import DeliveryLocation as SalesDL
    
    employee = Employee.objects.filter(user=request.user).first()
    
    loc_names = set()
    
    # Check SalesmanVisiting
    if employee:
        visits = SalesmanVisiting.objects.filter(
            salesman_mapping__employee=employee,
            salesman_mapping__area__name=route_name
        ).select_related('delivery_location')
        for v in visits:
            if v.delivery_location:
                loc_names.add(v.delivery_location.location_name)
    
    # Check AreaLocationMapping
    area = Area.objects.filter(name=route_name).first()
    if area:
        mappings = AreaLocationMapping.objects.filter(area=area).select_related('delivery_location')
        for m in mappings:
            if m.delivery_location:
                loc_names.add(m.delivery_location.location_name)
                
    if not loc_names:
        return Response([])
        
    route_stops = RouteStopMaster.objects.filter(stop_name__in=list(loc_names))
    sales_dls = SalesDL.objects.filter(delivery_location__in=route_stops).select_related('customer')
    
    customers = []
    seen = set()
    for sdl in sales_dls:
        if sdl.customer and sdl.customer.id not in seen:
            customers.append({
                'id': sdl.customer.id,
                'name': sdl.customer.name
            })
            seen.add(sdl.customer.id)
            
    # Sort alphabetically
    customers.sort(key=lambda x: x['name'].lower() if x['name'] else '')
    return Response(customers)
"""

if "def area_customers" not in content:
    content += "\n" + new_api
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added area_customers API")
else:
    print("API already exists")
