
import { PageObject, TestResult } from '../types';

export const SystemPOM: PageObject = {
  name: 'Configuración del Sistema',
  selectors: {
    btnRunDiagnostic: '[data-testid="btn-run-diagnostic"]',
  },

  validate: async (): Promise<TestResult[]> => {
    const results: TestResult[] = [];
    const startTime = Date.now();

    // Simulación de validación de UI (esto correría en el cliente)
    if (typeof document !== 'undefined') {
      const btnDiagnostic = document.querySelector(SystemPOM.selectors.btnRunDiagnostic);
      results.push({
        id: 'sys-ui-00',
        name: 'Botón Diagnóstico (Página Actual)',
        description: 'Verifica que el botón de acción principal de esta página sea accesible.',
        status: btnDiagnostic ? 'passed' : 'failed',
        message: btnDiagnostic ? 'El botón está presente y listo para POM.' : 'Error interno: No se encuentra el propio botón de la página.',
        category: 'ui',
        duration: Date.now() - startTime
      });
    }

    return results;
  }
};
