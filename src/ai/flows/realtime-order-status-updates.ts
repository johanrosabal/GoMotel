'use server';
/**
 * @fileOverview Este archivo define un flujo de Genkit para proporcionar actualizaciones en tiempo real sobre el estado de los pedidos de servicio en un entorno de motel.
 *
 * - `realtimeOrderStatusUpdates`: Una función que toma un número de habitación como entrada y devuelve el último estado del pedido para esa habitación.
 * - `RealtimeOrderStatusUpdatesInput`: El tipo de entrada para la función realtimeOrderStatusUpdates.
 * - `RealtimeOrderStatusUpdatesOutput`: El tipo de retorno para la función realtimeOrderStatusUpdates.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RealtimeOrderStatusUpdatesInputSchema = z.object({
  roomNumber: z.string().describe('El número de habitación para el cual obtener el estado del pedido.'),
});
export type RealtimeOrderStatusUpdatesInput = z.infer<typeof RealtimeOrderStatusUpdatesInputSchema>;

const RealtimeOrderStatusUpdatesOutputSchema = z.object({
  orderStatus: z.string().describe('El estado actual del pedido de servicio para la habitación especificada (p. ej., pendiente, en preparación, entregado).'),
  items: z.string().describe('Los artículos que se pidieron.'),
});
export type RealtimeOrderStatusUpdatesOutput = z.infer<typeof RealtimeOrderStatusUpdatesOutputSchema>;

export async function realtimeOrderStatusUpdates(input: RealtimeOrderStatusUpdatesInput): Promise<RealtimeOrderStatusUpdatesOutput> {
  return realtimeOrderStatusUpdatesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'realtimeOrderStatusUpdatesPrompt',
  input: {schema: RealtimeOrderStatusUpdatesInputSchema},
  output: {schema: RealtimeOrderStatusUpdatesOutputSchema},
  prompt: `Eres un coordinador de servicios de motel que proporciona actualizaciones en tiempo real sobre los pedidos de servicio.

  Proporciona el estado actual del pedido de servicio para la habitación número {{{roomNumber}}}. Devuelve el estado (p. ej., pendiente, en preparación, entregado) y enumera los artículos solicitados en la respuesta.
  Sé conciso y proporciona solo el estado actual.
  No agregues texto adicional fuera del esquema de salida.
  `,
});

const realtimeOrderStatusUpdatesFlow = ai.defineFlow(
  {
    name: 'realtimeOrderStatusUpdatesFlow',
    inputSchema: RealtimeOrderStatusUpdatesInputSchema,
    outputSchema: RealtimeOrderStatusUpdatesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
