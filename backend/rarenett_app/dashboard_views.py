from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from settings_app.models import Company, CompanyAddress, CompanyContact
from rarenett_app.models import BoardOfDirector

class CompanyDashboardAPIView(APIView):
    """
    API view to return Company details (logo, display name, registered address)
    and Board of Directors for the company profile dashboard.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Fetch the company
        company = Company.objects.first()
        company_data = None
        
        if company:
            logo_url = request.build_absolute_uri(company.logo.url) if company.logo else None
            title_logo_url = request.build_absolute_uri(company.title_logo.url) if hasattr(company, 'title_logo') and company.title_logo else None
            
            # Fetch registered office address
            addr = CompanyAddress.objects.filter(company=company, address_type='registered').first()
            if not addr:
                addr = CompanyAddress.objects.filter(company=company, is_default=True).first()
            if not addr:
                addr = CompanyAddress.objects.filter(company=company).first()
                
            address_data = None
            if addr:
                address_data = {
                    'address_line_1': addr.address_line_1,
                    'address_line_2': addr.address_line_2 or '',
                    'city': addr.city,
                    'state': addr.state,
                    'country': addr.country,
                    'pincode': addr.pincode,
                }
                
            # Fetch primary contact
            contact = CompanyContact.objects.filter(company=company, is_primary=True).first()
            if not contact:
                contact = CompanyContact.objects.filter(company=company).first()
            contact_data = None
            if contact:
                contact_data = {
                    'email': contact.email or '',
                    'phone': contact.phone or '',
                    'mobile': contact.mobile or '',
                    'support_email': contact.support_email or '',
                }

            company_data = {
                'name': company.name,
                'display_name': company.display_name or company.name,
                'logo_url': logo_url,
                'title_logo_url': title_logo_url,
                'description': company.description or '',
                'vision': company.vision or '',
                'mission': company.mission or '',
                'address': address_data,
                'contact': contact_data,
                'gst_no': company.gst_no or '',
                'registration_no': company.registration_no or ''
            }
        else:
            company_data = {
                'name': 'Glenda Beverages',
                'display_name': 'Glenda Beverages',
                'logo_url': None,
                'description': '',
                'vision': '',
                'mission': '',
                'address': None,
                'contact': None,
                'gst_no': '',
                'registration_no': ''
            }

        # Fetch board of directors
        bods = BoardOfDirector.objects.filter(is_active=True).select_related('designation')
        bod_list = []
        for bod in bods:
            pic_url = request.build_absolute_uri(bod.profile_picture.url) if bod.profile_picture else None
            bod_list.append({
                'name': bod.name,
                'designation': bod.designation.name if bod.designation else '',
                'profile_picture': pic_url,
                'email': bod.email or '',
                'phone': bod.phone or '',
            })

        return Response({
            'company': company_data,
            'board_of_directors': bod_list
        })
