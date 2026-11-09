import sys
filepath = r"c:\Paul@Rarenett\glenda_vite\backend\project_app\views.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

new_api = """
@api_view(['GET'])
def delivery_location_customers(request):
    dl_id = request.GET.get('delivery_location_id')
    if not dl_id: return Response([])
    
    from area_app.models import DeliveryLocation as AreaDL
    from logistics_app.models import RouteStopMaster
    from sales_app.models import DeliveryLocation as SalesDL
    
    area_dl = AreaDL.objects.filter(id=dl_id).first()
    if not area_dl: return Response([])
    
    route_stop = RouteStopMaster.objects.filter(stop_name__iexact=area_dl.location_name).first()
    if not route_stop: return Response([])
    
    sales_dls = SalesDL.objects.filter(delivery_location=route_stop).select_related('customer')
    customers = []
    seen = set()
    for sdl in sales_dls:
        if sdl.customer and sdl.customer.id not in seen:
            customers.append({'id': sdl.customer.id, 'name': sdl.customer.name})
            seen.add(sdl.customer.id)
            
    customers.sort(key=lambda x: x['name'].lower() if x['name'] else '')
    return Response(customers)
"""

if "def delivery_location_customers" not in content:
    content += "\n" + new_api
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added delivery_location_customers API")
else:
    print("API already exists")
