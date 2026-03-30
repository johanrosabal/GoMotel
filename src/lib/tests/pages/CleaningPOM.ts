
import { PageObject, TestResult } from '../types';

export const CleaningPOM: PageObject = {
  name: 'Cola de Limpieza',
  route: '/cleaning',
  iconName: 'Sparkles',
  selectors: {
    container: '[data-testid="cleaning-root-container"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    if (typeof document !== 'undefined') {
      const isCorrectRoute = window.location.pathname === CleaningPOM.route;
      const container = document.querySelector(CleaningPOM.selectors.container);
      
      results.push({
        id: 'cle-ui-01',
        name: 'Módulo Limpieza Operativo',
        description: 'Verifica la integridad del contenedor principal de limpieza.',
        status: isCorrectRoute ? (container ? 'passed' : 'failed') : 'not-on-page',
        message: isCorrectRoute 
          ? (container ? 'Módulo cargado correctamente.' : 'Contenedor no encontrado.') 
          : 'Navegue a /cleaning para validar este módulo.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
