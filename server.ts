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

// Database Interfaces
interface User {
  password: string;
  createdAt: string;
  isGoogleUser?: boolean;
}

interface Backup {
  transactions: any[];
  categories: any[];
  budgets: any[];
  userProfile: any;
  syncedAt: string;
}

// In-memory fallbacks if writing to disk fails on Vercel without KV configured
const memoryUsers: Record<string, User> = {};
const memoryBackups: Record<string, Backup> = {};

// Helper to check if Vercel KV is configured
const isKVEnabled = () => !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Execute a Vercel KV REST command
async function runKVCommand(command: any[]) {
  try {
    const response = await fetch(process.env.KV_REST_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      throw new Error(`KV Command failed with status ${response.status}`);
    }
    const data = await response.json();
    return data.result;
  } catch (err) {
    console.error("Vercel KV Error:", err);
    return null;
  }
}

// Initialize local files if they don't exist and we're not on Vercel
if (!process.env.VERCEL) {
  try {
    if (!fs.existsSync(USERS_FILE)) writeJSONFile(USERS_FILE, {});
    if (!fs.existsSync(BACKUPS_FILE)) writeJSONFile(BACKUPS_FILE, {});
  } catch (e) {
    console.warn("Could not initialize local database files:", e);
  }
}

// Get User Helper
async function getUser(email: string): Promise<User | null> {
  const emailLower = email.toLowerCase().trim();
  if (isKVEnabled()) {
    const res = await runKVCommand(["GET", `user:${emailLower}`]);
    return res ? JSON.parse(res) : null;
  }
  try {
    const users = readJSONFile(USERS_FILE);
    return users[emailLower] || null;
  } catch (err) {
    return memoryUsers[emailLower] || null;
  }
}

// Save User Helper
async function saveUser(email: string, user: User): Promise<boolean> {
  const emailLower = email.toLowerCase().trim();
  if (isKVEnabled()) {
    await runKVCommand(["SET", `user:${emailLower}`, JSON.stringify(user)]);
    return true;
  }
  try {
    const users = readJSONFile(USERS_FILE);
    users[emailLower] = user;
    writeJSONFile(USERS_FILE, users);
    return true;
  } catch (err) {
    console.warn("Read-only filesystem. Saving user in-memory:", err);
    memoryUsers[emailLower] = user;
    return true;
  }
}

// Get Backup Helper
async function getBackup(email: string): Promise<Backup | null> {
  const emailLower = email.toLowerCase().trim();
  if (isKVEnabled()) {
    const res = await runKVCommand(["GET", `backup:${emailLower}`]);
    return res ? JSON.parse(res) : null;
  }
  try {
    const backups = readJSONFile(BACKUPS_FILE);
    return backups[emailLower] || null;
  } catch (err) {
    return memoryBackups[emailLower] || null;
  }
}

// Save Backup Helper
async function saveBackup(email: string, backup: Backup): Promise<boolean> {
  const emailLower = email.toLowerCase().trim();
  if (isKVEnabled()) {
    await runKVCommand(["SET", `backup:${emailLower}`, JSON.stringify(backup)]);
    return true;
  }
  try {
    const backups = readJSONFile(BACKUPS_FILE);
    backups[emailLower] = backup;
    writeJSONFile(BACKUPS_FILE, backups);
    return true;
  } catch (err) {
    console.warn("Read-only filesystem. Saving backup in-memory:", err);
    memoryBackups[emailLower] = backup;
    return true;
  }
}

// API Route: Register
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password diperlukan" });
  }

  const emailLower = email.toLowerCase().trim();
  const existingUser = await getUser(emailLower);

  if (existingUser) {
    return res.status(400).json({ error: "Email sudah terdaftar" });
  }

  // Save user credentials
  await saveUser(emailLower, { password, createdAt: new Date().toISOString() });

  return res.json({ success: true, email: emailLower });
});

// API Route: Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password diperlukan" });
  }

  const emailLower = email.toLowerCase().trim();
  const user = await getUser(emailLower);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Email atau password salah" });
  }

  return res.json({ success: true, email: emailLower });
});

// API Route: Google Auth (Mock/Simulated)
app.post("/api/auth/google", async (req, res) => {
  const { email, name, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk login Google" });
  }

  const emailLower = email.toLowerCase().trim();
  const existingUser = await getUser(emailLower);

  // If user does not exist, register them automatically
  if (!existingUser) {
    await saveUser(emailLower, { 
      password: "google-authenticated-session", 
      createdAt: new Date().toISOString(),
      isGoogleUser: true
    });
  }

  // Create mock backup workspace with profile details if none exists
  const existingBackup = await getBackup(emailLower);
  if (!existingBackup) {
    await saveBackup(emailLower, {
      transactions: [],
      categories: [],
      budgets: [],
      userProfile: {
        name: name || emailLower.split("@")[0],
        avatar: avatar || "",
      },
      syncedAt: new Date().toISOString(),
    });
  }

  return res.json({ success: true, email: emailLower });
});

// API Route: Backup data to cloud
app.post("/api/sync/backup", async (req, res) => {
  const { email, transactions, categories, budgets, userProfile } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });
  }

  const emailLower = email.toLowerCase().trim();
  const syncedAt = new Date().toISOString();

  await saveBackup(emailLower, {
    transactions: transactions || [],
    categories: categories || [],
    budgets: budgets || [],
    userProfile: userProfile || null,
    syncedAt,
  });

  return res.json({ success: true, syncedAt });
});

// API Route: Restore data from cloud
app.post("/api/sync/restore", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });
  }

  const emailLower = email.toLowerCase().trim();
  const backup = await getBackup(emailLower);

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

    // Pre-calculate financial totals for accuracy in Rupiah and USD
    let summaryMeta = "";
    let listString = "Belum ada transaksi tercatat.";

    if (hasTransactions) {
      const incomeList = transactions.filter((t: any) => t.type === "income");
      const expenseList = transactions.filter((t: any) => t.type === "expense");
      
      const totalIncUSD = incomeList.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      const totalExpUSD = expenseList.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      const balanceUSD = totalIncUSD - totalExpUSD;
      
      const totalIncIDR = Math.round(totalIncUSD * 15000);
      const totalExpIDR = Math.round(totalExpUSD * 15000);
      const balanceIDR = totalIncIDR - totalExpIDR;
      
      const balanceStatus = balanceUSD >= 0 ? "SURPLUS" : "DEFISIT";
      
      // Calculate top spending category
      const categoryTotals: Record<string, number> = {};
      expenseList.forEach((t: any) => {
        const cat = t.category || "Lainnya";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
      });
      
      let topCategoryInfo = "Tidak ada pengeluaran";
      if (Object.keys(categoryTotals).length > 0) {
        const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
        const [topCat, topCatUSD] = sortedCategories[0];
        const topCatIDR = Math.round(topCatUSD * 15000);
        topCategoryInfo = `${topCat} dengan total pengeluaran Rp ${topCatIDR.toLocaleString("id-ID")} ($${topCatUSD.toFixed(2)})`;
      }
      
      summaryMeta = `
=== RINGKASAN KEUANGAN PENGGUNA ===
Total Pemasukan: Rp ${totalIncIDR.toLocaleString("id-ID")} ($${totalIncUSD.toFixed(2)})
Total Pengeluaran: Rp ${totalExpIDR.toLocaleString("id-ID")} ($${totalExpUSD.toFixed(2)})
Saldo Bersih (Net Balance): Rp ${balanceIDR.toLocaleString("id-ID")} ($${balanceUSD.toFixed(2)}) [STATUS: ${balanceStatus}]
Kategori Pengeluaran Terbesar: ${topCategoryInfo}
===================================
`;

      listString = transactions
        .map((t: any) => {
          const amountUSD = Number(t.amount) || 0;
          const amountIDR = Math.round(amountUSD * 15000);
          const formattedAmount = `Rp ${amountIDR.toLocaleString("id-ID")} ($${amountUSD.toFixed(2)})`;
          return `- ${t.type === "income" ? "Pemasukan" : "Pengeluaran"} | Jumlah: ${formattedAmount} | Kategori: ${t.category} | Catatan: ${t.note || ""} | Tanggal: ${t.date}`;
        })
        .join("\n");
    }

    let prompt = "";
    let systemInstruction = "";

    if (message) {
      // User is asking a custom question
      prompt = `Berikut adalah data ringkasan dan detail transaksi keuangan pengguna:\n${summaryMeta}\nDetail Transaksi:\n${listString}\n\nPertanyaan Pengguna: "${message}"\n\nBerikan jawaban/saran yang sangat praktis, cerdas, memotivasi, dan ringkas dalam Bahasa Indonesia berdasarkan data keuangan di atas. Jangan menulis salam pembuka atau penutup yang terlalu formal. Langsung berikan jawaban yang padat dan informatif. Sebutkan angka nominal dalam Rupiah secara spesifik jika relevan.`;
      systemInstruction = "Anda adalah penasihat keuangan AI interaktif untuk aplikasi DevFinancial. Berikan saran keuangan cerdas, sopan, memotivasi, ringkas (maksimal 3-4 kalimat) berdasarkan ringkasan keuangan dan data transaksi pengguna serta pertanyaan spesifik mereka dalam Bahasa Indonesia. Selalu gunakan mata uang Rupiah (Rp) dalam saran Anda.";
    } else {
      // General automatic advice
      if (!hasTransactions) {
        return res.json({
          insight: "Belum ada transaksi. Silakan tambah transaksi pengeluaran dan pemasukan untuk melihat analisis AI Anda di sini!",
        });
      }
      prompt = `Berikut adalah ringkasan dan daftar transaksi keuangan pengguna:\n${summaryMeta}\nDetail Transaksi:\n${listString}\n\nBerikan 1 atau 2 kalimat saran/insight keuangan (dalam bahasa Indonesia) yang sangat cerdas, memotivasi, dan spesifik untuk pengguna agar dapat berhemat dan mengelola uang dengan bijak. Tinjau apakah statusnya DEFISIT atau SURPLUS. Jangan menulis intro panjang. Langsung berikan sarannya menggunakan tanda kutip.`;
      systemInstruction = "Anda adalah penasihat keuangan AI cerdas untuk aplikasi DevFinancial. Buat saran transaksi keuangan yang personal, sopan, memotivasi, menarik, dan sangat relevan dengan pola belanja pengguna dalam bahasa Indonesia agar mereka bisa berhemat. Tinjau status keuangan (terutama jika defisit di mana pengeluaran melebihi pemasukan) dan berikan peringatan atau tips yang sesuai dengan nominal Rupiah mereka. Batasi jawaban maksimal 2 kalimat dan letakkan di dalam tanda kutip.";
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
    const { transactions, message } = req.body;
    const hasTxs = Array.isArray(transactions) && transactions.length > 0;

    // Helper to format currency values for output
    const formatValue = (amount: number) => {
      if (amount > 1000) {
        return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
      }
      return `Rp ${Math.round(amount * 15000).toLocaleString("id-ID")}`;
    };

    if (message) {
      const msgLower = message.toLowerCase().trim();
      
      // Check keywords
      if (msgLower.includes("hemat") || msgLower.includes("tips") || msgLower.includes("kurang")) {
        return res.json({
          insight: "Analisis AI: Untuk berhemat minggu ini, fokuslah membatasi pengeluaran non-primer seperti Makanan luar atau Belanja. Cobalah trik 'tunda 24 jam' sebelum membeli barang non-esensial dan sisihkan minimal 10% pendapatan Anda untuk ditabung.",
        });
      }
      if (msgLower.includes("investasi") || msgLower.includes("saham") || msgLower.includes("crypto") || msgLower.includes("reksa")) {
        return res.json({
          insight: "Analisis AI: Memulai investasi sebaiknya menggunakan 'uang dingin'. Mulailah dari instrumen berisiko rendah seperti Reksa Dana Pasar Uang, lalu pelajari investasi Saham bluechip atau CRYPTO utama secara berkala dengan metode dollar-cost averaging (DCA).",
        });
      }
      if (msgLower.includes("belanja") || msgLower.includes("makan") || msgLower.includes("boros")) {
        return res.json({
          insight: "Analisis AI: Pengeluaran makanan dan belanja seringkali menjadi kebocoran halus dalam keuangan. Mulailah mencatat limit harian belanja, rencanakan menu makanan mingguan (*meal prep*), dan bedakan dengan tegas antara kebutuhan vs keinginan.",
        });
      }
      
      // Default query response with dynamic transaction check
      if (hasTxs) {
        const totalExp = transactions.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0);
        return res.json({
          insight: `Analisis AI: Terkait pertanyaan "${message}", saya melihat total pengeluaran tercatat Anda sebesar ${formatValue(totalExp)}. Langkah terbaik saat ini adalah meninjau kembali catatan pengeluaran harian dan menekan anggaran sekunder agar keuangan tetap sehat.`,
        });
      }
      return res.json({
        insight: `Analisis AI: Pertanyaan Anda mengenai "${message}" telah diterima. Untuk memberikan saran yang lebih akurat, silakan tambahkan beberapa transaksi pemasukan atau pengeluaran terlebih dahulu di dashboard Anda.`,
      });
    }

    // Default general advice: analyze transactions dynamically!
    if (hasTxs) {
      const expenses = transactions.filter((t: any) => t.type === "expense");
      const income = transactions.filter((t: any) => t.type === "income");
      const totalExp = expenses.reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalInc = income.reduce((sum: number, t: any) => sum + t.amount, 0);
      
      if (expenses.length === 0) {
        return res.json({
          insight: `"Luar biasa! Belum ada pengeluaran yang tercatat minggu ini. Pertahankan disiplin keuangan Anda dan terus sisihkan pemasukan untuk investasi!"`,
        });
      }

      // Find top spending category
      const categoryTotals: Record<string, number> = {};
      expenses.forEach((t: any) => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });
      const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
      const topCat = topCategoryEntry[0];
      const topCatAmount = topCategoryEntry[1];

      let advice = "";
      if (topCat === "Makanan") {
        advice = `"Pengeluaran untuk Makanan mendominasi pengeluaran Anda sebesar ${formatValue(topCatAmount)}. Cobalah untuk memasak di rumah dan batasi jajan di luar agar hemat bulanan tercapai."`;
      } else if (topCat === "Transport") {
        advice = `"Pengeluaran Transportasi Anda cukup tinggi yaitu sebesar ${formatValue(topCatAmount)}. Pikirkan alternatif transportasi yang lebih ekonomis atau gunakan promo perjalanan."`;
      } else if (topCat === "Belanja") {
        advice = `"Kategori Belanja menjadi pos terbesar Anda dengan pengeluaran ${formatValue(topCatAmount)}. Batasi belanja impulsif dan gunakan prinsip kebutuhan di atas keinginan."`;
      } else if (topCat === "SAHAM" || topCat === "CRYPTO") {
        advice = `"Alokasi investasi di kategori ${topCat} Anda tercatat sebesar ${formatValue(topCatAmount)}. Ini adalah langkah bagus! Ingatlah untuk selalu diversifikasi risiko investasi Anda."`;
      } else {
        advice = `"Pengeluaran pos ${topCat} Anda mencapai ${formatValue(topCatAmount)}. Tinjau kembali kegunaannya dan lakukan penghematan pada pos non-esensial untuk menjaga surplus saldo Anda."`;
      }

      // Deficit warning
      if (totalExp > totalInc && totalInc > 0) {
        advice = `"Peringatan: Total pengeluaran Anda (${formatValue(totalExp)}) melebihi pemasukan Anda (${formatValue(totalInc)}). Segera batasi pos pengeluaran sekunder untuk menghindari defisit saldo!"`;
      }

      return res.json({
        insight: advice,
      });
    }

    // Default advice if no transactions
    return res.json({
      insight: `"Selamat datang di DevFinancial AI! Tambahkan beberapa transaksi pengeluaran atau pemasukan baru agar saya bisa memberikan analisis keuangan yang personal dan akurat untuk Anda."`,
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

if (!process.env.VERCEL) {
  startServer();
}

export default app;
