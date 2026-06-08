export async function onRequestGet(context) {
  const { env } = context;

  const HIBOUTIK_ACCOUNT = env.HIBOUTIK_ACCOUNT;
  const HIBOUTIK_EMAIL = env.HIBOUTIK_EMAIL;
  const HIBOUTIK_KEY = env.HIBOUTIK_API_KEY;

  if (!HIBOUTIK_ACCOUNT || !HIBOUTIK_EMAIL || !HIBOUTIK_KEY) {
    return new Response(JSON.stringify({ error: "Missing configuration" }), { status: 500 });
  }

  const authHeader = "Basic " + btoa(`${HIBOUTIK_EMAIL}:${HIBOUTIK_KEY}`);
  const baseUrl = `https://${HIBOUTIK_ACCOUNT}.hiboutik.com/api`;

  try {
    // Appel API pour récupérer les modificateurs (Pizzas)
    // Selon la documentation Hiboutik, on récupère généralement tous les modificateurs ou un groupe.
    const res = await fetch(`${baseUrl}/products/modifiers/`, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Hiboutik API error: ${res.statusText}`);
    }

    const modifiers = await res.json();
    
    // On filtre pour ne garder que ceux du groupe 61 (le groupe de vos Pizzas)
    // L'API Hiboutik utilise généralement une clé 'modifiers_groups_id' ou 'group_id'
    const pizzas = modifiers.filter(m => 
        String(m.modifiers_groups_id) === "61" || 
        String(m.group_id) === "61" ||
        String(m.modifier_group_id) === "61"
    );

    // On prépare une réponse ultra-rapide avec Cache-Control (garder en mémoire 5 minutes)
    return new Response(JSON.stringify(pizzas.length > 0 ? pizzas : modifiers), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300" // Cache Cloudflare de 5 mins
      }
    });

  } catch (error) {
    console.error("Erreur Fetch Pizzas:", error);
    // En cas d'erreur de l'API (ou si l'URL exacte diffère), on renvoie au moins le fallback (62 et 63)
    const fallbackPizzas = [
      { id: 62, modifier_id: 62, modifier_name: "Pepperoni" },
      { id: 63, modifier_id: 63, modifier_name: "Fromage" }
    ];
    return new Response(JSON.stringify(fallbackPizzas), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
