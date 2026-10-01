import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import {
  getPublicOfferedServices,
  getPublicUpcomingServices,
  LandingServiceItem
} from '../landing-page/service-catalog';

@Component({
  selector: 'app-site-nav',
  templateUrl: './site-nav.component.html',
  styleUrls: ['./site-nav.component.css']
})
export class SiteNavComponent {
  readonly venerandaLogo = 'assets/images/veneranda-logo.png';
  readonly offeredServices: LandingServiceItem[] = getPublicOfferedServices();
  readonly upcomingServices: LandingServiceItem[] = getPublicUpcomingServices();

  openMenu: 'services' | 'upcoming' | null = null;

  constructor(private router: Router) {}

  navigateToOverview(): void {
    this.router.navigate(['/login']);
  }

  toggleMenu(menu: 'services' | 'upcoming', event?: Event): void {
    event?.preventDefault();
    this.openMenu = this.openMenu === menu ? null : menu;
  }

  openOnHover(menu: 'services' | 'upcoming'): void {
    this.openMenu = menu;
  }

  closeMenus(): void {
    this.openMenu = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.site-nav-dropdown')) {
      this.closeMenus();
    }
  }
}
