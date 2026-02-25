'use server';

import { z } from 'zod';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const companyInfoSchema = z.object({
  id: z.string().optional(),
  tradeName: z.string().min(1, 'El nombre comercial es requerido.'),
  legalId: z.string().min(1, 'La cédula jurídica es requerida.'),
  country: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  websiteUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  logoUrl: z.string().optional(),
});

export async function saveCompanyInfo(values: z.infer<typeof companyInfoSchema>) {
  const validatedFields = companyInfoSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: 'Datos inválidos.' };
  }

  const { id, ...companyData } = validatedFields.data;

  try {
    // We use a singleton document with a fixed ID 'main'
    const companyInfoRef = doc(db, 'companyInfo', 'main');
    await setDoc(companyInfoRef, companyData, { merge: true });
    
    revalidatePath('/settings/company');
    return { success: true };
  } catch (error) {
    console.error('Error saving company info:', error);
    return { error: 'No se pudo guardar la información de la empresa.' };
  }
}
