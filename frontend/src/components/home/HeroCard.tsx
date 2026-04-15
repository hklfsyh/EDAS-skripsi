import styles from "./HeroCard.module.css";

export function HeroCard() {
  return (
    <section className={styles.heroCard}>
      <div className={styles.badge}>🎵 Powered by EDAS</div>
      <h1 className={styles.title}>
        Playlist yang <span className={styles.highlight}>ngerti</span> vibe kamu.
      </h1>
      <p className={styles.body}>
        Nggak perlu pusing cari lagu satu-satu. Pilih konteks aktivitas dan durasi
        yang kamu butuhkan, jawab kuesioner singkat — dan sistem siapkan playlist
        yang beneran nyambung sama momenmu.
      </p>

      {/* Fake equalizer bar — decorative */}
      <div className={styles.eq}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={styles.eqBar} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    </section>
  );
}
