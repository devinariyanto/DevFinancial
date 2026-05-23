import express from "express";
import { GoogleGenAI } from "@google/genai";

// ============================================================
// STANDALONE VERCEL SERVERLESS API
// This file is completely independent from server.ts
// No vite, no fs, no dotenv — only express + genai
// ============================================================

const app = express();
app.use(express.json());

// --- In-Memory Database (persists within serverless instance lifecycle) ---
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

const memoryUsers: Record<string, User> = {};
const memoryBackups: Record<string, Backup> = {};

// --- Vercel KV helpers (if connected via Upstash) ---
const isKVEnabled = () =>
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function kvRun(cmd: any[]): Promise<any> {
  try {
    const r = await fetch(process.env.KV_REST_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.result;
  } catch {
    return null;
  }
}

async function getUser(email: string): Promise<User | null> {
  if (isKVEnabled()) {
    const r = await kvRun(["GET", `user:${email}`]);
    return r ? JSON.parse(r) : null;
  }
  return memoryUsers[email] || null;
}

async function saveUser(email: string, user: User) {
  if (isKVEnabled()) {
    await kvRun(["SET", `user:${email}`, JSON.stringify(user)]);
  }
  memoryUsers[email] = user;
}

async function getBackup(email: string): Promise<Backup | null> {
  if (isKVEnabled()) {
    const r = await kvRun(["GET", `backup:${email}`]);
    return r ? JSON.parse(r) : null;
  }
  return memoryBackups[email] || null;
}

async function saveBackup(email: string, backup: Backup) {
  if (isKVEnabled()) {
    await kvRun(["SET", `backup:${email}`, JSON.stringify(backup)]);
  }
  memoryBackups[email] = backup;
}

// --- Gemini AI client ---
let aiClient: GoogleGenAI | null = null;
function getGenAI(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  if (customApiKey) {
    return new GoogleGenAI({ apiKey: customApiKey });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// ============================================================
// API ROUTES
// ============================================================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email dan password diperlukan" });

    const e = email.toLowerCase().trim();
    if (await getUser(e))
      return res.status(400).json({ error: "Email sudah terdaftar" });

    await saveUser(e, { password, createdAt: new Date().toISOString() });
    return res.json({ success: true, email: e });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email dan password diperlukan" });

    const e = email.toLowerCase().trim();
    const user = await getUser(e);
    if (!user || user.password !== password)
      return res.status(401).json({ error: "Email atau password salah" });

    return res.json({ success: true, email: e });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Google Auth
app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, name, avatar } = req.body;
    if (!email)
      return res.status(400).json({ error: "Email diperlukan untuk login Google" });

    const e = email.toLowerCase().trim();
    if (!(await getUser(e))) {
      await saveUser(e, {
        password: "google-authenticated-session",
        createdAt: new Date().toISOString(),
        isGoogleUser: true,
      });
    }
    if (!(await getBackup(e))) {
      await saveBackup(e, {
        transactions: [],
        categories: [],
        budgets: [],
        userProfile: { name: name || e.split("@")[0], avatar: avatar || "" },
        syncedAt: new Date().toISOString(),
      });
    }
    return res.json({ success: true, email: e });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Backup
app.post("/api/sync/backup", async (req, res) => {
  try {
    const { email, transactions, categories, budgets, userProfile } = req.body;
    if (!email)
      return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });

    const e = email.toLowerCase().trim();
    const syncedAt = new Date().toISOString();
    await saveBackup(e, {
      transactions: transactions || [],
      categories: categories || [],
      budgets: budgets || [],
      userProfile: userProfile || null,
      syncedAt,
    });
    return res.json({ success: true, syncedAt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Restore
app.post("/api/sync/restore", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ error: "Email diperlukan untuk sinkronisasi" });

    const e = email.toLowerCase().trim();
    const backup = await getBackup(e);
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
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// AI Insight
app.post("/api/insight", async (req, res) => {
  try {
    const { transactions, message } = req.body;
    const customApiKey = req.headers["x-gemini-key"] as string;
    const hasTransactions = Array.isArray(transactions) && transactions.length > 0;

    const ai = getGenAI(customApiKey);

    let summaryMeta = "";
    let listString = "Belum ada transaksi tercatat.";

    if (hasTransactions) {
      const incomeList = transactions.filter((t: any) => t.type === "income");
      const expenseList = transactions.filter((t: any) => t.type === "expense");
      const totalIncUSD = incomeList.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      const totalExpUSD = expenseList.reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
      const balanceUSD = totalIncUSD - totalExpUSD;
      const totalIncIDR = Math.round(totalIncUSD * 15000);
      const totalExpIDR = Math.round(totalExpUSD * 15000);
      const balanceIDR = totalIncIDR - totalExpIDR;
      const balanceStatus = balanceUSD >= 0 ? "SURPLUS" : "DEFISIT";

      const categoryTotals: Record<string, number> = {};
      expenseList.forEach((t: any) => {
        const cat = t.category || "Lainnya";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(t.amount) || 0);
      });
      let topCategoryInfo = "Tidak ada pengeluaran";
      if (Object.keys(categoryTotals).length > 0) {
        const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
        const [topCat, topCatUSD] = sorted[0];
        const topCatIDR = Math.round(topCatUSD * 15000);
        topCategoryInfo = `${topCat} dengan total pengeluaran Rp ${topCatIDR.toLocaleString("id-ID")} ($${topCatUSD.toFixed(2)})`;
      }

      summaryMeta = `\n=== RINGKASAN KEUANGAN PENGGUNA ===\nTotal Pemasukan: Rp ${totalIncIDR.toLocaleString("id-ID")} ($${totalIncUSD.toFixed(2)})\nTotal Pengeluaran: Rp ${totalExpIDR.toLocaleString("id-ID")} ($${totalExpUSD.toFixed(2)})\nSaldo Bersih: Rp ${balanceIDR.toLocaleString("id-ID")} ($${balanceUSD.toFixed(2)}) [STATUS: ${balanceStatus}]\nKategori Pengeluaran Terbesar: ${topCategoryInfo}\n===================================\n`;

      listString = transactions
        .map((t: any) => {
          const usd = Number(t.amount) || 0;
          const idr = Math.round(usd * 15000);
          return `- ${t.type === "income" ? "Pemasukan" : "Pengeluaran"} | Rp ${idr.toLocaleString("id-ID")} ($${usd.toFixed(2)}) | ${t.category} | ${t.note || ""} | ${t.date}`;
        })
        .join("\n");
    }

    let prompt = "";
    let systemInstruction = "";

    if (message) {
      prompt = `Data keuangan pengguna:\n${summaryMeta}\nDetail:\n${listString}\n\nPertanyaan: "${message}"\n\nBerikan jawaban praktis, cerdas, ringkas dalam Bahasa Indonesia. Sebutkan nominal Rupiah jika relevan.`;
      systemInstruction = "Anda adalah penasihat keuangan AI untuk DevFinancial. Jawab dalam Bahasa Indonesia, maksimal 3-4 kalimat. Gunakan mata uang Rupiah.";
    } else {
      if (!hasTransactions) {
        return res.json({ insight: "Belum ada transaksi. Silakan tambah transaksi untuk melihat analisis AI!" });
      }
      prompt = `Ringkasan keuangan:\n${summaryMeta}\nDetail:\n${listString}\n\nBerikan 1-2 kalimat saran keuangan dalam Bahasa Indonesia. Tinjau status DEFISIT/SURPLUS. Langsung berikan sarannya dalam tanda kutip.`;
      systemInstruction = "Anda adalah penasihat keuangan AI cerdas untuk DevFinancial. Buat saran personal, memotivasi dalam Bahasa Indonesia. Tinjau status keuangan dan berikan peringatan/tips sesuai nominal Rupiah. Maksimal 2 kalimat dalam tanda kutip.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { systemInstruction },
    });

    return res.json({ insight: response.text || "Terus pantau pengeluaran Anda!" });
  } catch (error: any) {
    console.error("Gemini Error:", error);

    // Fallback: dynamic simulation
    const { transactions, message } = req.body;
    const hasTxs = Array.isArray(transactions) && transactions.length > 0;
    const fv = (a: number) => (a > 1000 ? `Rp ${Math.round(a).toLocaleString("id-ID")}` : `Rp ${Math.round(a * 15000).toLocaleString("id-ID")}`);

    if (message) {
      if (hasTxs) {
        const totalExp = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
        return res.json({ insight: `Terkait "${message}", total pengeluaran Anda ${fv(totalExp)}. Tinjau kembali anggaran untuk menjaga kesehatan keuangan.` });
      }
      return res.json({ insight: `Pertanyaan "${message}" diterima. Tambahkan transaksi untuk saran lebih akurat.` });
    }

    if (hasTxs) {
      const expenses = transactions.filter((t: any) => t.type === "expense");
      const income = transactions.filter((t: any) => t.type === "income");
      const totalExp = expenses.reduce((s: number, t: any) => s + t.amount, 0);
      const totalInc = income.reduce((s: number, t: any) => s + t.amount, 0);
      if (totalExp > totalInc && totalInc > 0) {
        return res.json({ insight: `"Peringatan: Pengeluaran (${fv(totalExp)}) melebihi pemasukan (${fv(totalInc)}). Segera batasi pengeluaran sekunder!"` });
      }
      if (expenses.length > 0) {
        const catTotals: Record<string, number> = {};
        expenses.forEach((t: any) => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
        const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
        return res.json({ insight: `"Pengeluaran ${top[0]} Anda sebesar ${fv(top[1])}. Tinjau kembali dan hemat pada pos non-esensial."` });
      }
    }

    return res.json({ insight: `"Selamat datang di DevFinancial AI! Tambahkan transaksi untuk analisis keuangan personal."` });
  }
});

export default app;
