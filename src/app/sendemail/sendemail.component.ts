import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';
import { Subscription } from 'rxjs';
import {
  DEFAULT_FACILITY_LOGO,
  DEFAULT_FACILITY_NAME,
  FacilityBrandingService,
} from 'src/app/services/facility-branding.service';

@Component({
  selector: 'app-sendemail',
  templateUrl: './sendemail.component.html',
  styleUrls: ['./sendemail.component.css']
})
export class SendemailComponent implements OnInit, OnDestroy {

  facilityName = DEFAULT_FACILITY_NAME;
  facilityLogoUrl = DEFAULT_FACILITY_LOGO;
  private brandSubs: Subscription[] = [];

  constructor(
    private authService: AuthenticationService,
    private facilityBranding: FacilityBrandingService
  ) {}

  ngOnInit(): void {
    this.bindFacilityBranding();
  }

  ngOnDestroy(): void {
    this.brandSubs.forEach((sub) => sub.unsubscribe());
  }

  private bindFacilityBranding(): void {
    const brand = this.facilityBranding.hydrateFromLocalAssets();
    this.facilityName = brand.facilityName;
    this.facilityLogoUrl = this.facilityBranding.getLoginLogoUrl();
    this.brandSubs.push(
      this.facilityBranding.loginFacilityName$.subscribe((name) => (this.facilityName = name)),
      this.facilityBranding.loginFacilityLogo$.subscribe((logo) => (this.facilityLogoUrl = logo))
    );
    void this.facilityBranding.loadPublicFromConnectedServer();
  }

  onFacilityLogoError(): void {
    this.facilityLogoUrl = DEFAULT_FACILITY_LOGO;
  }

  getUserFormData(data: any) {

    this.authService.sendEmail(data).subscribe((result:any) => {

      console.log("email sent successfully, visit your email to get the password reset link");
      //console.log(data);
      //console.log(result);
      //console.log('userDetails', JSON.stringify(result.user));

      // Save JWT token and user details in local storage
      //sessionStorage.setItem('jwtToken', result.jwt);


    },
      (error:any) => {
        console.error("Login failed:", error);
      }

      //NB//
      //Remember to handle cases where the local storage data might be missing or invalid, and to clear the local storage when the user logs out or when the token expires for security reasons.
    );
  }


}
