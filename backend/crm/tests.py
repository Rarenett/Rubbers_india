import io
import openpyxl
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Lead, Industry, LeadCategory, LeadSource, LeadImportBatch, LeadImportStaging
from .views import normalize_phone

User = get_user_model()


class StagingLeadImportAcceptanceTests(TestCase):
    def setUp(self):
        self._cleanup()
        self.client = APIClient()
        self.user, _ = User.objects.get_or_create(username='testcrmuser', defaults={'email': 'testcrmuser@example.com'})
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        self._cleanup()

    def _cleanup(self):
        LeadImportStaging.objects.all().delete()
        LeadImportBatch.objects.all().delete()
        Lead.objects.filter(phone__in=['9876543210', '9876543211', '+91 98765 43210', '09876543210', '919876543210', '+919876543210']).delete()
        Industry.objects.filter(name__in=['XYZ', 'Software', 'Healthcare', 'CorrectIndustry', 'TypoIndustry', 'NonExistentIndustry']).delete()
        LeadCategory.objects.filter(name__in=['XYZCategory', 'SoftwareCategory']).delete()
        LeadSource.objects.filter(name__in=['XYZSource', 'SoftwareSource']).delete()

    def _create_excel_file(self, rows, sheet_name="Leads"):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = sheet_name
        for row in rows:
            ws.append(row)
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        stream.name = "test_leads.xlsx"
        return stream

    def test_acceptance_1_to_4_full_flow(self):
        """
        Acceptance Criteria 1 to 4:
        1. Upload Excel with new Industry 'XYZ' -> rows in LeadImportStaging, batch HAS_ISSUES, missing data lists 'XYZ' with rows, Lead unchanged.
        2. Push is blocked while XYZ is missing.
        3. Create Industry 'XYZ' in master, call revalidate -> rows VALID, batch READY, no re-upload.
        4. Push -> Leads created in original table, staging rows marked PUSHED.
        """
        headers = ["Phone*", "First Name", "Industry", "Company"]
        row1 = ["9876543210", "Alice", "XYZ", "Alpha Corp"]
        row2 = ["9876543211", "Bob", "XYZ", "Beta LLC"]
        excel_file = self._create_excel_file([headers, row1, row2])

        initial_lead_count = Lead.objects.count()

        # Step 1: Upload Excel
        upload_res = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        self.assertEqual(upload_res.status_code, status.HTTP_201_CREATED)
        batch_data = upload_res.json()
        batch_id = batch_data['id']

        # Verify LeadImportBatch & LeadImportStaging
        batch = LeadImportBatch.objects.get(id=batch_id)
        self.assertEqual(batch.status, 'HAS_ISSUES')
        self.assertEqual(batch.total_rows, 2)
        self.assertEqual(batch.invalid_rows, 2)
        self.assertEqual(batch.valid_rows, 0)
        self.assertEqual(LeadImportStaging.objects.filter(batch=batch).count(), 2)
        self.assertEqual(Lead.objects.count(), initial_lead_count)

        # Verify missing master data breakdown
        self.assertTrue(batch_data['has_missing_masters'])
        missing_ind = batch_data['missing_masters']['industries']
        self.assertEqual(len(missing_ind), 1)
        self.assertEqual(missing_ind[0]['name'], 'XYZ')
        self.assertEqual(missing_ind[0]['rows'], [2, 3])

        # Step 2: Push blocked while invalid rows exist
        push_fail_res = self.client.post(f'/api/crm_new/batches/{batch_id}/push/', {}, format='json')
        self.assertEqual(push_fail_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), initial_lead_count)

        # Step 3: Create Industry "XYZ" in master and revalidate without re-uploading
        Industry.objects.create(name="XYZ")
        reval_res = self.client.post(f'/api/crm_new/batches/{batch_id}/revalidate/', {}, format='json')
        self.assertEqual(reval_res.status_code, status.HTTP_200_OK)
        reval_data = reval_res.json()

        batch.refresh_from_db()
        self.assertEqual(batch.status, 'READY')
        self.assertEqual(batch.valid_rows, 2)
        self.assertEqual(batch.invalid_rows, 0)
        self.assertFalse(reval_data['has_missing_masters'])
        self.assertEqual(LeadImportStaging.objects.filter(batch=batch, validation_status='VALID').count(), 2)

        # Step 4: Push -> Leads created in crm_lead, staging rows marked PUSHED
        push_res = self.client.post(f'/api/crm_new/batches/{batch_id}/push/', {}, format='json')
        self.assertEqual(push_res.status_code, status.HTTP_200_OK)
        push_data = push_res.json()
        self.assertEqual(push_data['added'], 2)
        self.assertEqual(push_data['updated'], 0)
        self.assertEqual(Lead.objects.count(), initial_lead_count + 2)

        batch.refresh_from_db()
        self.assertEqual(batch.status, 'PUSHED')
        self.assertIsNotNone(batch.pushed_at)
        self.assertEqual(LeadImportStaging.objects.filter(batch=batch, validation_status='PUSHED').count(), 2)

    def test_acceptance_5_reupload_and_update(self):
        """
        Acceptance Criteria 5: Upload the same Excel again and push -> added = 0, updated = N, no duplicate leads.
        """
        Industry.objects.create(name="Software")
        headers = ["Phone*", "First Name", "Industry", "Company"]
        row1 = ["9876543210", "Alice", "Software", "Alpha Corp"]
        excel_file = self._create_excel_file([headers, row1])

        initial_lead_count = Lead.objects.count()

        # First upload and push
        up1 = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b1_id = up1.json()['id']
        self.client.post(f'/api/crm_new/batches/{b1_id}/push/', {}, format='json')
        self.assertEqual(Lead.objects.count(), initial_lead_count + 1)

        # Second upload with updated company name
        row1_updated = ["9876543210", "Alice Updated", "Software", "Alpha Corp New"]
        excel_file2 = self._create_excel_file([headers, row1_updated])
        up2 = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file2}, format='multipart')
        b2_id = up2.json()['id']

        push2 = self.client.post(f'/api/crm_new/batches/{b2_id}/push/', {}, format='json')
        self.assertEqual(push2.status_code, status.HTTP_200_OK)
        res2 = push2.json()
        self.assertEqual(res2['added'], 0)
        self.assertEqual(res2['updated'], 1)
        self.assertEqual(Lead.objects.count(), initial_lead_count + 1)

        lead = Lead.objects.filter(phone='9876543210').first()
        self.assertEqual(lead.first_name, "Alice Updated")
        self.assertEqual(lead.company, "Alpha Corp New")

    def test_acceptance_6_phone_normalization(self):
        """
        Acceptance Criteria 6: '9876543210' and '+91 98765 43210' resolve to the same lead.
        """
        self.assertEqual(normalize_phone("9876543210"), "9876543210")
        self.assertEqual(normalize_phone("+91 98765 43210"), "9876543210")
        self.assertEqual(normalize_phone("98765-43210"), "9876543210")
        self.assertEqual(normalize_phone("+919876543210"), "9876543210")
        self.assertEqual(normalize_phone("919876543210"), "9876543210")
        self.assertEqual(normalize_phone("09876543210"), "9876543210")

        initial_lead_count = Lead.objects.count()

        # Create existing lead with spaced phone
        Lead.objects.create(phone="+91 98765 43210", first_name="Original Name")

        headers = ["Phone*", "First Name"]
        row1 = ["9876543210", "Updated Name"]
        excel_file = self._create_excel_file([headers, row1])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        # Staging row should match existing_lead
        staging_row = LeadImportStaging.objects.get(batch_id=b_id, row_number=2)
        self.assertIsNotNone(staging_row.existing_lead)
        self.assertEqual(staging_row.existing_lead.first_name, "Original Name")

        # Push updates existing lead
        push = self.client.post(f'/api/crm_new/batches/{b_id}/push/', {}, format='json')
        self.assertEqual(push.json()['updated'], 1)
        self.assertEqual(Lead.objects.count(), initial_lead_count + 1)
        self.assertEqual(Lead.objects.filter(phone="+91 98765 43210").first().first_name, "Updated Name")

    def test_acceptance_7_duplicate_phone_in_file_flagged(self):
        """
        Acceptance Criteria 7: Same phone twice in one file -> second row flagged.
        """
        headers = ["Phone*", "First Name"]
        row1 = ["9876543210", "Alice"]
        row2 = ["+91 98765 43210", "Alice Duplicate"]
        excel_file = self._create_excel_file([headers, row1, row2])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        r1 = LeadImportStaging.objects.get(batch_id=b_id, row_number=2)
        r2 = LeadImportStaging.objects.get(batch_id=b_id, row_number=3)

        self.assertEqual(r1.validation_status, 'VALID')
        self.assertFalse(r1.is_duplicate_in_file)

        self.assertEqual(r2.validation_status, 'INVALID')
        self.assertTrue(r2.is_duplicate_in_file)
        self.assertIn("Duplicate phone in file (same as row 2)", r2.error_messages[0])

    def test_acceptance_8_case_insensitive_master_matching(self):
        """
        Acceptance Criteria 8: 'healthcare', 'Healthcare', ' HEALTHCARE ' all match the same master.
        """
        Industry.objects.create(name="Healthcare")

        headers = ["Phone*", "First Name", "Industry"]
        row1 = ["9876543210", "One", "healthcare"]
        row2 = ["9876543211", "Two", " HEALTHCARE "]
        excel_file = self._create_excel_file([headers, row1, row2])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        batch = LeadImportBatch.objects.get(id=b_id)
        self.assertEqual(batch.status, 'READY')
        self.assertEqual(batch.valid_rows, 2)
        self.assertEqual(batch.invalid_rows, 0)

        rows = LeadImportStaging.objects.filter(batch=batch)
        for r in rows:
            self.assertEqual(r.validation_status, 'VALID')
            self.assertIsNotNone(r.industry)
            self.assertEqual(r.industry.name, "Healthcare")

    def test_acceptance_9_forced_error_rollback(self):
        """
        Acceptance Criteria 9: Forced error during push -> full rollback, no partial leads.
        """
        headers = ["Phone*", "First Name"]
        row1 = ["9876543210", "Valid One"]
        row2 = ["9876543211", "Valid Two"]
        excel_file = self._create_excel_file([headers, row1, row2])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        # Corrupt second row's normalized_phone in staging table directly before push
        LeadImportStaging.objects.filter(batch_id=b_id, row_number=3).update(phone='', normalized_phone='')

        initial_count = Lead.objects.count()
        push_res = self.client.post(f'/api/crm_new/batches/{b_id}/push/', {}, format='json')
        self.assertEqual(push_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify complete rollback: 0 leads created
        self.assertEqual(Lead.objects.count(), initial_count)

    def test_skip_invalid_push_option(self):
        """Test push with skip_invalid=true pushes valid rows and ignores invalid ones."""
        headers = ["Phone*", "First Name", "Industry"]
        row1 = ["9876543210", "Valid Row", ""]  # No industry -> valid
        row2 = ["9876543211", "Invalid Row", "NonExistentIndustry"]
        excel_file = self._create_excel_file([headers, row1, row2])

        initial_count = Lead.objects.count()

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        # Standard push blocked
        push1 = self.client.post(f'/api/crm_new/batches/{b_id}/push/', {}, format='json')
        self.assertEqual(push1.status_code, status.HTTP_400_BAD_REQUEST)

        # Push with skip_invalid=True
        push2 = self.client.post(f'/api/crm_new/batches/{b_id}/push/', {'skip_invalid': True}, format='json')
        self.assertEqual(push2.status_code, status.HTTP_200_OK)
        self.assertEqual(push2.json()['added'], 1)
        self.assertEqual(push2.json()['skipped'], 1)
        self.assertEqual(Lead.objects.count(), initial_count + 1)

    def test_staging_row_patch_and_revalidation(self):
        """Test staging row edit endpoint PATCH /api/crm_new/staging-rows/{id}/."""
        headers = ["Phone*", "First Name", "Industry"]
        row1 = ["9876543210", "Alice", "TypoIndustry"]
        excel_file = self._create_excel_file([headers, row1])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']
        staging_row = LeadImportStaging.objects.get(batch_id=b_id, row_number=2)
        self.assertEqual(staging_row.validation_status, 'INVALID')

        # Create the correct industry
        Industry.objects.create(name="CorrectIndustry")

        # Patch the row's industry_name
        patch_res = self.client.patch(f'/api/crm_new/staging-rows/{staging_row.id}/', {
            'industry_name': 'CorrectIndustry'
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        staging_row.refresh_from_db()
        self.assertEqual(staging_row.validation_status, 'VALID')
        self.assertIsNotNone(staging_row.industry)

        batch = LeadImportBatch.objects.get(id=b_id)
        self.assertEqual(batch.status, 'READY')
        self.assertEqual(batch.valid_rows, 1)

    def test_batch_cancel_and_cleanup(self):
        """Test batch cancel and cleanup endpoints."""
        headers = ["Phone*", "First Name"]
        row1 = ["9876543210", "Alice"]
        excel_file = self._create_excel_file([headers, row1])

        up = self.client.post('/api/crm_new/batches/upload_excel/', {'file': excel_file}, format='multipart')
        b_id = up.json()['id']

        cancel_res = self.client.post(f'/api/crm_new/batches/{b_id}/cancel/', {}, format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(LeadImportBatch.objects.get(id=b_id).status, 'CANCELLED')

        cleanup_res = self.client.post('/api/crm_new/batches/cleanup/', {}, format='json')
        self.assertEqual(cleanup_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cleanup_res.json()['deleted_count'], 1)
        self.assertFalse(LeadImportBatch.objects.filter(id=b_id).exists())

