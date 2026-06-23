const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'dev.db');
  console.log("Conectando a local SQLite:", dbPath);
  const db = new Database(dbPath);

  // Ver si existen tablas
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tablas en SQLite local:", tables.map(t => t.name).join(", "));

  if (tables.some(t => t.name === 'Quote')) {
    const quoteCount = db.prepare("SELECT COUNT(*) as count FROM Quote").get().count;
    console.log("Cantidad de Cotizaciones en SQLite local:", quoteCount);

    if (quoteCount > 0) {
      const quotes = db.prepare("SELECT * FROM Quote LIMIT 5").all();
      console.log("Muestra de Cotizaciones en SQLite local:");
      console.log(quotes);
    }
  }

  if (tables.some(t => t.name === 'Client')) {
    const clientCount = db.prepare("SELECT COUNT(*) as count FROM Client").get().count;
    console.log("Cantidad de Clientes en SQLite local:", clientCount);
  }
  
  db.close();
} catch (error) {
  console.error("Error leyendo SQLite:", error);
}
