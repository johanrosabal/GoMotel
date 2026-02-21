'use client';

import type { Invoice } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from '@/components/ui/dropdown-menu';

function ActionsMenu({ invoice }: { invoice: Invoice }) {
    // Later we can add actions like "View PDF", "Send Email", etc.
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem disabled>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver Detalle (Próximamente)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
    if (invoices.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                No se encontraron facturas.
            </div>
        );
    }
    
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                            <TableCell className="font-mono">
                                <Badge variant="outline">{invoice.invoiceNumber}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{invoice.clientName}</TableCell>
                            <TableCell>{format(invoice.createdAt.toDate(), "dd MMM yyyy", { locale: es })}</TableCell>
                            <TableCell>{formatCurrency(invoice.total)}</TableCell>
                            <TableCell>
                                <Badge variant={invoice.status === 'Pagada' ? 'default' : 'secondary'} className={cn(invoice.status === 'Pagada' && 'bg-green-600')}>{invoice.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <ActionsMenu invoice={invoice} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

    