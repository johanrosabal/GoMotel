'use client';
import RoomTypesTable from '@/components/settings/room-types/RoomTypesTable';
import { getRoomTypes } from '@/lib/actions/roomType.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy as fbOrderBy } from 'firebase/firestore';
import type { RoomType } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function RoomTypesPage() {
  const { firestore } = useFirebase();

  const roomTypesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'roomTypes'), fbOrderBy('name'));
  }, [firestore]);

  const { data: roomTypes, isLoading } = useCollection<RoomType>(roomTypesQuery);
  
  return (
    <div className="container py-4 sm:py-6 lg:py-8 space-y-6">
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Tipos de Habitación</CardTitle>
                    <CardDescription>
                    Añada, edite o elimine los tipos de habitación para su motel.
                    </CardDescription>
                </div>
                <Button asChild size="sm" id="page-button-1">
                  <Link href="/settings/room-types/new" id="page-link-a-adir-tipo-de">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Tipo de Habitación
                  </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 rounded-md border p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <RoomTypesTable roomTypes={roomTypes || []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
