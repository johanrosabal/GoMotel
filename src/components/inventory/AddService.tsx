import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import EditServiceDialog from './EditServiceDialog';
import type { Service } from '@/types';

interface AddServiceProps {
    allServices: Service[];
}

export default function AddService({ allServices }: AddServiceProps) {
  return (
    <EditServiceDialog allServices={allServices}>
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Service
        </Button>
    </EditServiceDialog>
  );
}
