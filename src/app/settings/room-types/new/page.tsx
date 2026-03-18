'use client';
import RoomTypeForm from '@/components/settings/room-types/RoomTypeForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { RoomType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function NewRoomTypePage() {
  const { firestore } = useFirebase();

  const roomTypesQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(collection(firestore, 'roomTypes'), fbOrderBy('name'));
  }, [firestore]);

  const { data: allRoomTypes, isLoading } = useCollection<RoomType>(roomTypesQuery);

  if (isLoading) {
      return (
          <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
              <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10" />
                  <div className="space-y-2">
                      <Skeleton className="h-7 w-64" />
                      <Skeleton className="h-5 w-48" />
                  </div>
              </div>
              <Skeleton className="h-[600px] w-full" />
          </div>
      );
  }

  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center gap-4">
         <Button asChild variant="outline" size="icon" id="page-button-1">
            <Link href="/settings/room-types" id="page-link-settings-room-types">
              <ArrowLeft />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Añadir Nuevo Tipo de Habitación</h1>
          <p className="text-muted-foreground">Añada un nuevo tipo de habitación a su sistema.</p>
        </div>
      </div>
      <RoomTypeForm allRoomTypes={allRoomTypes || []} />
    </div>
  );
}
