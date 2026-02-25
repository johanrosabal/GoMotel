'use server';
/**
 * @fileOverview Flujo de Genkit para analizar el rendimiento del motel.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalysisInputSchema = z.object({
  stats: z.object({
    invoicesCount: z.number(),
    totalRevenue: z.number(),
    staysCount: z.number(),
    lowStockItems: z.array(z.string()),
  }),
});

const AnalysisOutputSchema = z.object({
  summary: z.string().describe('Un resumen narrativo del rendimiento.'),
  suggestions: z.array(z.string()).describe('Sugerencias para mejorar la operación.'),
});

export async function analyzePerformance(stats: any) {
  return analyzePerformanceFlow({ stats });
}

const prompt = ai.definePrompt({
  name: 'performanceAnalysisPrompt',
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `Eres un consultor experto en gestión hotelera y de moteles. 
  Analiza los siguientes datos de rendimiento de los últimos días:

  - Facturas generadas: {{stats.invoicesCount}}
  - Ingresos totales: {{stats.totalRevenue}}
  - Estancias registradas: {{stats.staysCount}}
  - Artículos con stock bajo: {{#each stats.lowStockItems}}{{{this}}}, {{/each}}

  Proporciona un resumen ejecutivo breve y 3 sugerencias accionables para el administrador. 
  Habla de forma profesional pero cercana.`,
});

const analyzePerformanceFlow = ai.defineFlow(
  {
    name: 'analyzePerformanceFlow',
    inputSchema: AnalysisInputSchema,
    outputSchema: AnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
