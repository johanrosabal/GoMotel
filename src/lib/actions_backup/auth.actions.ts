'use server';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db, auth } from '../firebase';
import { doc, setDoc, getDocs, collection, Timestamp, query, where } from 'firebase/firestore';

// HACK: This is a hacky way to get the auth instance on the server.
// In a real app, you would use the Firebase Admin SDK for server-side auth.
// However, for this prototyping environment, we'll use the client SDK on the server.

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export async function login(values: z.infer<typeof loginSchema>) {
  try {
    const validatedFields = loginSchema.safeParse(values);
    if (!validatedFields.success) {
      return { error: 'Campos inválidos.' };
    }
    const { email, password } = validatedFields.data;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    // Map Firebase auth errors to user-friendly messages
    switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return { error: 'Correo electrónico o contraseña incorrectos.' };
        case 'auth/invalid-email':
            return { error: 'El formato del correo electrónico no es válido.' };
        default:
            return { error: 'Ocurrió un error inesperado. Por favor, inténtelo de nuevo.' };
    }
  }
  revalidatePath('/');
}

import { adminAuth, adminDb } from '../firebase-admin';

const registerSchema = z.object({
    email: z.string().email('Correo electrónico inválido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
    firstName: z.string().min(1, 'El nombre es requerido.').max(25, 'El nombre no debe exceder los 25 caracteres.'),
    lastName: z.string().min(1, 'El primer apellido es requerido.').max(25, 'El primer apellido no debe exceder los 25 caracteres.'),
    secondLastName: z.string().max(25, 'El segundo apellido no debe exceder los 25 caracteres.').optional(),
    birthDate: z.coerce.date(),
    idCard: z.string().length(11, 'Formato de Cédula de Identidad inválido. Use 0-0000-0000.'),
    phoneNumber: z.string().length(15, 'Formato de teléfono inválido. Use (506) XXXX-XXXX.'),
    whatsappNumber: z.string().optional(),
    role: z.enum(['Administrador', 'Recepcion', 'Conserje', 'Contador']).optional(),
}).refine(data => {
    if (data.whatsappNumber && data.whatsappNumber.length > 0) {
        return data.whatsappNumber.length === 15;
    }
    return true;
}, {
    message: 'Formato de WhatsApp inválido. Use (506) XXXX-XXXX.',
    path: ['whatsappNumber'],
});

export async function register(values: z.infer<typeof registerSchema>) {
    try {
        const validatedFields = registerSchema.safeParse(values);
        if (!validatedFields.success) {
             const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).join(' ');
            return { error: errorMessages || 'Campos inválidos.' };
        }
        const { email, password, firstName, lastName, secondLastName, birthDate, idCard, phoneNumber, whatsappNumber, role } = validatedFields.data;
        
        // Check if user exists with soft delete
        const userQuery = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
        if (!userQuery.empty) {
            const userDoc = userQuery.docs[0];
            if (userDoc.data().status === 'Deleted') {
                return { error: 'Este usuario fue eliminado del sistema y no se puede registrar de nuevo.' };
            }
        }

        // Create user with Client SDK
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        try {
            // Check if this is the first user to assign roles
            const adminRolesQuery = await getDocs(collection(db, 'roles_admin'));
            const isFirstUser = adminRolesQuery.empty;
            const userRole = role || (isFirstUser ? 'Administrador' : 'Recepcion');

            if (isFirstUser) {
                // This is the first user, make them an admin.
                await setDoc(doc(db, 'roles_admin', uid), { admin: true });
            }

            // Create user profile in Firestore
            await setDoc(doc(db, 'users', uid), {
                uid: uid,
                email: email,
                firstName: firstName,
                lastName: lastName,
                secondLastName: secondLastName || '',
                birthDate: birthDate,
                idCard: idCard,
                phoneNumber: phoneNumber,
                whatsappNumber: whatsappNumber || '',
                createdAt: new Date(),
                role: userRole,
                status: 'Active',
                photoURL: '',
            });
        } catch (firestoreError) {
            // If Firestore fails, delete the Auth user to allow retries
            try {
                await userCredential.user.delete();
            } catch (deleteError) {
                console.error('Failed to cleanup auth user after firestore failure:', deleteError);
            }
            throw firestoreError;
        }
        
    } catch (error: any) {
        console.error('Registration error:', error);
        
        const errorCode = error.code || error.errorInfo?.code;
        const errorMessage = error.message || '';
        
        if (errorCode === 'auth/email-already-in-use' || 
            errorMessage.includes('already in use') || 
            errorMessage.includes('ALREADY_EXISTS')) {
            return { error: 'Este correo electrónico ya está en uso por otra cuenta.' };
        }
        
        switch (errorCode) {
            case 'auth/invalid-email':
                return { error: 'El formato del correo electrónico no es válido.' };
            case 'auth/weak-password':
                return { error: 'La contraseña es demasiado débil.' };
            default:
                return { error: 'Ocurrió un error inesperado. Por favor, inténtelo de nuevo.' };
        }
    }
    revalidatePath('/');
    revalidatePath('/users');
    return { success: true };
}
