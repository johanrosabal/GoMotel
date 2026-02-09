'use server';
/**
 * @fileOverview Este archivo define un flujo de Genkit para actualizaciones de disponibilidad de habitaciones en tiempo real en una aplicación de gestión de motel.
 *
 * El flujo utiliza una herramienta para obtener el último estado de todas las habitaciones del motel y luego actualiza Firestore con cualquier cambio. Esto asegura que la interfaz de usuario siempre refleje el estado actual de la habitación.
 *
 * - `realtimeRoomAvailabilityUpdates`:  Una función que activa el flujo de actualización de disponibilidad de habitaciones.
 * - `RealtimeRoomAvailabilityUpdatesInput`:  El tipo de entrada para la función `realtimeRoomAvailabilityUpdates` (actualmente vacío).
 * - `RealtimeRoomAvailabilityUpdatesOutput`:  El tipo de salida para la función `realtimeRoomAvailabilityUpdates` (actualmente vacío).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getRoomStatuses} from '@/src/services/room-service';

const RealtimeRoomAvailabilityUpdatesInputSchema = z.object({});
export type RealtimeRoomAvailabilityUpdatesInput = z.infer<typeof RealtimeRoomAvailabilityUpdatesInputSchema>;

const RealtimeRoomAvailabilityUpdatesOutputSchema = z.object({});
export type RealtimeRoomAvailabilityUpdatesOutput = z.infer<typeof RealtimeRoomAvailabilityUpdatesOutputSchema>;

export async function realtimeRoomAvailabilityUpdates(input: RealtimeRoomAvailabilityUpdatesInput): Promise<RealtimeRoomAvailabilityUpdatesOutput> {
  return realtimeRoomAvailabilityUpdatesFlow(input);
}

const updateRoomAvailabilityTool = ai.defineTool({
  name: 'getRoomStatuses',
  description: 'Obtiene los estados actuales de todas las habitaciones del motel.',
  inputSchema: z.object({}),
  outputSchema: z.record(z.string(), z.string()),
}, async () => {
  // Assuming getRoomStatuses fetches data from Firestore.
  const roomStatuses = await getRoomStatuses();
  return roomStatuses;
});


const roomAvailabilityPrompt = ai.definePrompt({
  name: 'roomAvailabilityPrompt',
  tools: [updateRoomAvailabilityTool],
  prompt: `Actualiza la disponibilidad de las habitaciones según los estados actuales de las habitaciones de la base de datos. Los estados actuales de las habitaciones son: {{await updateRoomAvailabilityTool}}`,
});

const realtimeRoomAvailabilityUpdatesFlow = ai.defineFlow(
  {
    name: 'realtimeRoomAvailabilityUpdatesFlow',
    inputSchema: RealtimeRoomAvailabilityUpdatesInputSchema,
    outputSchema: RealtimeRoomAvailabilityUpdatesOutputSchema,
  },
  async input => {
    // Call the prompt to trigger the tool and potentially update Firestore.
    await roomAvailabilityPrompt(input);
    return {}; // The flow itself doesn't return any specific data.
  }
);
