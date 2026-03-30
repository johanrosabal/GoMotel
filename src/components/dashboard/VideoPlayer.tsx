'use client';

import { Play, Youtube, Info } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
    url: string;
    title?: string;
    className?: string;
}

export function VideoPlayer({ url, title, className }: VideoPlayerProps) {
    const [hasError, setHasError] = useState(false);

    // Get YouTube ID from various formats
    const getYouTubeID = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Get Vimeo ID
    const getVimeoID = (url: string) => {
        const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
        const match = url.match(regExp);
        return match ? match[3] : null;
    };

    const youtubeID = getYouTubeID(url);
    const vimeoID = getVimeoID(url);

    if (hasError) {
        return (
            <div className={cn("aspect-video bg-neutral-900 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-6", className)}>
                <Info className="h-8 w-8 text-rose-500 mb-2 opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Error al cargar el video</p>
                <p className="text-[10px] text-slate-600 mt-1">El formato del enlace no es compatible o el video ya no existe.</p>
            </div>
        );
    }

    if (youtubeID) {
        return (
            <div className={cn("aspect-video relative group rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-2xl", className)}>
                <iframe
                    src={`https://www.youtube.com/embed/${youtubeID}?rel=0&modestbranding=1`}
                    title={title || "YouTube video player"}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onError={() => setHasError(true)}
                />
            </div>
        );
    }

    if (vimeoID) {
        return (
            <div className={cn("aspect-video relative group rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-2xl", className)}>
                <iframe
                    src={`https://player.vimeo.com/video/${vimeoID}?badge=0&autopause=0&player_id=0&app_id=58479`}
                    title={title || "Vimeo video player"}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    onError={() => setHasError(true)}
                />
            </div>
        );
    }

    // Direct MP4 or unknown link
    return (
        <div className={cn("aspect-video relative group rounded-2xl overflow-hidden bg-black ring-1 ring-white/5 shadow-2xl flex flex-col", className)}>
            <video 
                controls 
                playsInline
                preload="metadata"
                className="w-full h-full"
                title={title}
                onError={() => setHasError(true)}
            >
                <source src={url} />
                Tu navegador no soporta el tag de video.
            </video>
        </div>
    );
}
