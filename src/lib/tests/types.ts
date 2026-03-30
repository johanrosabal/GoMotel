import { LucideIcon } from 'lucide-react';

export type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'warning' | 'not-on-page';

export interface TestResult {
  id: string;
  name: string;
  description: string;
  status: TestStatus;
  message?: string;
  duration?: number;
  lastRun?: Date;
  category: 'connectivity' | 'integrity' | 'logic' | 'ui';
}

export interface PageObject {
  name: string;
  route: string;
  iconName: string; // Nombre del icono de Lucide
  selectors: Record<string, string>;
  validate: () => Promise<TestResult[]>;
}
