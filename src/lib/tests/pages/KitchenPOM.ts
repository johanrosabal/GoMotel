
import { PageObject, TestResult } from '../types';

export const KitchenPOM: PageObject = {
  name: 'Cola de Cocina',
  route: '/kitchen',
  iconName: 'ChefHat',
  selectors: {
    container: '[data-testid="orderqueuepage-main-div"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    if (typeof document !== 'undefined') {
      const isCorrectRoute = window.location.pathname === KitchenPOM.route;
      const container = document.querySelector(KitchenPOM.selectors.container);
      
      results.push({
        id: 'kit-ui-01',
        name: 'Módulo Cocina Operativo',
        description: 'Verifica la integridad del contenedor principal de cocina.',
        status: isCorrectRoute ? (container ? 'passed' : 'failed') : 'not-on-page',
        message: isCorrectRoute 
          ? (container ? 'Módulo cargado correctamente.' : 'Contenedor no encontrado.') 
          : 'Navegue a /kitchen para validar este módulo.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
