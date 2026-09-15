import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiConfigService } from '../services/api-config.service';

@Injectable()
export class NetworkConnectionInterceptor implements HttpInterceptor {
  constructor(private apiConfig: ApiConfigService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.apiConfig.shouldSkipConnectionHandling(req)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: unknown) => {
        if (this.apiConfig.shouldReportUnreachableFailure(req.url, error)) {
          this.apiConfig.reportNetworkFailure();
        }
        return throwError(() => error);
      })
    );
  }
}
