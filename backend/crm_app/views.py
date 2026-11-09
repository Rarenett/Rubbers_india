from rest_framework import views
from rest_framework import viewsets, filters, status
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from .models import DistributionZone, Lead, LeadCategory, TeleCallingProject, LeadAssignment, LeadInteractionLog, CallSession
from .serializers import (
    DistributionZoneSerializer,
    LeadSerializer, LeadCategorySerializer,
    TeleCallingProjectSerializer, LeadAssignmentSerializer,
    LeadInteractionLogSerializer, CallSessionSerializer
)

User = get_user_model()

class LeadCategoryViewSet(viewsets.ModelViewSet):
    queryset = LeadCategory.objects.all()
    serializer_class = LeadCategorySerializer
    permission_classes = [IsAuthenticated]

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    
    filterset_fields = ['lead_status', 'lead_source', 'industry', 'rating', 'email_opt_out', 'category']
    search_fields = ['first_name', 'last_name', 'company', 'email', 'phone', 'mobile']
    ordering_fields = ['created_at', 'updated_at', 'company', 'first_name', 'last_name', 'annual_revenue']
    ordering = ['-created_at']

    def perform_create(self, serializer):
        # Auto-assign owner to current user if not provided
        if not serializer.validated_data.get('lead_owner'):
            serializer.save(lead_owner=self.request.user)
        else:
            serializer.save()

class TeleCallingProjectViewSet(viewsets.ModelViewSet):
    queryset = TeleCallingProject.objects.all()
    serializer_class = TeleCallingProjectSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'team_leader']
    search_fields = ['name']

class LeadAssignmentViewSet(viewsets.ModelViewSet):
    queryset = LeadAssignment.objects.all()
    serializer_class = LeadAssignmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['lead', 'project', 'assignee', 'status', 'lead__category']
    search_fields = ['lead__first_name', 'lead__last_name', 'lead__company', 'remarks']

    def get_queryset(self):
        # Allow filtering for "my assignments"
        qs = super().get_queryset()
        if self.request.query_params.get('mine'):
            return qs.filter(assignee=self.request.user)
        return qs

    @action(detail=False, methods=['get'])
    def reminders(self, request):
        """Returns assignments with pending follow-ups for the current user."""
        now = timezone.now()
        # Filter for assignments where target_time is reached, and not in final statuses
        # Also check interaction logs for next_call_date
        reminders = LeadAssignment.objects.filter(
            assignee=request.user,
            target_time__lte=now
        ).exclude(status__in=['Opportunity', 'Disqualified', 'Junk']).order_by('target_time')
        
        serializer = self.get_serializer(reminders, many=True)
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        
        # Phase 3 Log Hook: Auto-create Interaction Log
        LeadInteractionLog.objects.create(
            assignment=instance,
            user=self.request.user,
            status=instance.status,
            remarks=instance.remarks,
            next_call_date=instance.target_time
        )

        # Diagram Hook: LeadAssignment(Opportunity) -> Lead(Qualified / Opportunity)
        if instance.status == 'Opportunity':
            lead = instance.lead
            lead.lead_status = 'Qualified / Opportunity'
            lead.save()
        elif instance.status == 'Disqualified':
            lead = instance.lead
            lead.lead_status = 'Disqualified'
            lead.save()

class LeadInteractionLogViewSet(viewsets.ModelViewSet):
    queryset = LeadInteractionLog.objects.all()
    serializer_class = LeadInteractionLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['assignment', 'user', 'status']
    ordering = ['-created_at']

class CallSessionViewSet(viewsets.ModelViewSet):
    queryset = CallSession.objects.all()
    serializer_class = CallSessionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['assignment', 'caller', 'status']
    ordering = ['-start_time']

    def perform_create(self, serializer):
        serializer.save(caller=self.request.user)

from django.db.models import Count, Q
from rest_framework.views import APIView

class TelecallerPerformanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Metrics per tele-caller (User who is an assignee)
        users = User.objects.filter(assigned_leads__isnull=False).distinct()
        performance_data = []

        for user in users:
            total_assignments = LeadAssignment.objects.filter(assignee=user).count()
            conversions = LeadAssignment.objects.filter(assignee=user, status='Opportunity').count()
            processed = LeadAssignment.objects.filter(assignee=user, status__in=['Opportunity', 'Disqualified', 'Junk']).count()
            
            performance_data.append({
                'id': user.id,
                'username': user.username,
                'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'total_leads': total_assignments,
                'conversions': conversions,
                'processed_leads': processed,
                'conversion_rate': round((conversions / total_assignments * 100), 2) if total_assignments > 0 else 0,
                'efficiency': round((processed / total_assignments * 100), 2) if total_assignments > 0 else 0,
            })

        return Response(performance_data)


class DistributionZoneListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        zones = DistributionZone.objects.all().order_by('name')
        serializer = DistributionZoneSerializer(zones, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = DistributionZoneSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DistributionZoneDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DistributionZone.objects.get(pk=pk)
        except DistributionZone.DoesNotExist:
            return None

    def get(self, request, pk):
        zone = self.get_object(pk)
        if not zone:
            return Response({'detail': 'Distribution zone not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DistributionZoneSerializer(zone)
        return Response(serializer.data)

    def put(self, request, pk):
        zone = self.get_object(pk)
        if not zone:
            return Response({'detail': 'Distribution zone not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = DistributionZoneSerializer(zone, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        zone = self.get_object(pk)
        if not zone:
            return Response({'detail': 'Distribution zone not found.'}, status=status.HTTP_404_NOT_FOUND)
        zone.delete()
        return Response({'detail': 'Distribution zone deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)



from rest_framework import viewsets
from .models import DistributorLead, VendorLead
from .serializers import DistributorLeadSerializer, VendorLeadSerializer

class DistributorLeadViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print('DRF 400 ERROR:', serializer.errors, file=open('err_log.txt', 'w'))
        return super().create(request, *args, **kwargs)

    queryset = DistributorLead.objects.all()
    serializer_class = DistributorLeadSerializer

class VendorLeadViewSet(viewsets.ModelViewSet):
    queryset = VendorLead.objects.all()
    serializer_class = VendorLeadSerializer
