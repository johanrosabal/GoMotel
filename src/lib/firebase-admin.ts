import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // No usamos service account por petición del usuario.
  // Esto funcionará en Cloud Run con credenciales por defecto.
  // En local fallará si no hay credenciales por defecto configuradas en la máquina.
  try {
    return initializeApp();
  } catch (error) {
    console.error('Error al inicializar Firebase Admin:', error);
    return null;
  }
}

const app = initializeFirebaseAdmin();

export const adminDb = app ? getFirestore(app) : null as any;
export const adminAuth = app ? getAuth(app) : null as any;
export const db = adminDb; // Alias para compatibilidad con otros archivos
