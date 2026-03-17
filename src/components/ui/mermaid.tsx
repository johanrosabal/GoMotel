'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface MermaidProps {
  chart: string;
}

/**
 * Componente cliente para renderizar diagramas de Mermaid.js.
 * Utiliza inicialización asíncrona para evitar errores de SSR en Next.js.
 * Responde dinámicamente al cambio de tema de la aplicación.
 */
export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const initMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        
        const isDark = resolvedTheme === 'dark';

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          themeVariables: {
            fontFamily: 'inherit',
            primaryColor: '#10b981',
            primaryTextColor: isDark ? '#fff' : '#111827',
            primaryBorderColor: '#059669',
            lineColor: isDark ? '#94a3b8' : '#4b5563',
            secondaryColor: '#f59e0b',
            tertiaryColor: isDark ? '#1e293b' : '#f9fafb',
            edgeLabelBackground: isDark ? '#1e293b' : '#ffffff',
          },
          securityLevel: 'loose',
        });

        // Generar un ID único para evitar colisiones en el DOM
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        
        // Renderizar el diagrama
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (error) {
        console.error('Error al renderizar Mermaid chart:', error);
      }
    };

    initMermaid();
  }, [chart, resolvedTheme]);

  return (
    <div 
      className="mermaid-wrapper flex justify-center py-10 overflow-x-auto bg-white dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-primary/10 my-8 shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg || '<div class="animate-pulse text-xs font-bold text-muted-foreground uppercase tracking-widest">Cargando Diagrama...</div>' }}
    />
  );
};
