import styles from "./HeroCard.module.css";

// HeroCard — komponen sambutan beranda (badge, judul, deskripsi singkat)
export function HeroCard() {
  return (
    <section className={styles.heroCard}>
      <div className={styles.badge}>🎵 Rekomendasi Playlist Cerdas</div>
      <h1 className={styles.title}>
        Temukan playlist yang <span className={styles.highlight}>pas</span> untuk aktivitasmu.
      </h1>
      <p className={styles.body}>
        Jawab beberapa pertanyaan, dapatkan rekomendasi playlist sesuai aktivitas dan suasana hatimu.
      </p>
    </section>
  );
}
