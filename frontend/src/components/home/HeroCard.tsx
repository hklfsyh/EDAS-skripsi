import styles from "./HeroCard.module.css";

export function HeroCard() {
  return (
    <section className={styles.heroCard}>
      <div className={styles.badge}>🎵 Rekomendasi Playlist Cerdas</div>
      <h1 className={styles.title}>
        Dapatkan playlist yang <span className={styles.highlight}>sesuai</span> dengan aktivitasmu.
      </h1>
      <p className={styles.body}>
        Isi aktivitas, durasi, dan jawab beberapa pertanyaan — sistem akan merangkai
        lagu-lagu terbaik yang cocok dengan momen kamu. Nggak perlu pilih lagu satu-satu lagi.
      </p>

      <div className={styles.howItWorks}>
        <div className={styles.step}>
          <span className={styles.stepNum}>1</span>
          <span>Pilih konteks aktivitas</span>
        </div>
        <div className={styles.stepArrow}>→</div>
        <div className={styles.step}>
          <span className={styles.stepNum}>2</span>
          <span>Jawab preferensi musik</span>
        </div>
        <div className={styles.stepArrow}>→</div>
        <div className={styles.step}>
          <span className={styles.stepNum}>3</span>
          <span>Dapatkan rekomendasi</span>
        </div>
      </div>

      <div className={styles.eq}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={styles.eqBar} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
    </section>
  );
}
