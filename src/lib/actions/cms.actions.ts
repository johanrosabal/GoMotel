'use server';

import { z } from 'zod';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { revalidatePath } from 'next/cache';

const landingPageFeatureSchema = z.object({
  id: z.string(),
  icon: z.string({ required_error: 'El icono es requerido.', invalid_type_error: 'El icono es requerido.' }).min(1, 'El icono es requerido.'),
  title: z.string({ required_error: 'El título es requerido.', invalid_type_error: 'El título es requerido.' }).min(1, 'El título es requerido.'),
  description: z.string({ required_error: 'La descripción es requerida.', invalid_type_error: 'La descripción es requerida.' }).min(1, 'La descripción es requerida.'),
});

const landingPageContentSchema = z.object({
  heroSection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.').optional(),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.').optional(),
    desktopSubtitle: z.string({ required_error: 'El subtítulo de escritorio es requerido.', invalid_type_error: 'El subtítulo de escritorio es requerido.' }).min(1, 'El subtítulo de escritorio es requerido.').optional(),
    mobileSubtitle: z.string({ required_error: 'El subtítulo móvil es requerido.', invalid_type_error: 'El subtítulo móvil es requerido.' }).min(1, 'El subtítulo móvil es requerido.').optional(),
    mobileImageUrl: z.string({ required_error: 'La imagen móvil es requerida.', invalid_type_error: 'La imagen móvil es requerida.' }).min(1, 'La imagen móvil es requerida.'),
    desktopImageUrl: z.string({ required_error: 'La imagen de escritorio es requerida.', invalid_type_error: 'La imagen de escritorio es requerida.' }).min(1, 'La imagen de escritorio es requerida.'),
  }).optional(),
  featuresSection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    description: z.string({ required_error: 'La descripción de la sección es requerida.', invalid_type_error: 'La descripción de la sección es requerida.' }).min(1, 'La descripción de la sección es requerida.'),
    features: z.array(landingPageFeatureSchema).min(1, 'Debe haber al menos una característica.'),
  }),
  amenitiesSection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    amenities: z.array(z.object({
      id: z.string(),
      title: z.string({ required_error: 'El título es requerido.', invalid_type_error: 'El título es requerido.' }).min(1, 'El título es requerido.'),
      description: z.string({ required_error: 'La descripción es requerida.', invalid_type_error: 'La descripción es requerida.' }).min(1, 'La descripción es requerida.'),
      imageUrl: z.string().optional(),
    })).min(1, 'Debe haber al menos una amenidad.'),
  }).optional(),
  gallerySection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    images: z.array(z.object({
      id: z.string(),
      url: z.string({ required_error: 'La URL es requerida.', invalid_type_error: 'La URL es requerida.' }).min(1, 'La URL es requerida.'),
      alt: z.string().optional(),
    })).min(1, 'Debe haber al menos una imagen en la galería.'),
    videos: z.array(z.object({
      id: z.string(),
      url: z.string({ required_error: 'La URL del video es requerida.' }).min(1, 'La URL es requerida.'),
      alt: z.string().optional(),
      thumbnailUrl: z.string().optional(),
    })).optional(),
  }).optional(),
  footerSection: z.object({
    description: z.string({ required_error: 'La descripción es requerida.', invalid_type_error: 'La descripción es requerida.' }).min(1, 'La descripción es requerida.'),
    address: z.string({ required_error: 'La dirección es requerida.', invalid_type_error: 'La dirección es requerida.' }).min(1, 'La dirección es requerida.'),
    phone: z.string({ required_error: 'El teléfono es requerido.', invalid_type_error: 'El teléfono es requerido.' }).min(1, 'El teléfono es requerido.'),
    whatsapp: z.string().optional(),
    googleMapsUrl: z.string().optional(),
    socialMedia: z.array(z.object({
      platform: z.enum(['Facebook', 'Instagram', 'Twitter', 'TikTok', 'LinkedIn']),
      url: z.string({ required_error: 'La URL es requerida.', invalid_type_error: 'La URL es requerida.' }).min(1, 'La URL es requerida.'),
    })).optional(),
  }).optional(),
});

export async function saveLandingPageContent(values: z.infer<typeof landingPageContentSchema>) {
  const validatedFields = landingPageContentSchema.safeParse(values);

  if (!validatedFields.success) {
    console.error('Validation error:', validatedFields.error.flatten());
    return { error: 'Datos inválidos.' };
  }

  try {
    const contentRef = doc(db, 'landingPageContent', 'main');
    await setDoc(contentRef, validatedFields.data, { merge: true });
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error saving landing page content:', error);
    return { error: 'No se pudo guardar el contenido de la página de inicio.' };
  }
}
