async function main() {
  console.log("Haciendo petición de prueba con el mensaje del usuario...");
  try {
    const res = await fetch("https://app.ikalchukum.com/api/chat/sofia", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Hola, quiero cotizar Chukum",
        phone: "+15554013952"
      })
    });

    console.log("Status Code:", res.status);
    const text = await res.text();
    console.log("Response Body:");
    console.log(text);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
