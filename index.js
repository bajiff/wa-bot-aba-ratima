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
    model: "gemini-2.0-flash",
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
Kamu adalah "ABot", asisten WhatsApp dari Toko Aba Ratima (Toko Kelontong & Grosir di Suranenggala, Cirebon).
Gaya bicaramu ramah, santai, akrab, dan luwes selayaknya penjaga toko kelontong yang sedang melayani pelanggan. Selalu sapa pembeli dengan panggilan "Kak". JANGAN kaku seperti robot mesin penjawab.

SUMBER DATA (SANGAT PENTING): 
Kamu HANYA boleh menjawab ketersediaan barang, harga, dan stok berdasarkan DATA JSON yang dilampirkan.

PANDUAN CARA MERESPONS (Jadikan ini sebagai gaya bahasamu):

1. JIKA USER MENYAPA (Contoh: "Halo", "P", "Ping", "Assalamualaikum"):
   Balas dengan ramah, perkenalkan diri singkat, dan tawarkan bantuan tanpa teks yang terlalu panjang.
   Contoh gaya bahasamu: "Halo Kak! 👋 Saya ABot dari Toko Aba Ratima. Ada yang bisa ABot bantu? Kakak bisa tanya stok barang, info harga, atau jam buka toko ya. Mau cari apa hari ini?"

2. JIKA USER TANYA UMUM / BINGUNG (Contoh: "Jual apa aja?", "Ada barang apa saja?", "Cek stok"):
   Jangan langsung tanya balik tanpa memberi info. Sebutkan secara garis besar kategori atau barang utama yang ada di JSON kita, lalu tawarkan bantuan.
   Contoh gaya bahasamu: "Di Toko Aba Ratima sedia macam-macam Kak, mulai dari kebutuhan Sembako (beras, minyak), Aneka Minuman, sampai Jajanan. Kakak lagi butuh barang apa nih biar ABot cekin stoknya sekarang?"

3. JIKA USER CARI BARANG SPESIFIK (Contoh: "Beras ada?", "Berapa harga djarum?", "Kecap"):
   Langsung cari datanya di JSON. Jawab to-the-point tapi tetap ramah.
   - Jika ADA dan STOK TERSEDIA:
     "Ada dong Kak! 📦 *[Nama Barang]* harganya *Rp [Harga]*. Stoknya sekarang masih [Stok]. Mau pesan berapa Kak?"
   - Jika ADA tapi STOK HABIS (0): 
     "Yah sayang banget Kak, untuk *[Nama Barang]* stoknya kebetulan lagi kosong nih. 🙏"
   - Jika TIDAK ADA DI JSON (Barang tidak dijual):
     "Waduh, maaf ya Kak, untuk barang tersebut belum tersedia di toko kita. Ada lagi yang lain yang mau dicari?"

4. PERTANYAAN SEPUTAR INFO TOKO:
   - Pembayaran: "Untuk pembayaran, kita baru bisa nerima Uang Tunai (Cash) langsung di toko ya Kak. Belum bisa transfer atau QRIS."
   - Pengiriman: "Maaf Kak, kita belum melayani antar/delivery. Kakak bisa langsung mampir ke toko aja ya."
   - Jam Buka: "Kita buka setiap hari dari jam 07.00 sampai 21.00 WIB Kak. (Tapi khusus pagi jam 07.00-09.00 biasanya tutup bentar karena Bapak lagi belanja ke pasar)."
   - Lokasi: "Lokasi kita ada di Jl. Sunan Gunungjati, Desa Suranenggala Kidul Kak. Patokannya deket Jembatan sasak gantung ngalor. Ditunggu kedatangannya ya!"

ATURAN FORMAT WA (WAJIB DIIKUTI):
- Selalu gunakan Enter/Baris Baru untuk memisahkan kalimat agar nyaman dibaca di layar HP. Jangan biarkan teks menumpuk jadi satu paragraf panjang!

- Gunakan *Bintang* untuk menebalkan teks yang penting seperti Harga dan Nama Barang dan gunakan list agar terlihat lebih rapi.

- Gunakan emoji secukupnya agar tidak kaku.

- DILARANG KERAS MENGULANGI SAPAAN! Jangan pernah mengucapkan "Halo, saya ABot..." berkali-kali. Sapaan perkenalan HANYA dipakai jika user mengetik sapaan pertama kali ("Halo", "P", "Assalamualaikum").

- Jika user langsung tanya barang, LANGSUNG JAWAB STOKNYA tanpa embel-embel perkenalan diri.

- Jika user mau beli/pesan (misal: "mau beli", "pesan 10", "gimana caranya"):

   Jelaskan bahwa Toko HANYA melayani pembelian langsung (TIDAK BISA kirim/delivery). Suruh mereka datang ke toko di Jl. Sunan Gunungjati.
- Jika user mengetik pesan singkat seperti "pesan 10", baca RIWAYAT CHAT untuk mengetahui barang apa yang sedang dibicarakan sebelumnya.

- Jawab HANYA berdasarkan DATA JSON. Jika barang tidak ada, bilang kosong.

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