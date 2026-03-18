'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { CommandMenu } from '@/components/CommandMenu';

export default function SearchCommand() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-10 w-full justify-start rounded-xl bg-background text-sm font-medium text-muted-foreground shadow-sm transition-all group sm:pr-12 md:w-40 lg:w-72 border-primary/10 hover:border-primary/30" id="searchcommand-button-1"
      >
        <Search className="mr-2 size-4 text-primary opacity-50 transition-opacity group-hover:opacity-100" />
        <span className="hidden lg:inline-flex">Buscar módulos o datos...</span>
        <span className="inline-flex lg:hidden">Buscar...</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-6 select-none items-center gap-1 rounded-md border bg-muted/50 px-2 font-mono text-[10px] font-black opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandMenu open={open} setOpen={setOpen} />
    </>
  );
}
