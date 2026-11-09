import os
import sys
import django
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from gate_app.models import VehicleType, Vehicle, VehicleEntry, Gate
from register_app.models import CustomUser

def seed_data():
    print("Seeding dummy data for Vehicle Management...")

    # Ensure we have a default user
    user = CustomUser.objects.first()
    if not user:
        print("No CustomUser found. Data will not have created_by.")
        
    # 1. Create Vehicle Types
    types_data = ["Employee Vehicle", "Vendor Transport", "Visitor Car", "VIP", "Delivery Truck"]
    types = []
    for t_name in types_data:
        v_type, created = VehicleType.objects.get_or_create(
            name=t_name,
            defaults={'created_by': user}
        )
        types.append(v_type)
        print(f"[{'Created' if created else 'Exists'}] Vehicle Type: {v_type.name}")

    # 2. Create Vehicles
    vehicles_data = [
        {"num": "MH-12-AB-1234", "type": types[0], "driver": "Rahul Sharma", "company": "Internal"},
        {"num": "MH-14-CD-5678", "type": types[2], "driver": "Sneha Gupta", "company": "TCS"},
        {"num": "MH-02-EF-9012", "type": types[1], "driver": "Ramesh Kumar", "company": "Delhivery"},
        {"num": "MH-09-GH-3456", "type": types[4], "driver": "Suresh Singh", "company": "BlueDart"},
        {"num": "MH-43-IJ-7890", "type": types[3], "driver": "Amit Patel", "company": "Reliance"},
    ]
    
    vehicles = []
    for v_data in vehicles_data:
        vehicle, created = Vehicle.objects.get_or_create(
            vehicle_number=v_data["num"],
            defaults={
                'vehicle_type': v_data["type"],
                'driver': v_data["driver"],
                'company': v_data["company"],
                'created_by': user
            }
        )
        vehicles.append(vehicle)
        print(f"[{'Created' if created else 'Exists'}] Vehicle: {vehicle.vehicle_number}")

    # Ensure we have at least one Gate
    gate = Gate.objects.first()
    if not gate:
        gate, _ = Gate.objects.get_or_create(name="Main Entrance", gate_no="G-01")

    # 3. Create Vehicle Entries (Some pending, some completed)
    entries_data = [
        # Pending inside
        {
            "vehicle": vehicles[0],
            "driver": vehicles[0].driver,
            "company": vehicles[0].company,
            "purpose": "Daily Commute",
            "status": "pending",
            "time_offset": -2 # 2 hours ago
        },
        {
            "vehicle": vehicles[2],
            "driver": vehicles[2].driver,
            "company": vehicles[2].company,
            "purpose": "Delivering IT Equipments",
            "material_details": "10 Laptops, 5 Monitors",
            "parking_location": "Bay 4",
            "status": "pending",
            "time_offset": -1
        },
        # Completed
        {
            "vehicle": vehicles[1],
            "driver": vehicles[1].driver,
            "company": vehicles[1].company,
            "purpose": "Meeting with HR",
            "status": "completed",
            "time_offset": -24, # 24 hours ago
            "duration": 2 # Stayed for 2 hours
        },
        {
            "vehicle": vehicles[3],
            "driver": vehicles[3].driver,
            "company": vehicles[3].company,
            "purpose": "Pickup of documents",
            "status": "completed",
            "time_offset": -5, 
            "duration": 0.5
        },
        {
            "vehicle": vehicles[4],
            "driver": vehicles[4].driver,
            "company": vehicles[4].company,
            "purpose": "Board Meeting",
            "status": "completed",
            "time_offset": -48,
            "duration": 5
        },
    ]

    for e_data in entries_data:
        entry_time = timezone.now() + timedelta(hours=e_data["time_offset"])
        
        entry = VehicleEntry.objects.create(
            vehicle=e_data["vehicle"],
            driver=e_data["driver"],
            company=e_data["company"],
            purpose=e_data.get("purpose", ""),
            material_details=e_data.get("material_details", ""),
            parking_location=e_data.get("parking_location", ""),
            entry_gate=gate,
            status=e_data["status"],
            created_by=user,
        )
        # Override entry_time which is auto_now_add
        VehicleEntry.objects.filter(id=entry.id).update(entry_time=entry_time)
        
        if e_data["status"] == "completed":
            exit_time = entry_time + timedelta(hours=e_data["duration"])
            VehicleEntry.objects.filter(id=entry.id).update(
                exit_time=exit_time,
                exit_gate=gate
            )
            print(f"[Created] Completed Entry for {entry.vehicle.vehicle_number}")
        else:
            print(f"[Created] Pending Entry for {entry.vehicle.vehicle_number}")
            
    print("Done seeding vehicle data!")

if __name__ == '__main__':
    seed_data()
