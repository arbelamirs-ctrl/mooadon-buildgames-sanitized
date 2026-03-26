Deno.serve(() => {
  const manifest = {
    name: "Mooadon — Loyalty Platform",
    short_name: "Mooadon",
    description: "Loyalty & rewards platform for businesses",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#17171f",
    theme_color: "#10b981",
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "https://base44.com/logo_v2.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ],
    categories: ["business", "finance", "productivity"],
    shortcuts: [
      {
        name: "POS Terminal",
        short_name: "POS",
        description: "POS Terminal",
        url: "/POSTerminal"
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Dashboard",
        url: "/AgentDashboard"
      }
    ]
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
});