export interface SystemDocumentationEntry {
  id: string;
  file: string;
  title: string;
  description: string;
  order: number;
}

/** Markdown files under src/assets/documentation */
export const SYSTEM_DOCUMENTATION_CATALOG: SystemDocumentationEntry[] = [
  {
    id: 'index',
    file: 'README.md',
    title: 'Documentation index',
    description: 'Guide to all topics and audiences',
    order: 0,
  },
  {
    id: 'overview',
    file: '01-system-overview.md',
    title: 'System overview',
    description: 'Modules, roles, and architecture',
    order: 1,
  },
  {
    id: 'getting-started',
    file: '02-getting-started.md',
    title: 'Getting started',
    description: 'Login, navigation, and daily basics',
    order: 2,
  },
  {
    id: 'patient-care',
    file: '03-patient-care-workflows.md',
    title: 'Patient care workflows',
    description: 'Queue, visits, pharmacy tab',
    order: 3,
  },
  {
    id: 'pharmacy-inventory',
    file: '04-pharmacy-and-inventory.md',
    title: 'Pharmacy & inventory',
    description: 'Stock, batches, transfers, OTC',
    order: 4,
  },
  {
    id: 'admin-security',
    file: '05-administration-and-security.md',
    title: 'Administration & security',
    description: 'Users, access control, settings',
    order: 5,
  },
  {
    id: 'technical',
    file: '06-technical-guide.md',
    title: 'Technical guide',
    description: 'Deployment and IT support',
    order: 6,
  },
  {
    id: 'expenses',
    file: '07-expense-management.md',
    title: 'Expense management',
    description: 'Categories, accounts, transactions',
    order: 7,
  },
];
