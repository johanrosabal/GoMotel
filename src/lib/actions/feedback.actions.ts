import { collection, addDoc, getDocs, doc, updateDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { FeedbackTicket } from '@/types';

export interface SubmitFeedbackInput {
  type: 'Queja' | 'Mejora de Servicio';
  email?: string;
  phone?: string;
  whatsapp?: string;
  subject?: string;
  details: string;
}

export async function submitFeedbackTicket(input: SubmitFeedbackInput) {
  if (!input.details || input.details.trim().length < 5) {
    return { error: 'Por favor escriba los detalles del asunto (mínimo 5 caracteres).' };
  }

  try {
    const feedbackRef = collection(db, 'feedbackTickets');
    const docRef = await addDoc(feedbackRef, {
      type: input.type,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      subject: input.subject?.trim() || (input.type === 'Queja' ? 'Queja sobre el Servicio' : 'Sugerencia de Mejora'),
      details: input.details.trim(),
      status: 'Pendiente',
      createdAt: serverTimestamp(),
    });

    // Notify Administrators in system notifications
    try {
      const notifRef = collection(db, 'notifications');
      const contactInfo = [input.email, input.phone, input.whatsapp].filter(Boolean).join(' | ') || 'Anónimo';
      await addDoc(notifRef, {
        title: `🚨 NUEVA ${input.type.toUpperCase()}`,
        message: `Contacto: ${contactInfo} - "${input.details.substring(0, 80)}..."`,
        type: 'Internal',
        audience: 'Administrador',
        targetRoles: ['Administrador'],
        isActive: true,
        startDate: serverTimestamp(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        createdAt: serverTimestamp(),
        feedbackId: docRef.id,
      });
    } catch (err) {
      console.error('Error creating admin notification for feedback:', err);
    }

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Error submitting feedback ticket:', error);
    return { error: error.message || 'Ocurrió un error al enviar el registro.' };
  }
}

export async function updateFeedbackStatus(id: string, status: 'Revisado' | 'Resuelto', reviewerName: string) {
  try {
    const ticketRef = doc(db, 'feedbackTickets', id);
    await updateDoc(ticketRef, {
      status,
      reviewedBy: reviewerName,
      reviewedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating feedback status:', error);
    return { error: error.message || 'Error al actualizar el estado de la queja/sugerencia.' };
  }
}
