import * as admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK.
 * This should only be used on the server side.
 * Requires FIREBASE_SERVICE_ACCOUNT environment variable to be set with the JSON content.
 */
function initializeAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not set. Admin functions will fail.');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Fix private key formatting if it was passed as a string with escaped newlines
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    return null;
  }
}

const app = initializeAdmin();

export const adminAuth = app ? admin.auth(app) : null;
export const adminDb = app ? admin.firestore(app) : null;
export default admin;
