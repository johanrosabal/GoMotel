'use server';

import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';
import { Client } from '@/types';

export async function getClient(clientId: string): Promise<any | null> {
  try {
    const clientRef = doc(db, 'clients', clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return null;
    
    const data = clientSnap.data();
    return { 
      id: clientSnap.id, 
      ...data,
      birthDate: data.birthDate ? { seconds: data.birthDate.seconds, nanoseconds: data.birthDate.nanoseconds } : null,
      createdAt: data.createdAt ? { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds } : null,
    };
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
}

const clientSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1, 'El nombre es requerido.').max(50, 'El nombre no debe exceder los 50 caracteres.'),
  lastName: z.string().min(1, 'El apellido es requerido.').max(50, 'El apellido no debe exceder los 50 caracteres.'),
  secondLastName: z.string().max(50, 'El segundo apellido no debe exceder los 50 caracteres.').optional(),
  idCard: z.string().min(1, 'La cédula es requerida.'),
  email: z.string().email('Correo electrónico inválido.').optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  birthDate: z.coerce.date().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
  isValidated: z.boolean().default(false),
  isBlacklisted: z.boolean().optional(),
  blacklistReason: z.string().optional(),
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

export async function toggleClientBlacklist(clientId: string, isBlacklisted: boolean, reason?: string) {
    console.log('--- toggleClientBlacklist called ---');
    console.log('Client ID:', clientId);
    console.log('Is Blacklisted:', isBlacklisted);
    console.log('Reason:', reason);
    
    if (!clientId) {
        console.error('Error: Invalid Client ID');
        return { error: 'ID de cliente no válido.' };
    }

    try {
        const clientRef = doc(db, 'clients', clientId);
        console.log('Updating document...');
        await updateDoc(clientRef, {
            isBlacklisted,
            blacklistReason: reason || null,
        });
        console.log('Update successful. Revalidating path...');
        revalidatePath('/clients');
        return { success: true };
    } catch (error) {
        console.error('Error toggling client blacklist in Firestore:', error);
        return { error: 'No se pudo actualizar el estado de lista negra.' };
    }
}

export async function toggleClientValidation(clientId: string, isValidated: boolean) {
    if (!clientId) return { error: 'ID de cliente no válido.' };

    try {
        const clientRef = doc(db, 'clients', clientId);
        await updateDoc(clientRef, {
            isValidated
        });
        revalidatePath('/clients');
        return { success: true };
    } catch (error) {
        console.error('Error toggling client validation:', error);
        return { error: 'No se pudo actualizar el estado de validación.' };
    }
}

export async function checkClientByIdCard(idCard: string): Promise<any | null> {
    try {
        const q = query(collection(db, 'clients'), where('idCard', '==', idCard), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return null;
        
        const clientDoc = querySnapshot.docs[0];
        const data = clientDoc.data();
        
        return { 
            id: clientDoc.id, 
            ...data,
            birthDate: data.birthDate ? { seconds: data.birthDate.seconds, nanoseconds: data.birthDate.nanoseconds } : null,
            createdAt: data.createdAt ? { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds } : null,
        };
    } catch (error) {
        console.error('Error checking client by idCard:', error);
        return null;
    }
}

    