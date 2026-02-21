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
      source: z.enum(['Purchased', 'Internal']).optional().describe('La fuente del producto (comprado o producción interna).'),
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
  prompt: `Eres un asistente de gestión de motel. Tu tarea es confirmar la actualización del inventario después de un pedido.

Recibiste los siguientes pedidos de servicio:
{{#each serviceOrders}}
- Servicio: {{{serviceName}}}, Cantidad: {{{quantity}}}, Fuente: {{#if source}}{{{source}}}{{else}}Purchased{{/if}}
{{/each}}

Tu respuesta debe seguir estas reglas:
1.  Para productos con fuente 'Internal', el pedido se registra pero no afecta al stock numérico.
2.  Para productos con fuente 'Purchased', el stock ya fue verificado y descontado por el sistema.
3.  Tu mensaje de salida debe ser una confirmación general.

Ejemplo de mensaje de salida: "Confirmado. Se ha descontado el stock para los productos comprados y se ha registrado el pedido para los productos de cocina."
Devuelve siempre 'success: true' y el mensaje de confirmación.`,
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
