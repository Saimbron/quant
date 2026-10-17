# Quant: calculadores de sou i autònoms (2026)

Web estàtica (Astro 5) amb quatre calculadores, en castellà i català:

| Pàgina | Castellà | Català |
|---|---|---|
| Sou net | `/` | `/ca/` |
| Quota d'autònoms | `/cuota-autonomos/` | `/ca/quota-autonoms/` |
| Factura amb IVA i IRPF | `/factura-iva-irpf/` | `/ca/factura-iva-irpf/` |
| Preu per hora | `/precio-hora-freelance/` | `/ca/preu-hora-freelance/` |

## Tecnologia

- **Astro 5**: genera pàgines estàtiques (ràpides i bones per a Google).
- **Three.js**: les monedes 3D de la portada (`src/scripts/coins.js`). Es carrega quan la pàgina ja està llesta, només si hi ha WebGL; sense, la web funciona igual.
- **GSAP + ScrollTrigger**: animacions lligades al scroll (`src/scripts/motion.js`). No es carrega si el visitant demana menys moviment.
- CSS i JavaScript propis per a la resta (càlcul en directe, comptador de xifres, transicions entre calculadores).

## Ordres

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # 13 proves de la lògica fiscal (algorisme AEAT 2026)
npm run build    # genera dist/
```

## Abans de publicar (obligatori)

1. `src/config.js` ja té el domini (`quantneto.com`), el correu i les dades del titular que exigeix la LSSI.
2. Si canvies el domini, torna a generar les imatges `public/og-*.png` (`.tools/og.html`) si vols que hi surti.

## Publicar a Cloudflare Pages amb el teu domini

1. Puja la carpeta a un repositori de GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → connecta el repositori.
   - Build command: `npm run build`
   - Output directory: `dist`
3. Custom domains → afegeix el teu domini. Si el compres a Cloudflare Registrar, el DNS es configura sol.
4. Cloudflare aplica automàticament `public/_headers` (seguretat i memòria cau).
5. Dona d'alta el domini a Google Search Console i envia `https://el-teu-domini/sitemap-index.xml`.

## On hi ha cada cosa

- `src/lib/tax.js`: paràmetres i fórmules del 2026 (Seguretat Social, retenció d'IRPF, trams d'autònoms). **Revisa'ls cada gener.**
- `src/lib/i18n.js`: tots els textos en castellà i català.
- `src/components/CalcPage.astro`: la pàgina de cada calculadora.
- `src/scripts/app.js`: la interacció (càlcul en directe, compartir, seccions, preguntes freqüents).
- `src/styles/global.css`: el sistema de disseny (tokens, tipografia Jost, paleta sorra i molsa).

## Imatges i vídeo

Les peces de la franja «Cinc segles fent comptes» són d'arxius oberts, amb el crèdit visible sota cada una:

- Narziss Renner, *Fuggerkontor* (1517), domini públic, Wikimedia Commons.
- Philip van Dijk, *The Bookkeeper* (1725), domini públic, Mauritshuis via Wikimedia Commons.
- National Photo Company, *Carpenter shop* (c. 1920), domini públic, Library of Congress.
- Archives New Zealand, *Head Office typists room* (1959), CC BY 2.0.
- Erik Pålsson, *Olivetti Dora portable typewriter* (vídeo), CC BY 3.0.

Els retalls WebP es regeneren amb `node .tools/img.mjs` (necessita `sharp`, inclòs com a dependència de desenvolupament).

## Privacitat

No hi ha galetes ni analítica. Els valors es calculen al navegador i es desen només a l'emmagatzematge local de cada visitant. Si més endavant hi afegeixes anuncis o analítica amb galetes, caldrà un bàner de consentiment i actualitzar `/legal/`.
