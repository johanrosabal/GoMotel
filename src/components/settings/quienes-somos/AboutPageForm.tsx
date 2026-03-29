'use client';

import { useState, useTransition, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AboutPageContent } from '@/types';
import { saveAboutPageContent } from '@/lib/actions/cms.actions';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FileText, Save, ImageIcon } from 'lucide-react';
import { MediaUpload } from '@/components/ui/media-upload';

const aboutPageContentSchema = z.object({
  content: z.string().min(1, 'El contenido es requerido.'),
  heroImageUrl: z.string().optional(),
});

type FormData = z.infer<typeof aboutPageContentSchema>;

export default function AboutPageForm() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  
  const contentRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'publicPages', 'about');
  }, [firestore]);
  
  const { data: content, isLoading } = useDoc<AboutPageContent>(contentRef);

  const form = useForm<FormData>({
    resolver: zodResolver(aboutPageContentSchema),
    defaultValues: {
      content: '',
      heroImageUrl: '',
    },
  });

  useEffect(() => {
    if (content) {
      form.reset({ 
        content: content.content,
        heroImageUrl: content.heroImageUrl || '',
      });
    }
  }, [content, form]);

  const onSubmit = (values: FormData) => {
    startTransition(async () => {
      const result = await saveAboutPageContent(values);
      if (result?.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: '¡Éxito!', description: 'El contenido ha sido actualizado.' });
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
                <ImageIcon className="h-5 w-5" /> Imagen de Portada (Hero)
            </CardTitle>
            <CardDescription>
              Seleccione la imagen principal que aparecerá en la parte superior de la página Quiénes Somos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="heroImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MediaUpload 
                      value={field.value || ''} 
                      onChange={field.onChange} 
                      path="about" 
                      type="image"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Contenido de la Página
            </CardTitle>
            <CardDescription>
              Escriba o pegue la historia y misión del motel. Use el editor para dar formato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RichTextEditor content={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isPending}>
            {isPending ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> Guardando...</span> : <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Guardar Cambios</span>}
          </Button>
        </div>
      </form>
    </Form>
  );
}
