export interface AppAccessPage {
  key: string;
  label: string;
  group: string;
  /** Only admin / MD roles may access, regardless of assignments. */
  adminOnly?: boolean;
  /** false = page exists but is not yet activated in the app. */
  enabled?: boolean;
}

/** Manageable overview and top-level pages for user-level access control. */
export const APP_ACCESS_PAGES: AppAccessPage[] = [
  { key: 'main-dashboard', label: 'Main Dashboard', group: 'Dashboard & Analytics' },
  { key: 'lab-dashboard', label: 'Lab Dashboard', group: 'Dashboard & Analytics', enabled: false },
  { key: 'patient-dashboard', label: 'Patient Dashboard', group: 'Dashboard & Analytics', enabled: false },
  { key: 'inventory-dashboard', label: 'Inventory Dashboard', group: 'Dashboard & Analytics', enabled: false },

  { key: 'all-patients', label: 'Registry', group: 'Patient Management' },
  { key: 'patient-groups', label: 'Patient Groups', group: 'Patient Management' },
  { key: 'queue-management', label: 'Queue Management', group: 'Patient Management' },
  { key: 'patient-visit', label: 'Patient Visit / Consultation', group: 'Patient Management' },
  { key: 'open-closed-visit', label: 'Open Closed Visit', group: 'Patient Management' },
  { key: 'patient-visits-list', label: 'Patient Visits List', group: 'Patient Management' },
  { key: 'doctor-assistant', label: 'Doctor Assistant Chat', group: 'Patient Management' },
  { key: 'patient', label: 'Legacy Patient Chart', group: 'Patient Management' },
  { key: 'patient-registration', label: 'Patient Registration', group: 'Patient Management', enabled: false },
  { key: 'patient-profile', label: 'Patient Profile', group: 'Patient Management', enabled: false },
  { key: 'visit-history', label: 'Visit History', group: 'Patient Management', enabled: false },
  { key: 'appointment-scheduling', label: 'Appointment Scheduling', group: 'Patient Management', enabled: false },
  { key: 'referral-management', label: 'Referral Management', group: 'Patient Management', enabled: false },

  { key: 'opd-consultation', label: 'OPD Consultation', group: 'Clinical — OPD', enabled: false },
  { key: 'opd-prescriptions', label: 'OPD Prescriptions', group: 'Clinical — OPD', enabled: false },
  { key: 'opd-investigations', label: 'OPD Investigations', group: 'Clinical — OPD', enabled: false },
  { key: 'opd-diagnosis', label: 'OPD Diagnosis', group: 'Clinical — OPD', enabled: false },
  { key: 'opd-follow-ups', label: 'OPD Follow-ups', group: 'Clinical — OPD', enabled: false },

  { key: 'bed-management', label: 'Bed Management', group: 'Clinical — Inpatient', enabled: false },
  { key: 'admissions', label: 'Admissions', group: 'Clinical — Inpatient', enabled: false },
  { key: 'discharges', label: 'Discharges', group: 'Clinical — Inpatient', enabled: false },
  { key: 'nursing-notes', label: 'Nursing Notes', group: 'Clinical — Inpatient', enabled: false },
  { key: 'doctor-rounds', label: 'Doctor Rounds', group: 'Clinical — Inpatient', enabled: false },
  { key: 'medication-charts', label: 'Medication Charts', group: 'Clinical — Inpatient', enabled: false },
  { key: 'procedures', label: 'Procedures', group: 'Clinical — Inpatient', enabled: false },
  { key: 'transfers', label: 'Transfers', group: 'Clinical — Inpatient', enabled: false },

  { key: 'consumable-items', label: 'Consumable Items', group: 'Inventory — Item Management' },
  { key: 'asset-management', label: 'Assets Management', group: 'Inventory — Item Management' },
  { key: 'reorder-levels', label: 'Reorder Levels', group: 'Inventory — Stock Management' },
  { key: 'stock-receive', label: 'Stock Receive', group: 'Inventory — Stock Management' },
  { key: 'stock-batch', label: 'Stock Batch', group: 'Inventory — Stock Management' },
  { key: 'stock-transfer', label: 'Stock Transfer', group: 'Inventory — Stock Management' },
  { key: 'stock-tracking', label: 'Stock Tracking', group: 'Inventory — Stock Management' },
  { key: 'stock-verification', label: 'Stock Verification', group: 'Inventory — Stock Management' },
  { key: 'stock-initializer', label: 'Stock Initializer', group: 'Inventory — Stock Management' },
  { key: 'stock-taking', label: 'Stock Taking', group: 'Inventory — Stock Management' },
  { key: 'expired-items', label: 'Expired Items', group: 'Inventory — Stock Management' },
  { key: 'suppliers', label: 'Stock Suppliers', group: 'Inventory — Stock Management' },
  { key: 'manufacturers', label: 'Stock Manufacturers', group: 'Inventory — Stock Management' },
  { key: 'adjustments', label: 'Adjustments', group: 'Inventory — Stock Management' },
  { key: 'stock-management', label: 'Stock Management Hub', group: 'Inventory — Stock Management', enabled: false },
  { key: 'store-management', label: 'Store Management', group: 'Inventory — Store Management' },
  { key: 'store-reports', label: 'Store Reports', group: 'Inventory — Store Management' },
  { key: 'store-analytics', label: 'Store Analytics', group: 'Inventory — Store Management' },
  { key: 'inventory-summary', label: 'Inventory Summary', group: 'Inventory — Store Management', enabled: false },

  { key: 'consultations-center', label: 'Consultations Center', group: 'Hospital Departments' },
  { key: 'consultation-v2', label: 'Consultation V2 (Beta)', group: 'Hospital Departments' },
  { key: 'scan', label: 'Ultrasound Scan', group: 'Hospital Departments' },
  { key: 'scan-v2', label: 'Ultrasound Scan (V2)', group: 'Hospital Departments' },
  { key: 'lab', label: 'Medical Laboratory', group: 'Hospital Departments' },
  { key: 'lab-v2', label: 'Medical Laboratory (V2)', group: 'Hospital Departments' },
  { key: 'dental', label: 'Dental Department', group: 'Hospital Departments' },
  { key: 'dental-v2', label: 'Dental Department (V2)', group: 'Hospital Departments' },
  { key: 'lab-mobile', label: 'Lab Mobile Page', group: 'Hospital Departments' },
  { key: 'maternal-child-health-requests', label: 'Maternal & Child Health', group: 'Hospital Departments' },
  { key: 'mch-v2', label: 'Maternal & Child Health (V2)', group: 'Hospital Departments' },
  { key: 'dashboard', label: 'Balance Sheet', group: 'Financial Management' },
  { key: 'otc-dispensary', label: 'Pharmacy', group: 'Hospital Departments' },

  { key: 'lab-test-requests', label: 'Lab Test Requests', group: 'Laboratory (planned)', enabled: false },
  { key: 'sample-collection', label: 'Sample Collection', group: 'Laboratory (planned)', enabled: false },
  { key: 'test-processing', label: 'Test Processing', group: 'Laboratory (planned)', enabled: false },
  { key: 'lab-results', label: 'Lab Results', group: 'Laboratory (planned)', enabled: false },
  { key: 'lab-reports', label: 'Lab Reports', group: 'Laboratory (planned)', enabled: false },
  { key: 'lab-equipment-tracking', label: 'Lab Equipment Tracking', group: 'Laboratory (planned)', enabled: false },
  { key: 'lab-statistics', label: 'Lab Statistics', group: 'Laboratory (planned)', enabled: false },

  { key: 'scan-requests', label: 'Scan Requests', group: 'Radiology (planned)', enabled: false },
  { key: 'radiology-reports', label: 'Radiology Reports', group: 'Radiology (planned)', enabled: false },
  { key: 'pacs-integration', label: 'PACS Integration', group: 'Radiology (planned)', enabled: false },
  { key: 'radiologist-worklist', label: 'Radiologist Worklist', group: 'Radiology (planned)', enabled: false },

  { key: 'pharmacy-dispensing', label: 'Drug Dispensing', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-prescription-management', label: 'Prescription Management', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-pricing', label: 'Drug Pricing', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-stock-tracking', label: 'Pharmacy Stock Tracking', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-purchase-orders', label: 'Pharmacy Purchase Orders', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-expiry-alerts', label: 'Drug Expiry Alerts', group: 'Pharmacy (planned)', enabled: false },
  { key: 'pharmacy-suppliers', label: 'Pharmacy Suppliers', group: 'Pharmacy (planned)', enabled: false },
  { key: 'drug-utilization', label: 'Drug Utilization', group: 'Pharmacy (planned)', enabled: false },

  { key: 'services-management', label: 'All Services', group: 'Services Management' },
  { key: 'service-categories', label: 'Service Categories', group: 'Services Management' },
  { key: 'service-types', label: 'Service Types', group: 'Services Management', enabled: false },

  { key: 'user-management', label: 'User Management & Roles', group: 'Administration & Setup', adminOnly: true },
  { key: 'access-control', label: 'Access Control Panel', group: 'Administration & Setup', adminOnly: true },
  { key: 'department-setup', label: 'Hospital Directory Setup', group: 'Administration & Setup', adminOnly: true },
  { key: 'business-settings', label: 'Business Settings', group: 'Administration & Setup', adminOnly: true },
  { key: 'special-privileges', label: 'Special Privileges', group: 'Administration & Setup', adminOnly: true },
  { key: 'data-backup', label: 'Backups & Restoration', group: 'Administration & Setup', adminOnly: true },
  { key: 'mobile-money-settings', label: 'DGateway / Mobile Money', group: 'Administration & Setup', adminOnly: true },
  { key: 'system-documentation', label: 'System Documentation', group: 'Administration & Setup' },
  { key: 'subscription', label: 'Subscription Status', group: 'Administration & Setup' },
  { key: 'system-configuration', label: 'System Configuration', group: 'Administration & Setup', enabled: false },
  { key: 'audit-logs', label: 'Audit Logs', group: 'Administration & Setup', enabled: false },

  { key: 'patient-billing', label: 'Patient Billing', group: 'Financial Management' },
  { key: 'expenses', label: 'Expense Management', group: 'Financial Management' },
  { key: 'expense-categories', label: 'Expense Categories', group: 'Financial Management' },
  { key: 'expense-accounts', label: 'Expense Accounts', group: 'Financial Management' },
  { key: 'expense-transactions', label: 'Expense Transactions', group: 'Financial Management' },
  { key: 'expense-analytics', label: 'Expense Analytics & Reports', group: 'Financial Management' },
  { key: 'loan-management', label: 'Loan Management', group: 'Financial Management' },
  { key: 'income-management', label: 'Income Management', group: 'Financial Management' },
  { key: 'income-transactions', label: 'Income Transactions', group: 'Financial Management' },
  { key: 'income-accounts', label: 'Income Accounts', group: 'Financial Management' },
  { key: 'income-categories', label: 'Income Categories', group: 'Financial Management' },
  { key: 'finance-dashboard', label: 'Finance Dashboard', group: 'Financial Management', enabled: false },
  { key: 'service-charges', label: 'Service Charges Setup', group: 'Financial Management', enabled: false },
  { key: 'cashier', label: 'Cashier Desk / Receipts', group: 'Financial Management' },
  { key: 'insurance-billing', label: 'Insurance / NHIF / Third-Party Billing', group: 'Financial Management', enabled: false },
  { key: 'refunds', label: 'Refunds & Adjustments', group: 'Financial Management', enabled: false },
  { key: 'finance-reports', label: 'Financial Reports', group: 'Financial Management', enabled: false },
  { key: 'insurance-registration', label: 'Insurance Registration', group: 'Financial Management', enabled: false },
  { key: 'pre-authorization', label: 'Pre-Authorization', group: 'Financial Management', enabled: false },
  { key: 'claim-submissions', label: 'Claim Submissions', group: 'Financial Management', enabled: false },
  { key: 'claim-tracking', label: 'Claim Tracking', group: 'Financial Management', enabled: false },
  { key: 'corporate-billing', label: 'Corporate Billing', group: 'Financial Management', enabled: false },

  { key: 'employee-registration', label: 'Employee Registration', group: 'Human Resources (planned)', enabled: false },
  { key: 'department-assignment', label: 'Department Assignment', group: 'Human Resources (planned)', enabled: false },
  { key: 'attendance', label: 'Attendance', group: 'Human Resources (planned)', enabled: false },
  { key: 'leave-management', label: 'Leave Management', group: 'Human Resources (planned)', enabled: false },
  { key: 'payroll', label: 'Payroll', group: 'Human Resources (planned)', enabled: false },
  { key: 'performance-tracking', label: 'Performance Tracking', group: 'Human Resources (planned)', enabled: false },

  { key: 'departmental-reports', label: 'Departmental Reports', group: 'Analytics & Reports (planned)', enabled: false },
  { key: 'revenue-reports', label: 'Revenue Reports', group: 'Analytics & Reports (planned)', enabled: false },
  { key: 'daily-admissions', label: 'Daily Admissions', group: 'Analytics & Reports (planned)', enabled: false },
  { key: 'regulatory-reports', label: 'Regulatory Reports', group: 'Analytics & Reports (planned)', enabled: false },
  { key: 'business-intelligence', label: 'Business Intelligence', group: 'Analytics & Reports (planned)', enabled: false },
  { key: 'predictive-analytics', label: 'Predictive Analytics', group: 'Analytics & Reports (planned)', enabled: false },

  { key: 'laundry', label: 'Laundry', group: 'Support Services (planned)', enabled: false },
  { key: 'kitchen-diet', label: 'Kitchen & Diet', group: 'Support Services (planned)', enabled: false },
  { key: 'transport-ambulance', label: 'Transport & Ambulance', group: 'Support Services (planned)', enabled: false },
  { key: 'housekeeping', label: 'Housekeeping', group: 'Support Services (planned)', enabled: false },
  { key: 'maintenance-requests', label: 'Maintenance Requests', group: 'Support Services (planned)', enabled: false },
  { key: 'equipment-maintenance', label: 'Equipment Maintenance', group: 'Support Services (planned)', enabled: false },

  { key: 'online-consultations', label: 'Online Consultations', group: 'Telehealth (planned)', enabled: false },
  { key: 'e-prescriptions', label: 'E-Prescriptions', group: 'Telehealth (planned)', enabled: false },
  { key: 'video-scheduling', label: 'Video Scheduling', group: 'Telehealth (planned)', enabled: false },
  { key: 'remote-monitoring', label: 'Remote Monitoring', group: 'Telehealth (planned)', enabled: false },
  { key: 'patient-portal', label: 'Patient Portal', group: 'Telehealth (planned)', enabled: false },

  { key: 'drug-interactions', label: 'Drug Interactions', group: 'Clinical Decision Support (planned)', enabled: false },
  { key: 'disease-protocols', label: 'Disease Protocols', group: 'Clinical Decision Support (planned)', enabled: false },
  { key: 'treatment-guidelines', label: 'Treatment Guidelines', group: 'Clinical Decision Support (planned)', enabled: false },

  { key: 'data-encryption', label: 'Data Encryption', group: 'Security & Compliance (planned)', enabled: false },
  { key: 'access-history', label: 'Access History', group: 'Security & Compliance (planned)', enabled: false },
  { key: 'role-controls', label: 'Role Controls', group: 'Security & Compliance (planned)', enabled: false },
  { key: 'compliance-reports', label: 'Compliance Reports', group: 'Security & Compliance (planned)', enabled: false },

  { key: 'blood-donations', label: 'Blood Donations', group: 'Blood Bank (planned)', enabled: false },
  { key: 'blood-screening', label: 'Blood Screening', group: 'Blood Bank (planned)', enabled: false },
  { key: 'blood-inventory', label: 'Blood Inventory', group: 'Blood Bank (planned)', enabled: false },

  { key: 'body-management', label: 'Body Management', group: 'Mortuary (planned)', enabled: false },
  { key: 'autopsy', label: 'Autopsy', group: 'Mortuary (planned)', enabled: false },
  { key: 'release-tracking', label: 'Release Tracking', group: 'Mortuary (planned)', enabled: false },

  { key: 'theatre-schedule', label: 'Theatre Schedule', group: 'Theatre (planned)', enabled: false },
  { key: 'theatre-records', label: 'Theatre Records', group: 'Theatre (planned)', enabled: false },
  { key: 'theatre-management', label: 'Theatre Management', group: 'Theatre (planned)', enabled: false },

  { key: 'dialysis-sessions', label: 'Dialysis Sessions', group: 'Dialysis (planned)', enabled: false },
  { key: 'dialysis-patient-data', label: 'Dialysis Patient Data', group: 'Dialysis (planned)', enabled: false },

  { key: 'integration-hub', label: 'Integration Hub', group: 'Integrations (planned)', enabled: false },

  { key: 'messages', label: 'Messages', group: 'User Account' },
  { key: 'help', label: 'Help & Support', group: 'User Account' },
  { key: 'settings-privacy', label: 'Settings & Privacy', group: 'User Account' },
  { key: 'user-profile', label: 'User Profile', group: 'User Account' },
];

export function getAppAccessPagesByGroup(): { group: string; pages: AppAccessPage[] }[] {
  const map = new Map<string, AppAccessPage[]>();
  for (const page of APP_ACCESS_PAGES) {
    if (!map.has(page.group)) {
      map.set(page.group, []);
    }
    map.get(page.group)!.push(page);
  }
  return Array.from(map.entries()).map(([group, pages]) => ({ group, pages }));
}

export function findAppAccessPage(key: string): AppAccessPage | undefined {
  return APP_ACCESS_PAGES.find(p => p.key === key);
}

/** Top-level routes outside /overview that participate in page access control. */
export const TOP_LEVEL_ACCESS_PAGE_KEYS = new Set([
  'patient-visit',
  'patient-visits-list',
  'doctor-assistant',
  'patient',
  'scan',
  'lab',
  'dental',
  'lab-mobile',
  'maternal-child-health-requests',
  'dashboard',
  'messages',
  'help',
  'settings-privacy',
  'user-profile',
]);
