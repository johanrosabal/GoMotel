'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { adminDb } from '../firebase-admin';

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
        if (!adminDb) throw new Error('Admin DB not initialized');
        const collection = adminDb.collection('productCategories');
        
        if (id) {
            await collection.doc(id).update(data);
        } else {
            await collection.add(data);
        }
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        console.error('Error saving category:', e);
        return { error: 'No se pudo guardar la categoría.' };
    }
}

export async function deleteCategory(id: string) {
    try {
        if (!adminDb) throw new Error('Admin DB not initialized');
        await adminDb.collection('productCategories').doc(id).delete();
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        console.error('Error deleting category:', e);
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
        if (!adminDb) throw new Error('Admin DB not initialized');
        const collection = adminDb.collection('productSubCategories');
        
        if (id) {
            await collection.doc(id).update(data);
        } else {
            await collection.add(data);
        }
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        console.error('Error saving sub-category:', e);
        return { error: 'No se pudo guardar la sub-categoría.' };
    }
}

export async function deleteSubCategory(id: string) {
    try {
        if (!adminDb) throw new Error('Admin DB not initialized');
        await adminDb.collection('productSubCategories').doc(id).delete();
        revalidatePath('/catalog');
        return { success: true };
    } catch (e) {
        console.error('Error deleting sub-category:', e);
        return { error: 'No se pudo eliminar la sub-categoría.' };
    }
}
