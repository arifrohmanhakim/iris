# Iris Presisi

**Iris Presisi** adalah game interaktif memotong aneka objek kuliner dengan presisi geometris tinggi dalam gaya estetika ilustrasi *outline* / *technical drafting ink*. Pemain ditantang untuk membagi bahan makanan menjadi beberapa potongan dengan luas permukaan yang seimbang dan rata.

---

## Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Struktur Proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Instalasi dan Menjalankan Aplikasi](#instalasi-dan-menjalankan-aplikasi)
- [Mekanik dan Cara Bermain](#mekanik-dan-cara-bermain)
- [Skrip yang Tersedia](#skrip-yang-tersedia)

---

## Fitur Utama

1. **Mode Permainan**
   - **Mode Kampanye (Campaign Mode)**: Terdiri dari 10 level tantangan bertingkat dengan variasi bentuk objek (roti tawar, timun, baguette, wortel yang meruncing, kue gulung, keju cheddar, sushi roll, terong, jagung, hingga pizza bulat) serta jumlah potongan yang semakin menantang (2 hingga 5 bagian).
   - **Mode Bebas (Free Play Mode)**: Kebebasan memilih objek dari koleksi kuliner dan menentukan sendiri target jumlah irisan (2 sampai 6 bagian) untuk latihan atau eksplorasi bebas.

2. **Evaluasi Geometri dan Sistem Penilaian**
   - **Algoritma Luas Poligon**: Menghitung luasan eksak setiap pecahan menggunakan formula Shoelace (*surveyor's formula*).
   - **Deviasi Presisi**: Mengukur persentase deviasi setiap potongan terhadap proporsi ideal.
   - **Tingkat Akurasi (Rating Tiers)**:
     - **Tier S** (Skor &ge; 98): Sempurna!
     - **Tier A** (Skor &ge; 88): Sangat Presisi
     - **Tier B** (Skor &ge; 70): Cukup Baik
     - **Tier C** (Skor < 70): Kurang Rata
   - **Gelar Akhir Kampanye**: Memberikan pangkat kuliner seperti *Master Koki Presisi*, *Ahli Pisau Handal*, *Juru Masak Terampil*, hingga *Koki Pemula*.

3. **Item Pembantu (Helper Items)**
   - **Grid Bantu**: Menampilkan garis kisi ukur pada canvas untuk mempermudah perkiraan pembagian (penalti -5 poin).
   - **Pisau Lurus**: Mengunci sudut goresan pisau ke kelipatan 45 derajat (penalti -4 poin).
   - **Undo 1x**: Membatalkan goresan irisan terakhir jika terjadi kesalahan pemotongan (penalti -8 poin).

4. **Sistem Streak & Rekor**
   - Mendapatkan poin bonus kombo berturut-turut saat mempertahankan skor &ge; 90.
   - Menyimpan rekor kampanye terbaik ke dalam penyimpanan lokal (`localStorage`).

5. **Audio Prosedural (Web Audio API)**
   - Efek suara sintetis tanpa memerlukan berkas audio eksternal: suara tebasan bilah pisau (*slice*), ketukan talenan (*chop*), remah makanan, dan melodi penyelesaian ronde.
   - Tersedia tombol mute dengan preferensi tersimpan di penyimpanan lokal.

6. **Visual & Simulasi Partikel**
   - Efek pemisahan pecahan benda (*drift separation*) pasca-potong.
   - Partikel remah (*crumbs*), kilatan (*sparks*), dan goresan pisau (*blade streak*).
   - Desain neo-brutalist minimalis dengan palet *ink & paper*.

7. **Ekspor & Berbagi Hasil**
   - Pembuatan kartu laporan hasil visual beresolusi tinggi langsung melalui Canvas.
   - Mendukung unduhan gambar format PNG dan Web Share API.

8. **Integrasi Google Analytics 4 (GA4)**
   - Inisialisasi dinamis dan aman tanpa dependensi pihak ketiga berat.
   - Pelacakan peristiwa (*custom events*): `game_start`, `round_completed`, `campaign_completed`, `helper_item_used`, dan `share_result`.
   - Menggunakan variabel lingkungan `VITE_GA_MEASUREMENT_ID`. Jika tidak diisi, fitur analitik otomatis non-aktif secara halus tanpa memunculkan galat.

---

## Teknologi yang Digunakan

- **Framework & UI**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animasi & Transisi**: [Motion](https://motion.dev/)
- **Ikon**: [Lucide React](https://lucide.dev/)
- **Grafik & Suara**: HTML5 Canvas 2D API & Web Audio API bawaan peramban

---

## Struktur Proyek

```text
iris/
├── index.html              # Titik masuk HTML aplikasi
├── package.json            # Dependensi dan skrip proyek
├── tsconfig.json           # Konfigurasi TypeScript
├── vite.config.ts          # Konfigurasi Vite & plugin Tailwind
└── src/
    ├── main.tsx            # Entry point React
    ├── App.tsx             # State machine dan tampilan utama permainan
    ├── index.css           # Styling global dan Tailwind import
    ├── components/
    │   ├── SliceCanvas.tsx # Komponen canvas interaktif untuk memotong objek
    │   └── TitleLockup.tsx # Komponen header dan judul permainan
    └── game/
        ├── analytics.ts    # Modul pelacakan Google Analytics 4 (GA4 & custom events)
        ├── audio.ts        # Mesin suara sintetis prosedural (Web Audio API)
        ├── geometry.ts     # Logika geometri (pemotongan poligon, Shoelace formula, centroid)
        ├── levels.ts       # Konfigurasi level kampanye, item pembantu, dan aturan skor
        ├── objects.ts      # Definisi poligon dan gambar interior objek kuliner
        ├── share.ts        # Generator gambar kartu ringkasan untuk unduh & bagikan
        └── types.ts        # Definisi antarmuka dan tipe data TypeScript
```

---

## Prasyarat

Sebelum memulai, pastikan perangkat telah terpasang:
- **Node.js** versi 18 atau lebih baru.
- Manajer paket: **Yarn** (direkomendasikan sesuai `yarn.lock`) atau **npm**.

---

## Instalasi dan Menjalankan Aplikasi

1. **Klon repositori atau buka direktori proyek**:
   ```bash
   cd iris
   ```

2. **Pasang seluruh dependensi**:
   ```bash
   yarn install
   # atau jika menggunakan npm:
   # npm install
   ```

3. **Konfigurasi Environment (Opsional untuk Google Analytics)**:
   Salin `.env.example` ke `.env` lalu masukkan ID Measurement Anda:
   ```bash
   cp .env.example .env
   ```
   Atur nilai `VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"`.

4. **Jalankan server pengembangan (development mode)**:
   ```bash
   yarn dev
   # atau jika menggunakan npm:
   # npm run dev
   ```
   Aplikasi akan berjalan secara lokal di `http://localhost:3000` (atau port yang tertera pada terminal).

5. **Kompilasi untuk produksi (production build)**:
   ```bash
   yarn build
   # atau jika menggunakan npm:
   # npm run build
   ```

6. **Pratinjau hasil build produksi**:
   ```bash
   yarn preview
   # atau jika menggunakan npm:
   # npm run preview
   ```

---

## Mekanik dan Cara Bermain

1. **Membelah Objek**:
   - Tekan dan tahan tombol mouse (atau sentuhan layar pada perangkat layar sentuh), lalu geser melewati objek untuk membuat garis potong.
   - Lepaskan untuk mengeksekusi irisan pisau.
2. **Mencapai Target Potongan**:
   - Setiap ronde menentukan target jumlah bagian (misalnya 2, 3, 4, atau 5 potongan).
   - Setelah jumlah irisan terpenuhi, permainan akan menghitung luas masing-masing bagian secara otomatis.
3. **Mengoptimalkan Nilai**:
   - Usahakan setiap irisan menghasilkan bagian yang memiliki luas seimbang.
   - Manfaatkan *Item Pembantu* jika diperlukan, dengan mempertimbangkan pengurangan penalti skor.
4. **Berbagi Skor**:
   - Setelah menyelesaikan semua ronde kampanye atau menyelesaikan mode bebas, unduh kartu statistik atau bagikan ke media sosial.

---

## Skrip yang Tersedia

| Perintah | Deskripsi |
| :--- | :--- |
| `yarn dev` | Menjalankan server pengembangan Vite |
| `yarn build` | Mengompilasi kode TypeScript dan membundel aset untuk produksi |
| `yarn preview` | Menjalankan server lokal untuk pratinjau hasil kompilasi `dist/` |
| `yarn lint` | Menjalankan pemeriksaan tipe (*type-checking*) TypeScript tanpa output file |
| `yarn clean` | Menghapus direktori `dist` dan sisa file kompilasi |
