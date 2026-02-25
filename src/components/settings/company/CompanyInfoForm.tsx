'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CompanyProfile } from '@/types';
import { saveCompanyInfo } from '@/lib/actions/company.actions';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

const companyInfoSchema = z.object({
  id: z.string().optional(),
  tradeName: z.string().min(1, 'El nombre comercial es requerido.'),
  legalId: z.string().min(1, 'La cédula jurídica es requerida.').length(12, 'El formato debe ser X-XXX-XXXXXX.'),
  country: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  websiteUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  logoUrl: z.string().optional(),
});

export default function CompanyInfoForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const companyInfoRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'companyInfo', 'main');
  }, [firestore]);
  
  const { data: companyInfo, isLoading } = useDoc<CompanyProfile>(companyInfoRef);

  const form = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      tradeName: '',
      legalId: '',
      country: 'Costa Rica',
      address: '',
      googleMapsUrl: '',
      websiteUrl: '',
      logoUrl: '',
    },
  });
  
  useEffect(() => {
    if (companyInfo) {
      form.reset({
        id: companyInfo.id,
        tradeName: companyInfo.tradeName || '',
        legalId: companyInfo.legalId || '',
        country: companyInfo.country || 'Costa Rica',
        address: companyInfo.address || '',
        googleMapsUrl: companyInfo.googleMapsUrl || '',
        websiteUrl: companyInfo.websiteUrl || '',
        logoUrl: companyInfo.logoUrl || '',
      });
      if (companyInfo.logoUrl) {
        setLogoPreview(companyInfo.logoUrl);
      }
    }
  }, [companyInfo, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        form.setValue('logoUrl', dataUrl, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLegalIdChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    const rawValue = e.target.value.replace(/\D/g, ''); // Remove non-digits
    const maxLength = 10;
    const value = rawValue.slice(0, maxLength);

    let maskedValue = '';
    if (value.length > 4) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1, 4)}-${value.slice(4)}`;
    } else if (value.length > 1) {
      maskedValue = `${value.slice(0, 1)}-${value.slice(1)}`;
    } else {
      maskedValue = value;
    }

    fieldOnChange(maskedValue);
  };

  const onSubmit = (values: z.infer<typeof companyInfoSchema>) => {
    startTransition(async () => {
      const result = await saveCompanyInfo(values);
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'La información de la empresa ha sido actualizada.' });
      }
    });
  };

  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/4" />
            <div className="grid grid-cols-3 gap-6">
                <div className="col-span-1 space-y-4">
                    <Skeleton className="h-40 w-40 rounded-lg" />
                    <Skeleton className="h-10 w-40" />
                </div>
                <div className="col-span-2 space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
            <div className="flex justify-end">
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
    );
  }

  return (
    <Tabs defaultValue="identity" className="w-full">
      <TabsList>
        <TabsTrigger value="identity">Identidad</TabsTrigger>
        <TabsTrigger value="contact">Contacto</TabsTrigger>
        <TabsTrigger value="social">Social y Bancos</TabsTrigger>
      </TabsList>
      <TabsContent value="identity" className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              <div className="space-y-2 flex flex-col items-center lg:items-start">
                  <Label>Logo</Label>
                  <Avatar className="h-40 w-40 rounded-lg border-2 border-dashed">
                      <AvatarImage src={logoPreview || undefined} className="object-contain" />
                      <AvatarFallback className="rounded-lg bg-transparent">
                          <Building className="h-16 w-16 text-muted-foreground" />
                      </AvatarFallback>
                  </Avatar>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                  />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-40 mt-2">
                      Cambiar Imagen
                  </Button>
              </div>
              <div className="lg:col-span-2 grid gap-4">
                  <div className="grid md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="tradeName" render={({ field }) => (
                          <FormItem><FormLabel>Nombre Comercial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="legalId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cédula Jurídica</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder="X-XXX-XXXXXX"
                                    onChange={(e) => handleLegalIdChange(e, field.onChange)}
                                />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem><FormLabel>País Local de Operación</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Dirección Física</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (
                      <FormItem><FormLabel>Enlace de Google Maps</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="websiteUrl" render={({ field }) => (
                      <FormItem><FormLabel>Sitio Web Oficial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </TabsContent>
      <TabsContent value="contact" className="pt-6">
        <p className="text-muted-foreground">Aquí podrá configurar teléfonos y correos de contacto adicionales.</p>
      </TabsContent>
      <TabsContent value="social" className="pt-6">
        <p className="text-muted-foreground">Aquí podrá configurar redes sociales e información bancaria.</p>
      </TabsContent>
    </Tabs>
  );
}
