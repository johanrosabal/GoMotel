
import { PageObject, TestResult } from '../types';

export const InvoicePOM: PageObject = {
  name: 'Facturación',
  route: '/billing/invoices',
  iconName: 'Receipt',
  selectors: {
    container: '[data-testid="invoices-root-container"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    if (typeof document !== 'undefined') {
      const isCorrectRoute = window.location.pathname === InvoicePOM.route;
      const container = document.querySelector(InvoicePOM.selectors.container);
      
      results.push({
        id: 'inv-ui-01',
        name: 'Módulo Facturación Operativo',
        description: 'Verifica la integridad del contenedor principal de facturas.',
        status: isCorrectRoute ? (container ? 'passed' : 'failed') : 'not-on-page',
        message: isCorrectRoute 
          ? (container ? 'Módulo cargado correctamente.' : 'Contenedor no encontrado.') 
          : 'Navegue a /billing/invoices para validar este módulo.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
