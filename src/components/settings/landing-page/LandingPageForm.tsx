'use client';

import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LandingPageContent } from '@/types';
import { saveLandingPageContent } from '@/lib/actions/cms.actions';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Layout, ShieldCheck, Clock, Zap, Star, Heart, CheckCircle, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';

const featureIcons = {
  ShieldCheck: ShieldCheck,
  Clock: Clock,
  Zap: Zap,
  Star: Star,
  Heart: Heart,
  CheckCircle: CheckCircle,
  Info: Info,
};

const landingPageFeatureSchema = z.object({
  id: z.string(),
  icon: z.string().min(1, 'El icono es requerido.'),
  title: z.string().min(1, 'El título es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
});

const landingPageContentSchema = z.object({
  featuresSection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    description: z.string({ required_error: 'La descripción de la sección es requerida.', invalid_type_error: 'La descripción de la sección es requerida.' }).min(1, 'La descripción de la sección es requerida.'),
    features: z.array(landingPageFeatureSchema).min(1, 'Debe haber al menos una característica.'),
  }),
  amenitiesSection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    amenities: z.array(z.object({
      id: z.string(),
      title: z.string({ required_error: 'El título es requerido.', invalid_type_error: 'El título es requerido.' }).min(1, 'El título es requerido.'),
      description: z.string({ required_error: 'La descripción es requerida.', invalid_type_error: 'La descripción es requerida.' }).min(1, 'La descripción es requerida.'),
      imageUrl: z.string().optional(),
    })).min(1, 'Debe haber al menos una amenidad.'),
  }).optional(),
  gallerySection: z.object({
    title1: z.string({ required_error: 'La línea 1 del título es requerida.', invalid_type_error: 'La línea 1 del título es requerida.' }).min(1, 'La línea 1 del título es requerida.'),
    title2: z.string({ required_error: 'La línea 2 del título es requerida.', invalid_type_error: 'La línea 2 del título es requerida.' }).min(1, 'La línea 2 del título es requerida.'),
    images: z.array(z.object({
      id: z.string(),
      url: z.string({ required_error: 'La URL es requerida.', invalid_type_error: 'La URL es requerida.' }).min(1, 'La URL es requerida.'),
      alt: z.string().optional(),
    })).min(1, 'Debe haber al menos una imagen en la galería.'),
  }).optional(),
  footerSection: z.object({
    description: z.string({ required_error: 'La descripción es requerida.', invalid_type_error: 'La descripción es requerida.' }).min(1, 'La descripción es requerida.'),
    address: z.string({ required_error: 'La dirección es requerida.', invalid_type_error: 'La dirección es requerida.' }).min(1, 'La dirección es requerida.'),
    phone: z.string({ required_error: 'El teléfono es requerido.', invalid_type_error: 'El teléfono es requerido.' }).min(1, 'El teléfono es requerido.'),
    whatsapp: z.string().optional(),
    googleMapsUrl: z.string().optional(),
    socialMedia: z.array(z.object({
      platform: z.enum(['Facebook', 'Instagram', 'Twitter', 'TikTok', 'LinkedIn']),
      url: z.string({ required_error: 'La URL es requerida.', invalid_type_error: 'La URL es requerida.' }).min(1, 'La URL es requerida.'),
    })).optional(),
  }).optional(),
});

type FormData = z.infer<typeof landingPageContentSchema>;

export default function LandingPageForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  
  const contentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'landingPageContent', 'main');
  }, [firestore]);
  
  const { data: content, isLoading } = useDoc<LandingPageContent>(contentRef);

  const defaultValues: FormData = {
    featuresSection: {
      title1: 'POR QUÉ SOMOS',
      title2: 'DIFERENTES',
      description: 'Cada detalle ha sido curado para garantizar una experiencia de clase mundial, donde su privacidad es nuestra prioridad número uno.',
      features: [
        { id: '1', icon: 'ShieldCheck', title: 'MÁXIMA PRIVACIDAD', description: 'Entradas y salidas discretas con sistemas automatizados para que su visita sea totalmente privada.' },
        { id: '2', icon: 'Clock', title: 'SERVICIO 24/7', description: 'Nuestro equipo está disponible a cualquier hora para atender sus necesidades con la mayor discreción.' },
        { id: '3', icon: 'Zap', title: 'CONFORT PREMIUM', description: 'Habitaciones equipadas con tecnología de punta, climatización inteligente y sistemas de sonido de alta fidelidad.' },
      ],
    },
    amenitiesSection: {
      title1: 'DISEÑO QUE',
      title2: 'INSPIRA',
      amenities: [
        { id: '1', title: 'Jacuzzi Privado', description: 'Sistemas de hidromasaje modernos para una relajación total en pareja.', imageUrl: '/motel_premium_room_1773958120043.png' },
        { id: '2', title: 'Menú Gourmet', description: 'Carta exclusiva de snacks y bebidas premium entregadas a su habitación.', imageUrl: '/motel_amenities_sparkling_pool_1773958148851.png' },
        { id: '3', title: 'Smart Controls', description: 'Controle iluminación, música y temperatura desde su dispositivo.', imageUrl: '/motel_exterior_night_1773958134736.png' },
        { id: '4', title: 'Camas King', description: 'Lencería de alta densidad de hilos para el descanso que merece.', imageUrl: '/motel_premium_room_1773958120043.png' },
      ],
    },
    gallerySection: {
      title1: 'EXPLORE',
      title2: 'LUJO',
      images: [
        { id: '1', url: '/motel_exterior_night_1773958134736.png', alt: 'Exterior' },
        { id: '2', url: '/motel_premium_room_1773958120043.png', alt: 'Room' },
        { id: '3', url: '/motel_amenities_sparkling_pool_1773958148851.png', alt: 'Pool' },
        { id: '4', url: 'https://picsum.photos/seed/luxury4/1200/800', alt: 'Mood' },
      ],
    },
    footerSection: {
      description: 'El motel líder en Costa Rica, ofreciendo experiencias de lujo y privacidad desde hace más de 15 años.',
      address: 'San José, Costa Rica. Del cruce de Escazú 2km Sur.',
      phone: '+506 2222-2222',
      whatsapp: '+506 8888-8888',
      googleMapsUrl: 'https://www.google.com/maps/place/Hotel+Dumanolo/@9.9940155,-84.1208675,17z/data=!3m1!4b1!4m6!3m5!1s0x8fa0fadcbd8621e1:0xb7a02eafc5c90ebf!8m2!3d9.9940102!4d-84.1182926!16s%2Fg%2F11cm6fkg8p?entry=ttu&g_ep=EgoyMDI2MDMxNy4wIKXMDSoASAFQAw%3D%3D',
      socialMedia: [
        { platform: 'Instagram', url: 'https://instagram.com' },
        { platform: 'Facebook', url: 'https://facebook.com' },
      ],
    },
  };

  const form = useForm<FormData>({
    resolver: zodResolver(landingPageContentSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'featuresSection.features',
  });

  const { fields: amenityFields, append: appendAmenity, remove: removeAmenity } = useFieldArray({
    control: form.control,
    name: 'amenitiesSection.amenities',
  });

  const { fields: galleryFields, append: appendGallery, remove: removeGallery } = useFieldArray({
    control: form.control,
    name: 'gallerySection.images',
  });

  const { fields: socialFields, append: appendSocial, remove: removeSocial } = useFieldArray({
    control: form.control,
    name: 'footerSection.socialMedia',
  });
  
  useEffect(() => {
    if (content) {
      // Merge content with default values to ensure no section becomes undefined
      const mergedContent = {
        ...defaultValues,
        ...content,
        featuresSection: {
          ...defaultValues.featuresSection,
          ...(content.featuresSection || {}),
        },
        amenitiesSection: {
          ...defaultValues.amenitiesSection,
          ...(content.amenitiesSection || {}),
        },
        gallerySection: {
          ...defaultValues.gallerySection,
          ...(content.gallerySection || {}),
        },
        footerSection: {
          ...defaultValues.footerSection,
          ...(content.footerSection || {}),
        },
      };
      form.reset(mergedContent);
    }
  }, [content, form]);

  const onSubmit = (values: FormData) => {
    startTransition(async () => {
      const result = await saveLandingPageContent(values);
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'El contenido de la página de inicio ha sido actualizado.' });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" /> Sección: Por qué somos Diferentes
            </CardTitle>
            <CardDescription>
              Personalice el título principal y la descripción de la sección de características.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="featuresSection.title1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 1 (Blanco)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: POR QUÉ SOMOS" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="featuresSection.title2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 2 (Color Primario)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: DIFERENTES" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="featuresSection.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Ingrese una breve descripción..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Cajas de Características</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ id: Date.now().toString(), icon: 'Star', title: '', description: '' })}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Caja
            </Button>
          </div>

          <div className="grid gap-6">
            {fields.map((field, index) => {
              const selectedIconName = form.watch(`featuresSection.features.${index}.icon`) as keyof typeof featureIcons;
              const IconComponent = featureIcons[selectedIconName] || Star;

              return (
                <Card key={field.id} className="relative overflow-hidden border-primary/10">
                  <div className="absolute top-2 right-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive/80"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="pt-6 grid md:grid-cols-[150px_1fr] gap-6">
                    <div className="space-y-3">
                      <FormLabel>Icono</FormLabel>
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 rounded-2xl bg-primary/5 text-primary">
                          <IconComponent className="h-8 w-8" />
                        </div>
                        <FormField
                          control={form.control}
                          name={`featuresSection.features.${index}.icon`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Icono" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.keys(featureIcons).map((iconName) => (
                                  <SelectItem key={iconName} value={iconName}>
                                    {iconName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`featuresSection.features.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Título de la Caja</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ej: MÁXIMA PRIVACIDAD" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`featuresSection.features.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción corta</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={2} placeholder="Describa esta característica..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" /> Sección: Nuestras Amenidades
            </CardTitle>
            <CardDescription>
              Personalice el título y las amenidades destacadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amenitiesSection.title1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 1 (Blanco)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: DISEÑO QUE" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amenitiesSection.title2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 2 (Color Primario)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: INSPIRA" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Lista de Amenidades</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendAmenity({ id: Date.now().toString(), title: '', description: '' })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Amenidad
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {amenityFields.map((field, index) => (
                  <Card key={field.id} className="border-primary/5 bg-primary/[0.02]">
                    <CardContent className="pt-6 space-y-4 relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive/80"
                        onClick={() => removeAmenity(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <FormField
                        control={form.control}
                        name={`amenitiesSection.amenities.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Título</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 px-3" placeholder="Ej: Jacuzzi Privado" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`amenitiesSection.amenities.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Descripción</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={2} className="resize-none" placeholder="Breve descripción..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`amenitiesSection.amenities.${index}.imageUrl`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Imagen de la Amenidad</FormLabel>
                            <FormControl>
                              <ImageUpload 
                                value={field.value || ''} 
                                onChange={field.onChange} 
                                path="amenities" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" /> Sección: Explore Lujo (Galería)
            </CardTitle>
            <CardDescription>
              Gestione las imágenes que aparecen en la galería de la página principal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gallerySection.title1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 1 (Blanco)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: EXPLORE" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gallerySection.title2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título Línea 2 (Color Primario)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: LUJO" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Imágenes de la Galería</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendGallery({ id: Date.now().toString(), url: '', alt: '' })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Imagen
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {galleryFields.map((field, index) => (
                  <Card key={field.id} className="border-primary/5 bg-primary/[0.02]">
                    <CardContent className="pt-6 space-y-4 relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 text-destructive hover:text-destructive/80"
                        onClick={() => removeGallery(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      
                      <FormField
                        control={form.control}
                        name={`gallerySection.images.${index}.url`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Archivo de Imagen</FormLabel>
                            <FormControl>
                              <ImageUpload 
                                value={field.value || ''} 
                                onChange={field.onChange} 
                                path="gallery" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`gallerySection.images.${index}.alt`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Descripción (Alt)</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-9 px-3" placeholder="Ej: Vista del exterior" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
              {galleryFields.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-muted rounded-2xl">
                  <p className="text-muted-foreground text-sm">No hay imágenes en la galería. Añade una para comenzar.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" /> Sección: Pie de Página (Footer)
            </CardTitle>
            <CardDescription>
              Gestione la información de contacto y redes sociales que aparece en la parte inferior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="footerSection.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Motel (Footer)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Ingrese una breve descripción para el pie de página..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="footerSection.address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección Física</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: San José, Costa Rica..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="footerSection.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: +506 2222-2222" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="footerSection.whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de WhatsApp</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: +506 8888-8888" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="footerSection.googleMapsUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enlace de Google Maps (Ubicación)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://www.google.com/maps/..." />
                  </FormControl>
                  <FormDescription>
                    Este enlace se usará para generar los botones de navegación (Google Maps y Waze).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 pt-4 border-t border-primary/10">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Redes Sociales</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendSocial({ platform: 'Instagram', url: '' })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Añadir Red Social
                </Button>
              </div>

              <div className="grid gap-3">
                {socialFields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-1">
                    <FormField
                      control={form.control}
                      name={`footerSection.socialMedia.${index}.platform`}
                      render={({ field }) => (
                        <FormItem className="w-1/3">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Plataforma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Instagram">Instagram</SelectItem>
                              <SelectItem value="Facebook">Facebook</SelectItem>
                              <SelectItem value="TikTok">TikTok</SelectItem>
                              <SelectItem value="Twitter">Twitter/X</SelectItem>
                              <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`footerSection.socialMedia.${index}.url`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} placeholder="URL del perfil (https://...)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-10 w-10 shrink-0"
                      onClick={() => removeSocial(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {socialFields.length === 0 && (
                  <p className="text-center py-4 text-xs text-muted-foreground italic">No hay redes sociales configuradas.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending} size="lg">
            {isPending ? 'Guardando...' : 'Guardar Todos los Cambios'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
