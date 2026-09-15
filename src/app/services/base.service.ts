import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BaseService {
  protected readonly apiConfig: ApiConfig = {
    baseUrl: '',
    timeout: 30000,
    retries: 2
  };

  constructor(
    protected http: HttpClient,
    private apiConfigService: ApiConfigService,
  ) {}

  protected get apiBaseUrl(): string {
    return this.apiConfigService.getBaseUrl();
  }

  protected getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Requested-With': 'XMLHttpRequest'
    });
  }

  protected getAuthToken(): string | null {
    // Get token from cookie or session storage
    const cookies = document.cookie.split(';');
    const sessionToken = cookies.find(cookie => cookie.trim().startsWith('sessionToken='));
    return sessionToken ? sessionToken.split('=')[1] : null;
  }

  protected handleError(error: HttpErrorResponse): Observable<never> {
    if (ApiConfigService.isServerUnreachableError(error)) {
      this.apiConfigService.reportNetworkFailure();
    }

    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = 'Bad Request: Please check your input';
          break;
        case 401:
          errorMessage = 'Unauthorized: Please login again';
          this.handleUnauthorized();
          break;
        case 403:
          errorMessage = 'Forbidden: You do not have permission to access this resource';
          break;
        case 404:
          errorMessage = 'Not Found: The requested resource was not found';
          break;
        case 500:
          errorMessage = 'Internal Server Error: Please try again later';
          break;
        case 503:
          errorMessage = 'Service Unavailable: The server is temporarily unavailable';
          break;
        default:
          errorMessage = `Server Error: ${error.status} - ${error.message}`;
      }
    }

    console.error('API Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  private handleUnauthorized(): void {
    // Clear authentication data and redirect to login
    document.cookie = 'sessionToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    sessionStorage.clear();
    // You might want to inject Router and navigate to login page
    window.location.href = '/login4';
  }

  protected get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.apiBaseUrl}${endpoint}`, {
      headers: this.getHeaders()
    }).pipe(
      retry(this.apiConfig.retries || 2),
      catchError(this.handleError.bind(this))
    );
  }

  protected post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.apiBaseUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      retry(this.apiConfig.retries || 2),
      catchError(this.handleError.bind(this))
    );
  }

  protected put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.apiBaseUrl}${endpoint}`, data, {
      headers: this.getHeaders()
    }).pipe(
      retry(this.apiConfig.retries || 2),
      catchError(this.handleError.bind(this))
    );
  }

  protected delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiBaseUrl}${endpoint}`, {
      headers: this.getHeaders()
    }).pipe(
      retry(this.apiConfig.retries || 2),
      catchError(this.handleError.bind(this))
    );
  }
}

