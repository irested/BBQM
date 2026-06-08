export async function onRequest(context) {
    const { env } = context;
    
    const HIBOUTIK_ACCOUNT = env.HIBOUTIK_ACCOUNT;
    const HIBOUTIK_EMAIL = env.HIBOUTIK_EMAIL;
    const HIBOUTIK_KEY = env.HIBOUTIK_KEY;

    if (!HIBOUTIK_ACCOUNT || !HIBOUTIK_EMAIL || !HIBOUTIK_KEY) {
      return new Response("Missing env", { status: 500 });
    }

    const authHeader = "Basic " + btoa(`${HIBOUTIK_EMAIL}:${HIBOUTIK_KEY}`);
    const baseUrl = `https://${HIBOUTIK_ACCOUNT}.hiboutik.com/api`;

    try {
      // Fetch the root API endpoint which usually returns the OpenAPI specification or list of endpoints
      const res = await fetch(baseUrl, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      const data = await res.text();
      return new Response(data, {
          headers: { 'Content-Type': 'application/json' }
      });
    } catch(e) {
      return new Response(e.toString(), { status: 500 });
    }
}
