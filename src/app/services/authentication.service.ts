import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccessControlService } from './access-control.service';
import { SubscriptionService } from './subscription.service';
import { ActiveRoomService } from './active-room.service';
import { ApiConfigService } from './api-config.service';
import { MessagingWebSocketService } from './messaging-websocket.service';
import { MessagingHubService } from './messaging-hub.service';
import { MessageSoundService } from './message-sound.service';
import { clearUserRolesFromSession } from '../utils/user-roles.util';


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  private get apiBaseUrl(): string {
    return this.apiConfig.getBaseUrl();
  }
  private get baseUrl3(): string {
    return this.apiBaseUrl + '/auth';
  }
  private get baseUrl5(): string {
    return this.apiBaseUrl + '/user-management';
  }


  router: any;

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService,
    private accessControl: AccessControlService,
    private activeRoomService: ActiveRoomService,
    private subscription: SubscriptionService,
    private messagingWs: MessagingWebSocketService,
    private messagingHub: MessagingHubService,
    private messageSound: MessageSoundService
  ) { }

  setSessionToken(token: string) {
    // Set the session token in an HttpOnly cookie
    document.cookie = `sessionToken=${token}; path=/`;
  }

    // In auth service
    logout() {
      this.messagingWs.disconnect();
      this.messagingHub.reset();
      this.messageSound.stop();

      // Clear the session token (remove the cookie)
      document.cookie = 'sessionToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
      // Clear other cached data if needed
      sessionStorage.removeItem('userDetails');
      sessionStorage.removeItem('userType');
      sessionStorage.removeItem('jwt');
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
      this.accessControl.clearSessionCache();
      this.subscription.clearSessionCache();
      sessionStorage.removeItem('downloadUrl');
      sessionStorage.removeItem('item');
      this.apiConfig.resetPreLoginServerSelection();
      this.router.navigate(['/login4']);

      // ... Perform any other necessary cleanup or logout actions
    }


  signUp(data: any): Observable<any>{
    return this.http.post<any>(`${this.baseUrl5}/signup`, data);    

  }

  getProfilePicturePresignedUpload(payload: {
    userId: number;
    fileName: string;
    contentType: string;
  }): Observable<{ uploadUrl: string; fileUrl: string }> {
    return this.http
      .post<any>(`${this.baseUrl5}/profile-picture/presigned-upload`, payload)
      .pipe(
        map((res: any) => {
          const d = res?.data ?? res;
          const uploadUrl = d?.uploadUrl ?? d?.url;
          const fileUrl =
            d?.fileUrl ?? d?.publicUrl ?? d?.profilePicUrl ?? d?.assetUrl ?? d?.location;
          if (!uploadUrl || !fileUrl) {
            throw new Error('Could not get S3 upload URL from server.');
          }
          return { uploadUrl: String(uploadUrl), fileUrl: String(fileUrl) };
        })
      );
  }

  uploadFileToPresignedUrl(uploadUrl: string, file: Blob, contentType: string): Observable<number> {
    return new Observable<number>((observer) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev: ProgressEvent) => {
        if (ev.lengthComputable) {
          observer.next(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
        }
      };
      xhr.onerror = () => observer.error(new Error('Network error while uploading to storage'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next(100);
          observer.complete();
        } else {
          observer.error(
            new Error(xhr.responseText || xhr.statusText || `Upload failed (${xhr.status})`)
          );
        }
      };
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
      xhr.send(file);
      return () => xhr.abort();
    });
  }

  updateProfilePic(id: number, profilePic: string): Observable<any> {
    return this.http.put(`${this.baseUrl5}/update-profile-pic/${id}`, { profilePic });
  }

  clientLogin(data: any): Observable<any>{
    return this.http.post<any>( `${this.baseUrl3}/user-login`, data);

  }

  sendEmail(data: any): Observable<any>{
    return this.http.post<any>(`${this.baseUrl3}/reset-link`, data);

  }

  resetPassword(data: any): Observable<any>{
    return this.http.post<any>(`${this.baseUrl3}/reset-link`, data);

  }


}
