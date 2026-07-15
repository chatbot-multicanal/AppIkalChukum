async function main() {
  console.log("Consultando el host de la base de datos de producción...");
  try {
    const res = await fetch("https://app.ikalchukum.com/api/debug");
    console.log("Status:", res.status);
    if (res.status === 200) {
      const json = await res.json();
      console.log("Production Database Host:", json.host);
    } else {
      console.log("Aún no se ha desplegado. Reintentando...");
    }
  } catch (err) {
    console.log("Error al conectar. Reintentando...", err.message);
  }
}

main();
