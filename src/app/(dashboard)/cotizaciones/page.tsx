export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import QuotesList from "./QuotesList";
import Link from "next/link";

export default async function CotizacionesPage() {
  // 1. Obtener todas las cotizaciones reales de la base de datos SQLite, incluyendo si tienen pedido
  const quotes = await db.quote.findMany({
    include: {
      client: true,
      user: true,
      order: {
        select: {
          id: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <main className="main-content animate-fade-in">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            Cotizaciones de Venta
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', fontWeight: 500 }}>
            Genera, envía y da seguimiento al estado de tus cotizaciones comerciales.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/cotizaciones/nueva" style={{ textDecoration: 'none' }}>
            <button className="btn-premium btn-primary-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Nueva Cotización
            </button>
          </Link>
        </div>
      </div>

      {/* Renderizar la lista de cotizaciones interactiva */}
      <QuotesList initialQuotes={quotes} />
    </main>
  );
}
