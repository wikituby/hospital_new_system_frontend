import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { Router } from '@angular/router';
import { defaultContactValue } from 'src/app/utils/phone-contact.util';
import { Subscription } from 'rxjs';
import {
  DEFAULT_FACILITY_LOGO,
  DEFAULT_FACILITY_NAME,
  FacilityBrandingService,
} from 'src/app/services/facility-branding.service';



@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit, OnDestroy {

  data: any[] = [];
  serverDirectoryName:string='';


  image:string=''


  type: string = "password";
  isText: boolean = false;
  eyeIcon: string = "bi bi-eye-slash-fill";

  typeRetype: string = "password";
  isTextRetype: boolean = false;
  eyeIconRetype: string = "bi bi-eye-slash-fill";
  imgSrc: any = '/assets/imgplaceholder.jpg';



  signUpForm!: FormGroup;
  contact = defaultContactValue();
  facilityName = DEFAULT_FACILITY_NAME;
  facilityLogoUrl = DEFAULT_FACILITY_LOGO;
  private brandSubs: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private authService: AuthenticationService,
    private router: Router,
    private facilityBranding: FacilityBrandingService
  ) {}

  ngOnInit(): void {
    this.bindFacilityBranding();
    this.signUpForm = this.fb.group({
      username: ['',Validators.required],
      password:['', Validators.required]
    })

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


  showPreview($event: any) {
    const reader = new FileReader();
    const fileInput = $event.target;
    const file = fileInput.files[0]; // Get the first selected file
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension) {
        if (fileExtension === 'pdf') {
          this.imgSrc = '/assets/imgplaceholder.jpg';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension)) {
          const fileReader = new FileReader();
          fileReader.onload = (e) => {
            this.imgSrc = e.target?.result;
          };
          fileReader.readAsDataURL(file);
        } else {
          this.imgSrc = '/assets/imgplaceholder.jpg';
        }
      }
    }
    reader.readAsDataURL($event.target.files[0]);
  }




  hideShowPassword(){
    this.isText = !this.isText;
    this.isText ? this.eyeIcon = "bi bi-eye-fill" : this.eyeIcon = "bi bi-eye-slash-fill";
    this.isText ? this.type = "text" : this.type = "password";
  }

  retypeHideShowPassword(){
    this.isTextRetype = !this.isTextRetype;
    this.isTextRetype ? this.eyeIconRetype = "bi bi-eye-fill" : this.eyeIconRetype = "bi bi-eye-slash-fill";
    this.isTextRetype ? this.typeRetype = "text" : this.typeRetype = "password";
  }

  onSignUp(){
    console.log(this.signUpForm.value);
    
    this.authService.signUp(this.signUpForm.value)
    .subscribe({
      next:(()=>{
        alert("signup success")

      }),
      error:(err=>{
        alert(err?.error.message)
      })
    })
  }



  getUserFormDataSignUp(data: any) {
    
    this.authService.signUp(data).subscribe((result:any) => {
      console.log(data);
      console.log(result);
      console.log("mesage " + result.message)
      console.log("mesage " + result.timestamp)
      console.log("mesage " + result.data)
      console.log("mesage " + result.data.role)
      console.log("mesage " + result.data.profilePic)

        console.log("account created successfully");
        this.router.navigate(['/login']);
      },
      (error:any) => {
        console.error("signup failed:", error);
      }
    );
  }







}
