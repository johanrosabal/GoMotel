'use server';

import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { EmailTemplate, Invoice } from '@/types';
import { revalidatePath } from 'next/cache';

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  try {
    const templatesRef = collection(db, 'emailTemplates');
    const q = query(templatesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as EmailTemplate[];
  } catch (error) {
    console.error('Error fetching email templates:', error);
    // Return empty array instead of throwing to allow build to continue
    return [];
  }
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  try {
    const templateRef = doc(db, 'emailTemplates', id);
    const snapshot = await getDoc(templateRef);
    
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as EmailTemplate;
    }
    return null;
  } catch (error) {
    console.error('Error fetching email template:', error);
    return null;
  }
}

export async function saveEmailTemplate(templateId: string, data: Partial<EmailTemplate>): Promise<void> {
  try {
    const templateRef = doc(db, 'emailTemplates', templateId);
    
    const saveData = {
      ...data,
      updatedAt: Date.now(),
    };
    
    // Si no tiene createdAt, es nuevo
    if (!data.createdAt) {
      saveData.createdAt = Date.now();
    }

    await setDoc(templateRef, saveData, { merge: true });
    revalidatePath('/marketing/templates');
  } catch (error) {
    console.error('Error saving email template:', error);
    throw new Error('No se pudo guardar la plantilla de correo.');
  }
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  try {
    const templateRef = doc(db, 'emailTemplates', id);
    await deleteDoc(templateRef);
    revalidatePath('/marketing/templates');
  } catch (error) {
    console.error('Error deleting email template:', error);
    throw new Error('No se pudo eliminar la plantilla de correo.');
  }
}
