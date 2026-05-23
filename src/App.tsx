import React, { useState, useEffect } from "react";
import { Transaction, UserSession, AppState } from "./types";
import { INITIAL_TRANSACTIONS } from "./data";
import { DashboardView } from "./components/DashboardView";
import { AddTransactionModal } from "./components/AddTransactionModal";
import { AuthView } from "./components/AuthView";
import { 
  Trash2, 
  Search, 
  User, 
  TrendingUp
} from "lucide-react";

export default function App() {
  // Primary client states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "activity" | "profile" | "secure">("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");
  
  // Auth state
  const [user, setUser] = useState<UserSession>({
    email: null,
    isLoggedIn: false,
  });

  // AI Insight states
  const [insightText, setInsightText] = useState<string>(
    `"Pengeluaran untuk 'Makanan' minggu ini naik 20%. Pertimbangkan untuk masak di rumah agar tabunganmu tercapai."`
  );
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");

  // Theme & Hide Balance states
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hideBalances, setHideBalances] = useState<boolean>(false);

  // Profile Editor states
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem("devfinancial_gemini_api_key", key);
  };

  const handleToggleHideBalances = () => {
    const nextVal = !hideBalances;
    setHideBalances(nextVal);
    localStorage.setItem("devfinancial_hide_balances", String(nextVal));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        alert("Ukuran gambar terlalu besar! Pilih gambar di bawah 200KB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfileAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    const updatedUser = {
      ...user,
      name: profileName.trim(),
      avatar: profileAvatar,
    };
    setUser(updatedUser);
    localStorage.setItem("devfinancial_user", JSON.stringify(updatedUser));
    await saveTransactionsAndSync(transactions, updatedUser);
    setIsSavingProfile(false);
    setProfileSavedMsg(true);
    setTimeout(() => setProfileSavedMsg(false), 3000);
  };

  // Filter states for Activity Tab
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  // Selection state for batch deletion
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  // Reset selection when tab or filters change
  useEffect(() => {
    setSelectedTxIds([]);
  }, [activeTab, filterType, sortBy, searchTerm]);

  // Load state from local storage on mount
  useEffect(() => {
    const savedTxs = localStorage.getItem("devfinancial_txs") || localStorage.getItem("financely_txs");
    const savedCurrency = localStorage.getItem("devfinancial_currency") || localStorage.getItem("financely_currency");
    const savedUser = localStorage.getItem("devfinancial_user") || localStorage.getItem("financely_user");
    const savedInsight = localStorage.getItem("devfinancial_insight") || localStorage.getItem("financely_insight");

    if (savedTxs) {
      try {
        let parsed: Transaction[] = JSON.parse(savedTxs);
        let migrated = false;
        parsed = parsed.map(tx => {
          const upperCat = (tx.category || "").toUpperCase();
          if (upperCat === "SAHAM IHSG" || upperCat === "SAHAM BLUECHIP" || upperCat === "INVESTASI SAHAM" || tx.category === "saham") {
            migrated = true;
            return { ...tx, category: "SAHAM" };
          }
          if (upperCat === "CRYPTO BLUECHIP" || upperCat === "INVESTASI CRYPTO" || tx.category === "crypto") {
            migrated = true;
            return { ...tx, category: "CRYPTO" };
          }
          return tx;
        });
        setTransactions(parsed);
        if (migrated) {
          localStorage.setItem("devfinancial_txs", JSON.stringify(parsed));
        }
      } catch (err) {
        console.error("Migration error:", err);
        setTransactions(INITIAL_TRANSACTIONS);
      }
    } else {
      // Seed with initial records
      setTransactions(INITIAL_TRANSACTIONS);
      localStorage.setItem("devfinancial_txs", JSON.stringify(INITIAL_TRANSACTIONS));
    }

    if (savedCurrency) {
      setCurrency(savedCurrency as "USD" | "IDR");
    }

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedApiKey = localStorage.getItem("devfinancial_gemini_api_key") || "";
    setGeminiApiKey(savedApiKey);

    const savedTheme = localStorage.getItem("devfinancial_theme") as "light" | "dark";
    const savedHideBalances = localStorage.getItem("devfinancial_hide_balances") === "true";
    if (savedTheme) {
      setTheme(savedTheme);
    }
    setHideBalances(savedHideBalances);

    if (savedInsight) {
      setInsightText(savedInsight);
    } else {
      // Fetch initial AI Insight on mount if has transaction
      triggerAIInsight(savedTxs ? JSON.parse(savedTxs) : INITIAL_TRANSACTIONS, savedApiKey);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("devfinancial_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeTab === "profile") {
      setProfileName(user.name || "");
      setProfileAvatar(user.avatar || "");
      setProfileSavedMsg(false);
    }
  }, [activeTab, user]);

  // Save transactions to local storage and sync with server if logged in
  const saveTransactionsAndSync = async (updatedTxs: Transaction[], updatedUser = user) => {
    setTransactions(updatedTxs);
    localStorage.setItem("devfinancial_txs", JSON.stringify(updatedTxs));

    if (updatedUser.isLoggedIn && updatedUser.email) {
      try {
        await fetch("/api/sync/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: updatedUser.email,
            transactions: updatedTxs,
            userProfile: {
              name: updatedUser.name,
              avatar: updatedUser.avatar,
            },
          }),
        });
        console.log("Successfully backed up state to the server cloud!");
      } catch (err) {
        console.error("Backup failed:", err);
      }
    }
  };

  // Sync data with server upon successful login or registration
  const handleLoginSuccess = async (email: string) => {
    // Try to restore user backup from backend
    try {
      const response = await fetch("/api/sync/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      const restoredUser = {
        email,
        isLoggedIn: true,
        name: data.userProfile?.name || "",
        avatar: data.userProfile?.avatar || "",
      };
      setUser(restoredUser);
      localStorage.setItem("devfinancial_user", JSON.stringify(restoredUser));

      if (data.transactions && data.transactions.length > 0) {
        // If server data exists, prompt backup restore override
        setTransactions(data.transactions);
        localStorage.setItem("devfinancial_txs", JSON.stringify(data.transactions));
        triggerAIInsight(data.transactions);
      } else {
        // New user: Start fresh with empty transactions and 0 balance
        setTransactions([]);
        localStorage.setItem("devfinancial_txs", JSON.stringify([]));
        triggerAIInsight([]);
      }
    } catch (err) {
      console.error("Sync restore failed:", err);
      const updatedUserSession = { email, isLoggedIn: true };
      setUser(updatedUserSession);
      localStorage.setItem("devfinancial_user", JSON.stringify(updatedUserSession));
    }

    // Set view back to dashboard
    setActiveTab("dashboard");
  };

  // Log user session out
  const handleLogout = () => {
    const guestUserSession = { email: null, isLoggedIn: false };
    setUser(guestUserSession);
    localStorage.removeItem("devfinancial_user");
    
    // Revert to default guest demonstration data
    setTransactions(INITIAL_TRANSACTIONS);
    localStorage.setItem("devfinancial_txs", JSON.stringify(INITIAL_TRANSACTIONS));
    triggerAIInsight(INITIAL_TRANSACTIONS);
    
    setActiveTab("dashboard");
  };

  // Generate real AI advice via Express route + Gemini API
  const triggerAIInsight = async (txList: Transaction[], customKey?: string) => {
    if (txList.length === 0) return;
    setIsLoadingInsight(true);

    const apiKey = customKey !== undefined ? customKey : (geminiApiKey || localStorage.getItem("devfinancial_gemini_api_key") || "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["x-gemini-key"] = apiKey;
    }

    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers,
        body: JSON.stringify({ transactions: txList }),
      });
      const data = await response.json();
      if (data.insight) {
        setInsightText(data.insight);
        localStorage.setItem("devfinancial_insight", data.insight);
      }
    } catch (err) {
      console.error("Failed to generate real AI insights:", err);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  // Generate custom AI advice via Express route + Gemini API
  const triggerCustomAIQuery = async (query: string) => {
    setIsLoadingInsight(true);
    const apiKey = geminiApiKey || localStorage.getItem("devfinancial_gemini_api_key") || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["x-gemini-key"] = apiKey;
    }
    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          transactions: transactions,
          message: query
        }),
      });
      const data = await response.json();
      if (data.insight) {
        setInsightText(data.insight);
      }
    } catch (err) {
      console.error("Failed to generate custom AI advice:", err);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  // Add Transaction operation
  const handleAddTransaction = (newTx: Omit<Transaction, "id">) => {
    const fullTx: Transaction = {
      ...newTx,
      id: "tx-" + Date.now(),
    };

    const updatedTxs = [fullTx, ...transactions];
    saveTransactionsAndSync(updatedTxs);
    setIsModalOpen(false);

    // Refresh AI insight on adding transaction automatically
    triggerAIInsight(updatedTxs);
  };

  // Delete Transaction operation
  const handleDeleteTransaction = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
      const updatedTxs = transactions.filter((tx) => tx.id !== id);
      saveTransactionsAndSync(updatedTxs);
      triggerAIInsight(updatedTxs);
    }
  };

  // Delete Selected transactions
  const handleDeleteSelected = () => {
    if (confirm(`Apakah Anda yakin ingin menghapus ${selectedTxIds.length} transaksi yang dipilih?`)) {
      const updatedTxs = transactions.filter((tx) => !selectedTxIds.includes(tx.id));
      saveTransactionsAndSync(updatedTxs);
      triggerAIInsight(updatedTxs);
      setSelectedTxIds([]);
    }
  };

  // Delete All transactions
  const handleDeleteAll = () => {
    if (confirm("Apakah Anda yakin ingin menghapus SELURUH transaksi? Tindakan ini tidak dapat dibatalkan.")) {
      saveTransactionsAndSync([]);
      triggerAIInsight([]);
      setSelectedTxIds([]);
    }
  };

  // Download transaction summary in CSV format
  const handleDownloadCSV = () => {
    if (transactions.length === 0) {
      alert("Tidak ada transaksi untuk diunduh!");
      return;
    }

    const headers = ["Tanggal", "Tipe", "Kategori", "Nominal (USD)", "Nominal (IDR)", "Catatan"];
    const rows = transactions.map((tx) => {
      const isInc = tx.type === "income";
      const amountUSD = tx.amount.toFixed(2);
      const amountIDR = Math.round(tx.amount * 15000);
      return [
        tx.date,
        isInc ? "Pemasukan" : "Pengeluaran",
        tx.category,
        `$${amountUSD}`,
        `Rp ${amountIDR}`,
        `"${(tx.note || "").replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map((row) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rekapan_transaksi_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle currencies USD / IDR
  const handleCurrencyToggle = () => {
    const nextCurr = currency === "USD" ? "IDR" : "USD";
    setCurrency(nextCurr);
    localStorage.setItem("devfinancial_currency", nextCurr);
  };

  // Filtering list logic for Activity screen
  const filteredTxs = transactions
    .filter((tx) => {
      const matchesSearch =
        tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.note && tx.note.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType =
        filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === "oldest") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === "highest") {
        return b.amount - a.amount;
      } else {
        return a.amount - b.amount;
      }
    });

  const currencyValue = (amount: number) => {
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    } else {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount * 15000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-slate-800 dark:bg-[#0b0f19] dark:text-slate-100 flex flex-col font-sans relative pb-20 md:pb-6 transition-colors duration-300" id="app-root-viewport">
      
      {/* Top App Bar Header following design system mockup */}
      <header className="bg-white/85 dark:bg-[#111827]/85 backdrop-blur-md border-b border-slate-100 dark:border-gray-800/80 flex justify-between items-center px-4 md:px-8 w-full h-16 sticky top-0 z-40 shadow-xs" id="app-top-header">
        <div 
          onClick={() => setActiveTab("dashboard")}
          className="flex items-center gap-2 select-none cursor-pointer group"
          id="header-brand-logo"
        >
          <span className="material-symbols-outlined text-[#006c49] dark:text-[#10b981] text-[28px] group-hover:scale-105 transition-transform">account_balance_wallet</span>
          <span className="font-bold text-lg md:text-xl text-[#006c49] dark:text-[#10b981] tracking-tight">DevFinancial</span>
        </div>

        {/* Global Desktop Side Navigation inside top header to reduce clutter */}
        <div className="hidden md:flex items-center gap-6" id="desktop-routing-links">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`cursor-pointer text-xs font-bold tracking-wider py-1 border-b-2 transition-all ${
              activeTab === "dashboard" ? "text-[#006c49] dark:text-[#10b981] border-[#006c49] dark:border-[#10b981]" : "text-slate-400 dark:text-gray-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("activity")}
            className={`cursor-pointer text-xs font-bold tracking-wider py-1 border-b-2 transition-all ${
              activeTab === "activity" ? "text-[#006c49] dark:text-[#10b981] border-[#006c49] dark:border-[#10b981]" : "text-slate-400 dark:text-gray-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Activity
          </button>
          <button 
            onClick={() => setActiveTab("profile")}
            className={`cursor-pointer text-xs font-bold tracking-wider py-1 border-b-2 transition-all ${
              activeTab === "profile" ? "text-[#006c49] dark:text-[#10b981] border-[#006c49] dark:border-[#10b981]" : "text-slate-400 dark:text-gray-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Profile
          </button>
        </div>

        {/* Header Right Action: Secure Sync tab router */}
        <button 
          onClick={() => setActiveTab("secure")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer active:scale-95 transition-all outline-hidden ${
            user.isLoggedIn 
              ? "bg-emerald-50 text-[#006c49] dark:bg-emerald-950/20 dark:text-[#10b981] hover:bg-emerald-100 dark:hover:bg-emerald-950/30" 
              : "bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-slate-200 dark:hover:bg-gray-600"
          }`}
          id="btn-header-secure"
        >
          <span>{user.isLoggedIn ? "Data Teramankan" : "Secure Data"}</span>
          <span className="material-symbols-outlined text-[15px]">{user.isLoggedIn ? "cloud_done" : "lock"}</span>
        </button>
      </header>

      {/* Main View routers */}
      <main className="flex-1 w-full" id="view-router-render">
        {activeTab === "dashboard" && (
          <DashboardView
            transactions={transactions}
            onAddClick={() => setIsModalOpen(true)}
            insightText={insightText}
            isLoadingInsight={isLoadingInsight}
            onRefreshInsight={() => triggerAIInsight(transactions)}
            currency={currency}
            onCurrencyToggle={handleCurrencyToggle}
            onNavigate={setActiveTab}
            isLoggedIn={user.isLoggedIn}
            userEmail={user.email}
            onDownloadCSV={handleDownloadCSV}
            onCustomQuery={triggerCustomAIQuery}
            geminiApiKey={geminiApiKey}
            onSaveApiKey={handleSaveApiKey}
            theme={theme}
            onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
            hideBalances={hideBalances}
            onToggleHideBalances={handleToggleHideBalances}
            userName={user.name || ""}
            userAvatar={user.avatar || ""}
          />
        )}

        {/* Activity Tab: interactive search, filter, sort and deletion */}
        {activeTab === "activity" && (
          <div className="w-full max-w-4xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in" id="activity-tab-main">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Riwayat Transaksi</h1>
              <p className="text-xs text-slate-500 dark:text-gray-400">Kelola, cari, dan pantau seluruh transaksi keuangan Anda di sini.</p>
            </div>

            {/* Filter Card */}
            <div className="bg-white dark:bg-gray-800 rounded-[24px] p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 flex flex-col gap-4" id="filters-panel">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search box */}
                <div className="relative flex items-center md:col-span-6">
                  <Search className="absolute left-4 text-slate-400 dark:text-gray-500" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari transaksi berdasarkan catatan atau kategori..."
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white text-sm font-medium rounded-xl pl-11 pr-4 py-3 border border-slate-100 dark:border-gray-800 focus:outline-hidden focus:border-[#006c49] dark:focus:border-[#10b981] focus:bg-white dark:focus:bg-gray-900 transition-all text-ellipsis"
                  />
                </div>

                {/* Filter Type */}
                <div className="md:col-span-3">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-700 dark:text-gray-200 text-sm font-bold rounded-xl px-4 py-3 border border-slate-100 dark:border-gray-800 focus:outline-hidden dark:focus:border-[#10b981] transition-all text-ellipsis cursor-pointer"
                  >
                    <option value="all">Semua Tipe</option>
                    <option value="income">Pemasukan (+)</option>
                    <option value="expense">Pengeluaran (-)</option>
                  </select>
                </div>

                {/* Sort selector */}
                <div className="md:col-span-3">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-700 dark:text-gray-200 text-sm font-bold rounded-xl px-4 py-3 border border-slate-100 dark:border-gray-800 focus:outline-hidden dark:focus:border-[#10b981] transition-all text-ellipsis cursor-pointer"
                  >
                    <option value="newest">Terbaru</option>
                    <option value="oldest">Terlama</option>
                    <option value="highest">Nominal Terbesar</option>
                    <option value="lowest">Nominal Terkecil</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Batch Actions & Selection Bar */}
            {filteredTxs.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-gray-700/50" id="batch-actions-panel">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    id="select-all-checkbox"
                    checked={filteredTxs.length > 0 && selectedTxIds.length === filteredTxs.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTxIds(filteredTxs.map(tx => tx.id));
                      } else {
                        setSelectedTxIds([]);
                      }
                    }}
                    className="w-4.5 h-4.5 accent-[#006c49] dark:accent-[#10b981] border-slate-300 dark:border-gray-600 rounded-sm focus:ring-[#006c49] cursor-pointer"
                  />
                  <label htmlFor="select-all-checkbox" className="text-xs font-bold text-slate-500 dark:text-gray-400 cursor-pointer select-none">
                    Pilih Semua ({filteredTxs.length} transaksi terfilter)
                  </label>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {selectedTxIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-bold transition-all cursor-pointer"
                      id="btn-delete-selected"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Terpilih ({selectedTxIds.length})</span>
                    </button>
                  )}
                  
                  {transactions.length > 0 && (
                    <>
                      <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#006c49] dark:text-[#10b981] hover:bg-[#d5eedc] dark:hover:bg-emerald-950/30 text-xs font-bold transition-all cursor-pointer"
                        id="btn-download-activity"
                      >
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        <span>Unduh Rekapan</span>
                      </button>

                      <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-gray-700 text-slate-500 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 text-xs font-bold transition-all cursor-pointer"
                        id="btn-delete-all"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                        <span>Hapus Semua</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Transaction list output */}
            <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50" id="activity-list-card">
              <div className="flex flex-col" id="activity-tx-rows">
                {filteredTxs.map((tx) => {
                  const isInc = tx.type === "income";
                  const isSelected = selectedTxIds.includes(tx.id);
                  return (
                    <div 
                      key={tx.id}
                      className={`flex items-center justify-between py-4 border-b border-slate-100 dark:border-gray-700 last:border-0 hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors rounded-xl px-2 -mx-2 group/row ${isSelected ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''}`}
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Row selection checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTxIds([...selectedTxIds, tx.id]);
                            } else {
                              setSelectedTxIds(selectedTxIds.filter(id => id !== tx.id));
                            }
                          }}
                          className="w-4 h-4 accent-[#006c49] dark:accent-[#10b981] border-slate-300 dark:border-gray-600 rounded-sm focus:ring-[#006c49] cursor-pointer"
                        />

                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          tx.category === "Gaji" ? "bg-emerald-50 text-emerald-500" :
                          tx.category === "Makanan" ? "bg-red-50 text-red-500" :
                          tx.category === "Transport" ? "bg-blue-50 text-blue-500" :
                          tx.category === "SAHAM" ? "bg-blue-50 text-blue-600" :
                          tx.category === "CRYPTO" ? "bg-amber-50 text-amber-600" :
                          "bg-slate-50 text-slate-500"
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {tx.category === "Gaji" ? "payments" :
                             tx.category === "Makanan" ? "restaurant" :
                             tx.category === "Transport" ? "directions_car" :
                             tx.category === "SAHAM" ? "show_chart" :
                             tx.category === "CRYPTO" ? "currency_bitcoin" :
                             "shopping_bag"}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            {tx.category}
                            {tx.note && <span className="text-[11px] font-medium text-slate-400 dark:text-gray-400 px-1.5 py-0.5 bg-slate-100 dark:bg-gray-700 rounded-sm italic">{tx.note}</span>}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-gray-400 font-medium">
                            {tx.date} • {isInc ? "Pemasukan" : "Pengeluaran"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-bold font-mono ${isInc ? "text-[#10b981]" : "text-slate-700 dark:text-slate-300"}`}>
                          {isInc ? "+" : "-"}{hideBalances ? "••••" : currencyValue(tx.amount)}
                        </span>
                        
                        {/* Delete trigger */}
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="text-slate-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer"
                          title="Hapus transaksi"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredTxs.length === 0 && (
                  <div className="text-center py-12 text-slate-400 dark:text-gray-500 font-medium select-none flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-gray-600">search_off</span>
                    <span>Tidak ada transaksi yang cocok dengan kriteria pencarian Anda.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="w-full max-w-2xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-6 animate-in fade-in" id="profile-tab-main">
            <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 flex flex-col items-center text-center gap-4 relative overflow-hidden" id="profile-card">
              {/* Profile Background header */}
              <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-emerald-600 to-[#10b981] opacity-90 select-none"></div>
              
              {/* Profile Avatar */}
              <div className="w-20 h-20 bg-slate-100 dark:bg-gray-700 rounded-full border-4 border-white dark:border-gray-800 flex items-center justify-center relative mt-12 z-10 shadow-sm overflow-hidden">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-[#006c49] dark:text-[#10b981]" />
                )}
              </div>

              <div className="z-10 mt-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {user.name || (user.isLoggedIn ? user.email?.split("@")[0] : "Tamu Tersayang")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {user.isLoggedIn ? user.email : "Mode Tamu Offline"}
                </p>
              </div>

              {/* Grid statistics elements */}
              <div className="grid grid-cols-2 gap-4 w-full mt-4 p-4 bg-slate-50 dark:bg-gray-900/50 rounded-2xl border border-slate-100 dark:border-gray-700/80" id="profile-stats">
                <div className="text-center py-2 border-r border-slate-200 dark:border-gray-700">
                  <div className="text-xs text-slate-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Transaksi Anda</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-white">{transactions.length}</div>
                </div>
                <div className="text-center py-2">
                  <div className="text-xs text-slate-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-1">Backup Cloud</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1">
                    {user.isLoggedIn ? (
                      <span className="text-[#10b981] flex items-center gap-1.5 text-sm font-bold">
                        <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                        Aktif
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-gray-500 text-sm font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">cloud_off</span>
                        Mati
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Editor Form */}
              <div className="w-full border-t border-slate-100 dark:border-gray-700/55 pt-5 mt-3 flex flex-col gap-4 text-left">
                <h3 className="text-xs font-bold text-slate-400 dark:text-gray-400 uppercase tracking-widest">Edit Profil</h3>
                
                {/* Edit Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-gray-300">Nama Pengguna</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Masukkan nama Anda..."
                    className="w-full bg-slate-50 dark:bg-gray-900/60 text-slate-800 dark:text-white text-sm font-semibold rounded-xl px-4 py-3 border border-slate-200 dark:border-gray-700/50 focus:outline-hidden focus:border-[#006c49] dark:focus:border-[#10b981] focus:bg-white dark:focus:bg-gray-900 transition-all"
                  />
                </div>

                {/* Edit Avatar */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-gray-300">Foto Profil</label>
                  <div className="flex gap-2 flex-wrap items-center">
                    {["#006c49", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"].map((color) => {
                      // Initials Avatar data URL
                      const avatarSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${encodeURIComponent(color)}"/><text x="50%" y="60%" font-size="50" font-family="system-ui, sans-serif" font-weight="bold" fill="white" text-anchor="middle">${encodeURIComponent(profileName ? profileName.slice(0, 2).toUpperCase() : "DF")}</text></svg>`;
                      const isSelected = profileAvatar === avatarSvg;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setProfileAvatar(avatarSvg)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                            isSelected ? "border-[#10b981] scale-110 shadow-xs" : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                          title={`Avatar Warna ${color}`}
                        >
                          <span className="text-white text-xs font-bold">{profileName ? profileName.slice(0, 2).toUpperCase() : "DF"}</span>
                        </button>
                      );
                    })}

                    <label className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 dark:border-gray-600 hover:border-[#10b981] dark:hover:border-[#10b981] flex items-center justify-center cursor-pointer transition-colors relative" title="Unggah Foto Kustom">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <span className="material-symbols-outlined text-slate-400 dark:text-gray-500 hover:text-[#10b981] dark:hover:text-[#10b981] text-[20px]">add_a_photo</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="w-full mt-2 bg-[#006c49] hover:bg-[#005236] text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-md shadow-emerald-900/10 disabled:opacity-50"
                >
                  <span>{isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>

                {profileSavedMsg && (
                  <p className="text-center w-full text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 animate-pulse">
                    Profil berhasil diperbarui dan disinkronkan ke Cloud!
                  </p>
                )}
              </div>

              {/* Setup credentials */}
              {!user.isLoggedIn && (
                <div className="w-full mt-4" id="profile-auth-prompt">
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-3 font-medium">Mulai sinkronisasi data Anda ke cloud agar tidak hilang saat membersihkan cache.</p>
                  <button
                    onClick={() => setActiveTab("secure")}
                    className="w-full bg-[#006c49] hover:bg-[#005236] text-white py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-md shadow-emerald-900/10"
                  >
                    <span className="material-symbols-outlined text-[18px]">cloud_sync</span>
                    <span>Amankan Ke Cloud</span>
                  </button>
                </div>
              )}

              {/* Contact Developer Card section */}
              <div className="w-full border-t border-slate-100 dark:border-gray-700/50 pt-5 mt-3 flex flex-col items-center gap-2" id="profile-contact-section">
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Hubungi Pengembang</span>
                <a 
                  href="https://instagram.com/devinmaulana234" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-gray-700 hover:bg-[#e6f4ea] hover:text-[#006c49] dark:hover:bg-emerald-950/20 dark:hover:text-[#10b981] text-slate-700 dark:text-gray-300 text-xs font-bold transition-all border border-slate-100/50 dark:border-gray-700/50 active:scale-95 cursor-pointer"
                >
                  <span>@devinmaulana234</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Secure Cloud login router */}
        {activeTab === "secure" && (
          <AuthView
            user={user}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onContinueAsGuest={() => setActiveTab("dashboard")}
          />
        )}
      </main>

      {/* Primary Float Action Button (FAB) + to trigger insert modal immediately */}
      {activeTab === "dashboard" && (
        <button 
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-20 md:bottom-8 right-5 md:right-8 w-14 h-14 bg-[#10b981] text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 duration-150 transition-all cursor-pointer z-40 outline-hidden hover:bg-[#0ea5e9]"
          id="btn-fab-add"
          aria-label="Add transaction"
          title="Tambah Transaksi Baru"
        >
          <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: "'wght' 500" }}>add</span>
        </button>
      )}

      {/* Global Interactive Bottom Nav Bar (Mobile viewport lock) */}
      <nav className="md:hidden bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 shadow-md bottom-0 rounded-t-2xl fixed bottom-0 w-full z-45 flex justify-around items-center px-4 py-3 pb-safe" id="mobile-nav-bar">
        {/* Dashboard Tab router */}
        <button 
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center text-xs font-semibold py-1 px-4 rounded-full transition-all cursor-pointer ${
            activeTab === "dashboard" 
              ? "bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#006c49] dark:text-[#10b981]" 
              : "text-slate-400 dark:text-gray-555 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="material-symbols-outlined select-none text-[22px] font-variation-settings-'FILL'-1">grid_view</span>
        </button>

        {/* Action Activity tab router */}
        <button 
          onClick={() => setActiveTab("activity")}
          className={`flex flex-col items-center justify-center text-xs font-semibold py-1 px-4 rounded-full transition-all cursor-pointer ${
            activeTab === "activity" 
              ? "bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#006c49] dark:text-[#10b981]" 
              : "text-slate-400 dark:text-gray-555 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="material-symbols-outlined select-none text-[22px]">receipt_long</span>
        </button>

        {/* Profile tab router */}
        <button 
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center justify-center text-xs font-semibold py-1 px-4 rounded-full transition-all cursor-pointer ${
            activeTab === "profile" 
              ? "bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#006c49] dark:text-[#10b981]" 
              : "text-slate-400 dark:text-gray-555 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <span className="material-symbols-outlined select-none text-[22px]">person</span>
        </button>
      </nav>

      {/* Modal overlay window */}
      {isModalOpen && (
        <AddTransactionModal
          onClose={() => setIsModalOpen(false)}
          onSave={handleAddTransaction}
          currency={currency}
        />
      )}

      {/* App Footer */}
      <footer className="w-full bg-white dark:bg-[#111827] border-t border-slate-100 dark:border-gray-800 py-6 text-center text-xs text-slate-400 dark:text-gray-500 mt-auto flex flex-col items-center gap-2" id="app-footer">
        <div>© {new Date().getFullYear()} DevFinancial. All rights reserved.</div>
        <div className="flex items-center gap-1.5 font-semibold text-[#006c49] dark:text-[#10b981]">
          <span>Developed by:</span>
          <a 
            href="https://instagram.com/devinmaulana234" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center hover:underline hover:text-[#10b981] transition-colors"
          >
            @devinmaulana234
          </a>
        </div>
      </footer>
    </div>
  );
}
