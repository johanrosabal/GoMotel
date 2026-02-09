'use server';

/**
 * @fileOverview Este archivo define un flujo de Genkit para actualizaciones de inventario en tiempo real en una aplicación de gestión de motel.
 *
 * - `updateInventory`: Una función que actualiza el inventario en función de los pedidos de servicio.
 * - `UpdateInventoryInput`: El tipo de entrada para la función `updateInventory`.
 * - `UpdateInventoryOutput`: El tipo de retorno para la función `updateInventory`.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateInventoryInputSchema = z.object({
  roomNumber: z.string().describe('El número de habitación para el pedido de servicio.'),
  serviceOrders: z.array(
    z.object({
      serviceName: z.string().describe('El nombre del servicio pedido.'),
      quantity: z.number().int().positive().describe('La cantidad del servicio pedido.'),
    })
  ).describe('Un array de pedidos de servicio para la habitación.'),
});
export type UpdateInventoryInput = z.infer<typeof UpdateInventoryInputSchema>;

const UpdateInventoryOutputSchema = z.object({
  success: z.boolean().describe('Indica si la actualización del inventario fue exitosa.'),
  message: z.string().describe('Un mensaje que proporciona detalles sobre el resultado de la actualización.'),
});
export type UpdateInventoryOutput = z.infer<typeof UpdateInventoryOutputSchema>;

export async function updateInventory(input: UpdateInventoryInput): Promise<UpdateInventoryOutput> {
  return updateInventoryFlow(input);
}

const updateInventoryPrompt = ai.definePrompt({
  name: 'updateInventoryPrompt',
  input: {schema: UpdateInventoryInputSchema},
  output: {schema: UpdateInventoryOutputSchema},
  prompt: `Eres un experto en gestión de inventario de motel. Basado en los pedidos de servicio proporcionados para una habitación específica, determinarás si el inventario se puede actualizar con éxito.

Pedidos de Servicio para la Habitación {{{roomNumber}}}:
{{#each serviceOrders}}
- Servicio: {{{serviceName}}}, Cantidad: {{{quantity}}}
{{/each}}

Determina si la actualización del inventario es exitosa según las existencias disponibles. Devuelve un estado de éxito (verdadero o falso) y un mensaje descriptivo.`,
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
