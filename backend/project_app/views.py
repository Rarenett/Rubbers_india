from django.shortcuts import render

# Create your views here.


from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from .models import MarketingLead, MarketingAttendance, MarketingTravel, MarketingShopVisit, MarketingShopPhoto, MarketingWishlist
# pyrefly: ignore [missing-import]
from .serializers import MarketingLeadSerializer, MarketingAttendanceSerializer, MarketingTravelSerializer, MarketingShopVisitSerializer, MarketingShopPhotoSerializer, MarketingWishlistSerializer
from rarenett_app.models import Employee

class MarketingLeadViewSet(viewsets.ModelViewSet):
    queryset = MarketingLead.objects.all()
    serializer_class = MarketingLeadSerializer

    def perform_create(self, serializer):
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            employee = Employee.objects.first()
        serializer.save(employee=employee)

    @action(detail=False, methods=['get'])
    def next_id(self, request):
        last_lead = MarketingLead.objects.order_by('id').last()
        next_id_num = last_lead.id + 1 if last_lead else 1
        return Response({'next_id': f"LD-{next_id_num:04d}"})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = MarketingLead.objects.count()
        active = MarketingLead.objects.filter(status='Active').count()
        escalated = MarketingLead.objects.filter(status='Escalated to Company').count()
        return Response({'total': total, 'active': active, 'escalated': escalated})

class MarketingAttendanceViewSet(viewsets.ModelViewSet):
    queryset = MarketingAttendance.objects.all()
    serializer_class = MarketingAttendanceSerializer

    def create(self, request, *args, **kwargs):
        from rarenett_app.models import Employee
        from django.utils import timezone
        import json
        import math

        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        from django.db import transaction

        # Handle face verification input
        live_descriptor_str = request.data.get('face_descriptor')
        if not live_descriptor_str:
            return Response({"error": "Face verification failed. No face data provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Location check
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if not lat or not lng:
            return Response({"error": "Location access is required to mark attendance."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Lock the employee record during creation to prevent race conditions from concurrent duplicate requests
            locked_employee = Employee.objects.select_for_update().filter(id=employee.id).first()
            if not locked_employee:
                return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)

            # Prevent starting a new session if an active session is already ongoing
            if MarketingAttendance.objects.filter(employee=locked_employee, attendance_date=today, sign_out_time__isnull=True).exists():
                return Response({"error": "You already have an active session. Please sign out before signing in again."}, status=status.HTTP_400_BAD_REQUEST)

            # Determine session type: FIRST_SIGN_IN if no previous session today, else RE_ENTRY
            has_earlier_session = MarketingAttendance.objects.filter(employee=locked_employee, attendance_date=today).exists()
            session_type = 'RE_ENTRY' if has_earlier_session else 'FIRST_SIGN_IN'

            # Handle face verification
            face_profile = getattr(locked_employee, 'face_profile', None)
            if not face_profile or not face_profile.face_descriptor:
                return Response({"error": "Employee face data not enrolled. Please contact administrator."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                live_descriptor = json.loads(live_descriptor_str)
                enrolled_descriptor = face_profile.face_descriptor
                if isinstance(enrolled_descriptor, str):
                    enrolled_descriptor = json.loads(enrolled_descriptor)

                if len(live_descriptor) != len(enrolled_descriptor):
                    return Response({"error": "Invalid face descriptor format."}, status=status.HTTP_400_BAD_REQUEST)

                # Euclidean distance
                distance = math.sqrt(sum((a - b) ** 2 for a, b in zip(live_descriptor, enrolled_descriptor)))
                threshold = 0.55  # face-api.js recommended threshold

                if distance > threshold:
                    return Response({"error": "Employee could not be verified. Please try again or contact the administrator."}, status=status.HTTP_400_BAD_REQUEST)

            except Exception as e:
                return Response({"error": f"Error verifying face: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

            # Remove face_descriptor from request data as it's not a model field for attendance
            data_copy = request.data.copy()
            if 'face_descriptor' in data_copy:
                del data_copy['face_descriptor']

            serializer = self.get_serializer(data=data_copy)
            serializer.is_valid(raise_exception=True)
            serializer.save(
                employee=locked_employee,
                face_verification_status='VERIFIED',
                face_match_score=distance,
                status='ACTIVE',
                session_type=session_type,
                attendance_date=today,
                attendance_time=timezone.now().time()
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def sync_offline(self, request):
        from rarenett_app.models import Employee
        from django.utils import timezone
        
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)

        offline_id = request.data.get('offlineAttendanceId')
        attendance_date = request.data.get('attendanceDate')
        attendance_time = request.data.get('attendanceTime')
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        location_accuracy = request.data.get('locationAccuracy')

        if not offline_id:
            return Response({"error": "offlineAttendanceId is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency check
        if MarketingAttendance.objects.filter(offline_attendance_id=offline_id).exists():
            return Response({"message": "Already synchronized."}, status=status.HTTP_200_OK)
            
        # Conflict check for session on same date to prevent duplicates
        if MarketingAttendance.objects.filter(employee=employee, attendance_date=attendance_date).exists():
            return Response({"message": "An attendance session for this date already exists. Ignored offline record."}, status=status.HTTP_200_OK)

        session_type = 'FIRST_SIGN_IN'

        data_copy = request.data.copy()
        serializer = self.get_serializer(data=data_copy)
        if serializer.is_valid():
            attendance = serializer.save(
                employee=employee,
                attendance_date=attendance_date,
                attendance_time=attendance_time,
                latitude=lat,
                longitude=lng,
                location_accuracy=location_accuracy,
                face_verification_status='OFFLINE_VERIFIED',
                status='ACTIVE',
                session_type=session_type,
                offline_attendance_id=offline_id
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def check_enrollment(self, request):
        from rarenett_app.models import Employee
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            face_profile = employee.face_profile
            is_enrolled = bool(face_profile.face_descriptor)
        except Exception:
            is_enrolled = False
        return Response({"is_enrolled": is_enrolled})

    @action(detail=False, methods=['get'])
    def current_status(self, request):
        from rarenett_app.models import Employee
        from django.utils import timezone
        
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)
            
        today = timezone.now().date()
        active_session = MarketingAttendance.objects.filter(employee=employee, attendance_date=today, sign_out_time__isnull=True).first()
        
        if active_session:
            return Response({
                "status": "ACTIVE",
                "session_id": active_session.id,
                "session_type": active_session.session_type,
                "sign_in_time": active_session.attendance_time.strftime('%I:%M %p') if active_session.attendance_time else None
            })
            
        # Check if they have completed sessions today
        last_session = MarketingAttendance.objects.filter(employee=employee, attendance_date=today, sign_out_time__isnull=False).order_by('-sign_out_time').first()
        if last_session:
            return Response({
                "status": "SIGNED_OUT",
                "last_sign_out": last_session.sign_out_time.strftime('%I:%M %p') if last_session.sign_out_time else None
            })
            
        return Response({
            "status": "NO_SESSION_TODAY"
        })

    @action(detail=False, methods=['post'])
    def sign_out(self, request):
        from rarenett_app.models import Employee
        from django.utils import timezone
        
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)
            
        today = timezone.now().date()
        active_session = MarketingAttendance.objects.filter(employee=employee, attendance_date=today, sign_out_time__isnull=True).first()
        
        if not active_session:
            return Response({"error": "You do not have an active session to sign out of."}, status=status.HTTP_400_BAD_REQUEST)
            
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        
        active_session.status = 'COMPLETED'
        active_session.sign_out_time = timezone.now().time()
        if lat and lng:
            active_session.sign_out_latitude = lat
            active_session.sign_out_longitude = lng
        
        active_session.save()
        
        return Response({
            "status": "COMPLETED",
            "message": "Signed out successfully.",
            "sign_out_time": active_session.sign_out_time.strftime('%I:%M %p')
        })

    @action(detail=False, methods=['get'])
    def daily_report(self, request):
        from rarenett_app.models import Employee
        from django.utils.dateparse import parse_date
        from django.utils import timezone
        
        date_str = request.query_params.get('date')
        report_date = None
        if date_str:
            report_date = parse_date(date_str)
            if report_date and report_date > timezone.now().date():
                return Response([])
        elif date_str is None:
            # If date param is completely omitted, default to today
            report_date = timezone.now().date()
        # If date_str == '', report_date remains None (fetch all history)
            
        from django.db.models import Q
        
        user = request.user
        
        # All employees (including admins) ONLY see their own individual attendance reports in this module
        employees = Employee.objects.filter(user=user).select_related('user')
        
        if report_date:
            attendances = MarketingAttendance.objects.filter(attendance_date=report_date)
        else:
            attendances = MarketingAttendance.objects.all()
        
        report_data = []
        for emp in employees:
            emp_name = f"{emp.user.first_name} {emp.user.last_name}".strip() if hasattr(emp, 'user') and emp.user else "Unknown"
            
            emp_attendances = [att for att in attendances if att.employee_id == emp.id]
            
            if emp_attendances:
                # Show each individual check-in / check-out session record
                emp_attendances.sort(key=lambda x: (str(x.attendance_date), str(x.attendance_time or '')), reverse=True)
                for att in emp_attendances:
                    # Status display
                    if att.sign_out_time:
                        record_status = 'Completed'
                    else:
                        record_status = 'Active (Working)'
                        
                    report_data.append({
                        'employee_id': emp.id,
                        'employee_name': emp_name or (emp.user.username if hasattr(emp, 'user') and emp.user else ""),
                        'attendance_date': att.attendance_date.strftime('%Y-%m-%d') if att.attendance_date else '-',
                        'attendance_time': att.attendance_time.strftime('%I:%M %p') if att.attendance_time else '-',
                        'sign_out_time': att.sign_out_time.strftime('%I:%M %p') if att.sign_out_time else '-',
                        'session_type': 'First Sign In' if att.session_type == 'FIRST_SIGN_IN' else 'Re-Entry',
                        'status': record_status,
                        'selfie_image': request.build_absolute_uri(att.selfie_image.url) if att.selfie_image else None
                    })
            else:
                # Only show 'Absent' if a specific date was queried
                if report_date:
                    report_data.append({
                        'employee_id': emp.id,
                        'employee_name': emp_name or (emp.user.username if hasattr(emp, 'user') and emp.user else ""),
                        'attendance_date': report_date.strftime('%Y-%m-%d'),
                        'attendance_time': '-',
                        'sign_out_time': '-',
                        'session_type': '-',
                        'status': 'Absent',
                        'selfie_image': None
                    })
        
        # Sort newest date and time first, then by name
        report_data.sort(key=lambda x: (x['attendance_date'], x['attendance_time'], x['employee_name']), reverse=True)
        return Response(report_data)

    @action(detail=False, methods=['post'])
    def enroll_face(self, request):
        try:
            from rarenett_app.models import Employee
            # pyrefly: ignore [missing-import]
            from .models import EmployeeFaceProfile
            
            employee = Employee.objects.filter(user=request.user).first()
            if not employee:
                return Response({"error": "Employee not found."}, status=status.HTTP_400_BAD_REQUEST)

            face_descriptor_str = request.data.get('face_descriptor')
            enrolled_image = request.data.get('enrolled_image')

            if not face_descriptor_str:
                return Response({"error": "No face data provided."}, status=status.HTTP_400_BAD_REQUEST)

            face_profile, created = EmployeeFaceProfile.objects.get_or_create(
                employee=employee,
                defaults={'face_descriptor': face_descriptor_str}
            )
            
            face_profile.face_descriptor = face_descriptor_str
            if enrolled_image:
                face_profile.enrolled_image = enrolled_image
            
            face_profile.save()

            return Response({"message": "Face data enrolled successfully."}, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            error_msg = f"Error: {str(e)} - {traceback.format_exc()}"
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)



class MarketingTravelViewSet(viewsets.ModelViewSet):
    queryset = MarketingTravel.objects.all()
    serializer_class = MarketingTravelSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        date = self.request.query_params.get('date')
        employee_id = self.request.query_params.get('employee_id')
        if date:
            queryset = queryset.filter(date=date)
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        else:
            employee = Employee.objects.filter(user=self.request.user).first()
            if employee:
                queryset = queryset.filter(employee=employee)
        return queryset

    def perform_create(self, serializer):
        # pyrefly: ignore [missing-import]
        from .models import MarketingTravelPhoto
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            employee = Employee.objects.first()
        travel = serializer.save(employee=employee)
        photos = self.request.FILES.getlist('odometer_photos')
        for photo in photos:
            MarketingTravelPhoto.objects.create(travel=travel, photo=photo)

    def perform_update(self, serializer):
        # pyrefly: ignore [missing-import]
        from .models import MarketingTravelPhoto
        travel = serializer.save()
        photos = self.request.FILES.getlist('odometer_photos')
        for photo in photos:
            MarketingTravelPhoto.objects.create(travel=travel, photo=photo)

class MarketingShopVisitViewSet(viewsets.ModelViewSet):
    queryset = MarketingShopVisit.objects.all()
    serializer_class = MarketingShopVisitSerializer

    def perform_create(self, serializer):
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            employee = Employee.objects.first()
        serializer.save(employee=employee)

class MarketingShopPhotoViewSet(viewsets.ModelViewSet):
    queryset = MarketingShopPhoto.objects.all()
    serializer_class = MarketingShopPhotoSerializer

class MarketingWishlistViewSet(viewsets.ModelViewSet):
    queryset = MarketingWishlist.objects.all()
    serializer_class = MarketingWishlistSerializer

    @action(detail=False, methods=['get'])
    
    @action(detail=False, methods=['get'])
    def approved_customers(self, request):
        approved_ledgers = MarketingWishlist.objects.filter(approval_status='Accepted', customer_ledger__isnull=False).values_list('customer_ledger_id', flat=True).distinct()
        return Response(list(approved_ledgers))

    def approved_prices(self, request):
        ledger_id = request.query_params.get('ledger_id')
        if not ledger_id:
            return Response([])
        approved_items = MarketingWishlist.objects.filter(customer_ledger_id=ledger_id, approval_status='Accepted')
        serializer = self.get_serializer(approved_items, many=True)
        return Response(serializer.data)



# pyrefly: ignore [missing-import]
from .models import MarketingOrder
# pyrefly: ignore [missing-import]
from .serializers import MarketingOrderSerializer
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

class MarketingOrderViewSet(viewsets.ModelViewSet):
    queryset = MarketingOrder.objects.all().order_by('-created_at')
    serializer_class = MarketingOrderSerializer
    permission_classes = [IsAuthenticated]


    @action(detail=False, methods=['get'], url_path='assigned-shops')
    def assigned_shops(self, request):
        from rarenett_app.models import Employee
        from area_app.models import SalesmanVisiting
        from .models import MarketingOrder
        from django.utils import timezone
        
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response({"error": "Employee profile not found."}, status=400)
            
        visit_date = request.query_params.get('date')
        if not visit_date:
            visit_date = timezone.now().date()
            
        visits = SalesmanVisiting.objects.filter(
            salesman_mapping__employee=employee,
            visiting_date=visit_date
        ).select_related('salesman_mapping__area', 'delivery_location')
        
        # Check orders created today by this employee
        orders = MarketingOrder.objects.filter(
            employee=employee,
            entry_date=visit_date
        )
        
        routes_dict = {}
        for visit in visits:
            route = visit.salesman_mapping.area
            route_id = route.id if route else None
            route_name = route.name if route else "Unassigned Route"
            
            if route_name not in routes_dict:
                routes_dict[route_name] = {
                    "route_id": route_id,
                    "route_name": route_name,
                    "shops": []
                }
                
            shop = visit.delivery_location
            
            has_order = False
            for o in orders:
                if str(o.delivery_location) == str(shop.id):
                    has_order = True
                    break
                    
            from logistics_app.models import RouteStopMaster
            search_name = shop.location_name.strip('\u200b').strip().lower() if shop and shop.location_name else ''
            route_stop_id = None
            if search_name:
                for rs in RouteStopMaster.objects.all():
                    if rs.stop_name and rs.stop_name.strip('\u200b').strip().lower() == search_name:
                        route_stop_id = rs.id
                        break

            routes_dict[route_name]["shops"].append({
                "assignment_id": visit.id,
                "shop_id": shop.id,
                "route_stop_id": route_stop_id,
                "shop_name": shop.location_name,
                "visit_status": visit.status,
                "order_status": "Order Created" if has_order else "Pending" 
            })
            
        return Response({
            "employee_id": employee.employee_id if hasattr(employee, 'employee_id') else employee.id,
            "employee_name": employee.user.get_full_name() or employee.user.username,
            "date": str(visit_date),
            "routes": list(routes_dict.values())
        })
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
            'stock_item_id': w.stock_item.item_code if w.stock_item and hasattr(w.stock_item, 'item_code') and w.stock_item.item_code else (w.stock_item.id if w.stock_item else 'N/A'),
            'stock_item_name': getattr(w.stock_item, 'name', getattr(w.stock_item, 'stock_name', 'N/A')) if w.stock_item else 'N/A',
            'quantity': w.quantity,
            'negotiated_price': str(w.negotiated_price) if w.negotiated_price else 'N/A',
            'original_price': str(getattr(w.stock_item, 'selling_price', getattr(w.stock_item, 'opening_rate', 'N/A'))) if w.stock_item else 'N/A'
        }
        report_data.append(row)

    return Response(report_data)


@api_view(['GET'])
def marketing_followup_report(request):
    from crm.views import CrmLeadFollowUpViewSet
    viewset = CrmLeadFollowUpViewSet()
    viewset.request = request
    viewset.format_kwarg = None
    return viewset.report(request)


@api_view(['GET'])
def marketing_executive_visit_report(request):
    """
    Executive Visit Report API:
    Retrieves complete visit history for a selected customer, including visits made by
    different executives/employees, arranged in descending order of visit date and time.
    """
    from django.db.models import Q
    from rarenett_app.models import Employee
    from .models import MarketingShopVisit, MarketingLead, MarketingAttendance
    from crm.models import CrmLeadFollowUp
    import datetime

    # 1. Available Visited Shops / Leads List: ONLY from follow-up lead visits
    shops = set()
    for s in CrmLeadFollowUp.objects.exclude(lead__shop_name__isnull=True).exclude(lead__shop_name='').values_list('lead__shop_name', flat=True):
        if s and s.strip():
            shops.add(s.strip())
    shops_list = sorted(list(shops), key=lambda x: x.lower())

    shop_param = request.GET.get('shop', '').strip() or request.GET.get('customer', '').strip()
    date_param = request.GET.get('date', '').strip()
    from_date = request.GET.get('from_date', '').strip() or date_param
    to_date = request.GET.get('to_date', '').strip() or date_param
    search = request.GET.get('search', '').strip()

    visits = []

    # Follow-Up Lead Visits (CrmLeadFollowUp)
    f_qs = CrmLeadFollowUp.objects.all().select_related(
        'lead', 'lead__employee', 'lead__employee__user', 'lead__employee__dept_designation__designation',
        'executive', 'executive__user', 'executive__dept_designation__designation',
        'telecaller', 'category'
    )

    if shop_param:
        f_qs = f_qs.filter(lead__shop_name__iexact=shop_param)

    if from_date:
        f_qs = f_qs.filter(Q(visit_date__gte=from_date) | Q(created_at__date__gte=from_date))
    if to_date:
        f_qs = f_qs.filter(Q(visit_date__lte=to_date) | Q(created_at__date__lte=to_date))

    for f in f_qs:
        emp = f.executive or (f.lead.employee if f.lead else None)
        if not emp and f.telecaller:
            emp = Employee.objects.filter(user=f.telecaller).first()

        emp_code = f"EMP-{emp.id:04d}" if emp else ('TEL-' + str(f.telecaller.id) if f.telecaller else '-')
        emp_name = '-'
        if emp and emp.user:
            emp_name = emp.user.get_full_name() or emp.user.username
        elif emp:
            emp_name = str(emp)
        elif f.telecaller:
            emp_name = f.telecaller.get_full_name() or f.telecaller.username

        emp_desig = emp.dept_designation.designation.name if (emp and emp.dept_designation and hasattr(emp.dept_designation, 'designation') and emp.dept_designation.designation) else 'Executive'

        v_date = f.visit_date or (f.created_at.date() if f.created_at else None)
        v_date_str = v_date.strftime('%Y-%m-%d') if v_date else '-'
        v_date_fmt = v_date.strftime('%d/%m/%Y') if v_date else '-'

        check_in_time = f.created_at.strftime('%I:%M %p') if f.created_at else '-'
        check_out_time = '-'
        duration = '-'

        if emp and v_date:
            att = MarketingAttendance.objects.filter(employee=emp, attendance_date=v_date).first()
            if att and att.sign_out_time:
                check_out_time = att.sign_out_time.strftime('%I:%M %p')
                if att.attendance_time:
                    try:
                        tdelta = datetime.datetime.combine(v_date, att.sign_out_time) - datetime.datetime.combine(v_date, att.attendance_time)
                        total_secs = int(tdelta.total_seconds())
                        if total_secs > 0:
                            h = total_secs // 3600
                            m = (total_secs % 3600) // 60
                            duration = f"{h}h {m}m" if h else f"{m}m"
                    except:
                        pass

        lead = f.lead
        lead_id = lead.lead_id if (lead and hasattr(lead, 'lead_id') and lead.lead_id) else (f"LD-{lead.id:04d}" if lead else '-')
        shop_name = lead.shop_name if lead else (shop_param or '-')
        shop_type = lead.shop_type if (lead and hasattr(lead, 'shop_type') and lead.shop_type) else '-'
        contact_number = lead.mobile_number if (lead and hasattr(lead, 'mobile_number') and lead.mobile_number) else '-'

        gps_text = f"{lead.latitude}, {lead.longitude}" if (lead and lead.latitude and lead.longitude) else '-'
        loc_parts = [p for p in [lead.address if lead else None, lead.city if lead else None, lead.state if lead else None] if p]
        location_text = ', '.join(loc_parts) if loc_parts else (lead.location if (lead and hasattr(lead, 'location') and lead.location) else '-')

        person_met = '-'
        if lead:
            pm = []
            if getattr(lead, 'first_name', None): pm.append(lead.first_name)
            if getattr(lead, 'last_name', None): pm.append(lead.last_name)
            if pm:
                person_met = ' '.join(pm).strip()
            elif getattr(lead, 'contact_person', None):
                person_met = lead.contact_person
            elif getattr(lead, 'mobile_number', None):
                person_met = f"Contact: {lead.mobile_number}"

        photo_urls = []
        if f.shop_photo:
            try:
                photo_urls.append(request.build_absolute_uri(f.shop_photo.url))
            except Exception:
                photo_urls.append(f.shop_photo.url)

        visits.append({
            'id': f"followup_{f.id}",
            'lead_id': lead_id,
            'shop_name': shop_name,
            'customer_name': shop_name,
            'shop_type': shop_type,
            'contact_number': contact_number,
            'employee_name': emp_name,
            'employee_id': emp_code,
            'employee_designation': emp_desig,
            'visit_date': v_date_str,
            'visit_date_formatted': v_date_fmt,
            'check_in_time': check_in_time,
            'check_out_time': check_out_time,
            'duration': duration,
            'purpose': f.purpose or 'Follow-up Lead Visit',
            'person_met': person_met,
            'remarks': f.remarks or (f.narration or '-'),
            'status': f.status or 'Active',
            'next_followup_date': f.next_visit_date.strftime('%Y-%m-%d') if f.next_visit_date else '-',
            'location': location_text,
            'gps_info': gps_text,
            'photos': photo_urls,
            'created_at': f.created_at.strftime('%Y-%m-%d %H:%M') if f.created_at else '-'
        })

    # Search filter
    if search:
        s_lower = search.lower()
        visits = [
            v for v in visits if (
                s_lower in (v['lead_id'] or '').lower() or
                s_lower in (v['shop_name'] or '').lower() or
                s_lower in (v['contact_number'] or '').lower() or
                s_lower in (v['employee_name'] or '').lower() or
                s_lower in (v['purpose'] or '').lower() or
                s_lower in (v['status'] or '').lower() or
                s_lower in (v['remarks'] or '').lower() or
                s_lower in (v['person_met'] or '').lower() or
                s_lower in (v['location'] or '').lower() or
                s_lower in (v['employee_id'] or '').lower()
            )
        ]

    # Sort vertically by visit date and time in DESCENDING order (latest first)
    visits.sort(key=lambda x: (x['visit_date'], x['created_at']), reverse=True)

    return Response({
        'shop': shop_param,
        'customer': shop_param,
        'shops': shops_list,
        'customers': shops_list,
        'total_visits': len(visits),
        'visits': visits
    })




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


@api_view(['GET'])
def delivery_location_customers(request):
    dl_id = request.GET.get('delivery_location_id')
    if not dl_id: return Response([])
    
    from area_app.models import DeliveryLocation as AreaDL
    from logistics_app.models import RouteStopMaster
    from sales_app.models import DeliveryLocation as SalesDL
    
    area_dl = AreaDL.objects.filter(id=dl_id).first()
    if not area_dl: return Response([])
    
    search_name = area_dl.location_name.strip('\u200b').strip()
    route_stop = None
    for rs in RouteStopMaster.objects.all():
        if rs.stop_name and rs.stop_name.strip('\u200b').strip().lower() == search_name.lower():
            route_stop = rs
            break
            
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


@api_view(['GET'])
def area_location_customers(request):
    area_id = request.GET.get('area_id')
    if not area_id: return Response([])
    
    from area_app.models import AreaLocationMapping
    from logistics_app.models import RouteStopMaster
    from sales_app.models import DeliveryLocation as SalesDL
    
    mappings = AreaLocationMapping.objects.filter(area_id=area_id).select_related('delivery_location')
    
    loc_names = []
    for m in mappings:
        if m.delivery_location and m.delivery_location.location_name:
            loc_names.append(m.delivery_location.location_name)
            
    if not loc_names: return Response([])
    
    route_stops = RouteStopMaster.objects.filter(stop_name__in=loc_names)
    sales_dls = SalesDL.objects.filter(delivery_location__in=route_stops).select_related('customer')
    
    customers = []
    seen = set()
    for sdl in sales_dls:
        if sdl.customer and sdl.customer.id not in seen:
            customers.append({'id': sdl.customer.id, 'name': sdl.customer.name})
            seen.add(sdl.customer.id)
            
    customers.sort(key=lambda x: x['name'].lower() if x['name'] else '')
    return Response(customers)
