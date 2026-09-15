import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { AccessControlService } from '../../../../services/access-control.service';
import { ThemeService } from '../../../../services/theme.service';
import { AppAccessPage } from '../../../../config/app-access-pages';
import { AppAccessEndpoint } from '../../../../config/app-access-endpoints';
import { AppAccessComponent, componentFullKey } from '../../../../config/app-access-components';

@Component({
  selector: 'app-access-permissions',
  templateUrl: './access-permissions.component.html',
  styleUrls: ['./access-permissions.component.css']
})
export class AccessPermissionsComponent implements OnInit {
  isDarkMode = false;
  searchQuery = '';
  isLoading = false;
  isSaving = false;
  responseMessage = '';
  responseColor = '';

  panelMode: 'user' | 'role' = 'user';

  usersList: any[] = [];
  selectedUser: any = null;
  selectedPageKeys = new Set<string>();
  hiddenComponentKeys = new Set<string>();
  pageGroups: { group: string; pages: AppAccessPage[] }[] = [];
  accessMode: 'full' | 'custom' = 'full';
  pageSearchQuery = '';
  expandedGroups = new Set<string>();

  rolesList: string[] = [];
  selectedRole = '';
  selectedEndpointKeys = new Set<string>();
  endpointGroups: { group: string; endpoints: AppAccessEndpoint[] }[] = [];
  endpointSearchQuery = '';
  expandedEndpointGroups = new Set<string>();
  roleAccessLoading = false;

  showPageConfigModal = false;
  pageConfigTarget: AppAccessPage | null = null;
  pageConfigGrantPage = true;
  pageConfigFullComponents = true;
  pageConfigComponentVisible = new Map<string, boolean>();

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private api: ApiService,
    private accessControl: AccessControlService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login4']);
      return;
    }
    if (!this.accessControl.canManageAccessControl()) {
      this.router.navigate(['/overview']);
      return;
    }

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.pageGroups = this.accessControl.getPagesByGroup();
    this.endpointGroups = this.accessControl.getEndpointsByGroup();
    this.expandAllGroups();
    this.expandAllEndpointGroups();
    this.loadUsers();
    this.loadRoles();
  }

  setPanelMode(mode: 'user' | 'role'): void {
    if (this.panelMode === mode) {
      return;
    }
    this.panelMode = mode;
    this.responseMessage = '';
  }

  expandAllGroups(): void {
    this.expandedGroups = new Set(this.pageGroups.map(g => g.group));
  }

  collapseAllGroups(): void {
    this.expandedGroups = new Set<string>();
  }

  expandAllEndpointGroups(): void {
    this.expandedEndpointGroups = new Set(this.endpointGroups.map(g => g.group));
  }

  collapseAllEndpointGroups(): void {
    this.expandedEndpointGroups = new Set<string>();
  }

  togglePermissionGroup(groupName: string): void {
    const next = new Set(this.expandedGroups);
    if (next.has(groupName)) {
      next.delete(groupName);
    } else {
      next.add(groupName);
    }
    this.expandedGroups = next;
  }

  toggleEndpointGroup(groupName: string): void {
    const next = new Set(this.expandedEndpointGroups);
    if (next.has(groupName)) {
      next.delete(groupName);
    } else {
      next.add(groupName);
    }
    this.expandedEndpointGroups = next;
  }

  isGroupExpanded(groupName: string): boolean {
    return this.expandedGroups.has(groupName);
  }

  isEndpointGroupExpanded(groupName: string): boolean {
    return this.expandedEndpointGroups.has(groupName);
  }

  grantedCountInGroup(pages: AppAccessPage[]): number {
    return pages.filter(p => this.isPageSelected(p.key)).length;
  }

  grantedEndpointsInGroup(endpoints: AppAccessEndpoint[]): number {
    return endpoints.filter(e => this.isEndpointSelected(e.key)).length;
  }

  get filteredUsers(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.usersList;
    }
    return this.usersList.filter(user =>
      (user.username || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q) ||
      (user.role || '').toLowerCase().includes(q)
    );
  }

  get filteredRoles(): string[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.rolesList;
    }
    return this.rolesList.filter(r => r.toLowerCase().includes(q));
  }

  get restrictedUserCount(): number {
    return this.usersList.filter(u => this.hasRestrictions(u)).length;
  }

  get pageConfigComponents(): AppAccessComponent[] {
    if (!this.pageConfigTarget) {
      return [];
    }
    return this.accessControl.getComponentsForPage(this.pageConfigTarget.key);
  }

  get pageConfigHasComponents(): boolean {
    return this.pageConfigComponents.length > 0;
  }

  openPageConfig(page: AppAccessPage, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.selectedUser || !this.isCustomAccessMode) {
      return;
    }
    this.pageConfigTarget = page;
    this.pageConfigGrantPage = this.isPageSelected(page.key);
    const frozenCount = this.accessControl.getComponentsForPage(page.key).filter((c) =>
      this.isComponentFrozen(page.key, c.key)
    ).length;
    this.pageConfigFullComponents = this.pageConfigGrantPage && frozenCount === 0;
    this.pageConfigComponentVisible = new Map(
      this.accessControl.getComponentsForPage(page.key).map((c) => [
        c.key,
        !this.isComponentFrozen(page.key, c.key),
      ])
    );
    this.showPageConfigModal = true;
  }

  closePageConfigModal(): void {
    this.showPageConfigModal = false;
    this.pageConfigTarget = null;
  }

  applyPageConfig(): void {
    if (!this.pageConfigTarget) {
      return;
    }
    const pageKey = this.pageConfigTarget.key;
    const nextPages = new Set(this.selectedPageKeys);
    const nextHidden = new Set(this.hiddenComponentKeys);

    if (this.pageConfigGrantPage) {
      nextPages.add(pageKey);
      if (this.pageConfigFullComponents || !this.pageConfigHasComponents) {
        for (const fullKey of Array.from(nextHidden)) {
          if (fullKey.startsWith(`${pageKey}.`)) {
            nextHidden.delete(fullKey);
          }
        }
      } else {
        for (const component of this.pageConfigComponents) {
          const fullKey = componentFullKey(pageKey, component.key);
          const visible = this.pageConfigComponentVisible.get(component.key) !== false;
          if (visible) {
            nextHidden.delete(fullKey);
          } else {
            nextHidden.add(fullKey);
          }
        }
      }
    } else {
      nextPages.delete(pageKey);
      for (const fullKey of Array.from(nextHidden)) {
        if (fullKey.startsWith(`${pageKey}.`)) {
          nextHidden.delete(fullKey);
        }
      }
    }

    this.selectedPageKeys = nextPages;
    this.hiddenComponentKeys = nextHidden;
    this.closePageConfigModal();
  }

  setPageConfigFullComponents(full: boolean): void {
    this.pageConfigFullComponents = full;
    if (full) {
      for (const component of this.pageConfigComponents) {
        this.pageConfigComponentVisible.set(component.key, true);
      }
    }
  }

  togglePageConfigComponent(componentKey: string, visible: boolean): void {
    this.pageConfigComponentVisible.set(componentKey, visible);
    const allVisible = this.pageConfigComponents.every(
      (c) => this.pageConfigComponentVisible.get(c.key) !== false
    );
    this.pageConfigFullComponents = allVisible;
  }

  pageAccessSummary(page: AppAccessPage): string {
    if (!this.isCustomAccessMode) {
      return 'Included in full access';
    }
    if (!this.isPageSelected(page.key)) {
      return 'No access';
    }
    const components = this.accessControl.getComponentsForPage(page.key);
    if (!components.length) {
      return 'Full page access';
    }
    const frozen = components.filter((c) => this.isComponentFrozen(page.key, c.key)).length;
    if (frozen === 0) {
      return 'Full page access';
    }
    if (frozen === components.length) {
      return 'Page access — all components hidden';
    }
    return `Partial — ${frozen} component(s) hidden`;
  }

  isComponentFrozen(pageKey: string, componentKey: string): boolean {
    return this.hiddenComponentKeys.has(componentFullKey(pageKey, componentKey));
  }

  get totalManageablePages(): number {
    return this.accessControl.getManageablePages().length;
  }

  get totalManageableEndpoints(): number {
    return this.accessControl.getManageableEndpoints().length;
  }

  get selectedPageCount(): number {
    return this.selectedPageKeys.size;
  }

  get selectedEndpointCount(): number {
    return this.selectedEndpointKeys.size;
  }

  get isCustomAccessMode(): boolean {
    return this.accessMode === 'custom';
  }

  get accessModeLabel(): string {
    if (!this.selectedUser) {
      return '';
    }
    return this.isCustomAccessMode
      ? `Limited — ${this.selectedPageCount} page(s) granted`
      : 'Full access — all overview pages';
  }

  get filteredPageGroups(): { group: string; pages: AppAccessPage[] }[] {
    const q = this.pageSearchQuery.trim().toLowerCase();
    if (!q) {
      return this.pageGroups;
    }
    return this.pageGroups
      .map(g => ({
        group: g.group,
        pages: g.pages.filter(
          p => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.pages.length > 0);
  }

  get filteredEndpointGroups(): { group: string; endpoints: AppAccessEndpoint[] }[] {
    const q = this.endpointSearchQuery.trim().toLowerCase();
    if (!q) {
      return this.endpointGroups;
    }
    return this.endpointGroups
      .map(g => ({
        group: g.group,
        endpoints: g.endpoints.filter(
          e => e.label.toLowerCase().includes(q) || e.key.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.endpoints.length > 0);
  }

  get grantedPagesPreview(): AppAccessPage[] {
    const keys = new Set(this.selectedPageKeys);
    return this.accessControl
      .getManageablePages()
      .filter(p => keys.has(p.key) && p.key !== 'main-dashboard');
  }

  get grantedEndpointsPreview(): AppAccessEndpoint[] {
    const keys = new Set(this.selectedEndpointKeys);
    return this.accessControl.getManageableEndpoints().filter(e => keys.has(e.key));
  }

  loadUsers(): void {
    this.isLoading = true;
    this.api.getAllUsers().subscribe({
      next: (response: any) => {
        this.applyUsersList(response);
        this.isLoading = false;
        this.mergeRolesFromUsers();
      },
      error: () => {
        this.usersList = [];
        this.isLoading = false;
        this.showFeedback('Failed to load users', 'error');
      }
    });
  }

  loadRoles(): void {
    this.api.getAllRoles().subscribe({
      next: (res: any) => {
        const names: string[] = [];
        const rows = Array.isArray(res) ? res : [];
        for (const row of rows) {
          const n = (row?.name ?? row?.role ?? row ?? '').toString().trim();
          if (n) {
            names.push(n);
          }
        }
        this.rolesList = this.uniqueRoles([...this.rolesList, ...names]);
        this.mergeRolesFromUsers();
      },
      error: () => {
        this.mergeRolesFromUsers();
      }
    });
  }

  private mergeRolesFromUsers(): void {
    const fromUsers = this.usersList
      .map(u => (u?.role ?? '').toString().trim())
      .filter(Boolean);
    this.rolesList = this.uniqueRoles([...this.rolesList, ...fromUsers]);
  }

  private uniqueRoles(roles: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of roles) {
      const key = r.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  selectUser(user: any): void {
    this.selectedUser = user;
    const raw = String(user?.allowedPageRoutes ?? '').trim();
    const full = this.accessControl.isFullAccessCsv(raw);
    const keys = full ? [] : this.accessControl.parsePageKeysCsv(raw);
    this.selectedPageKeys = new Set(keys);
    this.hiddenComponentKeys = this.accessControl.parseHiddenComponentsCsv(
      user?.hiddenPageComponents || ''
    );
    this.accessMode = full ? 'full' : 'custom';
    this.pageSearchQuery = '';
    this.expandAllGroups();
    this.responseMessage = '';
    this.closePageConfigModal();
  }

  selectRole(role: string): void {
    this.selectedRole = role;
    this.selectedEndpointKeys = new Set<string>();
    this.endpointSearchQuery = '';
    this.expandAllEndpointGroups();
    this.responseMessage = '';
    this.roleAccessLoading = true;
    this.api.getRoleEndpointAccess(role).subscribe({
      next: (data: any) => {
        const keys = this.accessControl.parseEndpointKeys(data?.endpointKeys ?? data?.allowedEndpointKeys);
        this.selectedEndpointKeys = new Set(keys);
        this.roleAccessLoading = false;
      },
      error: () => {
        this.roleAccessLoading = false;
        this.showFeedback('Failed to load role endpoint access', 'error');
      }
    });
  }

  clearSelection(): void {
    if (this.panelMode === 'user') {
      this.selectedUser = null;
      this.selectedPageKeys = new Set<string>();
      this.hiddenComponentKeys = new Set<string>();
      this.accessMode = 'full';
      this.pageSearchQuery = '';
      this.expandAllGroups();
      this.closePageConfigModal();
    } else {
      this.selectedRole = '';
      this.selectedEndpointKeys = new Set<string>();
      this.endpointSearchQuery = '';
      this.expandAllEndpointGroups();
    }
  }

  setAccessMode(mode: 'full' | 'custom'): void {
    this.accessMode = mode;
    if (mode === 'full') {
      this.selectedPageKeys = new Set<string>();
      this.hiddenComponentKeys = new Set<string>();
      this.closePageConfigModal();
      return;
    }
    if (this.selectedPageKeys.size === 0) {
      this.selectedPageKeys = new Set(['main-dashboard']);
    }
  }

  pageAccessLabel(key: string): string {
    if (!this.isCustomAccessMode) {
      return 'Included in full access';
    }
    return this.isPageSelected(key) ? 'Access granted' : 'No access';
  }

  isPageSelected(key: string): boolean {
    return this.selectedPageKeys.has(key);
  }

  isEndpointSelected(key: string): boolean {
    return this.selectedEndpointKeys.has(key);
  }

  togglePage(key: string, checked: boolean): void {
    const next = new Set(this.selectedPageKeys);
    const nextHidden = new Set(this.hiddenComponentKeys);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
      for (const fullKey of Array.from(nextHidden)) {
        if (fullKey.startsWith(`${key}.`)) {
          nextHidden.delete(fullKey);
        }
      }
    }
    this.selectedPageKeys = next;
    this.hiddenComponentKeys = nextHidden;
  }

  toggleEndpoint(key: string, checked: boolean): void {
    const next = new Set(this.selectedEndpointKeys);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedEndpointKeys = next;
  }

  selectAllInGroup(pages: AppAccessPage[]): void {
    const next = new Set(this.selectedPageKeys);
    pages.forEach(p => next.add(p.key));
    this.selectedPageKeys = next;
  }

  clearGroup(pages: AppAccessPage[]): void {
    const next = new Set(this.selectedPageKeys);
    pages.forEach(p => next.delete(p.key));
    this.selectedPageKeys = next;
  }

  selectAllEndpointsInGroup(endpoints: AppAccessEndpoint[]): void {
    const next = new Set(this.selectedEndpointKeys);
    endpoints.forEach(e => next.add(e.key));
    this.selectedEndpointKeys = next;
  }

  clearEndpointsInGroup(endpoints: AppAccessEndpoint[]): void {
    const next = new Set(this.selectedEndpointKeys);
    endpoints.forEach(e => next.delete(e.key));
    this.selectedEndpointKeys = next;
  }

  selectAllPages(): void {
    this.accessMode = 'custom';
    this.selectedPageKeys = new Set(
      this.accessControl.getManageablePages().map(p => p.key)
    );
  }

  clearAllPages(): void {
    this.accessMode = 'custom';
    this.selectedPageKeys = new Set(['main-dashboard']);
    this.hiddenComponentKeys = new Set<string>();
  }

  selectAllEndpoints(): void {
    this.selectedEndpointKeys = new Set(
      this.accessControl.getManageableEndpoints().map(e => e.key)
    );
  }

  clearAllEndpoints(): void {
    this.selectedEndpointKeys = new Set<string>();
  }

  hasRestrictions(user: any): boolean {
    const raw = String(user?.allowedPageRoutes ?? '').trim();
    if (this.accessControl.isFullAccessCsv(raw)) {
      return false;
    }
    return (
      this.accessControl.parsePageKeysCsv(raw).length > 0 ||
      this.accessControl.parseHiddenComponentsCsv(user?.hiddenPageComponents || '').size > 0
    );
  }

  getUserDisplayName(user: any): string {
    return user?.username || user?.email || 'Unknown user';
  }

  saveAccess(): void {
    if (!this.selectedUser?.id) {
      return;
    }
    this.isSaving = true;
    const routesCsv = this.accessControl.encodeAllowedPageRoutes(
      !this.isCustomAccessMode,
      Array.from(this.selectedPageKeys)
    );
    const hiddenCsv = this.isCustomAccessMode
      ? this.accessControl.hiddenComponentsToCsv(Array.from(this.hiddenComponentKeys))
      : '';
    const payload = {
      allowedPageRoutes: routesCsv,
      hiddenPageComponents: hiddenCsv,
    };
    this.api.updateUser(this.selectedUser.id, payload).subscribe({
      next: (response: any) => {
        this.isSaving = false;
        this.showFeedback(response?.message || 'Access settings saved', 'success');
        const updatedId = this.selectedUser.id;
        const currentId = Number(
          sessionStorage.getItem('userid') || sessionStorage.getItem('userId') || 0
        );
        if (currentId > 0 && currentId === Number(updatedId)) {
          sessionStorage.setItem('allowedPageRoutes', routesCsv);
          sessionStorage.setItem('hiddenPageComponents', hiddenCsv);
          this.accessControl.refreshFromSession();
        }
        this.api.getAllUsers().subscribe({
          next: (res: any) => {
            this.applyUsersList(res);
            const refreshed = this.usersList.find(u => u.id === updatedId);
            if (refreshed) {
              this.selectUser(refreshed);
            }
          }
        });
      },
      error: (error: any) => {
        this.isSaving = false;
        this.showFeedback(error?.error?.message || 'Failed to save access settings', 'error');
      }
    });
  }

  saveRoleAccess(): void {
    if (!this.selectedRole) {
      return;
    }
    this.isSaving = true;
    const keys = Array.from(this.selectedEndpointKeys);
    this.api.updateRoleEndpointAccess(this.selectedRole, keys).subscribe({
      next: (response: any) => {
        this.isSaving = false;
        this.showFeedback(response?.message || 'Role endpoint access saved', 'success');
        this.selectRole(this.selectedRole);
      },
      error: (error: any) => {
        this.isSaving = false;
        this.showFeedback(error?.error?.message || 'Failed to save role endpoint access', 'error');
      }
    });
  }

  private applyUsersList(response: any): void {
    this.usersList = (Array.isArray(response) ? response : [])
      .sort((a: any, b: any) => (b?.id ?? 0) - (a?.id ?? 0));
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.responseMessage = message;
    this.responseColor = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => {
      this.responseMessage = '';
    }, 4000);
  }
}
