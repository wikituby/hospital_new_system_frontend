import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';

@Component({
  selector: 'app-resetpassword',
  templateUrl: './resetpassword.component.html',
  styleUrls: ['./resetpassword.component.css']
})
export class ResetpasswordComponent implements OnInit {

  type: string = "password";
  isText: boolean = false;
  eyeIcon: string = "bi bi-eye-slash-fill";

  typeRetype: string = "password";
  isTextRetype: boolean = false;
  eyeIconRetype: string = "bi bi-eye-slash-fill";

  constructor(private authService: AuthenticationService){}

  ngOnInit(): void {
    
  }


  getUserFormData(data: any) {

    this.authService.resetPassword(data).subscribe((result) => {

      console.log("email sent successfully, visit your email to get the password reset link");
      //console.log(data);
      //console.log(result);
      //console.log('userDetails', JSON.stringify(result.user));

      // Save JWT token and user details in local storage
      //sessionStorage.setItem('jwtToken', result.jwt);


    },
      (error) => {
        console.error("Login failed:", error);
      }

      //NB//
      //Remember to handle cases where the local storage data might be missing or invalid, and to clear the local storage when the user logs out or when the token expires for security reasons.
    );
  }

  noLogin(){

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


}
