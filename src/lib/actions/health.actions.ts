
'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { TestResult } from '../tests/types';

// Intentar inicializar admin si no está
if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (error) {
    console.error('Error al inicializar Firebase Admin en Health Actions:', error);
  }
}

import { getSystemSettings } from './system.actions';
import { testSmtpConnection } from './email-sender.actions';

export async function pingFirebase(): Promise<TestResult> {
  // Mantener esta función por si en el futuro se configura el Service Account
  const start = Date.now();
  try {
    const db = getFirestore();
    await db.collection('settings').limit(1).get();
    
    return {
      id: 'conn-fb-01',
      name: 'Conexión Firestore (Admin)',
      description: 'Verifica la conectividad administrativa con Firebase.',
      status: 'passed',
      message: 'Base de datos conectada y respondiendo.',
      category: 'connectivity',
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      id: 'conn-fb-01',
      name: 'Conexión Firestore (Admin)',
      description: 'Verifica la conectividad administrativa con Firebase.',
      status: 'failed',
      message: error.message || 'Error de permisos o conexión.',
      category: 'connectivity',
      duration: Date.now() - start
    };
  }
}

export async function pingSmtp(): Promise<TestResult> {
  const start = Date.now();
  try {
    const settings = await getSystemSettings();
    if (!settings.smtpUser || !settings.smtpPass) {
      return {
        id: 'conn-smtp-01',
        name: 'Configuración SMTP',
        description: 'Verifica el estado del servidor de correos.',
        status: 'warning',
        message: 'No hay credenciales SMTP configuradas en Ajustes.',
        category: 'connectivity',
        duration: Date.now() - start
      };
    }

    const test = await testSmtpConnection({
      smtpHost: settings.smtpHost || 'smtp.gmail.com',
      smtpPort: settings.smtpPort || 465,
      smtpUser: settings.smtpUser,
      smtpPass: settings.smtpPass, // Usando datos reales
      smtpFrom: settings.smtpFrom || settings.smtpUser
    });

    return {
      id: 'conn-smtp-01',
      name: 'Servidor de Correo (SMTP)',
      description: 'Prueba de conexión real con los ajustes guardados.',
      status: test.success ? 'passed' : 'failed',
      message: test.message,
      category: 'connectivity',
      duration: Date.now() - start
    };
  } catch (error: any) {
    return {
      id: 'conn-smtp-01',
      name: 'Servidor de Correo (SMTP)',
      description: 'Prueba de conexión real.',
      status: 'failed',
      message: error.message || 'Error al conectar con SMTP.',
      category: 'connectivity',
      duration: Date.now() - start
    };
  }
}
