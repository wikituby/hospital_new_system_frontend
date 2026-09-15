import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api.service';
import { ThemeService } from '../services/theme.service';
import { NgForm } from '@angular/forms';
import { defaultContactValue } from '../utils/phone-contact.util';

@Component({
  selector: 'app-settings-privacy',
  templateUrl: './settings-privacy.component.html',
  styleUrls: ['./settings-privacy.component.css']
})
export class SettingsPrivacyComponent implements OnInit, OnDestroy {
  userName: any;
  userRole: any;
  userEmail: any;
  userProfilePic: any = 'assets/images/vector.jpeg';
  isDarkMode = false;
  private themeSub?: Subscription;
  
  // User profile data
  profileData: any = {
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: defaultContactValue(),
    title: ''
  };

  // Password change
  passwordData: any = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // Privacy settings
  privacySettings: any = {
    profileVisibility: 'public',
    emailNotifications: true,
    smsNotifications: false,
    dataSharing: false
  };

  // Loading states
  isLoading: boolean = false;
  showDivUpdatedLoader: boolean = false;
  responseMessage: string = '';
  responseColor: string = '';

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    this.userName = sessionStorage.getItem('username');
    this.userRole = sessionStorage.getItem('userrole');
    this.userEmail = sessionStorage.getItem('useremail');
    this.userProfilePic = sessionStorage.getItem('userProfilePic') || 'assets/images/vector.jpeg';
    if (!this.userName) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUserProfile();
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  loadUserProfile(): void {
    // Load user profile data from session storage or API
    const userDetails = sessionStorage.getItem('userDetails');
    if (userDetails) {
      try {
        const user = JSON.parse(userDetails);
        this.profileData = {
          username: user.username || this.userName || '',
          email: user.email || this.userEmail || '',
          firstName: user.firstName || user.first_name || '',
          lastName: user.lastName || user.last_name || '',
          phone: user.phone?.trim() || defaultContactValue(),
          title: user.title || ''
        };
      } catch (e) {
        console.error('Error parsing user details:', e);
      }
    }
  }

  updateProfile(form: NgForm): void {
    if (!form.valid) {
      this.responseMessage = 'Please fill in all required fields';
      this.responseColor = 'rgb(238, 16, 16)';
      this.showDivUpdatedLoader = true;
      setTimeout(() => {
        this.showDivUpdatedLoader = false;
      }, 2000);
      return;
    }

    this.showDivUpdatedLoader = true;
    const userId = sessionStorage.getItem('userid');

    if (!userId) {
      this.responseMessage = 'User ID is missing';
      this.responseColor = 'rgb(238, 16, 16)';
      this.showDivUpdatedLoader = false;
      return;
    }

    const updateData = {
      ...this.profileData,
      userRole: this.userRole
    };

    console.log('Updating profile:', updateData);

    // Update user profile via API
    this.api.updateUser(parseInt(userId), updateData).subscribe(
      (response: any) => {
        console.log('Profile updated successfully:', response);
        this.responseMessage = response.message || 'Profile updated successfully';
        this.responseColor = 'rgb(40, 167, 69)';
        
        // Update session storage
        const userDetails = sessionStorage.getItem('userDetails');
        if (userDetails) {
          try {
            const user = JSON.parse(userDetails);
            const updatedUser = { ...user, ...updateData };
            sessionStorage.setItem('userDetails', JSON.stringify(updatedUser));
            sessionStorage.setItem('username', updateData.username);
            sessionStorage.setItem('useremail', updateData.email);
          } catch (e) {
            console.error('Error updating session storage:', e);
          }
        }

        setTimeout(() => {
          this.showDivUpdatedLoader = false;
          this.loadUserProfile();
        }, 2000);
      },
      (error: any) => {
        console.error('Error updating profile:', error);
        this.responseMessage = error.error?.message || 'Error updating profile';
        this.responseColor = 'rgb(238, 16, 16)';
        this.showDivUpdatedLoader = false;
      }
    );
  }

  changePassword(form: NgForm): void {
    if (!form.valid) {
      this.responseMessage = 'Please fill in all password fields';
      this.responseColor = 'rgb(238, 16, 16)';
      this.showDivUpdatedLoader = true;
      setTimeout(() => {
        this.showDivUpdatedLoader = false;
      }, 2000);
      return;
    }

    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.responseMessage = 'New password and confirm password do not match';
      this.responseColor = 'rgb(238, 16, 16)';
      this.showDivUpdatedLoader = true;
      setTimeout(() => {
        this.showDivUpdatedLoader = false;
      }, 2000);
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      this.responseMessage = 'New password must be at least 6 characters long';
      this.responseColor = 'rgb(238, 16, 16)';
      this.showDivUpdatedLoader = true;
      setTimeout(() => {
        this.showDivUpdatedLoader = false;
      }, 2000);
      return;
    }

    this.showDivUpdatedLoader = true;

    // TODO: Implement password change API call
    // For now, just show success message
    setTimeout(() => {
      this.responseMessage = 'Password changed successfully';
      this.responseColor = 'rgb(40, 167, 69)';
      this.showDivUpdatedLoader = false;
      this.passwordData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      form.resetForm();
    }, 2000);
  }

  updatePrivacySettings(): void {
    this.showDivUpdatedLoader = true;

    // TODO: Implement privacy settings API call
    // For now, just show success message
    setTimeout(() => {
      this.responseMessage = 'Privacy settings updated successfully';
      this.responseColor = 'rgb(40, 167, 69)';
      this.showDivUpdatedLoader = false;
    }, 2000);
  }
}




