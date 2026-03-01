import PublicMenuDisplay from '@/components/public/PublicMenuDisplay';

export const metadata = {
  title: 'Menú Digital - Go Motel',
  description: 'Catálogo de servicios y productos disponibles.',
};

export default function PublicMenuPage() {
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-hidden">
      <PublicMenuDisplay />
    </div>
  );
}
