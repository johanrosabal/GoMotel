import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    // 1. Ejecutar Playwright en el servidor (esto requiere que Next.js tenga acceso al shell)
    try {
      await execAsync('npx playwright test');
    } catch (e: any) {
      // Si falla algún test, Playwright devuelve código de salida 1.
      // Atrapamos el error silenciosamente para poder leer el test-results.json generado.
    }

    // 2. Leer resultados en JSON
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    
    // Verificamos si existe antes de leer (por si Playwright falló catastróficamente)
    try {
      await fs.access(resultsPath);
    } catch {
      return NextResponse.json({ error: 'No se generaron resultados de prueba.' }, { status: 500 });
    }

    const data = await fs.readFile(resultsPath, 'utf-8');
    const report = JSON.parse(data);

    const finalResults: any[] = [];
    
    // Playwright agrupa en suites. Buscamos todas las specs de manera recursiva simple
    const suites = report.suites || [];
    
    // Función recursiva para extraer los tests
    const extractSpecs = (suiteList: any[]) => {
      let allSpecs: any[] = [];
      for (const s of suiteList) {
        if (s.specs) allSpecs = allSpecs.concat(s.specs);
        if (s.suites) allSpecs = allSpecs.concat(extractSpecs(s.suites));
      }
      return allSpecs;
    };

    const specs = extractSpecs(suites);

    for (const spec of specs) {
      const name = spec.title;
      const ok = spec.ok;
      const duration = spec.tests?.[0]?.results?.[0]?.duration || 0;
      
      finalResults.push({
        id: `e2e-${name.replace(/\s+/g, '-').toLowerCase()}`,
        name: name,
        description: 'Validación automatizada end-to-end con Playwright.',
        status: ok ? 'passed' : 'failed',
        message: ok ? 'Interfaz validada con éxito en navegador headless.' : 'Error al validar el contenedor de la interfaz.',
        category: 'e2e',
        duration
      });
    }

    return NextResponse.json({ results: finalResults });

  } catch (error: any) {
    console.error("Error al correr E2E:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
