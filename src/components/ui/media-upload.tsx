'use client';

import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Loader2, X, Video, Film, Play } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface MediaUploadProps {
  value: string;
  onChange: (url: string) => void;
  path?: string;
  type?: 'image' | 'video';
  maxSizeMB?: number;
}

export function MediaUpload({ 
  value, 
  onChange, 
  path = 'gallery', 
  type = 'image',
  maxSizeMB = 50 
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const storage = useStorage();
  const { toast } = useToast();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (type === 'image' && !file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Por favor seleccione una imagen válida.', variant: 'destructive' });
      return;
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      toast({ title: 'Error', description: 'Por favor seleccione un video válido.', variant: 'destructive' });
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast({ 
        title: 'Archivo demasiado grande', 
        description: `El archivo supera el límite de ${maxSizeMB}MB.`, 
        variant: 'destructive' 
      });
      return;
    }

    // Delete old media if it exists and is from Firebase Storage
    if (value && value.includes('firebasestorage.googleapis.com')) {
      try {
        const oldRef = ref(storage, value);
        await deleteObject(oldRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error('Error deleting old media:', error);
        }
      }
    }

    setUploading(true);
    setProgress(0);
    const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(Math.round(p));
      },
      (error) => {
        console.error('Upload error:', error);
        toast({ title: 'Error de subida', description: 'No se pudo subir el archivo.', variant: 'destructive' });
        setUploading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onChange(downloadURL);
          setUploading(false);
          toast({ title: '¡Listo!', description: 'Archivo subido correctamente.' });
        } catch (err: any) {
          console.error('Error obteniendo URL:', err);
          toast({ title: 'Error de subida', description: 'Problema obteniendo enlace de archivo.', variant: 'destructive' });
          setUploading(false);
        }
      }
    );
  };

  const handleRemove = async () => {
    if (value && value.includes('firebasestorage.googleapis.com')) {
      try {
        const oldRef = ref(storage, value);
        await deleteObject(oldRef);
      } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
          console.error('Error deleting file:', error);
        }
      }
    }
    onChange('');
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-input shadow-sm group">
          {type === 'image' ? (
            <Image src={value} alt="Preview" fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
              <video src={value} className="w-full h-full object-contain" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Play className="h-12 w-12 text-white fill-white/20" />
              </div>
            </div>
          )}
          
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
              {type === 'image' ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {type === 'image' ? 'Imagen' : 'Video'}
            </span>
          </div>
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center border-2 border-dashed border-input rounded-xl aspect-video hover:bg-muted/50 transition-all cursor-pointer relative overflow-hidden group",
          uploading && "pointer-events-none"
        )}>
          <Input
            type="file"
            accept={type === 'image' ? 'image/*' : 'video/*'}
            className="hidden"
            onChange={onFileChange}
            disabled={uploading}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                  {progress}%
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                Subiendo {type === 'image' ? 'Imagen' : 'Video'}...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
              <div className="p-4 rounded-full bg-muted group-hover:bg-primary/5 transition-colors">
                {type === 'image' ? <ImagePlus className="h-8 w-8" /> : <Film className="h-8 w-8" />}
              </div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase tracking-widest block">Subir {type === 'image' ? 'imagen' : 'video'}</span>
                <span className="text-[9px] text-muted-foreground font-medium italic mt-1 block">Tamaño máx: {maxSizeMB}MB</span>
              </div>
            </div>
          )}
        </label>
      )}
    </div>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" 
      strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  );
}
