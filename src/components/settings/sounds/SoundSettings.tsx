'use client';

import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';
import { playNotificationSound, type AlarmSound } from '@/lib/sound';
import { useToast } from '@/hooks/use-toast';

const soundOptions: { value: AlarmSound; label: string; description: string }[] = [
  { value: 'bip', label: 'Bip Clásico', description: 'Un sonido simple y agudo. Efectivo y discreto.' },
  { value: 'bell', label: 'Campana de Hotel', description: 'Un tono de campana claro y resonante. Profesional.' },
  { value: 'digital', label: 'Alarma Digital', description: 'Un sonido de alarma moderno y persistente. Urgente.' },
];

const ALARM_SOUND_KEY = 'alarm_sound_preference';

export default function SoundSettings() {
  const [selectedSound, setSelectedSound] = useState<AlarmSound>('bip');
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedSound = localStorage.getItem(ALARM_SOUND_KEY) as AlarmSound | null;
    if (storedSound && soundOptions.some(opt => opt.value === storedSound)) {
      setSelectedSound(storedSound);
    }
    setIsMounted(true);
  }, []);

  const handleSoundChange = (value: AlarmSound) => {
    setSelectedSound(value);
    localStorage.setItem(ALARM_SOUND_KEY, value);
    toast({
      title: 'Sonido de Alarma Guardado',
      description: `Se ha establecido "${soundOptions.find(o => o.value === value)?.label}" como su sonido de alerta.`,
    });
  };

  const previewSound = (sound: AlarmSound) => {
    playNotificationSound(sound);
  };
  
  if (!isMounted) {
      return <div>Cargando configuración de sonido...</div>;
  }

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedSound}
        onValueChange={handleSoundChange}
        className="grid gap-4 md:grid-cols-2"
      >
        {soundOptions.map((option) => (
          <Label
            key={option.value}
            htmlFor={`sound-${option.value}`}
            className="flex flex-col items-start gap-4 rounded-lg border p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:border-primary"
          >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <RadioGroupItem value={option.value} id={`sound-${option.value}`} />
                    <span className="font-bold text-base">{option.label}</span>
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        previewSound(option.value);
                    }}
                    aria-label={`Probar sonido ${option.label}`}
                >
                    <Volume2 className="h-5 w-5" />
                </Button>
            </div>
            <p className="pl-8 text-sm text-muted-foreground leading-snug">{option.description}</p>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
