import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';

@Component({
  selector: 'app-sendemail',
  templateUrl: './sendemail.component.html',
  styleUrls: ['./sendemail.component.css']
})
export class SendemailComponent implements OnInit {


  constructor(private authService: AuthenticationService){}

  ngOnInit(): void {
    
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
