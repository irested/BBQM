// Webhook pour recevoir les clics sur les boutons Telegram
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const update = await request.json();

    // On ne s'intéresse qu'aux clics sur les boutons (callback_query)
    if (!update.callback_query) {
      return new Response("OK", { status: 200 });
    }

    const callbackQuery = update.callback_query;
    const data = callbackQuery.data; // ex: "VAL|0612345678|2|Margherita"
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const originalText = callbackQuery.message.text;

    if (data.startsWith("VAL|")) {
      // 1. Extraire les infos de la commande depuis le texte du message Telegram
      // Format attendu (généré par order.js) :
      // 👤 Client: John Doe
      // 📞 Téléphone: 0612345678
      // 📦 Formule: Match Box (2)
      // 🍕 Pizza: BBQ
      const extractField = (label) => {
        const regex = new RegExp(`${label}:?\\s*(.+)`);
        const match = originalText.match(regex);
        return match ? match[1].trim() : null;
      };

      const firstName = extractField("Prénom");
      const lastName = extractField("Nom");
      const phone = extractField("Téléphone");
      const box = extractField("Formule"); // ex: "Match Box (2)"
      const pizza = extractField("Pizza");
      const orderDate = extractField("Date");
      const address = extractField("Adresse");
      const zip = extractField("CP");
      const city = extractField("Ville");

      // 2. Préparation pour Hiboutik API
      // Note: Les IDs doivent être configurés dans Cloudflare (Variables d'environnement)
      // ou on peut utiliser un fichier de mapping.
      const HIBOUTIK_ACCOUNT = env.HIBOUTIK_ACCOUNT;
      const HIBOUTIK_EMAIL = env.HIBOUTIK_EMAIL;
      const HIBOUTIK_KEY = env.HIBOUTIK_API_KEY;

      if (!HIBOUTIK_ACCOUNT || !HIBOUTIK_EMAIL || !HIBOUTIK_KEY) {
        throw new Error("Hiboutik credentials missing");
      }

      const authHeader = "Basic " + btoa(`${HIBOUTIK_EMAIL}:${HIBOUTIK_KEY}`);

      // --- HIBOUTIK API LOGIC ---
      const baseUrl = `https://${HIBOUTIK_ACCOUNT}.hiboutik.com/api`;
      
      async function hFetch(endpoint, method = 'GET', body = null) {
        const options = {
          method,
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(baseUrl + endpoint, options);
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Erreur ${res.status} sur ${endpoint} : ${errText}`);
        }
        return await res.json();
      }

      try {
        // 1. Chercher ou créer le client
        let customerId;
        const searchCustomer = await hFetch(`/customers/search/?phone=${encodeURIComponent(phone)}`);
        if (searchCustomer && searchCustomer.length > 0) {
          customerId = searchCustomer[0].customers_id;
        } else {
          // Créer le client
          const newCustomer = await hFetch('/customers/', 'POST', {
            first_name: firstName || "",
            last_name: lastName || "Inconnu",
            phone: phone,
            address: address || "",
            zipcode: zip || "",
            city: city || ""
          });
          customerId = newCustomer.customers_id || newCustomer.id;
        }

        // 2. Créer la vente
        const sale = await hFetch('/sales/', 'POST', {
          store_id: 1, // Store par défaut
          customer_id: customerId,
          currency_code: "EUR"
        });
        const saleId = sale.sale_id || sale.id;

        // Ajouter une note à la vente avec la date prévue et l'adresse complète
        try {
          const notes = `Pré-commande pour le : ${orderDate}\nLivraison : ${address}, ${zip} ${city}`;
          await hFetch(`/sales/${saleId}`, 'PUT', { notes: notes });
        } catch (e) {
          console.error("Erreur lors de l'ajout des notes:", e);
        }

        // 3. Ajouter le produit BOX (ID 48) avec la bonne déclinaison
        // On suppose que Size 2 = id 1, Size 4 = id 2 par exemple
        let sizeId = 1; 
        if (box && box.includes("4")) sizeId = 2; // Si "Pour 4", on suppose ID 2

        const addedProduct = await hFetch('/sales/add_product/', 'POST', {
          sale_id: saleId,
          product_id: 48,
          size_id: sizeId,
          stock_withdrawal: 1
        });
        
        // 4. Ajouter l'option Pizza (Recherche dynamique de l'ID par nom)
        let modifierId = null;
        try {
          const modifiers = await hFetch('/products/modifiers/');
          // On cherche une pizza dont le nom contient ou correspond à ce qu'on a reçu
          const found = modifiers.find(m => m.modifier_name && m.modifier_name.toLowerCase().includes(pizza.toLowerCase().substring(0, 5)));
          if (found) modifierId = found.modifier_id || found.id;
        } catch (e) {
          console.error("Erreur recherche modifier_id:", e);
        }
        
        // Fallback si non trouvé
        if (!modifierId) modifierId = 62;
        
        // L'API Hiboutik retourne l'ID de la ligne sous le nom "id_sale_product_detail"
        let lineId = null;
        if (Array.isArray(addedProduct)) {
            lineId = addedProduct[addedProduct.length - 1].id_sale_product_detail || addedProduct[addedProduct.length - 1].id;
        } else if (addedProduct) {
            lineId = addedProduct.id_sale_product_detail || addedProduct.id;
        }

        // Si on ne trouve toujours pas la ligne, on lève une erreur pour voir ce que l'API a répondu
        if (!lineId) {
            throw new Error("Impossible de trouver l'ID de la ligne. Reponse API: " + JSON.stringify(addedProduct).substring(0, 100));
        }
        
        if (lineId && modifierId) {
          try {
            await hFetch(`/sale_line_item_modifier/${lineId}/${modifierId}/`, 'POST');
          } catch (modifierErr) {
            console.error("Erreur ajout modifier", modifierErr);
            throw new Error("Impossible d'ajouter la pizza (modifier). API: " + modifierErr.message);
          }
        }

        // 3. Répondre à Telegram pour dire que c'est validé
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "✅ Commande validée sur Hiboutik !",
            show_alert: true
          })
        });

        // 4. Mettre à jour le message Telegram pour supprimer le bouton
        const updatedText = originalText + "\n\n✅ Traitée et envoyée à la caisse !";
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: updatedText
          })
        });

      } catch (err) {
        console.error("Erreur durant l'intégration Hiboutik:", err);
        // Informer Telegram de l'erreur avec les détails (SANS MARKDOWN POUR NE PAS PLANTER TELEGRAM)
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: "❌ Erreur de synchronisation.",
            show_alert: true
          })
        });

        const errMsg = err.message || "Erreur inconnue";
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: originalText + `\n\n❌ Erreur lors de l'envoi à la caisse:\n${errMsg}`
          })
        });
        
        return new Response("OK", { status: 200 });
      }
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}
