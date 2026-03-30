
import { PageObject, TestResult } from '../types';

export const ClientPOM: PageObject = {
  name: 'Gestión de Clientes',
  route: '/clients',
  iconName: 'UserCog',
  selectors: {
    container: '[data-testid="clients-root-container"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    if (typeof document !== 'undefined') {
      const isCorrectRoute = window.location.pathname === ClientPOM.route;
      const container = document.querySelector(ClientPOM.selectors.container);
      
      results.push({
        id: 'cli-ui-01',
        name: 'Módulo Clientes Operativo',
        description: 'Verifica la integridad del contenedor principal de clientes.',
        status: isCorrectRoute ? (container ? 'passed' : 'failed') : 'not-on-page',
        message: isCorrectRoute 
          ? (container ? 'Módulo cargado correctamente.' : 'Contenedor no encontrado.') 
          : 'Navegue a /clients para validar este módulo.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
