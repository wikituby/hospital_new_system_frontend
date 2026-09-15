import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { ApiConfigService } from '../../../services/api-config.service';
import { ThemeService } from '../../../services/theme.service';
import { AccessControlService } from '../../../services/access-control.service';

declare const Chart: any;

@Component({
  selector: 'app-main-dashboard',
  templateUrl: './main-dashboard.component.html',
  styleUrls: ['./main-dashboard.component.css']
})
export class MainDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  isLoading: boolean = true;
  errorMessage: string = '';
  isDarkMode: boolean = false;
  chartsReady: boolean = false;

  totalServices: number = 0;
  totalCategories: number = 0;
  totalPatients: number = 0;
  totalItems: number = 0;
  totalVisits: number = 0;
  totalVisitsLast30: number = 0;
  totalReorderItems: number = 0;
  totalPaymentsReceived: number = 0;
  totalPaymentsReceivedFormatted: string = '0.00';

  patientsTrend: number[] = [];
  itemsTrend: number[] = [];
  servicesTrend: number[] = [];
  visitsTrend: number[] = [];
  paymentsTrend: number[] = [];
  reorderTrend: number[] = [];

  patientsPath: string = '';
  itemsPath: string = '';
  servicesPath: string = '';
  visitsPath: string = '';
  paymentsPath: string = '';
  reorderPath: string = '';

  patientsAreaPath: string = '';
  servicesAreaPath: string = '';
  visitsAreaPath: string = '';
  paymentsAreaPath: string = '';
  reorderAreaPath: string = '';

  itemsCategoryLabels: string[] = [];
  itemsCategoryData: number[] = [];

  patientsAgeLabels: string[] = [];
  patientsAgeData: number[] = [];

  // Hospital-specific metrics
  todayAppointments: number = 0;
  pendingAppointments: number = 0;
  completedAppointments: number = 0;
  
  admittedPatients: number = 0;
  newAdmissionsToday: number = 0;
  dischargesToday: number = 0;
  
  pendingLabTests: number = 0;
  completedLabTests: number = 0;
  pendingScanTests: number = 0;
  completedScanTests: number = 0;
  
  criticalStockItems: number = 0;
  nearExpiryItems: number = 0;
  lowConfidenceStockItems: number = 0;
  
  todayRevenue: number = 0;
  todayRevenueFormatted: string = '0.00';
  weekRevenue: number = 0;
  weekRevenueFormatted: string = '0.00';
  outstandingPayments: number = 0;
  outstandingPaymentsFormatted: string = '0.00';
  
  emergencyCases: number = 0;
  criticalPatients: number = 0;
  
  recentActivities: any[] = [];
  upcomingAppointments: any[] = [];

  private readonly dashboardSectionsStorageKey = 'mainDashboardSectionExpanded';
  private readonly allDashboardSectionIds = [
    'summary',
    'pendingTasks',
    'quickLinks',
    'hospitalMetrics',
    'charts',
    'appointments',
    'activities',
  ] as const;
  expandedDashboardSections = new Set<string>([...this.allDashboardSectionIds]);

  quickLinks = [
    { label: 'Patient Registry', icon: 'bi-people', route: '/overview/all-patients', color: '#2563eb' },
    { label: 'Queue', icon: 'bi-list-ol', route: '/overview/queue-management', color: '#0d9488' },
    { label: 'Laboratory', icon: 'bi-flask', route: '/overview/lab-v2', color: '#7c3aed' },
    { label: 'OTC Dispensary', icon: 'bi-capsule', route: '/overview/otc-dispensary', color: '#2acc7b' },
    { label: 'Ultrasound Scan', icon: 'bi-camera', route: '/overview/scan-v2', color: '#db2777' },
    { label: 'Cashier', icon: 'bi-cash-register', route: '/overview/cashier', color: '#059669' },
    { label: 'Expenses', icon: 'bi-wallet2', route: '/overview/expenses', color: '#d97706' },
    { label: 'Stock Receive', icon: 'bi-box-arrow-in-down', route: '/overview/stock-receive', color: '#0891b2' },
    { label: 'Stock Verification', icon: 'bi-clipboard2-check', route: '/overview/stock-verification', color: '#0d9488' },
    { label: 'Stock Initializer', icon: 'bi-box-arrow-in-right', route: '/overview/stock-initializer', color: '#2563eb' },
    { label: 'Services', icon: 'bi-heart-pulse', route: '/overview/services-management', color: '#4f46e5' },
  ];

  private themeSubscription?: Subscription;
  private apiReadySub?: Subscription;
  private lastLoadedApiBase = '';

  constructor(
    private api: ApiService,
    private apiConfig: ApiConfigService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
    private accessControl: AccessControlService
  ) {}

  ngOnInit(): void {
    this.loadDashboardSectionState();

    this.themeSubscription = this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    // Wait for overview shell to paint before API + charts work.
    setTimeout(() => this.loadCounts(), 250);

    this.apiReadySub = this.apiConfig.state$
      .pipe(filter((state) => state === 'ready'))
      .subscribe(() => {
        const base = this.apiConfig.getBaseUrl();
        if (base && base !== this.lastLoadedApiBase) {
          this.loadCounts();
        }
      });
  }

  ngOnDestroy(): void {
    this.themeSubscription?.unsubscribe();
    this.apiReadySub?.unsubscribe();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data loads
  }

  navigateTo(route: string): void {
    const normalized = (route || '').replace(/^\//, '');
    const parts = normalized.split('/').filter(Boolean);
    const segment = parts[parts.length - 1];
    if (segment && !this.accessControl.canAccessPage(segment)) {
      window.alert(
        'You are not authorised to view content on this page. Contact admin for permission.'
      );
      return;
    }
    this.router.navigate([route]);
  }

  /** Financial summary cards on the main dashboard are MD-only. */
  isMdUser(): boolean {
    const role = (sessionStorage.getItem('userrole') || '').toLowerCase().trim();
    return role === 'md';
  }

  isDashboardSectionExpanded(sectionId: string): boolean {
    return this.expandedDashboardSections.has(sectionId);
  }

  toggleDashboardSection(sectionId: string): void {
    if (this.expandedDashboardSections.has(sectionId)) {
      this.expandedDashboardSections.delete(sectionId);
    } else {
      this.expandedDashboardSections.add(sectionId);
    }
    this.saveDashboardSectionState();
  }

  private loadDashboardSectionState(): void {
    try {
      const raw = localStorage.getItem(this.dashboardSectionsStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const valid = parsed.filter(
        (id): id is string => typeof id === 'string' && this.allDashboardSectionIds.includes(id as any)
      );
      if (valid.length) {
        this.expandedDashboardSections = new Set(valid);
      }
    } catch {
      // ignore invalid saved state
    }
  }

  private saveDashboardSectionState(): void {
    localStorage.setItem(
      this.dashboardSectionsStorageKey,
      JSON.stringify([...this.expandedDashboardSections])
    );
  }

  getTimeAgo(dateStr: any): string {
    if (!dateStr) return '';
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  getPriorityClass(priority: string): string {
    const p = (priority || '').toLowerCase();
    if (p.includes('emergency') || p.includes('urgent')) return 'priority-urgent';
    if (p.includes('high')) return 'priority-high';
    return 'priority-normal';
  }

  get pendingTasks(): { label: string; count: number; icon: string; route: string; tone: string; isAmount?: boolean }[] {
    const tasks = [
      { label: 'Pending Lab Tests', count: this.pendingLabTests, icon: 'bi-flask', route: '/overview/lab-v2', tone: 'purple' },
      { label: 'Pending Scans', count: this.pendingScanTests, icon: 'bi-camera', route: '/overview/scan-v2', tone: 'blue' },
      { label: 'Reorder Items', count: this.totalReorderItems, icon: 'bi-exclamation-triangle', route: '/overview/reorder-levels', tone: 'orange' },
      { label: 'Outstanding Payments', count: this.outstandingPayments, icon: 'bi-cash-stack', route: '/overview/patient-billing', tone: 'teal', isAmount: true },
      { label: 'Near Expiry Stock', count: this.nearExpiryItems, icon: 'bi-hourglass-split', route: '/overview/expired-items', tone: 'red' },
      { label: 'Low Confidence Stock', count: this.lowConfidenceStockItems, icon: 'bi-shield-exclamation', route: '/overview/stock-verification', tone: 'red' },
    ];
    if (!this.isMdUser()) {
      return tasks.filter((t) => t.label !== 'Outstanding Payments');
    }
    return tasks;
  }

  formatTaskCount(task: { count: number; isAmount?: boolean }): string {
    if (task.isAmount) {
      return this.outstandingPaymentsFormatted;
    }
    return String(task.count ?? 0);
  }

  openQuickLink(route: string): void {
    this.router.navigate([route]);
  }

  private loadStockVerificationAlerts(): void {
    this.api.getStockVerificationDashboard().subscribe({
      next: (data: any) => {
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        this.lowConfidenceStockItems = rows.filter((row: any) =>
          (row?.currentPreview?.confidenceLevelCode || '').toUpperCase() === 'LOW'
        ).length;
        this.cdr.detectChanges();
      },
      error: () => {
        this.lowConfidenceStockItems = 0;
      }
    });
  }

  private loadCounts(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.lastLoadedApiBase = this.apiConfig.getBaseUrl();

    this.api.getDashboardSummary().subscribe({
      next: (summary) => {
        this.applySummaryResponse(summary || {});
        this.loadStockVerificationAlerts();
        this.isLoading = false;
        this.chartsReady = true;
        this.cdr.detectChanges();
        this.scheduleChartRender();
      },
      error: (err) => this.handleDashboardLoadError(err),
    });
  }

  private applySummaryResponse(summary: any): void {
    this.totalServices = Number(summary.totalServices) || 0;
    this.totalCategories = Number(summary.totalCategories) || 0;
    this.totalPatients = Number(summary.totalPatients) || 0;
    this.totalItems = Number(summary.totalItems) || 0;
    this.totalVisits = Number(summary.totalVisits) || 0;
    this.totalVisitsLast30 = Number(summary.totalVisitsLast30) || 0;
    this.totalReorderItems = Number(summary.totalReorderItems) || 0;

    this.patientsTrend = this.toNumberArray(summary.patientsTrend);
    this.itemsTrend = this.toNumberArray(summary.itemsTrend);
    this.servicesTrend = this.toNumberArray(summary.servicesTrend);
    this.visitsTrend = this.toNumberArray(summary.visitsTrend);
    this.paymentsTrend = this.toNumberArray(summary.paymentsTrend);
    this.reorderTrend = this.toNumberArray(summary.reorderTrend);

    this.itemsCategoryLabels = Array.isArray(summary.itemsCategoryLabels) ? summary.itemsCategoryLabels : [];
    this.itemsCategoryData = this.toNumberArray(summary.itemsCategoryData);
    this.patientsAgeLabels = Array.isArray(summary.patientsAgeLabels) ? summary.patientsAgeLabels : [];
    this.patientsAgeData = this.toNumberArray(summary.patientsAgeData);

    this.todayAppointments = Number(summary.todayAppointments) || 0;
    this.pendingAppointments = Number(summary.pendingAppointments) || 0;
    this.completedAppointments = Number(summary.completedAppointments) || 0;
    this.admittedPatients = Number(summary.admittedPatients) || 0;
    this.newAdmissionsToday = Number(summary.newAdmissionsToday) || 0;
    this.dischargesToday = Number(summary.dischargesToday) || 0;
    this.pendingLabTests = Number(summary.pendingLabTests) || 0;
    this.completedLabTests = Number(summary.completedLabTests) || 0;
    this.pendingScanTests = Number(summary.pendingScanTests) || 0;
    this.completedScanTests = Number(summary.completedScanTests) || 0;
    this.criticalStockItems = Number(summary.criticalStockItems) || 0;
    this.nearExpiryItems = Number(summary.nearExpiryItems) || 0;
    this.emergencyCases = Number(summary.emergencyCases) || 0;
    this.criticalPatients = Number(summary.criticalPatients) || 0;

    this.totalPaymentsReceived = Number(summary.totalPaymentsReceived) || 0;
    this.todayRevenue = Number(summary.todayRevenue) || 0;
    this.weekRevenue = Number(summary.weekRevenue) || 0;
    this.outstandingPayments = Number(summary.outstandingPayments) || 0;

    this.totalPaymentsReceivedFormatted = this.totalPaymentsReceived.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    this.todayRevenueFormatted = this.todayRevenue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    this.weekRevenueFormatted = this.weekRevenue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    this.outstandingPaymentsFormatted = this.outstandingPayments.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    this.recentActivities = Array.isArray(summary.recentActivities) ? summary.recentActivities : [];
    this.upcomingAppointments = Array.isArray(summary.upcomingAppointments) ? summary.upcomingAppointments : [];

    this.buildSparklinePaths();
  }

  private toNumberArray(value: any): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => Number(entry) || 0);
  }

  private buildSparklinePaths(): void {
    const buildPath = (data: number[], width = 140, height = 36, padding = 2): string => {
      if (!data.length) return '';
      const maxVal = Math.max(...data, 1);
      const step = (width - padding * 2) / (data.length - 1 || 1);
      return data
        .map((v, i) => {
          const x = padding + i * step;
          const y = height - padding - (v / maxVal) * (height - padding * 2);
          return `${i === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' ');
    };
    const toArea = (d: string, width = 140, height = 36): string =>
      d ? `${d} L ${width},${height} L 0,${height} Z` : '';

    this.patientsPath = buildPath(this.patientsTrend);
    this.itemsPath = buildPath(this.itemsTrend);
    this.servicesPath = buildPath(this.servicesTrend);
    this.visitsPath = buildPath(this.visitsTrend);
    this.paymentsPath = buildPath(this.paymentsTrend);
    this.reorderPath = buildPath(this.reorderTrend);

    this.patientsAreaPath = toArea(this.patientsPath);
    this.servicesAreaPath = toArea(this.servicesPath);
    this.visitsAreaPath = toArea(this.visitsPath);
    this.paymentsAreaPath = toArea(this.paymentsPath);
    this.reorderAreaPath = toArea(this.reorderPath);
  }

  private scheduleChartRender(): void {
    const run = () => requestAnimationFrame(() => this.renderCharts());
    const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof win.requestIdleCallback === 'function') {
      win.requestIdleCallback(run, { timeout: 600 });
    } else {
      setTimeout(run, 150);
    }
  }

  private handleDashboardLoadError(err: any): void {
    console.error('API Error:', err);
    if (err?.status === 0) {
      this.errorMessage =
        'Cannot reach the clinic server (network blocked or offline). Use Change server, or check that the API is running.';
    } else {
      this.errorMessage =
        'Failed to load summary data. ' +
        (err?.error?.message || err?.message || 'Please check your connection and try again.');
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private generateTrendData(baseValue: number, months: number): number[] {
    const data: number[] = [];
    const avgValue = baseValue / 2;
    
    for (let i = 0; i < months; i++) {
      const t = (i / months) * Math.PI * 2;
      const wave1 = Math.sin(t) * (avgValue * 0.3);
      const wave2 = Math.cos(t * 1.5) * (avgValue * 0.2);
      const noise = (Math.random() - 0.5) * (avgValue * 0.1);
      
      const value = avgValue + wave1 + wave2 + noise;
      data.push(Math.max(0, Math.round(value)));
    }
    
    return data;
  }

  private renderCharts(): void {
    const monthLabels = ['M-5','M-4','M-3','M-2','M-1','Now'];

    const byId = (id: string) => document.getElementById(id) as HTMLCanvasElement | null;

    const patientsEl = byId('patientsLine');
    if (patientsEl && (window as any).Chart) {
      new Chart(patientsEl, {
        type: 'line',
        data: { labels: monthLabels, datasets: [{ data: this.patientsTrend, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', tension: 0.3, fill: true, pointRadius: 0 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
      });
    }

    const patientsAgeEl = byId('patientsAgePie');
    if (patientsAgeEl && (window as any).Chart) {
      new Chart(patientsAgeEl.getContext('2d') as any, {
        type: 'pie',
        data: {
          labels: this.patientsAgeLabels,
          datasets: [{
            data: this.patientsAgeData,
            backgroundColor: ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4']
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const itemsEl = byId('itemsBar');
    if (itemsEl && (window as any).Chart) {
      const ctx = itemsEl.getContext('2d') as any;
      
      const gradient1 = ctx.createLinearGradient(0, 0, 0, itemsEl.height || 250);
      gradient1.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
      gradient1.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
      
      const gradient2 = ctx.createLinearGradient(0, 0, 0, itemsEl.height || 250);
      gradient2.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
      gradient2.addColorStop(1, 'rgba(16, 185, 129, 0.05)');

      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      const categoryEntries = this.itemsCategoryLabels.map((label, i) => ({
        label,
        value: this.itemsCategoryData[i]
      })).sort((a, b) => b.value - a.value);
      
      const datasets: any[] = [];
      
      if (categoryEntries.length > 0) {
        const trend1 = this.generateTrendData(categoryEntries[0].value, 12);
        datasets.push({
          label: categoryEntries[0].label,
          data: trend1,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: gradient1,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2
        });
      }
      
      if (categoryEntries.length > 1) {
        const trend2 = this.generateTrendData(categoryEntries[1].value, 12);
        datasets.push({
          label: categoryEntries[1].label,
          data: trend2,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: gradient2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2
        });
      }

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { 
              display: true,
              position: 'top',
              align: 'start',
              labels: {
                usePointStyle: true,
                pointStyle: 'circle',
                padding: 15,
                font: { size: 12, weight: '500' },
                color: '#64748b'
              }
            }, 
            tooltip: { 
              enabled: true,
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              titleColor: '#1e293b',
              bodyColor: '#475569',
              borderColor: '#e2e8f0',
              borderWidth: 1,
              padding: 12,
              displayColors: true,
              callbacks: {
                label: function(context: any) {
                  return context.dataset.label + ': ' + context.parsed.y + ' items';
                }
              }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          },
          scales: {
            x: {
              grid: { display: false, drawBorder: false },
              ticks: { color: '#94a3b8', font: { size: 11 }, padding: 8 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
              ticks: { 
                color: '#94a3b8',
                font: { size: 11 },
                padding: 8,
                callback: function(value: any) {
                  return value + ' items';
                }
              }
            }
          }
        }
      });
    }

    const servicesEl = byId('servicesPie');
    if (servicesEl && (window as any).Chart) {
      const total = this.totalServices || 1;
      const cat = this.totalCategories || Math.floor(total * 0.6);
      const rest = Math.max(total - cat, 0);
      new Chart(servicesEl.getContext('2d') as any, {
        type: 'pie',
        data: { labels: ['Categories','Other'], datasets: [{ data: [cat, rest], backgroundColor: ['#a855f7','#d1c4f3'] }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }

    const visitsEl = byId('visitsLine');
    if (visitsEl && (window as any).Chart) {
      new Chart(visitsEl, {
        type: 'line',
        data: { labels: monthLabels, datasets: [{ data: this.visitsTrend, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)', tension: 0.3, fill: true, pointRadius: 0 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
      });
    }
  }
}
