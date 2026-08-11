import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CubeBabyPedal } from "../components/cube-baby/CubeBabyPedal";
import type { LiveParamsSnapshot } from "../types/device";
import "./splash.css";

type SplashScreenProps = {
  readonly onDone: () => void;
};

function useStableDone(onDone: () => void) {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  return () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };
}

/** Demo tone so the faceplate looks alive during boot. */
const SPLASH_PARAMS: LiveParamsSnapshot = {
  type: 3,
  gain: 5,
  tone: 10,
  reverb: 8,
  feedback: 64,
  volume: 100,
  time: 16,
  mix: 72,
  modulation: 8,
  cabinet: 3,
  irSection: 1,
  delaySection: 1,
  toneSection: 1,
};

export function SplashScreen({ onDone }: SplashScreenProps) {
  const finish = useStableDone(onDone);
  const rootRef = useRef<HTMLDivElement>(null);
  const pedalRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const pedal = pedalRef.current;
    const brand = brandRef.current;
    const bar = barRef.current;
    const status = statusRef.current;
    if (!root || !pedal || !brand || !bar || !status) return;

    const knobs = pedal.querySelectorAll<HTMLElement>(".pedal-knob");
    const footswitches = pedal.querySelectorAll<HTMLElement>(".cube-fs");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let reducedTimer: number | undefined;

    const ctx = gsap.context(() => {
      gsap.set(root, { opacity: 1 });
      gsap.set(pedal, { opacity: 0, y: 36, scale: 0.92, rotateX: 18 });
      gsap.set(brand, { opacity: 0, y: 16 });
      gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
      gsap.set(status, { opacity: 0 });
      gsap.set(knobs, { filter: "saturate(0.15) brightness(0.55)" });
      gsap.set(footswitches, { opacity: 0.35 });

      if (reduced) {
        gsap.set([pedal, brand, status], { opacity: 1, y: 0, scale: 1, rotateX: 8 });
        gsap.set(knobs, { filter: "none" });
        gsap.set(footswitches, { opacity: 1 });
        gsap.set(bar, { scaleX: 1 });
        reducedTimer = window.setTimeout(() => finish(), 400);
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.to(root, {
            opacity: 0,
            duration: 0.45,
            ease: "power2.inOut",
            onComplete: finish,
          });
        },
      });

      tl.to(pedal, { opacity: 1, y: 0, scale: 1, rotateX: 8, duration: 0.85 }, 0.1)
        .to(brand, { opacity: 1, y: 0, duration: 0.55 }, 0.35)
        .to(status, { opacity: 1, duration: 0.35 }, 0.5)
        .to(
          knobs,
          {
            filter: "saturate(1) brightness(1)",
            duration: 0.35,
            stagger: 0.055,
            ease: "power2.out",
          },
          0.55,
        )
        .to(footswitches, { opacity: 1, duration: 0.35, stagger: 0.08 }, 0.95)
        .to(bar, { scaleX: 1, duration: 1.35, ease: "power1.inOut" }, 0.45)
        .to(status, { opacity: 0.7, duration: 0.2 }, 1.7)
        .add(() => {
          if (status) status.textContent = "Listo";
        }, 1.75)
        .to({}, { duration: 0.35 });
    }, root);

    return () => {
      if (reducedTimer !== undefined) window.clearTimeout(reducedTimer);
      ctx.revert();
    };
  }, [finish]);

  return (
    <div ref={rootRef} className="splash" role="status" aria-live="polite" aria-label="Cargando CubeControl">
      <div className="splash__aurora" aria-hidden />
      <div className="splash__grid" aria-hidden />

      <div ref={brandRef} className="splash__brand">
        <p className="splash__eyebrow">CUBE Baby studio</p>
        <h1 className="splash__logo">CubeControl</h1>
      </div>

      <div ref={pedalRef} className="splash__pedal">
        <CubeBabyPedal
          params={SPLASH_PARAMS}
          activeSlot="B"
          busy
          showScope={false}
          onParamChange={() => undefined}
          onSelectSlot={() => undefined}
        />
      </div>

      <div className="splash__footer">
        <p ref={statusRef} className="splash__status">
          Encendiendo CUBE Baby…
        </p>
        <div className="splash__bar" aria-hidden>
          <div ref={barRef} className="splash__bar-fill" />
        </div>
      </div>
    </div>
  );
}
