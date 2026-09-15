import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { ProductsComponent } from './products/products.component';
import { CartComponent } from './cart/cart.component';
import { FooterComponent } from './footer/footer.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatToolbarModule } from '@angular/material/toolbar';
import { HttpClientModule } from '@angular/common/http';
import { ProductDetailsComponent } from './product-details/product-details.component';
import { MensFashionComponent } from './mens-fashion/mens-fashion.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { ItemManagementComponent } from './item-management/item-management.component';
import { MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PopupComponent } from './popup/popup.component';
import { LoginComponent } from './auth/login/login.component';
import { SignupComponent } from './auth/signup/signup.component';
import { ResetpasswordComponent } from './resetpassword/resetpassword.component';
import { SendemailComponent } from './sendemail/sendemail.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgbCollapseModule, NgbModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { AsyncPipe, DecimalPipe, NgFor, CommonModule, UpperCasePipe } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { DashboardComponent } from './dashboard/dashboard.component';
import { initializeApp,provideFirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';
import { provideStorage,getStorage } from '@angular/fire/storage';
import { TestComponent } from './test/test.component';
import { FormarrayexampleComponent } from './formarrayexample/formarrayexample.component';
import { Login2Component } from './login2/login2.component';
import { Login3Component } from './login3/login3.component';
import { Login4Component } from './auth/login4/login4.component';
import { PatientComponent } from './patient/patient.component';
import { PatientVisitComponent } from './patient-visit/patient-visit.component';
import { CapitalizePipe } from './capitalize.pipe';
import { ServicesOfferedComponent } from './services-offered/services-offered.component';
import { StockReceiveComponent } from './stock-receive/stock-receive.component';
import { ScanComponent } from './scan/scan.component';
import { LabComponent } from './lab/lab.component';
import { PatientInfoComponent } from './patient-visit/components/patient-info/patient-info.component';
import { VitalSignsComponent } from './patient-visit/components/vital-signs/vital-signs.component';
import { PatientVisitContainerComponent } from './patient-visit/components/patient-visit-container/patient-visit-container.component';
import { OverviewComponent } from './overview/overview.component';
import { MainDashboardComponent } from './overview/dashboards/main-dashboard/main-dashboard.component';
import { LabDashboardComponent } from './overview/dashboards/lab-dashboard/lab-dashboard.component';
import { PatientDashboardComponent } from './overview/dashboards/patient-dashboard/patient-dashboard.component';
import { FinanceDashboardComponent } from './overview/dashboards/finance-dashboard/finance-dashboard.component';
import { InventoryDashboardComponent } from './overview/dashboards/inventory-dashboard/inventory-dashboard.component';
import { ReorderLevelsComponent as OverviewReorderLevelsComponent } from './overview/pages/inventory/reorder-levels/reorder-levels.component';
import { SuppliersComponent } from './overview/pages/inventory/suppliers/suppliers.component';
import { AllPatientsComponent } from './overview/pages/patient-management/all-patients/all-patients.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { ServiceDetailComponent } from './service-detail/service-detail.component';
import { SiteNavComponent } from './site-nav/site-nav.component';
import { AboutPageComponent } from './about-page/about-page.component';
import { BookAppointmentComponent } from './book-appointment/book-appointment.component';
import { ContactPageComponent } from './contact-page/contact-page.component';
import { AssetManagementComponent } from './overview/pages/inventory/asset-management/asset-management.component';
import { StoreManagementComponent } from './overview/pages/inventory/store-management/store-management.component';
import { StoreReportsComponent } from './overview/pages/inventory/store-reports/store-reports.component';
import { StoreAnalyticsComponent } from './overview/pages/inventory/store-analytics/store-analytics.component';
import { ConsultationsCenterComponent } from './overview/pages/consultations-center/consultations-center.component';
import { ConsultationV2Component } from './overview/pages/consultation-v2/consultation-v2.component';
import { ScanV2Component } from './overview/pages/scan-v2/scan-v2.component';
import { LabV2Component } from './overview/pages/lab-v2/lab-v2.component';
import { DentalV2Component } from './overview/pages/dental-v2/dental-v2.component';
import { MchV2Component } from './overview/pages/mch-v2/mch-v2.component';
import { MaternalChildHealthRequestsComponent } from './overview/pages/maternal-child-health/test-requests/maternal-child-health-requests.component';
import { ConsultationPatientInfoComponent } from './overview/pages/consultations-center/components/consultation-patient-info/consultation-patient-info.component';
import { ConsultationDetailsComponent } from './overview/pages/consultations-center/components/consultation-details/consultation-details.component';
import { StockManagementComponent } from './overview/pages/inventory/stock-management/stock-management.component';
import { ConsumableItemsComponent } from './overview/pages/inventory/consumable-items/consumable-items.component';
import { StockTransferComponent } from './overview/pages/inventory/stock-transfer/stock-transfer.component';
import { StockTrackingComponent } from './overview/pages/inventory/stock-tracking/stock-tracking.component';
import { StockTakingComponent } from './overview/pages/inventory/stock-taking/stock-taking.component';
import { StockVerificationComponent } from './overview/pages/inventory/stock-verification/stock-verification.component';
import { StockInitializerComponent } from './overview/pages/inventory/stock-initializer/stock-initializer.component';
import { StockReceiveComponent as OverviewStockReceiveComponent } from './overview/pages/inventory/stock-receive/stock-receive.component';
import { StockBatchComponent } from './overview/pages/inventory/stock-batch/stock-batch.component';
import { StockAdjustmentsComponent } from './overview/pages/inventory/stock-adjustments/stock-adjustments.component';
import { ExpiredItemsComponent } from './overview/pages/inventory/expired-items/expired-items.component';
import { ShopItemManagementComponent } from './overview/pages/inventory/shop-item-management/shop-item-management.component';
import { ShopItemReceiveComponent as OverviewShopItemReceiveComponent } from './overview/pages/inventory/shop-item-receive/shop-item-receive.component';
import { ManufacturersComponent } from './overview/pages/inventory/manufacturers/manufacturers.component';
import { ServicesManagementComponent } from './overview/pages/services-management/services-management.component';
import { ServiceCategoriesComponent } from './overview/pages/services-management/service-categories/service-categories.component';
import { ServiceTypesComponent } from './overview/pages/services-management/service-types/service-types.component';
import { PatientGroupsComponent } from './overview/pages/patient-management/patient-groups/patient-groups.component';
// OPD Components
import { ConsultationComponent } from './overview/pages/opd/consultation/consultation.component';
import { PrescriptionsComponent } from './overview/pages/opd/prescriptions/prescriptions.component';
import { InvestigationsComponent } from './overview/pages/opd/investigations/investigations.component';
import { DiagnosisComponent } from './overview/pages/opd/diagnosis/diagnosis.component';
import { FollowUpsComponent } from './overview/pages/opd/follow-ups/follow-ups.component';
// IPD Components
import { BedManagementComponent } from './overview/pages/ipd/bed-management/bed-management.component';
import { AdmissionsComponent } from './overview/pages/ipd/admissions/admissions.component';
import { DischargesComponent } from './overview/pages/ipd/discharges/discharges.component';
import { NursingNotesComponent } from './overview/pages/ipd/nursing-notes/nursing-notes.component';
import { DoctorRoundsComponent } from './overview/pages/ipd/doctor-rounds/doctor-rounds.component';
import { MedicationChartsComponent } from './overview/pages/ipd/medication-charts/medication-charts.component';
import { ProceduresComponent } from './overview/pages/ipd/procedures/procedures.component';
import { TransfersComponent } from './overview/pages/ipd/transfers/transfers.component';
// Patient Management Additional
import { PatientRegistrationComponent } from './overview/pages/patient-management/patient-registration/patient-registration.component';
import { PatientProfileComponent } from './overview/pages/patient-management/patient-profile/patient-profile.component';
import { VisitHistoryComponent } from './overview/pages/patient-management/visit-history/visit-history.component';
import { AppointmentSchedulingComponent } from './overview/pages/patient-management/appointment-scheduling/appointment-scheduling.component';
import { QueueManagementComponent } from './overview/pages/patient-management/queue-management/queue-management.component';
import { ReferralManagementComponent } from './overview/pages/patient-management/referral-management/referral-management.component';
// Laboratory Components
import { LabTestRequestsComponent } from './overview/pages/laboratory/test-requests/lab-test-requests.component';
import { SampleCollectionComponent } from './overview/pages/laboratory/sample-collection/sample-collection.component';
import { TestProcessingComponent } from './overview/pages/laboratory/test-processing/test-processing.component';
import { LabResultsComponent } from './overview/pages/laboratory/results/lab-results.component';
import { LabReportsComponent } from './overview/pages/laboratory/reports/lab-reports.component';
import { LabEquipmentTrackingComponent } from './overview/pages/laboratory/equipment-tracking/lab-equipment-tracking.component';
// Radiology Components
import { ScanRequestsComponent } from './overview/pages/radiology/scan-requests/scan-requests.component';
import { RadiologyReportsComponent } from './overview/pages/radiology/reports/radiology-reports.component';
import { PacsIntegrationComponent } from './overview/pages/radiology/pacs-integration/pacs-integration.component';
import { RadiologistWorklistComponent } from './overview/pages/radiology/radiologist-worklist/radiologist-worklist.component';
// Pharmacy Components
import { PharmacyDispensingComponent } from './overview/pages/pharmacy/dispensing/pharmacy-dispensing.component';
import { PharmacyPrescriptionManagementComponent } from './overview/pages/pharmacy/prescription-management/pharmacy-prescription-management.component';
import { PharmacyPricingComponent } from './overview/pages/pharmacy/pricing/pharmacy-pricing.component';
import { PharmacyStockTrackingComponent } from './overview/pages/pharmacy/stock-tracking/pharmacy-stock-tracking.component';
import { PharmacyPurchaseOrdersComponent } from './overview/pages/pharmacy/purchase-orders/pharmacy-purchase-orders.component';
import { PharmacyExpiryAlertsComponent } from './overview/pages/pharmacy/expiry-alerts/pharmacy-expiry-alerts.component';
import { PharmacySuppliersComponent } from './overview/pages/pharmacy/suppliers/pharmacy-suppliers.component';
import { OtcDispensaryComponent } from './overview/pages/pharmacy/otc-dispensary/otc-dispensary.component';
// HR Components
import { EmployeeRegistrationComponent } from './overview/pages/hr/employee-registration/employee-registration.component';
import { DepartmentAssignmentComponent } from './overview/pages/hr/department-assignment/department-assignment.component';
import { AttendanceComponent } from './overview/pages/hr/attendance/attendance.component';
import { LeaveManagementComponent } from './overview/pages/hr/leave/leave-management.component';
import { PayrollComponent } from './overview/pages/hr/payroll/payroll.component';
import { PerformanceTrackingComponent } from './overview/pages/hr/performance/performance-tracking.component';
// Finance Components
import { ServiceChargesComponent } from './overview/pages/finance/service-charges/service-charges.component';
import { PatientBillingComponent } from './overview/pages/finance/patient-billing/patient-billing.component';
import { CashierComponent } from './overview/pages/finance/cashier/cashier.component';
import { InsuranceBillingComponent } from './overview/pages/finance/insurance-billing/insurance-billing.component';
import { RefundsComponent } from './overview/pages/finance/refunds/refunds.component';
import { ExpensesComponent } from './overview/pages/finance/expenses/expenses.component';
import { ExpenseCategoriesComponent } from './overview/pages/finance/expense-categories/expense-categories.component';
import { ExpenseAccountsComponent } from './overview/pages/finance/expense-accounts/expense-accounts.component';
import { ExpenseTransactionsComponent } from './overview/pages/finance/expense-transactions/expense-transactions.component';
import { LoanManagementComponent } from './overview/pages/finance/loan-management/loan-management.component';
import { IncomeManagementComponent } from './overview/pages/finance/income-management/income-management.component';
import { IncomeTransactionsComponent } from './overview/pages/finance/income-transactions/income-transactions.component';
import { IncomeCategoriesComponent } from './overview/pages/finance/income-categories/income-categories.component';
import { IncomeAccountsComponent } from './overview/pages/finance/income-accounts/income-accounts.component';
import { ExpenseAnalyticsComponent } from './overview/pages/finance/expense-analytics/expense-analytics.component';
import { BalanceSheetComponent } from './overview/pages/finance/balance-sheet/balance-sheet.component';
import { FinanceReportsComponent } from './overview/pages/finance/reports/finance-reports.component';
// Reports Components
import { DepartmentalReportsComponent } from './overview/pages/reports/departmental/departmental-reports.component';
import { RevenueReportsComponent } from './overview/pages/reports/revenue/revenue-reports.component';
import { DrugUtilizationComponent } from './overview/pages/reports/drug-utilization/drug-utilization.component';
import { LabStatisticsComponent } from './overview/pages/reports/lab-statistics/lab-statistics.component';
import { DailyAdmissionsComponent } from './overview/pages/reports/daily-admissions/daily-admissions.component';
import { RegulatoryReportsComponent } from './overview/pages/reports/regulatory-reports/regulatory-reports.component';
import { InventorySummaryComponent } from './overview/pages/reports/inventory-summary/inventory-summary.component';
// Administration Components
import { UserManagementComponent } from './overview/pages/administration/user-management/user-management.component';
import { AccessPermissionsComponent } from './overview/pages/administration/permissions/access-permissions.component';
import { DepartmentSetupComponent } from './overview/pages/administration/department-setup/department-setup.component';
import { SubscriptionComponent } from './overview/pages/administration/subscription/subscription.component';
import { SubscriptionPaymentComponent } from './overview/pages/administration/subscription/subscription-payment.component';
import { MobileMoneySettingsComponent } from './overview/pages/administration/subscription/mobile-money-settings.component';
import { BusinessSettingsComponent } from './overview/pages/administration/business-settings/business-settings.component';
import { SpecialPrivilegesComponent } from './overview/pages/administration/special-privileges/special-privileges.component';
import { SystemConfigurationComponent } from './overview/pages/administration/configuration/system-configuration.component';
import { DataBackupComponent } from './overview/pages/administration/backup/data-backup.component';
import { SystemDocumentationComponent } from './overview/pages/administration/system-documentation/system-documentation.component';
import { AuditLogsComponent } from './overview/pages/administration/audit-logs/audit-logs.component';
// Support Services Components
import { LaundryComponent } from './overview/pages/support-services/laundry/laundry.component';
import { KitchenDietComponent } from './overview/pages/support-services/kitchen/kitchen-diet.component';
import { TransportAmbulanceComponent } from './overview/pages/support-services/transport/transport-ambulance.component';
import { HousekeepingComponent } from './overview/pages/support-services/housekeeping/housekeeping.component';
import { MaintenanceRequestsComponent } from './overview/pages/support-services/maintenance/maintenance-requests.component';
// Insurance Components
import { InsuranceRegistrationComponent } from './overview/pages/insurance/registration/insurance-registration.component';
import { PreAuthorizationComponent } from './overview/pages/insurance/pre-authorization/pre-authorization.component';
import { ClaimSubmissionsComponent } from './overview/pages/insurance/claims/claim-submissions.component';
import { ClaimTrackingComponent } from './overview/pages/insurance/claims/claim-tracking.component';
import { CorporateBillingComponent } from './overview/pages/insurance/corporate-billing/corporate-billing.component';
// Telemedicine Components
import { OnlineConsultationsComponent } from './overview/pages/telemedicine/online-consultations/online-consultations.component';
import { EPrescriptionsComponent } from './overview/pages/telemedicine/e-prescriptions/e-prescriptions.component';
import { VideoSchedulingComponent } from './overview/pages/telemedicine/video-scheduling/video-scheduling.component';
import { RemoteMonitoringComponent } from './overview/pages/telemedicine/remote-monitoring/remote-monitoring.component';
import { PatientPortalComponent } from './overview/pages/telemedicine/patient-portal/patient-portal.component';
// Clinical Decision Support Components
import { DrugInteractionsComponent } from './overview/pages/clinical-decision-support/drug-interactions/drug-interactions.component';
import { DiseaseProtocolsComponent } from './overview/pages/clinical-decision-support/protocols/disease-protocols.component';
import { TreatmentGuidelinesComponent } from './overview/pages/clinical-decision-support/guidelines/treatment-guidelines.component';
import { PredictiveAnalyticsComponent } from './overview/pages/clinical-decision-support/predictive-analytics/predictive-analytics.component';
// Security & Compliance Components
import { DataEncryptionComponent } from './overview/pages/security-compliance/data-encryption/data-encryption.component';
import { AccessHistoryComponent } from './overview/pages/security-compliance/access-history/access-history.component';
import { RoleControlsComponent } from './overview/pages/security-compliance/role-controls/role-controls.component';
import { ComplianceReportsComponent } from './overview/pages/security-compliance/compliance-reports/compliance-reports.component';
// Specialized Modules Components
import { BloodDonationsComponent } from './overview/pages/blood-bank/donations/blood-donations.component';
import { BloodScreeningComponent } from './overview/pages/blood-bank/screening/blood-screening.component';
import { BloodInventoryComponent } from './overview/pages/blood-bank/inventory/blood-inventory.component';
import { BodyManagementComponent } from './overview/pages/mortuary/body-management/body-management.component';
import { AutopsyComponent } from './overview/pages/mortuary/autopsy/autopsy.component';
import { ReleaseTrackingComponent } from './overview/pages/mortuary/release-tracking/release-tracking.component';
import { TheatreScheduleComponent } from './overview/pages/theatre/schedule/theatre-schedule.component';
import { TheatreRecordsComponent } from './overview/pages/theatre/records/theatre-records.component';
import { TheatreManagementComponent } from './overview/pages/theatre/management/theatre-management.component';
import { DialysisSessionsComponent } from './overview/pages/dialysis/sessions/dialysis-sessions.component';
import { DialysisPatientDataComponent } from './overview/pages/dialysis/patient-data/dialysis-patient-data.component';
import { EquipmentMaintenanceComponent } from './overview/pages/equipment-maintenance/schedules/equipment-maintenance.component';
import { BusinessIntelligenceComponent } from './overview/pages/business-intelligence/dashboards/business-intelligence.component';
import { IntegrationHubComponent } from './overview/pages/integration-hub/external-lab/integration-hub.component';
// New components from old project
import { DentalComponent } from './dental/dental.component';
import { ExpiryDrugsComponent } from './expiry-drugs/expiry-drugs.component';
import { LabMobilePageComponent } from './lab-mobile-page/lab-mobile-page.component';
import { MessagesComponent } from './messages/messages.component';
import { HelpSupportComponent } from './help/help-support.component';
import { PatientVisitsListComponent } from './patient-visits-list/patient-visits-list.component';
import { SettingsPrivacyComponent } from './settings-privacy/settings-privacy.component';
import { StoreManagementComponent as StandaloneStoreManagementComponent } from './store-management/store-management.component';
import { LoginMobileComponent } from './auth/login-mobile/login-mobile.component';
import { GlobalFeedbackComponent } from './shared/global-feedback/global-feedback.component';
import { HmsLoadingComponent } from './shared/loading/hms-loading.component';
import { UnitSellingModelPickerComponent } from './shared/unit-selling-model-picker/unit-selling-model-picker.component';
import { SearchableSelectComponent } from './shared/searchable-select/searchable-select.component';
import { StandardDosagePickerComponent } from './shared/standard-dosage-picker/standard-dosage-picker.component';
import { ShopItemDosageRulesEditorComponent } from './shared/shop-item-dosage-rules-editor/shop-item-dosage-rules-editor.component';
import { TreatmentChartModalComponent } from './shared/treatment-chart-modal/treatment-chart-modal.component';
import { PdDspAdmCellComponent } from './shared/pd-dsp-adm-cell/pd-dsp-adm-cell.component';
import { GlobalFeedbackInterceptor } from './interceptors/global-feedback.interceptor';
import { NetworkConnectionInterceptor } from './interceptors/network-connection.interceptor';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { ServerConnectionComponent } from './server-connection/server-connection.component';
import { ApiConfigService } from './services/api-config.service';
import { DoctorAssistantComponent } from './doctor-assistant/doctor-assistant.component';

export function initializeApiConfig(apiConfig: ApiConfigService): () => Promise<void> {
  return () => apiConfig.initializeOnStartup();
}

 // Import the MatDialogModule

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    ProductsComponent,
    CartComponent,
    FooterComponent,
    ProductDetailsComponent,
    MensFashionComponent,
    CheckoutComponent,
    ItemManagementComponent,
    PopupComponent,
    LoginComponent,
    SignupComponent,
    ResetpasswordComponent,
    SendemailComponent,
    DashboardComponent,
    TestComponent,
    FormarrayexampleComponent,
    Login2Component,
    Login3Component,
    Login4Component,
    PatientComponent,
    CapitalizePipe,
    PatientVisitComponent,
    ServicesOfferedComponent,
    StockReceiveComponent,
    ScanComponent,
    LabComponent,
    PatientInfoComponent,
    VitalSignsComponent,
    PatientVisitContainerComponent,
    OverviewComponent,
    MainDashboardComponent,
    LabDashboardComponent,
    PatientDashboardComponent,
    FinanceDashboardComponent,
    InventoryDashboardComponent,
    OverviewReorderLevelsComponent,
    SuppliersComponent,
    AllPatientsComponent,
    LandingPageComponent,
    ServiceDetailComponent,
    SiteNavComponent,
    AboutPageComponent,
    BookAppointmentComponent,
    ContactPageComponent,
    AssetManagementComponent,
    StoreManagementComponent,
    StoreReportsComponent,
    StoreAnalyticsComponent,
    ConsultationsCenterComponent,
    ConsultationV2Component,
    ScanV2Component,
    LabV2Component,
    DentalV2Component,
    MchV2Component,
    MaternalChildHealthRequestsComponent,
    ConsultationPatientInfoComponent,
    ConsultationDetailsComponent,
    StockManagementComponent,
    ConsumableItemsComponent,
    StockTransferComponent,
    StockTrackingComponent,
    StockTakingComponent,
    StockVerificationComponent,
    StockInitializerComponent,
    OverviewStockReceiveComponent,
    StockBatchComponent,
    StockAdjustmentsComponent,
    ExpiredItemsComponent,
    ShopItemManagementComponent,
    OverviewShopItemReceiveComponent,
    ManufacturersComponent,
    ServicesManagementComponent,
    ServiceCategoriesComponent,
    ServiceTypesComponent,
    PatientGroupsComponent,
    // OPD Components
    ConsultationComponent,
    PrescriptionsComponent,
    InvestigationsComponent,
    DiagnosisComponent,
    FollowUpsComponent,
    // IPD Components
    BedManagementComponent,
    AdmissionsComponent,
    DischargesComponent,
    NursingNotesComponent,
    DoctorRoundsComponent,
    MedicationChartsComponent,
    ProceduresComponent,
    TransfersComponent,
    // Patient Management Additional
    PatientRegistrationComponent,
    PatientProfileComponent,
    VisitHistoryComponent,
    AppointmentSchedulingComponent,
    QueueManagementComponent,
    ReferralManagementComponent,
    // Laboratory Components
    LabTestRequestsComponent,
    SampleCollectionComponent,
    TestProcessingComponent,
    LabResultsComponent,
    LabReportsComponent,
    LabEquipmentTrackingComponent,
    // Radiology Components
    ScanRequestsComponent,
    RadiologyReportsComponent,
    PacsIntegrationComponent,
    RadiologistWorklistComponent,
    // Pharmacy Components
    PharmacyDispensingComponent,
    PharmacyPrescriptionManagementComponent,
    PharmacyPricingComponent,
    PharmacyStockTrackingComponent,
    PharmacyPurchaseOrdersComponent,
    PharmacyExpiryAlertsComponent,
    PharmacySuppliersComponent,
    OtcDispensaryComponent,
    // HR Components
    EmployeeRegistrationComponent,
    DepartmentAssignmentComponent,
    AttendanceComponent,
    LeaveManagementComponent,
    PayrollComponent,
    PerformanceTrackingComponent,
    // Finance Components
    ServiceChargesComponent,
    PatientBillingComponent,
    CashierComponent,
    InsuranceBillingComponent,
    RefundsComponent,
    ExpensesComponent,
    ExpenseCategoriesComponent,
    ExpenseAccountsComponent,
    ExpenseTransactionsComponent,
    LoanManagementComponent,
    IncomeManagementComponent,
    IncomeTransactionsComponent,
    IncomeCategoriesComponent,
    IncomeAccountsComponent,
    ExpenseAnalyticsComponent,
    BalanceSheetComponent,
    FinanceReportsComponent,
    // Reports Components
    DepartmentalReportsComponent,
    RevenueReportsComponent,
    DrugUtilizationComponent,
    LabStatisticsComponent,
    DailyAdmissionsComponent,
    RegulatoryReportsComponent,
    InventorySummaryComponent,
    // Administration Components
    UserManagementComponent,
    AccessPermissionsComponent,
    SubscriptionComponent,
    SubscriptionPaymentComponent,
    MobileMoneySettingsComponent,
    BusinessSettingsComponent,
    SpecialPrivilegesComponent,
    DepartmentSetupComponent,
    SystemConfigurationComponent,
    DataBackupComponent,
    SystemDocumentationComponent,
    AuditLogsComponent,
    // Support Services Components
    LaundryComponent,
    KitchenDietComponent,
    TransportAmbulanceComponent,
    HousekeepingComponent,
    MaintenanceRequestsComponent,
    // Insurance Components
    InsuranceRegistrationComponent,
    PreAuthorizationComponent,
    ClaimSubmissionsComponent,
    ClaimTrackingComponent,
    CorporateBillingComponent,
    // Telemedicine Components
    OnlineConsultationsComponent,
    EPrescriptionsComponent,
    VideoSchedulingComponent,
    RemoteMonitoringComponent,
    PatientPortalComponent,
    // Clinical Decision Support Components
    DrugInteractionsComponent,
    DiseaseProtocolsComponent,
    TreatmentGuidelinesComponent,
    PredictiveAnalyticsComponent,
    // Security & Compliance Components
    DataEncryptionComponent,
    AccessHistoryComponent,
    RoleControlsComponent,
    ComplianceReportsComponent,
    // Specialized Modules Components
    BloodDonationsComponent,
    BloodScreeningComponent,
    BloodInventoryComponent,
    BodyManagementComponent,
    AutopsyComponent,
    ReleaseTrackingComponent,
    TheatreScheduleComponent,
    TheatreRecordsComponent,
    TheatreManagementComponent,
    DialysisSessionsComponent,
    DialysisPatientDataComponent,
    EquipmentMaintenanceComponent,
    BusinessIntelligenceComponent,
    IntegrationHubComponent,
    // New components from old project
    DentalComponent,
    ExpiryDrugsComponent,
    LabMobilePageComponent,
    MessagesComponent,
    HelpSupportComponent,
    PatientVisitsListComponent,
    SettingsPrivacyComponent,
    StandaloneStoreManagementComponent,
    LoginMobileComponent,
    GlobalFeedbackComponent,
    HmsLoadingComponent,
    UnitSellingModelPickerComponent,
    SearchableSelectComponent,
    StandardDosagePickerComponent,
    ShopItemDosageRulesEditorComponent,
    TreatmentChartModalComponent,
    PdDspAdmCellComponent,
    UserProfileComponent,
    ServerConnectionComponent,
    DoctorAssistantComponent

    
  ],

  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    HttpClientModule,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    NgxPaginationModule,
    NgbModule,
    NgbCollapseModule,
    NgbTypeaheadModule,
    DecimalPipe,
    AsyncPipe,
    NgFor,
    UpperCasePipe,
    BrowserAnimationsModule,
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideStorage(() => getStorage()),
     
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApiConfig,
      deps: [ApiConfigService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: GlobalFeedbackInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: NetworkConnectionInterceptor,
      multi: true
    }
  ],

 
  bootstrap: [
    AppComponent
  ]
  

})
export class AppModule { }
