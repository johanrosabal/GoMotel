import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export async function GET() {
  return NextResponse.json({ message: "OK" });
}
