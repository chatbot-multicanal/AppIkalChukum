"use client";

import { useEffect } from "react";

interface PrintTriggerProps {
  title: string;
}

export default function PrintTrigger({ title }: PrintTriggerProps) {
  useEffect(() => {
    // 1. Establecer el título del documento para que al "Guardar como PDF",
    // el navegador use este título por defecto como nombre de archivo.
    document.title = title;

    // 2. Asociar el evento click al botón de imprimir
    const printBtn = document.getElementById("print-btn-trigger");
    if (printBtn) {
      printBtn.onclick = () => {
        window.print();
      };
    }

    // 3. Disparar automáticamente el diálogo de impresión del navegador
    // con un leve delay para asegurar que los estilos CSS y fuentes terminen de cargar.
    const timer = setTimeout(() => {
      window.print();
    }, 800);

    return () => clearTimeout(timer);
  }, [title]);

  return null;
}
