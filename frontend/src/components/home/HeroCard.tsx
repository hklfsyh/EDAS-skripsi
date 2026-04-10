import styles from "./HeroCard.module.css";

export function HeroCard() {
  return (
    <section className={styles.heroCard}>
      <h1>Playlist helper yang ngerti vibe kamu.</h1>
      <p>
        Nggak perlu pusing cari lagu satu-satu. Cukup pilih konteks aktivitas dan durasi
        yang kamu butuhkan, lalu lanjut ke kuesioner singkat. Setelah itu sistem siapin
        playlist yang lebih nyambung sama momen kamu.
      </p>
    </section>
  );
}
