import sharp from 'sharp';
const C = '.tools/cand/';
const jobs = [
  ['fuggerkontor.jpg', 'fugger-1517', { left: 0, top: 0.18, h: 0.62 }],
  ['the-bookkeeper.jpg', 'contable-1725', { left: 0, top: 0.05, h: 0.95 }],
  ['carpenter-shop-library-of-congress-washington-d.jpg', 'carpinteria-1920', { left: 0.18, top: 0, h: 0.95 }],
  ['head-office-typists-room-new-zealand-railways.jpg', 'mecanografas-1959', { left: 0.08, top: 0, h: 0.93 }],
];
for (const [src, out, crop] of jobs) {
  const img = sharp(C + src);
  const { width, height } = await img.metadata();
  // Recorte 4:5 vertical
  const ch = Math.round(height * crop.h);
  const cw = Math.min(width, Math.round(ch * 0.8));
  const top = Math.round(height * crop.top);
  const left = Math.min(width - cw, Math.round(width * crop.left));
  for (const w of [480, 800]) {
    await sharp(C + src).extract({ left, top, width: cw, height: Math.min(ch, height - top) }).resize({ width: w, height: Math.round(w * 1.25), fit: 'cover' }).webp({ quality: 74 }).toFile(`public/img/${out}-${w}.webp`);
  }
  console.log(out, width, height, '→', cw, ch);
}
