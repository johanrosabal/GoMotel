
import { PageObject, TestResult } from '../types';

export const BarPOM: PageObject = {
  name: 'Cola de Bar',
  route: '/bar',
  iconName: 'GlassWater',
  selectors: {
    container: '[data-testid="order-queue-container"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    if (typeof document !== 'undefined') {
      const isCorrectRoute = window.location.pathname === BarPOM.route;
      const container = document.querySelector(BarPOM.selectors.container);
      
      results.push({
        id: 'bar-ui-01',
        name: 'Módulo Bar Operativo',
        description: 'Verifica la integridad del contenedor principal de bar.',
        status: isCorrectRoute ? (container ? 'passed' : 'failed') : 'not-on-page',
        message: isCorrectRoute 
          ? (container ? 'Módulo cargado correctamente.' : 'Contenedor no encontrado.') 
          : 'Navegue a /bar para validar este módulo.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
