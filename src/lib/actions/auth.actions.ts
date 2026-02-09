'use server';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, auth } from '../firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';

// HACK: This is a hacky way to get the auth instance on the server.
// In a real app, you would use the Firebase Admin SDK for server-side auth.
// However, for this prototyping environment, we'll use the client SDK on the server.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
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
  redirect('/dashboard');
}

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export async function register(values: z.infer<typeof registerSchema>) {
    try {
        const validatedFields = registerSchema.safeParse(values);
        if (!validatedFields.success) {
            return { error: 'Campos inválidos.' };
        }
        const { email, password } = validatedFields.data;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        const user = userCredential.user;
        
        // Check if this is the first user
        const adminRolesQuery = await getDocs(collection(db, 'roles_admin'));
        if (adminRolesQuery.empty) {
            // This is the first user, make them an admin.
            await setDoc(doc(db, 'roles_admin', user.uid), { admin: true });
        }

    } catch (error: any) {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return { error: 'Este correo electrónico ya está en uso.' };
            case 'auth/invalid-email':
                return { error: 'El formato del correo electrónico no es válido.' };
            case 'auth/weak-password':
                return { error: 'La contraseña es demasiado débil.' };
            default:
                return { error: 'Ocurrió un error inesperado. Por favor, inténtelo de nuevo.' };
        }
    }
    revalidatePath('/');
    redirect('/dashboard');
}

export async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        return { error: 'Error al cerrar sesión.' };
    }
    revalidatePath('/');
    redirect('/');
}
