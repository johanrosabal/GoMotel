'use client';
import { notFound, useParams } from 'next/navigation';
import RoomTypeForm from '@/components/settings/room-types/RoomTypeForm';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { RoomType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditRoomTypePage() {
  const params = useParams();
  const id = params.id as string;
  const { firestore } = useFirebase();

  const roomTypeRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'roomTypes', id);
  }, [firestore, id]);

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'), fbOrderBy('name'));
  }, [firestore]);

  const { data: roomType, isLoading: isLoadingRoomType } = useDoc<RoomType>(roomTypeRef);
  const { data: allRoomTypes, isLoading: isLoadingAllRoomTypes } = useCollection<RoomType>(roomTypesQuery);

  const isLoading = isLoadingRoomType || isLoadingAllRoomTypes;

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
  
  if (!isLoading && !roomType) {
    notFound();
  }

  return (
     <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex items-center gap-4">
         <Button asChild variant="outline" size="icon">
            <Link href="/settings/room-types">
              <ArrowLeft />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Editar Tipo de Habitación</h1>
          <p className="text-muted-foreground">Actualizar detalles para {roomType?.name}.</p>
        </div>
      </div>
      <RoomTypeForm roomType={roomType as RoomType} allRoomTypes={allRoomTypes || []} />
    </div>
  );
}
