
import PublicOrderClient from '@/components/public/PublicOrderClient';

export const metadata = {
  title: 'Realizar Pedido - Go Motel',
  description: 'Ordene sus servicios y productos directamente desde su móvil.',
};

export default function PublicOrderPage() {
  return (
    <div className="min-h-screen bg-muted/30 pb-24 md:pb-0">
      <PublicOrderClient />
    </div>
  );
}
