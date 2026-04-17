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

## Spotify & YouTube Export (Eksperimen Lokal)

Fitur ini opsional untuk uji coba export playlist hasil dummy ke akun Spotify/YouTube pribadi.

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
YOUTUBE_CLIENT_ID=isi_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=isi_google_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
GEMINI_API_KEY=isi_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2b) Siapkan OAuth YouTube (Google Cloud)

- Buka `https://console.cloud.google.com/`.
- Aktifkan **YouTube Data API v3** di project kamu.
- Buat OAuth client type **Web application**.
- Tambahkan Authorized redirect URI sesuai env:
	- `http://localhost:3000/api/youtube/callback`
	- (atau domain deploy kamu, misalnya Netlify)
- Scope yang dipakai aplikasi:
	- `https://www.googleapis.com/auth/youtube`
	- `https://www.googleapis.com/auth/youtube.force-ssl`

### 2c) Siapkan Gemini API untuk NLG (opsional tapi direkomendasikan)

- Buka `https://aistudio.google.com/app/apikey`.
- Login menggunakan akun Google.
- Klik **Create API key** lalu salin key yang dihasilkan.
- Simpan key tersebut ke `GEMINI_API_KEY` pada `.env.local`.
- Rekomendasi model: `GEMINI_MODEL=gemini-2.5-flash`.

Catatan perilaku sistem NLG:
- Narasi tetap diambil dari hasil playlist dummy yang sudah ada.
- Jika Gemini tidak aktif/gagal/kuota habis, API akan mengembalikan error eksplisit (`ok:false`) agar penyebab bisa ditangani langsung.
- NLG hanya mengubah gaya bahasa narasi, tidak mengubah ranking atau hasil EDAS.

### 3) Jalankan aplikasi

```bash
npm run dev
```

Lalu buka halaman hasil (`/hasil`), gunakan bagian:

- `Hubungkan Spotify` (OAuth)
- `Kirim playlist ke Spotify`
- `Hubungkan YouTube` (OAuth)
- `Kirim playlist ke YouTube`

Untuk cek NLG:
- Jalankan alur sampai halaman `proses` lalu `hasil`.
- Narasi rekomendasi akan dibuat dari ringkasan hasil dummy playlist.
- Kalau API key valid, gaya narasi lebih natural; jika tidak, narasi fallback tetap muncul.

Catatan:
- Ini mode eksperimen. Tidak mengubah fitur utama skripsi.
- Proses add lagu memakai strategi search-and-match, jadi bisa ada sebagian lagu tidak ditemukan.
- NLG diintegrasikan sebagai lapisan presentasi teks, bukan mesin pemeringkatan lagu.

## Migrasi ke Vercel (Rinci)

Panduan ini fokus untuk migrasi dari deploy Netlify ke Vercel, termasuk OAuth Spotify/YouTube dan Gemini.

### 1) Import project ke Vercel

- Login ke `https://vercel.com`.
- Klik **Add New... -> Project**.
- Pilih repo `hklfsyh/EDAS-skripsi`.
- Saat konfigurasi:
	- **Framework Preset**: `Next.js`
	- **Root Directory**: `frontend`
	- **Build Command**: `npm run build` (default Next.js)
	- **Install Command**: `npm install`

### 2) Isi Environment Variables di Vercel

Tambahkan variabel berikut di **Project Settings -> Environment Variables**:

- `NEXT_PUBLIC_APP_URL`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (isi: `gemini-2.5-flash`)

Tips:
- Gunakan nilai yang sama seperti catatan di file `.env.example`, lalu ganti domain URL ke domain Vercel.
- Untuk produksi, isi semua variable di environment `Production`.

### 3) Dapatkan domain Vercel lalu update URL

Setelah deploy pertama, kamu akan dapat domain seperti:
- `https://nama-proyek.vercel.app`

Lalu update tiga variabel ini agar pakai domain Vercel:
- `NEXT_PUBLIC_APP_URL=https://nama-proyek.vercel.app`
- `SPOTIFY_REDIRECT_URI=https://nama-proyek.vercel.app/api/spotify/callback`
- `YOUTUBE_REDIRECT_URI=https://nama-proyek.vercel.app/api/youtube/callback`

### 4) Update OAuth Spotify Developer Dashboard

- Buka `https://developer.spotify.com/dashboard`.
- Pilih app kamu.
- Tambahkan **Redirect URI** produksi Vercel:
	- `https://nama-proyek.vercel.app/api/spotify/callback`
- Simpan perubahan.

### 5) Update OAuth Google Cloud (YouTube)

- Buka `https://console.cloud.google.com/`.
- Pilih project OAuth yang sama dengan `YOUTUBE_CLIENT_ID`.
- Masuk ke **APIs & Services -> Credentials -> OAuth 2.0 Client IDs**.
- Buka client ID web app kamu.
- Tambahkan **Authorized redirect URI**:
	- `https://nama-proyek.vercel.app/api/youtube/callback`

Penting:
- `redirect_uri` harus **exact match** (protocol `https`, domain, path, trailing slash harus konsisten).
- Jika salah sedikit, Google akan melempar `redirect_uri_mismatch`.

### 6) Verifikasi redirect URI yang dipakai aplikasi

Route login YouTube mendukung debug mode:
- Buka `https://nama-proyek.vercel.app/api/youtube/login?debug=1`
- Cek JSON `redirectUri`.
- Pastikan nilainya identik dengan yang ada di Google Cloud OAuth.

### 7) Strategi model Gemini untuk NLG (sesuai permintaan)

Urutan fallback saat generate narasi:
1. `gemini-2.5-flash`
2. `gemini-2.5-pro`
3. `gemini-2.5-flash-lite`

Jika model pertama gagal/kuota penuh/endpoint error, sistem lanjut ke model berikutnya.

### 8) Checklist pasca migrasi

- `/api/youtube/login?debug=1` menampilkan `redirectUri` Vercel yang benar.
- Login Spotify berhasil balik ke halaman hasil.
- Login YouTube tidak lagi `redirect_uri_mismatch`.
- Endpoint NLG berhasil `ok:true`, atau jika gagal tetap `ok:false` dengan alasan jelas.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
