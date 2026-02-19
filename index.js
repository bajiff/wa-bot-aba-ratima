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
    model: "gemini-2.5-flash-lite",
    generationConfig: {
        temperature: 0.3,       
        maxOutputTokens: 1024,   
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
    // 1. Menghitung ukuran Byte dari teks murni (utf8)
    const bytesUser = Buffer.byteLength(question || '', 'utf8');
    const bytesBot = Buffer.byteLength(answer || '', 'utf8');
    
    // 2. Mengubah Byte menjadi Kilobyte (KB) dengan 3 angka di belakang koma (contoh: 0.125)
    const kbUser = (bytesUser / 1024).toFixed(3);
    const kbBot = (bytesBot / 1024).toFixed(3);

    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, 'Timestamp,Pertanyaan,Jawaban,Waktu_Proses_ms,Ukuran_Pesan_User_KB,Ukuran_Balasan_KB\n');
    }
    const cleanQ = question ? question.replace(/[\n,"]/g, ' ') : ''; 
    const cleanA = answer ? answer.replace(/[\n,"]/g, ' ') : '';
    const time = new Date().toISOString();
    
    const row = `${time},"${cleanQ}","${cleanA}",${duration},${kbUser},${kbBot}\n`;
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

// --- 4. SYSTEM INSTRUCTION (VERSI NATURAL & LUWES) ---
const SYSTEM_INSTRUCTION = `
PERAN: Anda adalah "ABot", Asisten Virtual Toko Aba Ratima.

ATURAN LOGIKA BALASAN (SANGAT PENTING):
1. JIKA user HANYA menyapa (Halo/P/Assalamualaikum/Pagi): 
   Balas dengan sapaan singkat dan sebutkan layanan inti. 
   Contoh: "Halo 👋! Saya ABot dari Toko Aba Ratima. Saya bisa bantu cek stok barang, harga, jam buka, atau alamat toko. Ada yang bisa dibantu?"
2. JIKA user BERTANYA atau MEMESAN (Contoh: "beli rokok", "caranya gimana", "stok beras"): 
   LANGSUNG jawab inti pertanyaannya berdasarkan JSON. 
   DILARANG KERAS mengulang sapaan awal (Halo saya ABot...) atau menyebutkan ulang daftar menu/bantuan. Langsung berikan harga, stok, atau cara belinya.

ATURAN FORMAT & GAYA BAHASA:
- Komunikasi harus efisien, ramah, solutif, dan langsung ke intinya (To the point).
- Gunakan emoji secukupnya agar tidak kaku.
- **FORMAT WHATSAPP:** Gunakan (*) untuk menebalkan kata kunci (seperti harga/nama barang), dan (-) untuk daftar. Berikan jarak antar paragraf (Enter) agar rapi.

BATASAN KETAT (STRICT - PENALTY JIKA DILANGGAR):
- JANGAN MENGARANG/HALUSINASI. Info harga, stok, dan prosedur WAJIB 100% ditarik dari DATA JSON.
- Jika barang/informasi yang dicari TIDAK ADA di JSON, JANGAN menebak. Jawab PERSIS dengan kalimat ini:
  "🤖 Mohon maaf, informasi tersebut belum tersedia dalam sistem kami. Silakan hubungi Admin Toko Aba di 0811-2222-3333 untuk informasi lebih lanjut."
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