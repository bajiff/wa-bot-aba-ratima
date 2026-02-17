// ? File: cek_model.js
import 'dotenv/config';

async function cekDaftarModel() {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        console.error("❌ API_KEY tidak ditemukan di file .env!");
        return;
    }

    console.log("🔍 Sedang menghubungi Google untuk mengecek izin model...");
    console.log("🔑 Menggunakan API Key berawalan: " + apiKey.substring(0, 5) + "...");

    try {
        // Tembak langsung ke endpoint ListModels
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("\n❌ GAGAL! Ada masalah dengan API Key atau Akun Anda:");
            console.error(`Pesan Error: ${data.error.message}`);
        } else if (data.models) {
            console.log("\n✅ BERHASIL! Berikut daftar model yang diizinkan untuk Anda:");
            console.log("===========================================================");
            
            // Filter hanya model yang bisa generateContent (Chat)
            const chatModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
            
            chatModels.forEach(m => {
                // Kita ambil nama belakangnya saja biar mudah dibaca
                const cleanName = m.name.replace("models/", "");
                console.log(`👉 ${cleanName}`);
            });
            console.log("===========================================================");
            console.log("TIPS: Pilih salah satu nama di atas untuk dipasang di index.js");
        } else {
            console.log("⚠️ Respon aneh dari Google (tidak ada error, tidak ada model).");
            console.log(data);
        }

    } catch (error) {
        console.error("❌ Error Koneksi:", error);
    }
}

cekDaftarModel();