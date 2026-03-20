'use client';

import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useStorage } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Loader2, X } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  path?: string;
}

export function ImageUpload({ value, onChange, path = 'landing-page' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const storage = useStorage();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Delete old image if it exists and is from Firebase Storage
    if (value && value.includes('firebasestorage.googleapis.com')) {
      try {
        const oldRef = ref(storage, value);
        await deleteObject(oldRef);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    setUploading(true);
    const storageRef = ref(storage, `${path}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      null,
      (error) => {
        console.error('Upload error:', error);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        onChange(downloadURL);
        setUploading(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      {value ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-input">
          <Image src={value} alt="Preview" fill className="object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={async () => {
              if (value.includes('firebasestorage.googleapis.com')) {
                try {
                  const oldRef = ref(storage, value);
                  await deleteObject(oldRef);
                } catch (error) {
                  console.error('Error deleting image:', error);
                }
              }
              onChange('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-lg aspect-video hover:bg-muted/50 transition-colors cursor-pointer relative">
          <Input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImagePlus className="h-8 w-8" />
              <span className="text-xs font-bold uppercase tracking-wider">Subir imagen</span>
            </div>
          )}
        </label>
      )}
    </div>
  );
}
