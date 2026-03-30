import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 md:flex-row md:items-center md:justify-between group", className)}>
      <div className="space-y-1">
        <h2 className="text-3xl font-black tracking-tight uppercase flex items-center gap-3">
          {icon && <span className="p-2 bg-primary/10 rounded-xl">{icon}</span>}
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground text-sm font-medium italic opacity-80 pl-2 border-l-2 border-primary/20">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

