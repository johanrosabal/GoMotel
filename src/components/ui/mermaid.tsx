'use client';

import React, { useEffect, useState } from 'react';

interface MermaidProps {
  chart: string;
}

/**
 * Componente cliente para renderizar diagramas de Mermaid.js.
 * Utiliza inicialización asíncrona para evitar errores de SSR en Next.js.
 */
export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    const initMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#10b981',
            primaryTextColor: '#fff',
            primaryBorderColor: '#059669',
            lineColor: '#6b7280',
            secondaryColor: '#f59e0b',
            tertiaryColor: '#fff',
            mainBkg: '#ffffff',
            nodeBorder: '#e2e8f0',
            clusterBkg: '#f8fafc'
          },
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        // Generar un ID único para evitar colisiones en el DOM
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        setSvg(renderedSvg);
      } catch (error) {
        console.error('Error al renderizar Mermaid chart:', error);
      }
    };

    initMermaid();
  }, [chart]);

  return (
    <div 
      className="mermaid-wrapper flex justify-center py-10 overflow-x-auto bg-white/50 dark:bg-muted/10 rounded-2xl border-2 border-dashed border-primary/10 my-8 shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg || '<div class="animate-pulse text-xs font-bold text-muted-foreground uppercase tracking-widest">Cargando Diagrama...</div>' }}
    />
  );
};
