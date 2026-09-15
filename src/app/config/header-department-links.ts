/** Header More → Departments: overview shell routes. */
export interface HeaderDepartmentLink {
  pageKey: string;
  label: string;
  /** Absolute route, e.g. /overview/lab-v2 */
  path: string;
  icon: string;
}

export const HEADER_DEPARTMENT_LINKS: HeaderDepartmentLink[] = [
  { pageKey: 'scan', label: 'Ultrasound Scan', path: '/overview/scan-v2', icon: 'bi-camera' },
  { pageKey: 'lab', label: 'Medical Laboratory', path: '/overview/lab-v2', icon: 'bi-clipboard2-pulse' },
  { pageKey: 'dental', label: 'Dental Department', path: '/overview/dental-v2', icon: 'bi-emoji-smile' },
  { pageKey: 'lab-mobile', label: 'Lab Mobile Page', path: '/overview/lab-mobile', icon: 'bi-phone' },
  {
    pageKey: 'maternal-child-health-requests',
    label: 'Maternal & Child Health',
    path: '/overview/mch-v2',
    icon: 'bi-heart-pulse',
  },
  {
    pageKey: 'dashboard',
    label: 'Financial Management',
    path: '/overview/dashboard',
    icon: 'bi-currency-dollar',
  },
];
