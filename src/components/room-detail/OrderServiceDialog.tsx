'use client';

import { useState, useTransition, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Service } from '@/types';
import { createOrder } from '@/lib/actions/order.actions';
import { ScrollArea } from '../ui/scroll-area';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { updateInventory } from '@/ai/flows/realtime-inventory-updates';

interface OrderServiceDialogProps {
  children: ReactNode;
  stayId?: string;
  availableServices: Service[];
}

type CartItem = {
  service: Service;
  quantity: number;
};

export default function OrderServiceDialog({ children, stayId, availableServices }: OrderServiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const handleAddToCart = (service: Service) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.service.id === service.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.service.id === service.id
            ? { ...item, quantity: Math.min(item.quantity + 1, service.stock) }
            : item
        );
      }
      return [...prevCart, { service, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (service: Service) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.service.id === service.id);
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((item) =>
          item.service.id === service.id ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prevCart.filter((item) => item.service.id !== service.id);
    });
  };

  const getCartQuantity = (serviceId: string) => {
    return cart.find((item) => item.service.id === serviceId)?.quantity || 0;
  };
  
  const total = cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0);

  const handleSubmitOrder = () => {
    if (!stayId) return;
    
    startTransition(async () => {
      const result = await createOrder(stayId, cart);
      if (result.error) {
        toast({ title: 'Order Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Success!', description: 'Order has been placed.' });
        
        // Call AI for inventory update simulation
        const aiResult = await updateInventory({
            roomNumber: 'current',
            serviceOrders: cart.map(item => ({ serviceName: item.service.name, quantity: item.quantity })),
        });
        toast({ title: "AI Inventory Check", description: aiResult.message });
        
        setCart([]);
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Order Services</DialogTitle>
          <DialogDescription>
            Select services to add to the room's bill.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0">
            <div className='flex flex-col'>
                <h3 className="font-semibold mb-2">Available Services</h3>
                <ScrollArea className="flex-1 pr-4 border rounded-lg">
                    <div className='p-2 space-y-2'>
                    {availableServices.map((service) => (
                        <div key={service.id} className="flex items-center justify-between p-2 rounded-md border">
                            <div>
                                <p className="font-medium">{service.name}</p>
                                <p className="text-sm text-muted-foreground">{formatCurrency(service.price)} - Stock: {service.stock}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleRemoveFromCart(service)} disabled={getCartQuantity(service.id) === 0}>
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-6 text-center">{getCartQuantity(service.id)}</span>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleAddToCart(service)} disabled={getCartQuantity(service.id) >= service.stock}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    </div>
                </ScrollArea>
            </div>
            <div className='flex flex-col'>
                <h3 className="font-semibold mb-2">Current Order</h3>
                <div className="border rounded-lg p-4 flex-1 flex flex-col">
                    {cart.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <ShoppingCart className="h-12 w-12" />
                            <p className="mt-2">Your cart is empty.</p>
                        </div>
                    ) : (
                        <>
                         <ScrollArea className="flex-1 -mr-4 pr-4">
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.service.id} className="flex justify-between items-center text-sm">
                                        <div>
                                            <p className="font-medium">{item.service.name}</p>
                                            <p className="text-muted-foreground">{item.quantity} x {formatCurrency(item.service.price)}</p>
                                        </div>
                                        <p className="font-semibold">{formatCurrency(item.service.price * item.quantity)}</p>
                                    </div>
                                ))}
                            </div>
                         </ScrollArea>
                         <div className="mt-4 pt-4 border-t flex justify-between font-bold text-lg">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                         </div>
                        </>
                    )}
                </div>
            </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmitOrder} disabled={isPending || cart.length === 0}>
            {isPending ? 'Placing Order...' : 'Submit Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
