import PosClientPage from '@/components/pos/PosClientPage';

export default function PosRootPage() {
  return (
    <div className="w-full flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <PosClientPage />
    </div>
  );
}
