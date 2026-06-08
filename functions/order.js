export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Get the JSON data from the form
  let data;
  try {
    data = await request.json();
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { name, phone, address, box_name, match_date } = data;

  // 2. Validate essential fields
  if (!name || !phone || !address) {
    return new Response("Missing fields", { status: 400 });
  }

  // 3. Prepare Telegram Payload
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = "-5165917777"; // Group Chat ID

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
📦 *Produit:* ${escapeMD(box_name)}
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
            // We will pack the essential data in the callback_data later (max 64 bytes)
            // For now, it's just a placeholder action
            callback_data: `VAL|${phone}|${box_name.substring(0,20)}`
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

