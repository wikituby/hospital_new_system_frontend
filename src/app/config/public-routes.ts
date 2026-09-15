export const PUBLIC_APP_PATH_PREFIXES = [
  '/landingpage',
  '/service',
  '/about',
  '/book-appointment',
  '/contact',
  '/login',
  '/login2',
  '/login3',
  '/login4',
  '/login-mobile',
  '/signup',
  '/sendemail',
  '/resetpassword',
  '/products',
  '/cart',
  '/product-details',
  '/mens-fashion',
];

export function normalizeAppPath(url: string): string {
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

export function isPublicAppPath(url: string): boolean {
  const path = normalizeAppPath(url);
  return PUBLIC_APP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
