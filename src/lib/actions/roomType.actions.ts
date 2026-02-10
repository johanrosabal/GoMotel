'use server';

import {
  collection,
  getDocs,
  query,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '../firebase';
import type { RoomType } from '@/types';

// Note: The functions in this file have been deprecated and moved to client components
// to ensure proper user authentication context is available for Firestore operations.
// Server actions are not suitable for authenticated Firestore client SDK operations in this setup.

export async function getRoomTypes(): Promise<RoomType[]> {
  return [];
}

export async function getRoomTypeById(id: string): Promise<RoomType | null> {
  return null;
}
