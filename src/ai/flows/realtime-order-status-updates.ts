'use server';
/**
 * @fileOverview This file defines a Genkit flow for providing real-time updates on the status of service orders in a motel setting.
 *
 * - `realtimeOrderStatusUpdates`: A function that takes a room number as input and returns the latest order status for that room.
 * - `RealtimeOrderStatusUpdatesInput`: The input type for the realtimeOrderStatusUpdates function.
 * - `RealtimeOrderStatusUpdatesOutput`: The return type for the realtimeOrderStatusUpdates function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RealtimeOrderStatusUpdatesInputSchema = z.object({
  roomNumber: z.string().describe('The room number for which to retrieve the order status.'),
});
export type RealtimeOrderStatusUpdatesInput = z.infer<typeof RealtimeOrderStatusUpdatesInputSchema>;

const RealtimeOrderStatusUpdatesOutputSchema = z.object({
  orderStatus: z.string().describe('The current status of the service order for the specified room (e.g., pending, preparing, delivered).'),
  items: z.string().describe('The items that were ordered.'),
});
export type RealtimeOrderStatusUpdatesOutput = z.infer<typeof RealtimeOrderStatusUpdatesOutputSchema>;

export async function realtimeOrderStatusUpdates(input: RealtimeOrderStatusUpdatesInput): Promise<RealtimeOrderStatusUpdatesOutput> {
  return realtimeOrderStatusUpdatesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'realtimeOrderStatusUpdatesPrompt',
  input: {schema: RealtimeOrderStatusUpdatesInputSchema},
  output: {schema: RealtimeOrderStatusUpdatesOutputSchema},
  prompt: `You are a motel service coordinator providing real-time updates on service orders.

  Provide the current status of the service order for room number {{{roomNumber}}}. Return the status (e.g., pending, preparing, delivered) and list the items requested in the response.
  Be concise and provide only the current status.
  Do not add extra text outside of the output schema.
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
