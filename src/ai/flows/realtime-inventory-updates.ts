'use server';

/**
 * @fileOverview This file defines a Genkit flow for real-time inventory updates in a motel management application.
 *
 * - `updateInventory`: A function that updates the inventory based on service orders.
 * - `UpdateInventoryInput`: The input type for the `updateInventory` function.
 * - `UpdateInventoryOutput`: The return type for the `updateInventory` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateInventoryInputSchema = z.object({
  roomNumber: z.string().describe('The room number for the service order.'),
  serviceOrders: z.array(
    z.object({
      serviceName: z.string().describe('The name of the service ordered.'),
      quantity: z.number().int().positive().describe('The quantity of the service ordered.'),
    })
  ).describe('An array of service orders for the room.'),
});
export type UpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;

const UpdateInventoryOutputSchema = z.object({
  success: z.boolean().describe('Indicates whether the inventory update was successful.'),
  message: z.string().describe('A message providing details about the update result.'),
});
export type UpdateInventoryOutput = z.infer<typeof UpdateInventoryOutputSchema>;

export async function updateInventory(input: UpdateInventoryInput): Promise<UpdateInventoryOutput> {
  return updateInventoryFlow(input);
}

const updateInventoryPrompt = ai.definePrompt({
  name: 'updateInventoryPrompt',
  input: {schema: UpdateInventoryInputSchema},
  output: {schema: UpdateInventoryOutputSchema},
  prompt: `You are a motel inventory management expert. Based on the service orders provided for a specific room, you will determine if the inventory can be successfully updated.

Service Orders for Room {{{roomNumber}}}:
{{#each serviceOrders}}
- Service: {{{serviceName}}}, Quantity: {{{quantity}}}
{{/each}}

Determine if the inventory update is successful based on available stock. Return a success status (true or false) and a descriptive message.`,
});

const updateInventoryFlow = ai.defineFlow(
  {
    name: 'updateInventoryFlow',
    inputSchema: UpdateInventoryInputSchema,
    outputSchema: UpdateInventoryOutputSchema,
  },
  async input => {
    const {output} = await updateInventoryPrompt(input);
    return output!;
  }
);
