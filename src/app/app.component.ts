import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgxPaginationModule } from 'ngx-pagination';
import { Subscription } from 'rxjs';
import { isPublicAppPath } from './config/public-routes';
import { ApiConfigService, ApiConnectionState } from './services/api-config.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'wiki'
  showServerConnection = false;
  showApiResolving = false;
  private apiStateSub?: Subscription;

  isLoginRoute: boolean = false;
  isSignupRoute: boolean = false;
  isResetPasswordRoute: boolean = false;
  isSendEmail: boolean = false;
  isLogin2Route: boolean = false;
  isLogin3Route: boolean = false;
  isLogin4Route: boolean = false;
  isLandingPageRoute: boolean = false;
  /** Overview embeds the toolbar next to the sidebar; hide the global one there. */
  isOverviewRoute: boolean = false;

  get showGlobalHeader(): boolean {
    return (
      !this.isOverviewRoute &&
      !this.isLandingPageRoute &&
      !this.isLogin4Route &&
      !this.isLogin3Route &&
      !this.isLogin2Route &&
      !this.isLoginRoute &&
      !this.isSignupRoute &&
      !this.isResetPasswordRoute &&
      !this.isSendEmail
    );
  }



  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiConfig: ApiConfigService
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const routeData = this.route.firstChild?.snapshot.data;

        // Check if the login or signup data property is true
        this.isLogin2Route = routeData?.['login2'] || false;
        this.isLogin3Route = routeData?.['login3'] || false;
        this.isLogin4Route = routeData?.['login4'] || false;

        this.isLoginRoute = routeData?.['login'] || false;
        this.isSignupRoute = routeData?.['signup'] || false;
        this.isResetPasswordRoute = routeData?.['resetpassword'] || false;
        this.isSendEmail = routeData?.['sendemail'] || false;
        this.isLandingPageRoute = routeData?.['landingpage'] || false;

        this.syncOverviewShellClass();
        this.applyApiConnectionState(this.apiConfig.getConnectionState());
      });
  }

  ngOnInit(): void {
    this.syncOverviewShellClass();
    this.applyApiConnectionState(this.apiConfig.getConnectionState());
    this.apiStateSub = this.apiConfig.state$.subscribe((state) =>
      this.applyApiConnectionState(state)
    );
  }

  ngOnDestroy(): void {
    this.apiStateSub?.unsubscribe();
  }

  private applyApiConnectionState(state: ApiConnectionState): void {
    this.showServerConnection = this.apiConfig.shouldShowServerConnection();
    this.showApiResolving =
      state === 'resolving' && !isPublicAppPath(this.router.url);
  }

  /** Lock document scroll on overview shell; inner .content still scrolls. */
  private syncOverviewShellClass(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    const isOverview = path === '/overview' || path.startsWith('/overview/');
    const isPatientVisit = path === '/patient-visit' || path.endsWith('/patient-visit');
    this.isOverviewRoute = isOverview;
    document.body.classList.toggle('app-overview-shell', isOverview);
    document.body.classList.toggle('app-patient-visit-shell', isPatientVisit);
  }
}