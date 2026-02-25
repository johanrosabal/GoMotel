'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Building, PlusCircle, Trash2, Facebook, Instagram, Linkedin, Smartphone, Mail, Banknote } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const companyContactSchema = z.object({
  label: z.string().min(1, 'La etiqueta es requerida.'),
  value: z.string().min(1, 'El valor es requerido.'),
});

const companyEmailContactSchema = z.object({
  label: z.string().min(1, 'La etiqueta es requerida.'),
  value: z.string().min(1, 'El valor es requerido.').email('Correo electrónico inválido.'),
});

const companySocialSchema = z.object({
  platform: z.enum(['Facebook', 'Instagram', 'Twitter', 'TikTok', 'LinkedIn']),
  url: z.string().url('URL inválida.'),
});

const companyBankAccountSchema = z.object({
  bankName: z.string().min(1, 'El banco es requerido.'),
  accountHolder: z.string().min(1, 'El titular es requerido.'),
  accountNumber: z.string().min(1, 'El número de cuenta es requerido.'),
  iban: z.string().optional(),
});


const companyInfoSchema = z.object({
  id: z.string().optional(),
  tradeName: z.string().min(1, 'El nombre comercial es requerido.'),
  legalId: z.string().min(1, 'La cédula jurídica es requerida.').length(12, 'El formato debe ser X-XXX-XXXXXX.'),
  country: z.string().optional(),
  address: z.string().optional(),
  googleMapsUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  websiteUrl: z.string().url('URL inválida.').or(z.literal('')).optional(),
  logoUrl: z.string().optional(),
  phoneNumbers: z.array(companyContactSchema).optional(),
  emails: z.array(companyEmailContactSchema).optional(),
  socialMedia: z.array(companySocialSchema).optional(),
  bankAccounts: z.array(companyBankAccountSchema).optional(),
});

type SocialPlatform = 'Facebook' | 'Instagram' | 'Twitter' | 'TikTok' | 'LinkedIn';

const socialIcons: Record<SocialPlatform, React.ElementType> = {
  Facebook: Facebook,
  Instagram: Instagram,
  Twitter: () => <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current"><title>X</title><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83-8.209-9.078h7.404l5.24-6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>,
  TikTok: () => <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current"><title>TikTok</title><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.04-5.36Z"/></svg>,
  LinkedIn: Linkedin,
};


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
      tradeName: '', legalId: '', country: 'Costa Rica', address: '', googleMapsUrl: '',
      websiteUrl: '', logoUrl: '', phoneNumbers: [], emails: [], socialMedia: [], bankAccounts: [],
    },
  });

  const { fields: phoneFields, append: appendPhone, remove: removePhone } = useFieldArray({ control: form.control, name: 'phoneNumbers' });
  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({ control: form.control, name: 'emails' });
  const { fields: socialFields, append: appendSocial, remove: removeSocial } = useFieldArray({ control: form.control, name: 'socialMedia' });
  const { fields: bankFields, append: appendBank, remove: removeBank } = useFieldArray({ control: form.control, name: 'bankAccounts' });
  
  useEffect(() => {
    if (companyInfo) {
      form.reset({
        ...companyInfo,
        tradeName: companyInfo.tradeName || '',
        legalId: companyInfo.legalId || '',
        country: companyInfo.country || 'Costa Rica',
        address: companyInfo.address || '',
        googleMapsUrl: companyInfo.googleMapsUrl || '',
        websiteUrl: companyInfo.websiteUrl || '',
        logoUrl: companyInfo.logoUrl || '',
        phoneNumbers: companyInfo.phoneNumbers || [],
        emails: companyInfo.emails || [],
        socialMedia: companyInfo.socialMedia || [],
        bankAccounts: companyInfo.bankAccounts || [],
      });
      if (companyInfo.logoUrl) {
        setLogoPreview(companyInfo.logoUrl);
      }
    }
  }, [companyInfo, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL(file.type, 0.9);

            setLogoPreview(dataUrl);
            form.setValue('logoUrl', dataUrl, { shouldValidate: true });
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (value: string) => void) => {
    let numbers = e.target.value.replace(/\D/g, '');
    
    if (numbers.startsWith('506')) {
      numbers = numbers.substring(3);
    }
    const value = numbers.slice(0, 8);
    let maskedValue = '';
    if (value.length > 0) {
      maskedValue = `(506) ${value.slice(0, 4)}`;
      if (value.length > 4) {
        maskedValue += `-${value.slice(4)}`;
      }
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
                    <Skeleton className="h-52 w-52 rounded-lg" />
                    <Skeleton className="h-10 w-52" />
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="identity">Identidad</TabsTrigger>
            <TabsTrigger value="contact">Contacto</TabsTrigger>
            <TabsTrigger value="social">Social y Bancos</TabsTrigger>
          </TabsList>
          <TabsContent value="identity" className="pt-6">
              <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="space-y-2 flex flex-col items-center lg:items-start">
                    <Label>Logo</Label>
                    <Avatar className="h-96 w-96 rounded-lg border-2 border-dashed">
                        <AvatarImage src={logoPreview || undefined} className="object-contain" />
                        <AvatarFallback className="rounded-lg bg-transparent">
                            <Building className="h-32 w-32 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-96 mt-2"> Cambiar Imagen </Button>
                </div>
                <div className="lg:col-span-2 grid gap-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="tradeName" render={({ field }) => (<FormItem><FormLabel>Nombre Comercial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="legalId" render={({ field }) => (<FormItem><FormLabel>Cédula Jurídica</FormLabel><FormControl><Input {...field} placeholder="X-XXX-XXXXXX" onChange={(e) => handleLegalIdChange(e, field.onChange)}/></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>País Local de Operación</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Dirección Física</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (<FormItem><FormLabel>Enlace de Google Maps</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="websiteUrl" render={({ field }) => (<FormItem><FormLabel>Sitio Web Oficial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </div>
          </TabsContent>
          <TabsContent value="contact" className="pt-6 space-y-6">
              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium flex items-center gap-2"><Smartphone className="h-5 w-5" />Números de Teléfono</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendPhone({ label: '', value: '' })}><PlusCircle className="mr-2 h-4 w-4" />Añadir Teléfono</Button>
                  </div>
                  <div className="space-y-4">
                      {phoneFields.length > 0 ? phoneFields.map((field, index) => (
                          <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg bg-muted/50">
                              <FormField control={form.control} name={`phoneNumbers.${index}.label`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Etiqueta</FormLabel><FormControl><Input placeholder="Principal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name={`phoneNumbers.${index}.value`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Número</FormLabel><FormControl><Input placeholder="(506) 8888-8888" {...field} onChange={(e) => handlePhoneChange(e, field.onChange)}/></FormControl><FormMessage /></FormItem>)} />
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removePhone(index)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                      )) : (
                        <div className="text-center text-sm text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                            No se han añadido números de teléfono.
                        </div>
                      )}
                  </div>
              </div>
              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium flex items-center gap-2"><Mail className="h-5 w-5" />Correos Electrónicos</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendEmail({ label: '', value: '' })}><PlusCircle className="mr-2 h-4 w-4" />Añadir Correo</Button>
                  </div>
                  <div className="space-y-4">
                      {emailFields.length > 0 ? emailFields.map((field, index) => (
                          <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg bg-muted/50">
                              <FormField control={form.control} name={`emails.${index}.label`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Etiqueta</FormLabel><FormControl><Input placeholder="Soporte" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name={`emails.${index}.value`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Correo</FormLabel><FormControl><Input type="email" placeholder="soporte@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeEmail(index)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                      )) : (
                        <div className="text-center text-sm text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                            No se han añadido correos electrónicos.
                        </div>
                      )}
                  </div>
              </div>
          </TabsContent>
          <TabsContent value="social" className="pt-6 space-y-6">
              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium flex items-center gap-2"><svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect width="4" height="12" x="2" y="9"></rect><circle cx="4" cy="4" r="2"></circle></svg>Redes Sociales</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendSocial({ platform: 'Facebook', url: '' })}><PlusCircle className="mr-2 h-4 w-4" />Añadir Red Social</Button>
                  </div>
                  <div className="space-y-4">
                      {socialFields.length > 0 ? socialFields.map((field, index) => {
                           const Icon = socialIcons[form.watch(`socialMedia.${index}.platform`)];
                           return(
                            <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg bg-muted/50">
                                <FormField control={form.control} name={`socialMedia.${index}.platform`} render={({ field }) => (<FormItem><FormLabel>Plataforma</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="w-[150px]"><div className="flex items-center gap-2"><Icon/> <SelectValue /></div></SelectTrigger></FormControl><SelectContent>{Object.keys(socialIcons).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`socialMedia.${index}.url`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>URL</FormLabel><FormControl><Input type="url" placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeSocial(index)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                           )
                        }) : (
                            <div className="text-center text-sm text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                                No se han añadido redes sociales.
                            </div>
                        )}
                  </div>
              </div>
              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium flex items-center gap-2"><Banknote className="h-5 w-5" />Cuentas Bancarias</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendBank({ bankName: '', accountHolder: '', accountNumber: '', iban: ''})}><PlusCircle className="mr-2 h-4 w-4" />Añadir Cuenta</Button>
                  </div>
                  <div className="space-y-4">
                      {bankFields.length > 0 ? bankFields.map((field, index) => (
                          <div key={field.id} className="p-4 border rounded-lg bg-muted/50 space-y-4">
                              <div className="flex justify-end -mt-2 -mr-2"><Button type="button" variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => removeBank(index)}><Trash2 className="h-4 w-4" /></Button></div>
                              <div className="grid sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name={`bankAccounts.${index}.bankName`} render={({ field }) => (<FormItem><FormLabel>Nombre del Banco</FormLabel><FormControl><Input placeholder="Banco Nacional" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`bankAccounts.${index}.accountHolder`} render={({ field }) => (<FormItem><FormLabel>Titular</FormLabel><FormControl><Input placeholder="Nombre del titular" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              </div>
                              <FormField control={form.control} name={`bankAccounts.${index}.accountNumber`} render={({ field }) => (<FormItem><FormLabel>Número de Cuenta</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name={`bankAccounts.${index}.iban`} render={({ field }) => (<FormItem><FormLabel>IBAN (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                      )) : (
                        <div className="text-center text-sm text-muted-foreground p-4 border-2 border-dashed rounded-lg">
                            No se han añadido cuentas bancarias.
                        </div>
                      )}
                  </div>
              </div>
          </TabsContent>
          <div className="flex justify-end pt-8">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </Tabs>
      </form>
    </Form>
  );
}
