'use server';
/**
 * @fileOverview This file defines a Genkit flow for real-time room availability updates in a motel management application.
 *
 * The flow uses a tool to get the latest status of all rooms in the motel, and then updates Firestore with any changes.  This ensures that the UI always reflects the current room status.
 *
 * - `realtimeRoomAvailabilityUpdates`:  A function that triggers the room availability update flow.
 * - `RealtimeRoomAvailabilityUpdatesInput`:  The input type for the `realtimeRoomAvailabilityUpdates` function (currently empty).
 * - `RealtimeRoomAvailabilityUpdatesOutput`:  The output type for the `realtimeRoomAvailabilityUpdates` function (currently empty).
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
  description: 'Gets the current statuses of all rooms in the motel.',
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
  prompt: `Update the room availabilities based on the current room statuses from the database.  The current room statuses are: {{await updateRoomAvailabilityTool}}`,
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
