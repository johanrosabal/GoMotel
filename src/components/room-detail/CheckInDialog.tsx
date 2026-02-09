'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { checkIn } from '@/lib/actions/room.actions';

interface CheckInDialogProps {
  children: ReactNode;
  roomId: string;
}

const checkInSchema = z.object({
  guestName: z.string().min(2, 'Guest name must be at least 2 characters.'),
});

export default function CheckInDialog({ children, roomId }: CheckInDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof checkInSchema>>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      guestName: '',
    },
  });

  const onSubmit = (values: z.infer<typeof checkInSchema>) => {
    const formData = new FormData();
    formData.append('guestName', values.guestName);

    startTransition(async () => {
      const result = await checkIn(roomId, formData);
      if (result?.error) {
        toast({
          title: 'Check-In Failed',
          description: typeof result.error === 'string' ? result.error : 'Please check the form fields.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success!',
          description: `Guest "${values.guestName}" has been checked in.`,
        });
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Guest Check-In</DialogTitle>
          <DialogDescription>
            Enter the guest's name to check them into this room.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Checking In...' : 'Confirm Check-In'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
