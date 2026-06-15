'use client';

import InventoryTable from '@/components/inventory/InventoryTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AddService from '@/components/inventory/AddService';
import { Package, DollarSign, BarChart3, TrendingUp, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";
import type { Service } from '@/types';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';

export default function InventoryPage() {
  const { firestore } = useFirebase();

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'));
  }, [firestore]);

  const { data: services, isLoading } = useCollection<Service>(servicesQuery);

  const initialServices = useMemo(() => {
    if (!services) return [];
    const sorted = [...services];
    sorted.sort((a, b) => {
        if (a.category.localeCompare(b.category) !== 0) {
            return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [services]);

  const totalCostValue = useMemo(() => initialServices.reduce((acc, srv) => acc + (srv.stock * (srv.costPrice || 0)), 0), [initialServices]);
  const totalSaleValue = useMemo(() => initialServices.reduce((acc, srv) => acc + (srv.stock * srv.price), 0), [initialServices]);
  const totalUnits = useMemo(() => initialServices.reduce((acc, srv) => acc + srv.stock, 0), [initialServices]);



  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4 group">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter leading-none flex flex-wrap gap-x-4 items-baseline">
                <span className="text-white">Control de</span>
                <span className="text-primary">Inventario</span>
              </h1>
            </div>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] max-w-xl pl-2">
            Monitoreo en tiempo real de existencias, precios de costo y alertas de stock bajo.
          </p>
        </div>
        <div className="flex items-center gap-3">

          <AddService allServices={initialServices} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Físico (Costo)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary italic tracking-tighter">{formatCurrency(totalCostValue)}</div>
            <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Costo total de adquisición</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Venta (Potencial)</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-white italic tracking-tighter">{formatCurrency(totalSaleValue)}</div>
            <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Valor si se vende todo</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Utilidad Bruta Estimada</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-500 italic tracking-tighter">{formatCurrency(totalSaleValue - totalCostValue)}</div>
            <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Margen de ganancia total</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Unidades</CardTitle>
            <Package className="h-4 w-4 text-violet-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-white italic tracking-tighter">{totalUnits}</div>
            <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Productos físicos en bodega</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.02] py-6">
            <div>
                <CardTitle className="text-xl font-black uppercase italic tracking-tighter text-white">Listado de Existencias</CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Consulte el estado actual de sus activos y productos para la venta.
                </CardDescription>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
            <InventoryTable initialServices={initialServices} />
        </CardContent>
      </Card>
    </div>
  );
}
