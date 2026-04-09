'use client';

import { useState, useTransition } from 'react';
import { EmailTemplate } from '@/types';
import { deleteEmailTemplate } from '@/lib/actions/email.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Mail, Pencil, Trash2, Tag } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface TemplateListProps {
  templates: EmailTemplate[];
}

export function TemplateList({ templates: initialTemplates }: TemplateListProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;

    startTransition(async () => {
      try {
        await deleteEmailTemplate(id);
        setTemplates(prev => prev.filter(t => t.id !== id));
        toast({ title: 'Eliminado', description: 'La plantilla ha sido eliminada correctamente.' });
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudo eliminar la plantilla.', variant: 'destructive' });
      }
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'transactional': return <Badge variant="secondary">Transaccional</Badge>;
      case 'marketing': return <Badge variant="default">Marketing</Badge>;
      case 'invoice': return <Badge variant="outline">Factura</Badge>;
      default: return <Badge variant="ghost">{type}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Plantillas de Correo
          </CardTitle>
          <CardDescription>
            Administre los formatos de correo para sus clientes.
          </CardDescription>
        </div>
        <Link href="/marketing/templates/new" data-testid="templatelist-marketing-templates-new-link">
          <Button className="gap-2" data-testid="templatelist-add-button">
            <Plus className="h-4 w-4" /> Nueva Plantilla
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Nombre</TableHead>
                <TableHead className="font-bold">Tipo</TableHead>
                <TableHead className="font-bold">Asunto</TableHead>
                <TableHead className="font-bold">Variables</TableHead>
                <TableHead className="text-right font-bold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                    No hay plantillas creadas todavía.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{getTypeBadge(template.type)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{template.subject}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map(v => (
                          <Badge key={v} variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="templatelist-action-button">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/marketing/templates/edit/${template.id}`} className="flex items-center gap-2 cursor-pointer" data-testid="templatelist-edit-link">
                              <Pencil className="h-4 w-4" /> Editar
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(template.id!)}
                            className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
