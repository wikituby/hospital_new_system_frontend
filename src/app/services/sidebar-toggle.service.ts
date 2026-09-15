import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarToggleService {
  private readonly overviewSidebarToggleSubject = new Subject<void>();
  private readonly sidebarOffsetSubject = new BehaviorSubject<number>(0);

  readonly overviewSidebarToggle$ = this.overviewSidebarToggleSubject.asObservable();
  readonly sidebarOffset$ = this.sidebarOffsetSubject.asObservable();

  requestOverviewSidebarToggle(): void {
    this.overviewSidebarToggleSubject.next();
  }

  /** Docked sidebar width reserved for the header/content column (0 when overview is not active). */
  setSidebarOffset(px: number): void {
    const next = Math.max(0, Math.round(px || 0));
    if (this.sidebarOffsetSubject.value === next) {
      return;
    }
    this.sidebarOffsetSubject.next(next);
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--app-sidebar-width', `${next}px`);
    }
  }

  clearSidebarOffset(): void {
    this.setSidebarOffset(0);
  }
}
