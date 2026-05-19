"use client";

// useEffect, useRef — untuk animasi paralaks dan referensi DOM layer
import { useEffect, useRef } from "react";
import styles from "./ComicBackground.module.css";

// Props — posisi mouse dalam persen (0-100) untuk efek paralaks
type Props = {
  mouseX: number;
  mouseY: number;
};

// ComicBackground — latar tema komik dengan layer paralaks, blob, kata, burst, panel
export function ComicBackground({ mouseX, mouseY }: Props) {
  // Ref untuk 4 layer paralaks dengan kedalaman berbeda
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);
  const layer4Ref = useRef<HTMLDivElement>(null);

  // useEffect: update posisi tiap layer berdasarkan mouse dengan multiplier berbeda
  useEffect(() => {
    const dx = (mouseX - 50) / 50;
    const dy = (mouseY - 50) / 50;

    if (layer1Ref.current) {
      layer1Ref.current.style.transform = `translate(${dx * -8}px, ${dy * -8}px)`;
    }
    if (layer2Ref.current) {
      layer2Ref.current.style.transform = `translate(${dx * -16}px, ${dy * -16}px)`;
    }
    if (layer3Ref.current) {
      layer3Ref.current.style.transform = `translate(${dx * -28}px, ${dy * -28}px)`;
    }
    if (layer4Ref.current) {
      layer4Ref.current.style.transform = `translate(${dx * -42}px, ${dy * -42}px)`;
    }
  }, [mouseX, mouseY]);

  return (
    <div className={styles.wrapper} aria-hidden>
      {/* Halftone pattern overlay */}
      <div className={styles.halftone} />

      {/* Layer 1 — bentuk blob organik */}
      <div ref={layer1Ref} className={`${styles.layer} ${styles.layer1}`}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      {/* Layer 2 — kata-kata komik (POW, BAM, ZAP, dll) */}
      <div ref={layer2Ref} className={`${styles.layer} ${styles.layer2}`}>
        <span className={`${styles.word} ${styles.wPow}`}>POW!</span>
        <span className={`${styles.word} ${styles.wBam}`}>BAM!</span>
        <span className={`${styles.word} ${styles.wZap}`}>ZAP!</span>
        <span className={`${styles.word} ${styles.wKa}`}>KA-BOOM!</span>
        <span className={`${styles.word} ${styles.wWham}`}>WHAM!</span>
      </div>

      {/* Layer 3 — burst stars + panel komik */}
      <div ref={layer3Ref} className={`${styles.layer} ${styles.layer3}`}>
        <div className={`${styles.burst} ${styles.burstA}`} />
        <div className={`${styles.burst} ${styles.burstB}`} />
        <div className={`${styles.panel} ${styles.panelA}`} />
        <div className={`${styles.panel} ${styles.panelB}`} />
        <div className={`${styles.panel} ${styles.panelC}`} />
      </div>

      {/* Layer 4 — garis kecepatan radial */}
      <div ref={layer4Ref} className={`${styles.layer} ${styles.layer4}`}>
        <div className={styles.speedLines} />
      </div>

      {/* Ink noise overlay di atas semua */}
      <div className={styles.inkOverlay} />
    </div>
  );
}
