import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from 'src/app/services/api.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import jwt_decode from 'jwt-decode'; // Import the jwt-decode library
import { JwtPayload } from '../auth/models/jwt-payload.interface';
import { DataService } from 'src/app/services/data.service';
import { Router } from '@angular/router';
import { navigateAfterLogin } from '../auth/navigate-after-login';
import { SubscriptionService } from 'src/app/services/subscription.service';
import {
  clearUserRolesFromSession,
  persistUserRolesToSession,
} from 'src/app/utils/user-roles.util';
@Component({
  selector: 'app-login3',
  templateUrl: './login3.component.html',
  styleUrls: ['./login3.component.css']
})
export class Login3Component implements OnInit {

  
  data: any[] = [];
  userRole: any;
  notFound: boolean = false;

  type: string = "password";
  isText: boolean = false;
  eyeIcon: string = "bi bi-eye-slash-fill";
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthenticationService,
    private router: Router,
    private api: ApiService,
    private subscription: SubscriptionService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required ]
    });

    // ... (other initialization code)
  }



  hideShowPassword() {
    this.isText = !this.isText;
    this.isText ? this.eyeIcon = "bi bi-eye-fill" : this.eyeIcon = "bi bi-eye-slash-fill";
    this.isText ? this.type = "text" : this.type = "password";
  }



  getUserFormData(data: any) {
  
    this.authService.clientLogin(data).subscribe((result:any) => {

      console.log("User logged in successfully");

      console.log('userDetails', result.user);
      console.log('username', result.user.username);
      
      this.userRole = result.user.role;
      console.log(result.user.profilePic);
      
      console.log('user role', this.userRole);
      console.log('jwt', result.jwt);

      console.log('user email', JSON.stringify(result.user.email));

      // Save JWT token and user details in local storage
      //sessionStorage.setItem('jwtToken', result.jwt);
      sessionStorage.setItem('userDetails', JSON.stringify(result.user));
      sessionStorage.setItem('username', result.user.username);
      persistUserRolesToSession(result.user);
      sessionStorage.setItem('useremail', result.user.email);
      sessionStorage.setItem('userProfilePic', result.user.profilePic);
      //sessionStorage.setItem('jwt', result.jwt);

      sessionStorage.setItem('userType', result.userType); // If you want to store userType as well

      // Store the JWT token in an HttpOnly cookie
      this.authService.setSessionToken(result.jwt);
      //this.authService.setSessionToken(result.user.role);

      //this.router.navigate(['/']);

      this.checkSessionExpiry();

      navigateAfterLogin(this.router, this.subscription, this.userRole);

    },(error:any) => {
      // Handle errors here

      this.notFound=true;

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



