import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { isPublicAppPath, normalizeAppPath } from '../config/public-routes';
import { SubscriptionService } from '../services/subscription.service';

const SUBSCRIPTION_PAGE = '/overview/subscription';

function isSubscriptionPage(path: string): boolean {
  return path === SUBSCRIPTION_PAGE || path.startsWith(`${SUBSCRIPTION_PAGE}/`);
}

function isLoggedIn(): boolean {
  return !!sessionStorage.getItem('username');
}

function evaluateSubscriptionAccess(url: string) {
  const router = inject(Router);
  const subscription = inject(SubscriptionService);
  subscription.refreshFromSession();

  const path = normalizeAppPath(url);

  if (isPublicAppPath(url) || !isLoggedIn()) {
    return true;
  }

  if (isSubscriptionPage(path)) {
    return true;
  }

  if (subscription.isActive()) {
    return true;
  }

  return router.createUrlTree(['/overview/subscription']);
}

/** Blocks app routes when the facility subscription is not active (subscription page always allowed). */
export const subscriptionGuard: CanActivateFn = (_route, state) =>
  evaluateSubscriptionAccess(state.url);

/** Same check for overview child routes. */
export const subscriptionChildGuard: CanActivateChildFn = (_route, state) =>
  evaluateSubscriptionAccess(state.url);
