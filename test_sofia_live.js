async function main() {
  console.log("Haciendo petición de prueba a la API de Sofía en producción...");
  try {
    const res = await fetch("https://app.ikalchukum.com/api/chat/sofia", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Hola, soy Gabriel de Miami quiero cotizar chukum",
        phone: "+15554013952"
      })
    });

    console.log("Status Code:", res.status);
    const text = await res.text();
    console.log("Raw Response:");
    console.log(text);
  } catch (err) {
    console.error("Error al conectar:", err);
  }
}

main();
