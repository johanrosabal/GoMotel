'use server';

import { TestResult } from '../tests/types';
import { adminDb } from '../firebase-admin';
import { getSystemSettings } from './system.actions';
import { testSmtpConnection } from './email-sender.actions';

export async function pingFirebase(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!adminDb) {
      throw new Error('Firebase Admin no está inicializado (no se usa Service Account en local).');
    }
    await adminDb.collection('settings').limit(1).get();
    
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
