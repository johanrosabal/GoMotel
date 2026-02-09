import { SidebarTrigger } from '@/components/ui/sidebar';

export default function PageHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <SidebarTrigger className="sm:hidden" />
      {/* Add breadcrumbs or page titles here if needed */}
    </header>
  );
}
