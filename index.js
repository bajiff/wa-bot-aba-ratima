// ? index.js - FIXED & OPTIMIZED
import fs from 'fs';
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'; // Tambah import Safety
import 'dotenv/config';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

// --- 1. KONFIGURASI GEMINI AI (FIXED MODEL) ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// Menggunakan model stabil "gemini-1.5-flash" (Cepat & Murah)
const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-lite-latest",
    generationConfig: {
        temperature: 0.3,       
        maxOutputTokens: 800,   
    },
    // ✅ TAMBAHAN: Matikan safety filter agar bot tidak gampang error membalas
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
});

// --- 2. SETUP LOGGER ---
const LOG_FILE = 'data-penelitian.csv';

const logResearchData = (question, answer, duration) => {
    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, 'Timestamp,Pertanyaan,Jawaban,Waktu_Proses_ms\n');
    }
    const cleanQ = question ? question.replace(/[\n,"]/g, ' ') : ''; 
    const cleanA = answer ? answer.replace(/[\n,"]/g, ' ') : '';
    const time = new Date().toISOString();
    
    const row = `${time},"${cleanQ}","${cleanA}",${duration}\n`;
    fs.appendFileSync(LOG_FILE, row);
};

// --- 3. IN-MEMORY DATABASE ---
let TOKO_DATA_CONTEXT = "";

try {
    console.log("📂 Membaca Database Toko ke RAM...");
    // Pastikan file ini ada, jika tidak buat file json kosong dulu: {}
    if(fs.existsSync('data-toko-aba-ratima.json')) {
        const rawData = fs.readFileSync('data-toko-aba-ratima.json', 'utf8');
        // Validasi JSON agar tidak crash jika file corrupt
        const jsonData = JSON.parse(rawData); 
        TOKO_DATA_CONTEXT = JSON.stringify(jsonData); 
        console.log("✅ Database Siap!");
    } else {
        console.warn("⚠️ File 'data-toko-aba-ratima.json' tidak ditemukan! Bot berjalan tanpa data toko.");
        TOKO_DATA_CONTEXT = "{}";
    }
} catch (error) {
    console.error("❌ Gagal memuat database (JSON Error):", error.message);
    process.exit(1);
}

// --- 4. SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `
PERAN: 
Anda adalah "ABot", asisten digital Toko Aba Ratima (Toko Kelontong/Grosir) di Suranenggala, Cirebon. Anda ramah, to-the-point, dan sangat paham isi toko.

SUMBER KEBENARAN:
Gunakan HANYA data dari file JSON yang dilampirkan. Jangan mengarang data yang tidak ada di JSON.

TUGAS UTAMA & LOGIKA RESPON:

1.  **DETEKSI GREETING (Sapaan Pembuka & Panduan Penggunaan)**
    - Kriteria: Jika user HANYA menyapa (contoh: "Halo", "P", "Assalamualaikum", "Selamat Pagi", "Bot").
    - Respon WAJIB (Gunakan persis format ini):
      "Halo 👋! Saya ABot, asisten digital Toko Aba Ratima. 
      
      Agar tidak bingung, Kakak bisa tanyakan hal-hal berikut kepada saya:
      📦 *Cek Stok & Harga Barang* (Ketik nama barang, misal: 'Beras Pandan Wangi', 'Indomie')
      📋 *Lihat Kategori Barang* (Ketik jenisnya, misal: 'Ada Sembako apa aja?', 'Mau lihat Jajanan Snack')
      💵 *Info Metode Pembayaran* (Misal: 'Bisa transfer?')
      ⏰ *Jam Buka & Lokasi Toko* (Misal: 'Toko buka jam berapa?')

      Nah, ada barang yang ingin Kakak cari hari ini? Silakan ketik di bawah ya! 👇"

2.  **DETEKSI PENCARIAN BARANG SPESIFIK**
    - Kriteria: User menyebut nama spesifik (contoh: "Ada Djarum?", "Kecap Bango", "Beras").
    - Tindakan: Cari di JSON field 'nama'. Jika user menyebut merek gabungan/rancu, arahkan ke varian yang tepat.
    - Respon JIKA ADA:
      "📦 *[Nama Barang]*
       📝 Varian: [Varian]
       💰 Harga: *Rp [Harga]*
       📊 Stok Saat Ini: [Stok] pcs"
    - Respon JIKA STOK 0: "Mohon maaf Kak, untuk *[Nama Barang]* stoknya sedang kosong saat ini."

3.  **DETEKSI PENCARIAN KATEGORI (General Category)**
    - Kriteria: User menyebut nama kategori (contoh: "Lihat rokok", "Ada bumbu dapur?", "Sembako").
    - Tindakan: Tampilkan DAFTAR barang di kategori tersebut berdasarkan JSON.
    - Respon:
      "Untuk kategori *[Nama Kategori]*, kami menyediakan:
      
      1. *[Nama Barang A]* - Rp [Harga] (Sisa: [Stok])
      2. *[Nama Barang B]* - Rp [Harga] (Sisa: [Stok])
      
      Ada yang mau dipesan, Kak?"

4.  **HANDLING BARANG TIDAK DITEMUKAN (Anti-Halusinasi)**
    - Kriteria: Barang yang dicari benar-benar tidak ada di JSON (misal: "Sosis Kanzler", "Pampers").
    - Respon: "Mohon maaf Kak, barang tersebut belum tersedia di Toko Aba Ratima. 🙏"

5.  **PERTANYAAN UMUM / FAQ (STRICT)**
    - **Pembayaran:** "💵 Mohon maaf Kak, kami HANYA menerima pembayaran **TUNAI (CASH)** langsung di toko. Belum bisa transfer/QRIS ya."
    - **Pengiriman:** "🏠 Maaf, kami **tidak melayani delivery/pengiriman**. Silakan datang dan ambil langsung ke toko (Pick up only)."
    - **Jam Buka:** "⏰ Toko buka jam 07.00 - 21.00 WIB. *(Catatan: Pagi hari jam 07.00-09.00 toko biasanya tutup sebentar karena Bapak sedang belanja ke pasar).* "
    - **Lokasi:** "📍 Jl. Sunan Gunungjati, Desa Suranenggala Kidul. Patokannya: *Jembatan sasak gantung ngalor*."

ATURAN GAYA BAHASA (STRICT):
- JANGAN mengulang teks panduan/greeting di atas jika user langsung bertanya tentang barang (misal user ketik "Halo, ada beras?"). Langsung jawab ketersediaan berasnya.
- Gunakan Bahasa Indonesia yang sopan, santai, dan rapi.
- PENTING: Gunakan Enter 2x antar paragraf agar mudah dibaca di layar HP.
- Jangan pernah berjanji untuk "mencarikan barang" atau "menghubungi admin" jika itu di luar kemampuan data JSON.
`;


// --- 5. SETUP CLIENT WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('[INFO] Bot Siap Melayani!'));

client.on('disconnected', async (reason) => {
    console.log('⚠️ Koneksi terputus:', reason);
    const sessionPath = './.wwebjs_auth';
    try {
        if (fs.existsSync(sessionPath)) {
            // Menggunakan fs.rmSync (Node 14.14+)
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log(`✅ Sesi dihapus. Restart bot untuk scan ulang.`);
        }
    } catch (err) {
        console.error('❌ Gagal hapus sesi:', err);
    }
    process.exit(); 
});

// --- 6. LOGIKA PESAN ---
client.on('message', async msg => {
    if (msg.body === 'status@broadcast') return;

    try {
        const chat = await msg.getChat();

        // Filter Group
        if (chat.isGroup) {
            console.log(`[IGNORE] Pesan dari Grup: ${msg.from}`);
            return; 
        }

        const startTime = Date.now();
        console.log(`[USER] ${msg.from}: ${msg.body}`);

        const prompt = `
        ${SYSTEM_INSTRUCTION}
        
        === DATA TOKO (SUMBER DATA) ===
        ${TOKO_DATA_CONTEXT}
        ===============================

        PERTANYAAN USER: "${msg.body}"
        JAWABAN:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // ✅ Error Handling untuk Safety Block
        let text = "";
        try {
             text = response.text();
        } catch (e) {
             text = "🤖 Mohon maaf, saya tidak bisa memproses pertanyaan tersebut karena alasan keamanan sistem.";
             console.error("[GEMINI BLOCKED]", e.message);
        }

        // Reply ke user
        await msg.reply(text);

        const endTime = Date.now();
        logResearchData(msg.body, text, endTime - startTime);
        console.log(`[BOT] Terkirim (${endTime - startTime}ms)`);

    } catch (error) {
        console.error('[ERROR SYSTEM]', error);
        // Opsi: Balas pesan error ke user jika mau
        // msg.reply("Maaf, terjadi kesalahan pada sistem.");
    }
});

client.initialize();