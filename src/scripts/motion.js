// Scroll choreography with GSAP ScrollTrigger. Loaded after the page is usable,
// never under reduced motion; everything it touches is visible without it.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const EASE_OUT = 'expo.out';

export function initMotion({ hero, coins, onStage } = {}) {
  const ctx = gsap.context(() => {});
  const mm = gsap.matchMedia();

  ctx.add(() => {
    // Big section headings: each line rises out of its own mask
    gsap.utils.toArray('[data-lines]').forEach((h) => {
      const inner = h.querySelectorAll('.ln > span');
      gsap.from(inner, {
        yPercent: 105, duration: 1.1, ease: EASE_OUT, stagger: 0.09,
        scrollTrigger: { trigger: h, start: 'top 85%', once: true },
      });
    });

    // Footer wordmark: letters climb in one after another
    const word = document.querySelector('[data-wordmark]');
    if (word) {
      gsap.from(word.querySelectorAll('.ch > span'), {
        yPercent: 110, duration: 1.2, ease: EASE_OUT, stagger: 0.06,
        scrollTrigger: { trigger: word, start: 'top 90%', once: true },
      });
    }
  });

  mm.add('(min-width: 1024px)', () => {
    // Hero leaves in layers: the sheet rises faster than the copy, the camera dollies into the coins
    if (hero) {
      gsap.timeline({
        scrollTrigger: {
          trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6,
          onUpdate: (st) => coins?.()?.setScroll(st.progress),
        },
      })
        .to(hero.querySelector('.doc-stage'), { yPercent: -14, ease: 'none' }, 0)
        .to(hero.querySelector('.stage-num'), { xPercent: -10, ease: 'none' }, 0)
        .to(hero.querySelector('.hero-copy'), { y: -60, ease: 'none' }, 0);
    }

    // Archive strip: alternate columns drift at different speeds
    gsap.utils.toArray('.world-item figure').forEach((fig, i) => {
      gsap.fromTo(fig, { y: i % 2 ? 50 : -20 }, {
        y: i % 2 ? -30 : 20, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      });
    });

    // "From gross to net" pins and the scroll walks through the four steps
    const stages = document.querySelector('[data-stages]');
    if (stages && onStage) {
      let current = -1;
      ScrollTrigger.create({
        trigger: stages, start: 'top top', end: '+=160%', pin: true,
        onUpdate: (st) => {
          // Four equal stretches of scroll, one per step; scrolling stays the visitor's
          const idx = Math.min(3, Math.floor(st.progress * 4));
          if (idx !== current) { current = idx; onStage(idx); }
        },
      });
    }
  });

  return () => {
    mm.revert();
    ctx.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}
