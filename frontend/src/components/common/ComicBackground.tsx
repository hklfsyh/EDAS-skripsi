"use client";

import { useEffect, useRef } from "react";
import styles from "./ComicBackground.module.css";

type Props = {
  mouseX: number;
  mouseY: number;
};

export function ComicBackground({ mouseX, mouseY }: Props) {
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);
  const layer4Ref = useRef<HTMLDivElement>(null);

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
      <div className={styles.halftone} />

      <div ref={layer1Ref} className={`${styles.layer} ${styles.layer1}`}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      <div ref={layer2Ref} className={`${styles.layer} ${styles.layer2}`}>
        <span className={`${styles.word} ${styles.wPow}`}>POW!</span>
        <span className={`${styles.word} ${styles.wBam}`}>BAM!</span>
        <span className={`${styles.word} ${styles.wZap}`}>ZAP!</span>
        <span className={`${styles.word} ${styles.wKa}`}>KA-BOOM!</span>
        <span className={`${styles.word} ${styles.wWham}`}>WHAM!</span>
      </div>

      <div ref={layer3Ref} className={`${styles.layer} ${styles.layer3}`}>
        <div className={`${styles.burst} ${styles.burstA}`} />
        <div className={`${styles.burst} ${styles.burstB}`} />
        <div className={`${styles.panel} ${styles.panelA}`} />
        <div className={`${styles.panel} ${styles.panelB}`} />
        <div className={`${styles.panel} ${styles.panelC}`} />
      </div>

      <div ref={layer4Ref} className={`${styles.layer} ${styles.layer4}`}>
        <div className={styles.speedLines} />
      </div>

      <div className={styles.inkOverlay} />
    </div>
  );
}
