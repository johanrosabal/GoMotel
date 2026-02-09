'use server';
/**
 * @fileOverview Este archivo define un flujo de Genkit para actualizaciones de disponibilidad de habitaciones en tiempo real en una aplicación de gestión de motel.
 *
 * El flujo utiliza una herramienta para obtener el último estado de todas las habitaciones del motel y luego resume el estado.
 *
 * - `realtimeRoomAvailabilityUpdates`:  Una función que activa el flujo de actualización de disponibilidad de habitaciones.
 * - `RealtimeRoomAvailabilityUpdatesInput`:  El tipo de entrada para la función `realtimeRoomAvailabilityUpdates` (actualmente vacío).
 * - `RealtimeRoomAvailabilityUpdatesOutput`:  El tipo de salida para la función `realtimeRoomAvailabilityUpdates`.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getRoomStatuses} from '@/services/room-service';

const RealtimeRoomAvailabilityUpdatesInputSchema = z.object({});
export type RealtimeRoomAvailabilityUpdatesInput = z.infer<typeof RealtimeRoomAvailabilityUpdatesInputSchema>;

const RealtimeRoomAvailabilityUpdatesOutputSchema = z.object({
    summary: z.string().describe('Un resumen del estado de las habitaciones.'),
});
export type RealtimeRoomAvailabilityUpdatesOutput = z.infer<typeof RealtimeRoomAvailabilityUpdatesOutputSchema>;

export async function realtimeRoomAvailabilityUpdates(input: RealtimeRoomAvailabilityUpdatesInput): Promise<RealtimeRoomAvailabilityUpdatesOutput> {
  return realtimeRoomAvailabilityUpdatesFlow(input);
}

const getRoomStatusesTool = ai.defineTool({
  name: 'getRoomStatuses',
  description: 'Obtiene los estados actuales de todas las habitaciones del motel.',
  inputSchema: z.object({}),
  outputSchema: z.record(z.string(), z.string()),
}, async () => {
  const roomStatuses = await getRoomStatuses();
  return roomStatuses;
});


const roomAvailabilityPrompt = ai.definePrompt({
  name: 'roomAvailabilityPrompt',
  tools: [getRoomStatusesTool],
  output: { schema: RealtimeRoomAvailabilityUpdatesOutputSchema },
  prompt: `Usa la herramienta getRoomStatuses para obtener el estado actual de todas las habitaciones. Luego, proporciona un resumen conciso de la situación (cuántas están ocupadas, disponibles, etc.).`,
});

const realtimeRoomAvailabilityUpdatesFlow = ai.defineFlow(
  {
    name: 'realtimeRoomAvailabilityUpdatesFlow',
    inputSchema: RealtimeRoomAvailabilityUpdatesInputSchema,
    outputSchema: RealtimeRoomAvailabilityUpdatesOutputSchema,
  },
  async () => {
    const {output} = await roomAvailabilityPrompt({});
    return output!;
  }
);
