import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import jwt_decode from 'jwt-decode'; // Import the jwt-decode library
import { JwtPayload } from '../models/jwt-payload.interface';
import { DataService } from 'src/app/services/data.service';
import { Router } from '@angular/router';
import { navigateAfterLogin } from '../navigate-after-login';
import { parseLoginFailure } from '../login-error.util';
import { ActiveRoomService } from 'src/app/services/active-room.service';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { ApiConfigService } from 'src/app/services/api-config.service';
import {
  clearUserRolesFromSession,
  persistUserRolesToSession,
  userHasAssignedRole,
  NO_ROLE_ASSIGNED_MESSAGE,
} from 'src/app/utils/user-roles.util';
import { notifyAuthSessionChanged } from 'src/app/utils/auth-session.util';
import { AccessControlService } from 'src/app/services/access-control.service';
import {
  DEFAULT_FACILITY_LOGO,
  DEFAULT_FACILITY_NAME,
  FacilityBrandingService,
} from 'src/app/services/facility-branding.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login4.component.html',
  styleUrls: ['./login4.component.css']
})
export class Login4Component implements OnInit, OnDestroy {

  data: any[] = [];
  userRole: any;
  notFound: boolean = false;
  loginErrorMessage: string = '';

  type: string = "password";
  isText: boolean = false;
  eyeIcon: string = "bi bi-eye-slash-fill";
  loginForm!: FormGroup;

  facilityName = DEFAULT_FACILITY_NAME;
  facilityLogoUrl = DEFAULT_FACILITY_LOGO;
  private brandSubs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router,
    private api: ApiService,
    private activeRoomService: ActiveRoomService,
    private subscription: SubscriptionService,
    private apiConfig: ApiConfigService,
    private facilityBranding: FacilityBrandingService,
    private accessControl: AccessControlService
  ) {}

  get connectedServerLabel(): string {
    return this.apiConfig.getDisplayBaseUrl();
  }

  changeServer(): void {
    this.apiConfig.resetPreLoginServerSelection();
    this.apiConfig.openServerConnectionDialog();
  }

  ngOnInit(): void {
    this.bindFacilityBranding();

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required ]
    });
  }

  ngOnDestroy(): void {
    this.brandSubs.forEach((s) => s.unsubscribe());
  }

  private bindFacilityBranding(): void {
    const brand = this.facilityBranding.hydrateFromLocalAssets();
    this.facilityName = brand.facilityName;
    this.facilityLogoUrl = this.facilityBranding.getLoginLogoUrl();
    this.brandSubs.push(
      this.facilityBranding.loginFacilityName$.subscribe((name) => (this.facilityName = name)),
      this.facilityBranding.loginFacilityLogo$.subscribe((logo) => (this.facilityLogoUrl = logo))
    );
  }


  hideShowPassword() {
    this.isText = !this.isText;
    this.isText ? this.eyeIcon = "bi bi-eye-fill" : this.eyeIcon = "bi bi-eye-slash-fill";
    this.isText ? this.type = "text" : this.type = "password";
  }



  getUserFormData(data: any) {
    this.notFound = false;
    this.loginErrorMessage = '';
  
    this.authService.clientLogin(data).subscribe((result:any) => {

      console.log("User logged in successfully");

      console.log('userDetails', result.user);
      console.log('username', result.user.username);
      
      this.userRole = result.user.role;
      if (!userHasAssignedRole(result.user)) {
        this.notFound = false;
        this.loginErrorMessage = NO_ROLE_ASSIGNED_MESSAGE;
        return;
      }
      console.log(result.user.profilePic);
      
      console.log('user role', this.userRole);
      console.log('jwt', result.jwt);

      console.log('user email', JSON.stringify(result.user.email));

      // Save JWT token and user details in local storage
      //sessionStorage.setItem('jwtToken', result.jwt);
      sessionStorage.setItem('userDetails', JSON.stringify(result.user));
      sessionStorage.setItem('username', result.user.username);
      if (result.user?.id != null) {
        sessionStorage.setItem('userid', String(result.user.id));
      }
      persistUserRolesToSession(result.user);
      sessionStorage.setItem('useremail', result.user.email);
      sessionStorage.setItem('userProfilePic', result.user.profilePic);
      sessionStorage.setItem('assignedModuleIds', result.user.assignedModuleIds || '');
      sessionStorage.setItem('assignedClinicIds', result.user.assignedClinicIds || '');
      sessionStorage.setItem('allowedPageRoutes', result.user.allowedPageRoutes || '');
      sessionStorage.setItem('hiddenPageComponents', result.user.hiddenPageComponents || '');
      sessionStorage.removeItem('activeClinicId');
      sessionStorage.removeItem('activeModuleId');
      sessionStorage.setItem('jwt', result.jwt);

      sessionStorage.setItem('userType', result.userType); // If you want to store userType as well

      this.accessControl.refreshFromSession();
      this.subscription.refreshFromSession();
      notifyAuthSessionChanged();

      // Store the JWT token in an HttpOnly cookie
      this.authService.setSessionToken(result.jwt);

      this.checkSessionExpiry();

      navigateAfterLogin(this.router, this.subscription, this.userRole, undefined, this.activeRoomService);

    },(error:any) => {
      const failure = parseLoginFailure(error);
      this.notFound = !failure.isInactive;
      this.loginErrorMessage = failure.isInactive ? failure.message : '';


      console.error('Error during login:', error.error.error);
      console.error('Error during login:', error.statusText);

      // You can display an error message to the user or perform any other error-related actions
      // For example, if you want to show an error message to the user:
      // this.errorMessage = error.message;

      // Clear any sensitive data from local storage (for security)
      sessionStorage.removeItem('userDetails');
      sessionStorage.removeItem('username');
      clearUserRolesFromSession();
      sessionStorage.removeItem('useremail');
      sessionStorage.removeItem('userProfilePic');
      sessionStorage.removeItem('assignedModuleIds');
      sessionStorage.removeItem('assignedClinicIds');
      sessionStorage.removeItem('allowedPageRoutes');
      sessionStorage.removeItem('hiddenPageComponents');
      sessionStorage.removeItem('activeClinicId');
      sessionStorage.removeItem('activeModuleId');
      this.activeRoomService.clearActiveRoom();

      // Optionally, you can also redirect the user to a login page or display an error message
      // this.router.navigate(['/login']);
    }
  );
}

  // In your auth service
  




  checkSessionExpiry() {
    // Get the token from local storage
    const token = this.api.getSessionToken();

    // Check if a token is present
    if (token) {
      // Decode the token using the JwtPayload interface for type assertion
      const tokenPayload = jwt_decode(token) as JwtPayload; // Use type assertion


      // Calculate expiration time in milliseconds
      const expirationTimeInSeconds = tokenPayload.exp; // Expiration time from backend in seconds
      
      const expirationTimeInMilliseconds = expirationTimeInSeconds * 1000; // Convert to milliseconds

    
      // Get the current time in milliseconds
      const currentTime = Date.now();

      // Compare the current time with the expiration time
      if (currentTime > expirationTimeInMilliseconds) {
        // If the token is expired, log the user out
        this.authService.logout();
        this.router.navigate(['/login4']);
      }
    }
  }

  noLogin(){
    sessionStorage.setItem('username', "Account");
    sessionStorage.setItem('userrole', "undefined");
    this.router.navigate(['/login4']);

  }


}
