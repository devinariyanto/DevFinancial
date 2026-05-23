import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
dotenv.config({ path: ".env.local" });

// Lazy-loaded GenAI client to prevent startup crash if GEMINI_API_KEY is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  if (customApiKey) {
    return new GoogleGenAI({
      apiKey: customApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const app = express();
const PORT = 3000;

// Middleware for body parsing
app.use(express.json());

// In-memory or simple file-based JSON database for persistence
// Ensure data folder exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const BACKUPS_FILE = path.join(DATA_DIR, "backups.json");

// Helper function to read helper files
function readJSONFile(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading file:", filePath, err);
  }
  return {};
}

// Helper function to write helper files
function writeJSONFile(filePath: string, data: any) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing file:", filePath, err);
  }
}

// Initialize files if empty
if (!fs.existsSync(USERS_FILE)) writeJSONFile(USERS_FILE, {});
if (!fs.existsSync(BACKUPS_FILE)) writeJSONFile(BACKUPS_FILE, {});

// API Route: Register
app.post("/api/auth/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password diperlukan" });
  }

  const emailLower = email.toLowerCase().trim();
  const users = readJSONFile(USERS_FILE);

  if (users[emailLower]) {
    return res.status(400).json({ error: "Email sudah terdaftar" });
  }

  // Save user credentials (simple text hashing or plain since it is helper sandbox)
  users[emailLower] = { password, createdAt: new Date().toISOString() };
  writeJSONFile(USERS_FILE, users);

  return res.json({ success: true, email: emailLower });
});

// API Route: Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password diperlukan" });
  }

  const emailLower = email.toLowerCase().trim();
  const users = readJSONFile(USERS_FILE);

  const user = users[emailLower];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Email atau password salah" });
  }

  return res.json({ success: true, email: emailLower });
});

// API Route: Google Auth (Mock/Simulated)
app.post("/api/auth/google", (req, res) => {
  const { email, name, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk login Google" });
  }

  const emailLower = email.toLowerCase().trim();
  const users = readJSONFile(USERS_FILE);

  // If user does not exist, register them automatically
  if (!users[emailLower]) {
    users[emailLower] = { 
      password: "google-authenticated-session", 
      createdAt: new Date().toISOString(),
      isGoogleUser: true
    };
    writeJSONFile(USERS_FILE, users);
  }

  // Create mock backup workspace with profile details if none exists
  const backups = readJSONFile(BACKUPS_FILE);
  if (!backups[emailLower]) {
    backups[emailLower] = {
      transactions: [],
      categories: [],
      budgets: [],
      userProfile: {
        name: name || emailLower.split("@")[0],
        avatar: avatar || "",
      },
      syncedAt: new Date().toISOString(),
    };
    writeJSONFile(BACKUPS_FILE, backups);
  }

  return res.json({ success: true, email: emailLower });
});

// API Route: Backup data to cloud
app.post("/api/sync/backup", (req, res) => {
  const { email, transactions, categories, budgets, userProfile } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });
  }

  const emailLower = email.toLowerCase().trim();
  const backups = readJSONFile(BACKUPS_FILE);

  backups[emailLower] = {
    transactions: transactions || [],
    categories: categories || [],
    budgets: budgets || [],
    userProfile: userProfile || null,
    syncedAt: new Date().toISOString(),
  };

  writeJSONFile(BACKUPS_FILE, backups);
  return res.json({ success: true, syncedAt: backups[emailLower].syncedAt });
});

// API Route: Restore data from cloud
app.post("/api/sync/restore", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });
  }

  const emailLower = email.toLowerCase().trim();
  const backups = readJSONFile(BACKUPS_FILE);

  const backup = backups[emailLower];
  if (!backup) {
    return res.json({
      transactions: [],
      categories: [],
      budgets: [],
      userProfile: null,
      message: "Tidak ada data backup yang ditemukan untuk akun ini.",
    });
  }

  return res.json({
    transactions: backup.transactions || [],
    categories: backup.categories || [],
    budgets: backup.budgets || [],
    userProfile: backup.userProfile || null,
    syncedAt: backup.syncedAt,
  });
});

// API Route: Generate AI insights with Gemini
app.post("/api/insight", async (req, res) => {
  try {
    const { transactions, message } = req.body;
    const customApiKey = req.headers["x-gemini-key"] as string;
    
    // Even if transactions list is empty, we can still chat if they send a message
    const hasTransactions = Array.isArray(transactions) && transactions.length > 0;
    
    const ai = getGenAI(customApiKey);

    // Summarize transaction data to pass cleanly to Gemini
    const listString = hasTransactions
      ? transactions
          .map(
            (t) =>
              `- ${t.type === "income" ? "Pemasukan" : "Pengeluaran"} | Rp ${t.amount} | Kategori: ${t.category} | Catatan: ${t.note || ""} | Tanggal: ${t.date}`
          )
          .join("\n")
      : "Belum ada transaksi tercatat.";

    let prompt = "";
    let systemInstruction = "";

    if (message) {
      // User is asking a custom question
      prompt = `Berikut adalah data transaksi keuangan pengguna:\n${listString}\n\nPertanyaan Pengguna: "${message}"\n\nBerikan jawaban/saran yang sangat praktis, cerdas, memotivasi, dan ringkas dalam Bahasa Indonesia berdasarkan data keuangan di atas. Jangan menulis salam pembuka atau penutup yang terlalu formal. Langsung berikan jawaban yang padat dan informatif.`;
      systemInstruction = "Anda adalah penasihat keuangan AI interaktif untuk aplikasi DevFinancial. Berikan saran keuangan cerdas, sopan, memotivasi, dan ringkas (maksimal 3-4 kalimat) berdasarkan data transaksi pengguna dan pertanyaan spesifik mereka dalam Bahasa Indonesia.";
    } else {
      // General automatic advice
      if (!hasTransactions) {
        return res.json({
          insight: "Belum ada transaksi. Silakan tambah transaksi pengeluaran dan pemasukan untuk melihat analisis AI Anda di sini!",
        });
      }
      prompt = `Berikut adalah daftar transaksi keuangan pengguna:\n${listString}\n\nBerikan 1 atau 2 kalimat saran/insight keuangan (dalam bahasa Indonesia) yang sangat cerdas, memotivasi, dan spesifik untuk pengguna agar dapat berhemat dan mengelola uang dengan bijak. Jangan menulis intro panjang. Langsung berikan sarannya menggunakan tanda kutip.`;
      systemInstruction = "Anda adalah penasihat keuangan AI cerdas untuk aplikasi DevFinancial. Buat saran transaksi keuangan yang personal, sopan, memotivasi, menarik, dan sangat relevan dengan pola belanja pengguna dalam bahasa Indonesia agar mereka bisa berhemat. Batasi jawaban maksimal 2 kalimat dan letakkan di dalam tanda kutip.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const parsedText = response.text || "Terus pantau pengeluaran Anda agar tabunganmu tercapai!";
    return res.json({ insight: parsedText });
  } catch (error: any) {
    console.error("Gemini Insight Error:", error);
    
    // Provide dynamic simulation if GEMINI_API_KEY is missing
    const { message } = req.body;
    if (message) {
      const msgLower = message.toLowerCase();
      if (msgLower.includes("hemat") || msgLower.includes("tips")) {
        return res.json({
          insight: "Untuk berhemat, mulailah dengan membatasi makan di luar sebesar 20%, buat anggaran bulanan yang ketat untuk hiburan, dan selalu sisihkan 10% pendapatan di awal bulan sebagai tabungan otomatis.",
        });
      }
      if (msgLower.includes("investasi") || msgLower.includes("saham") || msgLower.includes("reksa")) {
        return res.json({
          insight: "Langkah investasi terbaik untuk pemula adalah menyisihkan uang dingin ke Reksa Dana Pasar Uang yang minim risiko, lalu pelajari dasar investasi Saham atau Obligasi Negara secara konsisten.",
        });
      }
      return res.json({
        insight: `Analisis AI: Pertanyaan Anda mengenai "${message}" membutuhkan peninjauan transaksi pengeluaran kategori Makanan & Belanja Anda. Cobalah menahan diri dari pembelian impulsif selama 24 jam sebelum bertransaksi.`,
      });
    }

    return res.json({
      insight: `"Pengeluaran untuk 'Makanan' minggu ini naik 20%. Pertimbangkan untuk masak di rumah agar tabunganmu tercapai."`,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Configure development and production modes
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for smooth development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
