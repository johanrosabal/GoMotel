'use server';
import { z } from 'zod';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido.'),
  description: z.string().optional(),
});

export async function saveCategory(values: z.infer<typeof categorySchema>) {
    const validatedFields = categorySchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos inválidos.' };
    }
    const { id, ...data } = validatedFields.data;

    try {
        if (id) {
            await updateDoc(doc(db, 'productCategories', id), data);
        } else {
            await addDoc(collection(db, 'productCategories'), data);
        }
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo guardar la categoría.' };
    }
}

export async function deleteCategory(id: string) {
    try {
        await deleteDoc(doc(db, 'productCategories', id));
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo eliminar la categoría.' };
    }
}

const subCategorySchema = z.object({
  id: z.string().optional(),
  categoryId: z.string(),
  name: z.string().min(1, 'El nombre es requerido.'),
  description: z.string().optional(),
});

export async function saveSubCategory(values: z.infer<typeof subCategorySchema>) {
    const validatedFields = subCategorySchema.safeParse(values);
    if (!validatedFields.success) {
        return { error: 'Datos inválidos.' };
    }
    const { id, ...data } = validatedFields.data;

    try {
        if (id) {
            await updateDoc(doc(db, 'productSubCategories', id), data);
        } else {
            await addDoc(collection(db, 'productSubCategories'), data);
        }
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo guardar la sub-categoría.' };
    }
}

export async function deleteSubCategory(id: string) {
    try {
        await deleteDoc(doc(db, 'productSubCategories', id));
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        return { error: 'No se pudo eliminar la sub-categoría.' };
    }
}
