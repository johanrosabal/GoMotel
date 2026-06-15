
// 'use server'; // Removido para que se ejecute en el cliente

import { doc, getDoc, setDoc } from 'firebase/firestore';
// // import { revalidatePath } from 'next/cache';
const revalidatePath = (path: string) => { console.log('[Client] Mock revalidatePath called for ' + path); };

import { db } from '../firebase';
import type { SystemSettings } from '@/types';

const SETTINGS_DOC_ID = 'system';
const DEFAULT_DOMAIN = 'api-krdy3op4ma-uc.a.run.app';

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: SETTINGS_DOC_ID,
        verificationApiDomain: data.verificationApiDomain || DEFAULT_DOMAIN,
        publicMenuDarkMode: data.publicMenuDarkMode || false,
        supportEmail: data.supportEmail || '',
        supportPhone: data.supportPhone || '',
        smtpHost: data.smtpHost || 'smtp.gmail.com',
        smtpPort: data.smtpPort || 465,
        smtpUser: data.smtpUser || '',
        smtpPass: data.smtpPass || '',
        smtpFrom: data.smtpFrom || '',
      } as SystemSettings;
    }

    return {
      id: SETTINGS_DOC_ID,
      verificationApiDomain: DEFAULT_DOMAIN,
      publicMenuDarkMode: false,
      supportEmail: '',
      supportPhone: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
    } as SystemSettings;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return {
      id: SETTINGS_DOC_ID,
      verificationApiDomain: DEFAULT_DOMAIN,
      publicMenuDarkMode: false,
      supportEmail: '',
      supportPhone: '',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: '',
      smtpPass: '',
      smtpFrom: '',
    } as SystemSettings;
  }
}

export async function updateSystemSettings(data: Partial<SystemSettings>) {
  try {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, data, { merge: true });
    revalidatePath('/settings');
    revalidatePath('/clients');
    revalidatePath('/public/menu');
    return { success: true };
  } catch (error) {
    console.error('Error updating system settings:', error);
    return { error: 'No se pudieron actualizar los ajustes del sistema.' };
  }
}
