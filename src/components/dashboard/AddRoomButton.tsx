import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import AddRoomDialog from './AddRoomDialog';

export default function AddRoomButton() {
  return (
    <AddRoomDialog>
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Habitación
        </Button>
    </AddRoomDialog>
  );
}
