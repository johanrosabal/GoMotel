'use server';

import { z } from 'zod';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const companyContactSchema = z.object({
  label: z.string().min(1, 'La etiqueta es requerida.'),
  value: z.string().min(1, 'El valor es requerido.'),
});

const companySocialSchema = z.object({
  platform: z.string().min(1, 'La plataforma es requerida.'),
  url: z.string().url('URL inválida.'),
});

const companyBankAccountSchema = z.object({
  bankName: z.string().min(1, 'El banco es requerido.'),
  accountHolder: z.string().min(1, 'El titular es requerido.'),
  accountNumber: z.string().min(1, 'El número de cuenta es requerido.'),
  iban: z.string().optional(),
});

const companyInfoSchema = z.object({
  id: z.string().optional(),
  tradeName: z.string().min(1, 'El nombre comercial es requerido.'),
  legalId: z.string().min(1, 'La cédula jurídica es requerida.'),
  country: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  websiteUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  logoUrl: z.string().optional(),
  phoneNumbers: z.array(companyContactSchema).optional(),
  emails: z.array(companyContactSchema).optional(),
  socialMedia: z.array(companySocialSchema).optional(),
  bankAccounts: z.array(companyBankAccountSchema).optional(),
});


export async function saveCompanyInfo(values: z.infer<typeof companyInfoSchema>) {
  const validatedFields = companyInfoSchema.safeParse(values);

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten());
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
