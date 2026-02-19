// ? index.js - RE-OPTIMIZED BY PROMPT ENGINEER
import fs from 'fs';
import { appendFile } from 'fs/promises'; // Gunakan Async untuk log agar tidak memblokir antrean pesan
import qrcode from 'qrcode-terminal';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import 'dotenv/config';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

// --- 1. SETUP LOGGER (ASYNC) ---
const LOG_FILE = 'data-penelitian.csv';
// Buat header jika file belum ada
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'Timestamp,Pertanyaan,Jawaban,Waktu_Proses_ms,Ukuran_Pesan_User_KB,Ukuran_Balasan_KB\n');
}

const logResearchDataAsync = async (question, answer, duration) => {
    const kbUser = (Buffer.byteLength(question || '', 'utf8') / 1024).toFixed(3);
    const kbBot = (Buffer.byteLength(answer || '', 'utf8') / 1024).toFixed(3);
    const cleanQ = question ? question.replace(/[\n,"]/g, ' ') : ''; 
    const cleanA = answer ? answer.replace(/[\n,"]/g, ' ') : '';
    const time = new Date().toISOString();
    
    const row = `${time},"${cleanQ}","${cleanA}",${duration},${kbUser},${kbBot}\n`;
    await appendFile(LOG_FILE, row); // Non-blocking I/O
};

// --- 2. IN-MEMORY DATABASE ---
let TOKO_DATA_CONTEXT = "{}";
try {
    console.log("📂 Membaca Database Toko ke RAM...");
    if(fs.existsSync('data-toko-aba-ratima.json')) {
        const rawData = fs.readFileSync('data-toko-aba-ratima.json', 'utf8');
        TOKO_DATA_CONTEXT = JSON.stringify(JSON.parse(rawData)); 
        console.log("✅ Database Siap!");
    } else {
        console.warn("⚠️ File JSON tidak ditemukan!");
    }
} catch (error) {
    console.error("❌ Gagal memuat database:", error.message);
    process.exit(1);
}

// --- 3. KONFIGURASI GEMINI AI & SYSTEM INSTRUCTION ---
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
// --- 4. SYSTEM INSTRUCTION (VERSI NATURAL & LUWES) ---
const SYSTEM_INSTRUCTION = `
PERAN: Anda adalah "ABot", Asisten Virtual Toko Aba Ratima.

ATURAN LOGIKA BALASAN (SANGAT PENTING):
PERAN: Anda adalah "ABot", Aba Chatbot.
TUGAS UTAMA:
1. Jika User menyapa (Halo/P/Assalamualaikum) -> Berikan salam pembuka dan tawarkan bantuan.

2. Jika User bertanya -> Jawab berdasarkan DATA JSON yang dilampirkan.

3. Greeting: Halo 👋!
Saya ABot, Chatbot WhatsApp Toko Aba Ratima. Saya siap membantu Anda dengan informasi seputar Informasi dan berikan point-point yang bisa anda jelaskan agar user tidak bingung untuk bertanya.

4. JIKA user BERTANYA atau MEMESAN (Contoh: "beli rokok", "caranya gimana", "stok beras"): 
LANGSUNG jawab inti pertanyaannya berdasarkan JSON. 
DILARANG KERAS mengulang sapaan awal (Halo saya ABot...) atau menyebutkan ulang daftar menu/bantuan. Langsung berikan harga, stok, atau cara belinya.

ATURAN FORMAT & GAYA BAHASA:
- Komunikasi harus efisien, ramah, solutif, dan langsung ke intinya (To the point).
- Gunakan emoji secukupnya agar tidak kaku.
- **FORMAT WHATSAPP:** Gunakan (*) untuk menebalkan kata kunci (seperti harga/nama barang), dan (-) untuk daftar. Berikan jarak antar paragraf (Enter) agar rapi.

ATURAN PENANGANAN BARANG KOSONG / VARIAN LAIN (NEW):
- JIKA user mencari barang yang TIDAK ADA atau menanyakan VARIAN LAIN yang tidak terdaftar di JSON, jawablah dengan bahasa natural bahwa barang tersebut tidak dijual/kosong. 
- Contoh: "Mohon maaf Kak, untuk saat ini kami hanya menyediakan [Sebutkan barang yang ada di JSON] saja." atau "Wah maaf Kak, untuk [Nama Barang] kebetulan kita belum jual nih."

BATASAN KETAT (STRICT):
- JANGAN MENGARANG/HALUSINASI. Info harga, stok, dan prosedur WAJIB 100% ditarik dari DATA JSON.
- JIKA user bertanya hal di luar konteks toko (misal: nanya cuaca, politik, atau info admin yang tidak ada di JSON), BARU gunakan template ini persis:
  "🤖 Mohon maaf, informasi tersebut belum tersedia dalam sistem kami. Silakan hubungi Admin Toko Aba di 0811-2222-3333."
=== DATA TOKO (SUMBER DATA) ===
${TOKO_DATA_CONTEXT}
`;
// Gunakan parameter systemInstruction bawaan SDK
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", // Hapus suffix "-lite" jika error, gunakan base model
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
});

// --- 4. SESSION MEMORY (AGAR BOT TIDAK AMNESIA) ---
const chatSessions = new Map(); 

// --- 5. SETUP CLIENT WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('[INFO] Bot Siap Melayani!'));

client.on('disconnected', async (reason) => {
    console.log('⚠️ Koneksi terputus:', reason);
    const sessionPath = './.wwebjs_auth';
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
    process.exit(); 
});

// --- 6. LOGIKA PESAN ---
client.on('message', async msg => {
    if (msg.body === 'status@broadcast') return;

    // ✅ Pengecekan Grup Tanpa Membebani Server WA
    if (msg.from.includes('@g.us')) return;

    try {
        const startTime = Date.now();
        console.log(`[USER] ${msg.from}: ${msg.body}`);

        // ✅ Buat atau Ambil Sesi Obrolan untuk User Ini
        if (!chatSessions.has(msg.from)) {
            // Inisialisasi chat baru dengan memori kosong (System Instruction otomatis ikut dari model)
            chatSessions.set(msg.from, model.startChat({ history: [] }));
        }
        
        const chat = chatSessions.get(msg.from);

        // ✅ Kirim pesan murni tanpa menempelkan prompt JSON lagi
        const result = await chat.sendMessage(msg.body);
        let text = "";
        
        try {
             text = result.response.text();
        } catch (e) {
             text = "🤖 Mohon maaf, saya tidak bisa memproses pertanyaan tersebut karena alasan keamanan sistem.";
        }

        await msg.reply(text);

        const endTime = Date.now();
        logResearchDataAsync(msg.body, text, endTime - startTime); // Jalankan di background
        console.log(`[BOT] Terkirim ke ${msg.from} (${endTime - startTime}ms)`);

    } catch (error) {
        console.error('[ERROR SYSTEM]', error);
    }
});

client.initialize();