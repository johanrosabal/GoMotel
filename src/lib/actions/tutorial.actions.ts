'use server';

import { db } from '@/lib/firebase';
import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    deleteDoc, 
    query, 
    orderBy, 
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Tutorial } from '@/types';

// Helper to convert Firestore Tutorial to plain object
function toTutorialObject(doc: any): Tutorial {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt ? {
            seconds: data.createdAt.seconds,
            nanoseconds: data.createdAt.nanoseconds
        } : null,
        updatedAt: data.updatedAt ? {
            seconds: data.updatedAt.seconds,
            nanoseconds: data.updatedAt.nanoseconds
        } : null,
    } as any;
}

export async function saveTutorial(data: Partial<Tutorial>) {
    try {
        const id = data.id || doc(collection(db, 'tutorials')).id;
        const tutorialRef = doc(db, 'tutorials', id);
        
        const now = Timestamp.now();
        const finalData = {
            ...data,
            id,
            updatedAt: now,
            createdAt: data.createdAt ? data.createdAt : now,
            order: data.order || 0,
            category: data.category || 'General'
        };

        await setDoc(tutorialRef, finalData, { merge: true });
        revalidatePath('/manual/tutorials');
        revalidatePath('/dashboard/tutorials/manage');
        return { success: true, id };
    } catch (error: any) {
        console.error('Error saving tutorial:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteTutorial(id: string) {
    try {
        await deleteDoc(doc(db, 'tutorials', id));
        revalidatePath('/manual/tutorials');
        revalidatePath('/dashboard/tutorials/manage');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting tutorial:', error);
        return { success: false, error: error.message };
    }
}

export async function getTutorials() {
    try {
        const tutorialsRef = collection(db, 'tutorials');
        const q = query(tutorialsRef, orderBy('order', 'asc'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(toTutorialObject);
    } catch (error) {
        console.error('Error fetching tutorials:', error);
        return [];
    }
}

export async function getTutorialById(id: string) {
    try {
        const docRef = doc(db, 'tutorials', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return toTutorialObject(docSnap);
        }
        return null;
    } catch (error) {
        console.error('Error fetching tutorial by id:', error);
        return null;
    }
}
