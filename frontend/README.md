This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Spotify Export (Eksperimen Lokal)

Fitur ini opsional untuk uji coba export playlist hasil dummy ke akun Spotify pribadi.

### 1) Buat app di Spotify Developer

- Buka `https://developer.spotify.com/dashboard`.
- Buat app baru.
- Tambahkan Redirect URI yang sama dengan env kamu, contoh:
	- `http://localhost:3000/api/spotify/callback`

### 2) Buat file env lokal

Buat file `.env.local` di folder `frontend`:

```bash
SPOTIFY_CLIENT_ID=isi_client_id
SPOTIFY_CLIENT_SECRET=isi_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3) Jalankan aplikasi

```bash
npm run dev
```

Lalu buka halaman hasil (`/hasil`), gunakan bagian:

- `Hubungkan Spotify` (OAuth)
- `Kirim playlist ke Spotify`

Catatan:
- Ini mode eksperimen. Tidak mengubah fitur utama skripsi.
- Proses add lagu memakai strategi search-and-match, jadi bisa ada sebagian lagu tidak ditemukan.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
