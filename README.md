# 🎓 wa-bot-aba-ratima

**Prototipe Chatbot WhatsApp Pelayanan Informasi Stok Barang LLM (Zero Cost)**

Project ini adalah implementasi Penelitian untuk membuat Asisten Digital Sekolah yang cerdas, responsif, dan gratis. Menggunakan **Node.js** sebagai backend, **whatsapp-web.js** sebagai antarmuka WhatsApp, dan **Google Gemini (Gemini Flash Lite Latest)** sebagai otak pemrosesan bahasa alami.

---

## ✨ Fitur Utama

* 🤖 **AI-Powered Context:** Menjawab pertanyaan berdasarkan data sekolah, bukan sekadar *keyword matching*.
* ⚡ **High Performance:** Menggunakan teknik *In-Memory Caching* (JSON loaded to RAM) untuk respon super cepat (< 5 detik).
* 💸 **Zero Cost Architecture:** Tidak memerlukan WhatsApp Business API berbayar.
* 📊 **Auto-Logger:** Otomatis merekam riwayat chat, jawaban bot, dan waktu respon ke file CSV (`data-penelitian.csv`) untuk analisis data skripsi.
* 📝 **Dynamic Knowledge Base:** Data Aba Ratima tersimpan di file JSON yang mudah diedit tanpa mengubah kodingan.

---

## 🛠️ Prasyarat (Requirements)

Sebelum memulai, pastikan komputer Anda sudah terinstal:

1. **Node.js** (Versi 18 atau lebih baru). [Download di sini](https://nodejs.org/).
2. **Git** (Opsional, untuk clone repo).
3. **Akun WhatsApp** (di HP) yang siap digunakan sebagai bot.
4. **Google AI Studio API Key**. [Dapatkan di sini](https://aistudio.google.com/).

---

## 🚀 Panduan Instalasi (Step-by-Step)

### 1. Clone atau Download Project

Buka terminal/CMD, lalu jalankan:

```bash
git clone https://github.com/bajiff/wa-bot-aba-ratima.git
cd wa-bot-aba-ratima
```

### 2. Install Dependencies

Install semua library yang dibutuhkan (whatsapp-web.js, google-generative-ai, dll):

```bash
npm install
```

### 3. Konfigurasi API Key

Buat file baru bernama `.env` di dalam folder project.
Isi dengan API Key Google Gemini Anda:

```env
API_KEY=AIzaSy_Paste_Key_Anda_Disini

```

### 4. Siapkan Data nya

Pastikan file `data-toko-aba-ratima.json` sudah tersedia dan berisi data yang valid.
*(Format JSON harus valid agar bot bisa membacanya).*

---

## ▶️ Cara Menjalankan Bot

1. Jalankan perintah berikut di terminal:
```bash
node index.js

```


2. Tunggu hingga muncul **QR Code** di terminal.
3. Buka WhatsApp di HP Anda -> **Perangkat Tertaut** -> **Tautkan Perangkat**.
4. Scan QR Code yang ada di terminal.
5. Tunggu hingga muncul pesan:
> `[INFO] Bot Siap Melayani! 🚀`



Sekarang bot sudah aktif! Coba kirim pesan dari nomor lain: *"Halo"* atau *"Mau beli rokok"*.

---

## 📂 Struktur Project

```
baji-wa-bot-akademik/
├── node_modules/              # Library (Jangan diedit)
├── .env                       # Kunci Rahasia (API KEY)
├── data-toko-aba-ratima.json   # Database Informasi Sekolah
├── data-penelitian.csv        # Log Data Otomatis (Muncul setelah chat)
├── index.js                   # Kodingan Utama (Otak Bot)
├── package.json               # Daftar Dependencies
└── README.md                  # Dokumentasi ini

```

---

## ❓ Troubleshooting (Kendala Umum)

**Q: Bot merespon lambat (> 10 detik)?**
A: Pastikan Anda menggunakan model `gemini-flash-lite-latest` atau `gemini-2.0-flash-lite` di `index.js`. Model versi "Preview" atau koneksi internet yang tidak stabil bisa mempengaruhi kecepatan.

**Q: Error `429 Too Many Requests`?**
A: Kuota API Key Anda habis atau terkena limit. Ganti API Key baru atau ganti model ke versi yang lebih ringan (Lite).

**Q: Error `ProtocolError: Execution context was destroyed`?**
A: Biasanya terjadi di Linux/Server. Coba hapus folder `.wwebjs_auth` dan jalankan ulang. Pastikan argumen `--no-sandbox` ada di `index.js`.

---

## 👨‍💻 Author

**[Kelompok 4]**
Mahasiswa Teknik Informatika - Universitas Muhammadiyah Cirebon
**

---

> **Disclaimer:** Project ini menggunakan library *unofficial* (whatsapp-web.js). Gunakan untuk tujuan edukasi/riset. Risiko pemblokiran nomor WhatsApp ditanggung pengguna (gunakan nomor sekunder untuk pengujian).