const fs = require('fs');

let s = fs.readFileSync('backend/digilocker_app/urls.py', 'utf8');

s = s.replace(
  'DigiLockerEditRequestViewSet\n)',
  'DigiLockerEditRequestViewSet,\n    DigiLockerSettingsView\n)'
);
if (!s.includes('DigiLockerSettingsView')) {
  s = s.replace(
    'DigiLockerEditRequestViewSet\r\n)',
    'DigiLockerEditRequestViewSet,\r\n    DigiLockerSettingsView\r\n)'
  );
}

const oldReports = `    # Dedicated Reports endpoints (must be listed before router to avoid conflicts)
    path('reports/files-view/', DigiLockerFilesViewReportView.as_view(), name='digilocker-reports-files-view'),
    path('reports/file-download/', DigiLockerFileDownloadReportView.as_view(), name='digilocker-reports-file-download'),`;

const newReports = `    # Settings endpoint
    path('settings/', DigiLockerSettingsView.as_view(), name='digilocker-settings'),

    # Dedicated Reports endpoints (must be listed before router to avoid conflicts)
    path('reports/files-view/', DigiLockerFilesViewReportView.as_view(), name='digilocker-reports-files-view'),
    path('reports/file-download/', DigiLockerFileDownloadReportView.as_view(), name='digilocker-reports-file-download'),`;

s = s.replace(oldReports, newReports);

fs.writeFileSync('backend/digilocker_app/urls.py', s, 'utf8');
console.log('Successfully added settings endpoint to backend/digilocker_app/urls.py');

