import { Router } from '@angular/router';
import { ActiveRoomService } from '../services/active-room.service';
import { SubscriptionService } from '../services/subscription.service';

const CLINICAL_REGISTRY_ROLES = new Set(['nurse', 'doctor', 'clinician']);

function isClinicalRegistryRole(role: string): boolean {
  return CLINICAL_REGISTRY_ROLES.has(role);
}

function roleMatches(role: string, keywords: string[]): boolean {
  return keywords.some((keyword) => role.includes(keyword));
}

/** Ultrasound / medical imaging staff → Scan V2 */
function isScanImagingRole(role: string): boolean {
  return roleMatches(role, [
    'sono',
    'sonograph',
    'radiograph',
    'medical imaging',
    'imaging technologist',
    'imaging tech',
  ]);
}

function isLabRole(role: string): boolean {
  return role === 'lab' || roleMatches(role, ['laborator', 'lab tech', 'lab technician']);
}

function isDentalRole(role: string): boolean {
  return roleMatches(role, ['dental', 'dentist', 'oral health']);
}

function isMchRole(role: string): boolean {
  return (
    role === 'mch' ||
    roleMatches(role, ['midwife', 'maternal', 'maternity', 'child health'])
  );
}

function navigateByRole(
  router: Router,
  rawRole: string | null | undefined,
  isSmallScreen?: () => boolean
): void {
  const role = (rawRole ?? '').toString().toLowerCase().trim();
  const small = isSmallScreen?.() ?? false;

  if (isLabRole(role)) {
    router.navigate(small ? ['/overview/lab-mobile'] : ['/overview/lab-v2']);
    return;
  }
  if (isScanImagingRole(role)) {
    router.navigate(['/overview/scan-v2']);
    return;
  }
  if (isDentalRole(role)) {
    router.navigate(['/overview/dental-v2']);
    return;
  }
  if (isMchRole(role)) {
    router.navigate(['/overview/mch-v2']);
    return;
  }
  if (isClinicalRegistryRole(role)) {
    router.navigate(['/overview/all-patients']);
    return;
  }
  router.navigate(['/overview/main-dashboard']);
}

/**
 * After login: load subscription status first. Without active subscription → subscription page.
 * With active subscription → role-based landing route.
 */
export function navigateAfterLogin(
  router: Router,
  subscription: SubscriptionService,
  rawRole: string | null | undefined,
  isSmallScreen?: () => boolean,
  activeRoom?: ActiveRoomService
): void {
  subscription.loadStatus().subscribe({
    next: () => {
      // On-prem localhost/LAN clinics skip the cloud subscription gate.
      if (!subscription.isActive() && !subscription.isOnPremClinicApi()) {
        activeRoom?.clearActiveRoom();
        router.navigate(['/overview/subscription']);
        return;
      }
      activeRoom?.initializeFromSession().subscribe();
      navigateByRole(router, rawRole, isSmallScreen);
    },
    error: () => {
      activeRoom?.clearActiveRoom();
      // Login already succeeded — enter the app even if subscription status cannot be loaded.
      navigateByRole(router, rawRole, isSmallScreen);
    },
  });
}
