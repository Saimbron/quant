// Datos del sitio
export const SITE = {
  name: 'Quant',
  url: 'https://quantneto.com',
  email: 'hola@quantneto.com',
  // Titular del sitio (obligatorio por la LSSI en el aviso legal)
  owner: 'Àlex Cimbron Morales',
  nif: '41633576B',
  city: 'Barcelona',
  updated: '2026-10-15',

  // Google AdSense. Con `client` vacío no se carga nada: ni anuncios, ni cookies, ni aviso.
  // Al rellenarlo se activan a la vez los anuncios, el ads.txt, la CSP de Google y el texto legal.
  // En AdSense, publica también el mensaje de consentimiento (Privacidad y mensajes > RGPD).
  ads: {
    client: '', // p. ej. 'ca-pub-1234567890123456'
    slots: {
      afterHero: '', // ID del bloque de anuncio bajo la calculadora
      beforeFaq: '', // ID del bloque de anuncio antes de las preguntas frecuentes
    },
  },

  // Cloudflare Web Analytics (sin cookies). Ponlo a true si lo activas en Cloudflare Pages.
  cloudflareAnalytics: false,
};

export const ADS_ON = /^ca-pub-\d{10,}$/.test(SITE.ads.client);
