export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Get the JSON data from the form
  let data;
  try {
    data = await request.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { name, phone, address, box_size, box_pizza, match_date } = data;

  // 2. Validate essential fields
  if (!name || !phone || !address || !box_size || !box_pizza) {
    return new Response("Missing fields", { status: 400 });
  }

  // 3. Prepare Telegram Payload
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set in environment variables.");
    return new Response("Server Configuration Error", { status: 500 });
  }

  // Escape special characters for MarkdownV2
  const escapeMD = (text) => {
    return text.toString().replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  };

  const messageText = `
🍕 *Nouvelle Pré\\-commande \\!*
👤 *Client:* ${escapeMD(name)}
📞 *Téléphone:* ${escapeMD(phone)}
📦 *Formule:* Match Box \\(${escapeMD(box_size)}\\)
🍕 *Pizza:* ${escapeMD(box_pizza)}
🕒 *Date:* ${escapeMD(match_date)}
📍 *Adresse:* ${escapeMD(address)}
`;

  const telegramPayload = {
    chat_id: chatId,
    text: messageText,
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Valider (Envoi vers Hiboutik)",
            // We pack phone and a short version of pizza/size just to identify it
            callback_data: `VAL|${phone}|${box_size.substring(0,1)}|${box_pizza.substring(0,10)}`
          }
        ]
      ]
    }
  };

  // 4. Send to Telegram
  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramPayload)
    });

    if (telegramResponse.ok) {
      return new Response("Order received", { status: 200 });
    } else {
      const errorText = await telegramResponse.text();
      console.error("Telegram API Error:", errorText);
      return new Response("Failed to send notification", { status: 502 });
    }
  } catch (err) {
    console.error("Fetch Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

