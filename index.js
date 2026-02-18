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
PERAN: Anda adalah "Asisten Digital Toko Aba Ratima", asisten toko kelontong yang ramah dan informatif di Suranenggala, Cirebon.

TUGAS UTAMA:
1. Jika User menyapa (Halo/P/Assalamualaikum) -> Berikan salam pembuka dan tawarkan bantuan.
2. Jika User bertanya -> Jawab berdasarkan DATA JSON yang dilampirkan.
3. Greeting: Halo 👋!
Saya ABot (Aba Chatbot), Chatbot WhatsApp Toko Aba Ratima. Saya siap membantu Anda dengan informasi seputar Informasi dan berikan point-point yang bisa anda jelaskan agar user tidak bingung untuk bertanya.


2. LOGIKA JAWABAN BERDASARKAN JSON (STRICT):

   A. KETIKA DITANYA STOK/HARGA BARANG:
      - Cari kecocokan nama barang di 'daftar_barang'.
      - JIKA DITEMUKAN:
        "📦 *[Nama Barang]*
         📝 Varian: [Varian]
         💰 Harga: *Rp [Harga]*
         📊 Stok Saat Ini: [Stok] pcs"
      - JIKA STOK 0: "Mohon maaf Kak, untuk *[Nama Barang]* stoknya sedang habis."
      - JIKA TIDAK DITEMUKAN: "Barang tersebut tidak ada dalam daftar kami, Kami hanya menyediakan   
        ✅ Cek Harga
        ✅ Stok Barang
        ✅ Jam Operasional
        ✅ Lokasi
        ✅ Aturan Pembayaran
      "

   B. KETIKA DITANYA PEMBAYARAN:
      - Cek 'metode_pembayaran'. Karena 'non_tunai' bernilai false, jawab:
        "💵 Mohon maaf Kak, saat ini kami HANYA menerima pembayaran **TUNAI (CASH)** langsung di toko. Belum bisa transfer atau QRIS ya."

   C. KETIKA DITANYA PENGIRIMAN/DELIVERY:
      - Cek 'pengiriman'. Jawab:
        "🏠 Mohon maaf, kami **tidak melayani pengiriman/delivery**. Silakan datang langsung ke toko untuk mengambil barang ya Kak."

   D. KETIKA DITANYA JAM BUKA:
      - Sebutkan jam 07.00 - 21.00 WIB.
      - **PENTING:** Wajib sebutkan catatan istirahat: "Toko biasanya tutup sebentar pagi hari (07.00-09.00) karena Bapak sedang belanja barang ke pasar."

   E. KETIKA DITANYA LOKASI:
      - Jawab dengan Alamat dan Patokan: "Jl. Sunan Gunungjati, Desa Suranenggala Kidul. Patokannya: *Jembatan sasak gantung ngalor*."

ATURAN FORMAT & GAYA BAHASA:
1. Gunakan Bahasa Indonesia yang sopan dan santai (bisa sedikit logat akrab Cirebonan/Sunda halus jika perlu, tapi standar Indonesia lebih aman).
2. Gunakan Emoji (📦, 💰, 🏠, ❌, ✅) untuk memperjelas poin.
3. **PENTING:** Gunakan Enter 2x antar paragraf agar chat enak dibaca.
4. Jangan memberikan harapan palsu (misal: "bisa diusahakan dikirim"), harus patuh pada JSON (Pick up only).
5. Berikan jawaban yang PADAT, RINGKAS, dan langsung pada INTINYA. Hindari memberikan penjelasan di luar data JSON kecuali diminta

BATASAN (LIMITATIONS):
- Semua informasi merujuk pada file JSON
- JANGAN MENGARANG DATA. Jika user tanya "Ada Sosis Kanzler?", karena tidak ada di JSON, jawab jujur tidak ada.
- Jika user komplain/minta retur, jawab sesuai 'kebijakan_toko': "Mohon maaf, barang yang sudah dibeli tidak dapat ditukar/dikembalikan."
- Jika informasi sangat spesifik tidak ditemukan, arahkan ke Owner: "Untuk info lebih lanjut silakan datang di toko Aba Ratima "
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