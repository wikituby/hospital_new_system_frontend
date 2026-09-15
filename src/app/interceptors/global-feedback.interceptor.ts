import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { GlobalFeedbackService } from '../services/global-feedback.service';
import { ApiConfigService } from '../services/api-config.service';

@Injectable()
export class GlobalFeedbackInterceptor implements HttpInterceptor {
  constructor(private globalFeedbackService: GlobalFeedbackService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      tap((event) => {
        if (event instanceof HttpResponse && this.isWriteMethod(req.method)) {
          const successMessage = this.extractSuccessMessage(event.body);
          if (successMessage) {
            this.globalFeedbackService.show(successMessage, 'success');
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Unreachable-server errors open the connection modal instead of a toast.
        if (!ApiConfigService.isServerUnreachableError(error)) {
          const errorMessage = this.extractErrorMessage(error);
          this.globalFeedbackService.show(errorMessage, 'error');
        }
        return throwError(() => error);
      })
    );
  }

  private isWriteMethod(method: string): boolean {
    const normalizedMethod = (method || '').toUpperCase();
    return normalizedMethod === 'POST' || normalizedMethod === 'PUT' || normalizedMethod === 'PATCH' || normalizedMethod === 'DELETE';
  }

  private extractSuccessMessage(body: any): string | null {
    if (!body) return null;
    if (typeof body === 'string' && body.trim()) return body.trim();

    const message = body?.message || body?.data?.message || body?.result?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
    return null;
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    const apiMessage =
      error?.error?.message ||
      error?.error?.error ||
      (typeof error?.error === 'string' ? error.error : null);

    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage.trim();
    }

    if (error?.status === 0) {
      return 'Network error. Please check your connection and try again.';
    }

    return error?.message || 'Something went wrong. Please try again.';
  }
}
