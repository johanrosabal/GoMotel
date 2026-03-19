'use server';

import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const clientSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(50, 'El nombre no debe exceder los 50 caracteres.'),
  lastName: z.string().min(1, 'El apellido es requerido.').max(50, 'El apellido no debe exceder los 50 caracteres.'),
  secondLastName: z.string().max(50, 'El segundo apellido no debe exceder los 50 caracteres.').optional(),
  idCard: z.string().min(1, 'La cédula es requerida.'),
  email: z.string().email('Correo electrónico inválido.'),
  phoneNumber: z.string().min(1, 'El teléfono es requerido.'),
  whatsappNumber: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  isValidated: z.boolean().default(false),
});


export async function saveClient(values: z.infer<typeof clientSchema>) {
  const validatedFields = clientSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: 'Datos inválidos.' };
  }

  const { id, ...clientData } = validatedFields.data;

  try {
    if (id) {
      const clientRef = doc(db, 'clients', id);
      await updateDoc(clientRef, {
          ...clientData,
          birthDate: clientData.birthDate ? Timestamp.fromDate(clientData.birthDate) : null,
          isVip: clientData.isVip || false,
      });
    } else {
      await addDoc(collection(db, 'clients'), {
          ...clientData,
          birthDate: clientData.birthDate ? Timestamp.fromDate(clientData.birthDate) : null,
          isVip: clientData.isVip || false,
          isValidated: clientData.isValidated || false,
          createdAt: Timestamp.now(),
          visitCount: 0,
      });
    }
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Error saving client:', error);
    return { error: 'No se pudo guardar el cliente.' };
  }
}

export async function deleteClient(clientId: string) {
    if (!clientId) {
        return { error: 'ID de cliente no válido.' };
    }

    try {
        await deleteDoc(doc(db, 'clients', clientId));
        revalidatePath('/clients');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete client:', error);
        return { error: 'No se pudo eliminar el cliente.' };
    }
}

    