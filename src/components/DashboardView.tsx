import React from "react";
import { Transaction, Category, ChatMessage } from "../types";
import { DEFAULT_CATEGORIES } from "../data";
import { TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight, Bot, RotateCw, Wallet, ShieldAlert, Repeat } from "lucide-react";

interface DashboardViewProps {
  transactions: Transaction[];
  onAddClick: () => void;
  insightText: string;
  isLoadingInsight: boolean;
  onRefreshInsight: () => void;
  currency: "USD" | "IDR";
  onCurrencyToggle: () => void;
  onNavigate: (tab: "dashboard" | "activity" | "profile" | "secure") => void;
  isLoggedIn: boolean;
  userEmail: string | null;
  onDownloadCSV: () => void;
  onCustomQuery: (query: string) => void;
  geminiApiKey: string;
  onSaveApiKey: (key: string) => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  hideBalances: boolean;
  onToggleHideBalances: () => void;
  userName: string;
  userAvatar: string;
  chatHistory: ChatMessage[];
  onClearChat: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  onAddClick,
  insightText,
  isLoadingInsight,
  onRefreshInsight,
  currency,
  onCurrencyToggle,
  onNavigate,
  isLoggedIn,
  userEmail,
  onDownloadCSV,
  onCustomQuery,
  geminiApiKey,
  onSaveApiKey,
  theme,
  onThemeToggle,
  hideBalances,
  onToggleHideBalances,
  userName,
  userAvatar,
  chatHistory,
  onClearChat,
}) => {
  const [chatInput, setChatInput] = React.useState("");
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoadingInsight) return;
    onCustomQuery(chatInput.trim());
    setChatInput("");
  };

  const handleChipClick = (query: string) => {
    if (isLoadingInsight) return;
    onCustomQuery(query);
  };

  // Get 5 points for sparkline based on transactions running balance
  const getSparklineHeights = () => {
    if (transactions.length === 0) {
      return [20, 40, 30, 70, 100]; // default layout heights if empty
    }
    
    const sortedTxs = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    let running = 0;
    const runningBalances = sortedTxs.map((t) => {
      if (t.type === "income") {
        running += t.amount;
      } else {
        running -= t.amount;
      }
      return running;
    });

    const k = runningBalances.length;
    let points: number[] = [];
    if (k < 5) {
      // Pad with 0s or initial values
      const padCount = 5 - k;
      for (let i = 0; i < padCount; i++) {
        points.push(0);
      }
      points.push(...runningBalances);
    } else {
      for (let i = 0; i < 5; i++) {
        const idx = Math.floor((i / 4) * (k - 1));
        points.push(runningBalances[idx]);
      }
    }

    const minVal = Math.min(...points);
    const maxVal = Math.max(...points);
    const range = maxVal - minVal;

    return points.map((val) => {
      if (range === 0) {
        return val > 0 ? 100 : 30; // flat height
      }
      return Math.round(((val - minVal) / range) * 80 + 20); // 20% to 100%
    });
  };

  const sparklineHeights = getSparklineHeights();
  // Format Currencies
  const formatValue = (amount: number) => {
    if (currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    } else {
      // Scale USD unit to IDR like 15,000 for realistic Rp feel, or format directly
      const scaled = amount * 15000;
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(scaled);
    }
  };

  // Compute totals directly from the transactions array
  const currentIncomeSum = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const currentExpenseSum = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = currentIncomeSum - currentExpenseSum;

  // Category summary for Donut Chart
  const categoryTotals: { [key: string]: number } = {};
  DEFAULT_CATEGORIES.forEach((c) => {
    categoryTotals[c.name] = 0;
  });

  // Accrue standard types
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      // Normalize category mapping just in case of case mismatches
      const catName = t.category.toUpperCase() === "SAHAM" ? "SAHAM" 
                    : t.category.toUpperCase() === "CRYPTO" ? "CRYPTO"
                    : t.category;
      categoryTotals[catName] = (categoryTotals[catName] || 0) + t.amount;
    });

  const totalExpenseSum = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

  // Group active expenses
  const activeExpenses = Object.entries(categoryTotals)
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  const hasExpenses = activeExpenses.length > 0;

  // Map of premium colors matching the aesthetic
  const categoryColorMap: { [key: string]: { hex: string, tw: string } } = {
    "Makanan": { hex: "#ef4444", tw: "bg-red-500" },
    "Transport": { hex: "#3b82f6", tw: "bg-blue-500" },
    "Belanja": { hex: "#f59e0b", tw: "bg-amber-500" },
    "Hiburan": { hex: "#8b5cf6", tw: "bg-purple-500" },
    "Tagihan": { hex: "#f97316", tw: "bg-orange-500" },
    "Kesehatan": { hex: "#14b8a6", tw: "bg-teal-500" },
    "SAHAM": { hex: "#006c49", tw: "bg-[#006c49]" }, // Premium forest/emerald green for investment
    "CRYPTO": { hex: "#d97706", tw: "bg-amber-600" },
    "Lainnya": { hex: "#64748b", tw: "bg-slate-500" },
  };

  const defaultColor = { hex: "#64748b", tw: "bg-slate-500" };

  let accumPercent = 0;
  const gradientSlices = activeExpenses.map(([name, amount]) => {
    const pct = totalExpenseSum > 0 ? (amount / totalExpenseSum) * 100 : 0;
    const color = categoryColorMap[name] || defaultColor;
    const start = accumPercent;
    accumPercent += pct;
    const end = accumPercent;
    return {
      name,
      amount,
      pct: Math.round(pct),
      color,
      start,
      end
    };
  });

  // Build conic-gradient background
  let conicGradientString = "#f1f5f9";
  if (hasExpenses) {
    conicGradientString = "conic-gradient(" + gradientSlices.map(slice => {
      return `${slice.color.hex} ${slice.start}% ${slice.end}%`;
    }).join(", ") + ")";
  }

  const conicGradientStyle = {
    background: conicGradientString,
  };

  const totalExpenseText = currency === "USD" 
    ? `$${currentExpenseSum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
    : `Rp ${Math.round(currentExpenseSum * 15000).toLocaleString("id-ID")}`;

  // Dynamic font size depending on text length to prevent wrapping / breaking
  let fontSizeClass = "text-[18px]";
  if (totalExpenseText.length > 14) {
    fontSizeClass = "text-[12px]";
  } else if (totalExpenseText.length > 11) {
    fontSizeClass = "text-[14px]";
  } else if (totalExpenseText.length > 8) {
    fontSizeClass = "text-[16px]";
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-6" id="dashboard-container">
      
      {/* User Profile Header Card & Theme Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-[28px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-[#10b981] overflow-hidden shrink-0 flex items-center justify-center bg-slate-100 dark:bg-gray-700 shadow-xs">
            {userAvatar ? (
              <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[#006c49] dark:text-[#10b981] text-[28px]">person</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              Halo, {userName || (userEmail ? userEmail.split("@")[0] : "Tamu")}!
            </h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-gray-400">
              {userEmail ? `${userEmail} • Sesi Cloud Aktif` : "Mode Tamu Offline • Data disimpan lokal"}
            </p>
          </div>
        </div>
        
        {/* Mode Terang / Gelap Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={onThemeToggle}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-600 rounded-full px-4 py-2 text-xs font-bold select-none transition-all cursor-pointer active:scale-95 shadow-xs"
            title="Ganti Mode Tampilan"
          >
            <span className="material-symbols-outlined text-[16px]">
              {theme === "light" ? "dark_mode" : "light_mode"}
            </span>
            <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>
        </div>
      </div>

      {/* Dynamic top info / Sync State banner */}
      {isLoggedIn && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-[#006c49] dark:text-[#10b981] border border-emerald-100 dark:border-emerald-900/30 rounded-2xl px-4 py-3 text-sm font-medium animate-in fade-in transition-all">
          <span className="material-symbols-outlined text-[18px]">cloud_done</span>
          <span>Akun aktif: <strong>{userEmail}</strong> • Data Anda tersinkronisasi dengan aman di Cloud!</span>
        </div>
      )}

      {/* Bento Layout Row */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-6" id="summary-section">
        {/* Total Balance Card (Large 8 cols on desktop) */}
        <div className="bg-white dark:bg-gray-800 rounded-[24px] p-6 md:col-span-8 flex flex-col justify-between shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 hover:border-[#10b981]/25 hover:shadow-md transition-all group relative overflow-hidden" id="card-total-balance">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-sm font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>Total Balance</span>
                  <button
                    onClick={onToggleHideBalances}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-center"
                    title={hideBalances ? "Tampilkan Saldo" : "Sembunyikan Saldo"}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {hideBalances ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </h2>
                <div className="text-3xl md:text-4xl font-bold font-sans text-slate-900 dark:text-white tracking-tight leading-none" id="balance-amount">
                  {hideBalances ? "••••••" : formatValue(totalBalance)}
                </div>
              </div>
              
              {/* Currency Toggle Switcher */}
              <button 
                onClick={onCurrencyToggle}
                className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 dark:bg-gray-700 dark:hover:bg-gray-600 border border-slate-100 dark:border-gray-600 text-slate-600 dark:text-gray-300 rounded-full px-3 py-1.5 text-xs font-semibold select-none transition-all cursor-pointer active:scale-95"
                title="Ganti mata uang"
              >
                <span className="material-symbols-outlined text-[14px]">payments</span>
                {currency === "USD" ? "USD ($)" : "IDR (Rp)"}
              </button>
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between">
            {totalBalance >= 0 ? (
              <div className="inline-flex items-center gap-1 bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#10b981] dark:text-[#10b981] px-3.5 py-1.5 rounded-full text-xs font-semibold">
                <TrendingUp size={14} className="stroke-[2.5]" />
                <span>Surplus {currentIncomeSum > 0 ? Math.round((totalBalance / currentIncomeSum) * 100) : 0}%</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-red-500 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                <TrendingDown size={14} className="stroke-[2.5]" />
                <span>Defisit {currentExpenseSum > 0 ? Math.round((Math.abs(totalBalance) / currentExpenseSum) * 100) : 0}%</span>
              </div>
            )}

            {/* Sparkline Indicator visually resembling the screenshot specs */}
            <div className="w-36 h-12 flex items-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
              {sparklineHeights.map((h, i) => (
                <div 
                  key={i} 
                  className={`w-1/5 rounded-t-md transition-all duration-300 ${
                    i === 4 ? (totalBalance >= 0 ? "bg-[#10b981]" : "bg-red-500") : "bg-slate-100 dark:bg-gray-700"
                  }`} 
                  style={{ height: `${h}%`, minHeight: "4px" }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Income & Expense Column (4 cols on desktop) */}
        <div className="flex flex-col gap-4 md:col-span-4" id="monthly-stats-group">
          {/* Monthly Income Card */}
          <div className="bg-white dark:bg-gray-800 rounded-[24px] p-5 flex flex-col justify-center shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 hover:border-slate-200 dark:hover:border-gray-600 transition-all" id="card-income">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e6f4ea] dark:bg-emerald-950/20 text-[#10b981] flex items-center justify-center">
                <ArrowUpRight size={18} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Monthly Income</h3>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{hideBalances ? "••••" : formatValue(currentIncomeSum)}</div>
              </div>
            </div>
          </div>

          {/* Monthly Expense Card */}
          <div className="bg-white dark:bg-gray-800 rounded-[24px] p-5 flex flex-col justify-center shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 hover:border-slate-200 dark:hover:border-gray-600 transition-all" id="card-expense">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center">
                <ArrowDownRight size={18} />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Monthly Expense</h3>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{hideBalances ? "••••" : formatValue(currentExpenseSum)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Health Score Section */}
      {(() => {
        // Calculate Financial Health Score (0-100)
        const savingsRatio = currentIncomeSum > 0
          ? Math.max(0, Math.min(100, ((currentIncomeSum - currentExpenseSum) / currentIncomeSum) * 100))
          : 0;

        // Consistency: count unique days with transactions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentTxs = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
        const uniqueDays = new Set(recentTxs.map(t => t.date)).size;
        const consistencyScore = Math.min(100, (uniqueDays / 10) * 100); // 10+ days = 100%

        // Diversification: penalize if one expense category > 60% of total
        let diversificationScore = 100;
        if (activeExpenses.length > 0 && totalExpenseSum > 0) {
          const topCatPct = (activeExpenses[0][1] / totalExpenseSum) * 100;
          if (topCatPct > 80) diversificationScore = 20;
          else if (topCatPct > 60) diversificationScore = 50;
          else if (topCatPct > 40) diversificationScore = 75;
          else diversificationScore = 100;
        }

        const healthScore = transactions.length === 0 ? 0 : Math.round(
          savingsRatio * 0.4 + consistencyScore * 0.3 + diversificationScore * 0.3
        );

        const scoreColor = healthScore >= 70 ? "#10b981" : healthScore >= 40 ? "#f59e0b" : "#ef4444";
        const scoreLabel = healthScore >= 70 ? "Sehat" : healthScore >= 40 ? "Perlu Perhatian" : "Kritis";
        const scoreEmoji = healthScore >= 70 ? "🏆" : healthScore >= 40 ? "⚠️" : "🚨";

        // SVG ring animation
        const radius = 54;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (healthScore / 100) * circumference;

        // Tips based on score components
        const tips: string[] = [];
        if (savingsRatio < 20) tips.push("Tingkatkan rasio tabungan — targetkan minimal 20% dari pemasukan");
        if (consistencyScore < 50) tips.push("Catat transaksi lebih rutin agar analisis lebih akurat");
        if (diversificationScore < 75) tips.push("Diversifikasi pengeluaran — hindari dominasi satu kategori");
        if (tips.length === 0) tips.push("Keuangan Anda dalam kondisi sangat baik! Pertahankan! 🎉");

        return (
          <section className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 transition-all" id="section-health-score">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Animated Ring Gauge */}
              <div className="relative w-[140px] h-[140px] shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  {/* Background ring */}
                  <circle
                    cx="60" cy="60" r={radius}
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-100 dark:text-gray-700"
                    strokeWidth="10"
                  />
                  {/* Score ring */}
                  <circle
                    cx="60" cy="60" r={radius}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${scoreColor}40)` }}
                  />
                </svg>
                {/* Center score text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold tracking-tight" style={{ color: scoreColor }}>
                    {healthScore}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">
                    / 100
                  </span>
                </div>
              </div>

              {/* Score details */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2 justify-center sm:justify-start">
                  <span>{scoreEmoji}</span>
                  <span>Financial Health Score</span>
                </h2>
                <p className="text-sm font-bold mt-1 mb-3" style={{ color: scoreColor }}>
                  Status: {scoreLabel}
                </p>

                {/* Score breakdown bars */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 w-24 shrink-0">Tabungan</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(100, savingsRatio)}%` }}></div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 w-10 text-right">{Math.round(savingsRatio)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 w-24 shrink-0">Konsistensi</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${Math.min(100, consistencyScore)}%` }}></div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 w-10 text-right">{Math.round(consistencyScore)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 w-24 shrink-0">Diversifikasi</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500 transition-all duration-700" style={{ width: `${diversificationScore}%` }}></div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 w-10 text-right">{diversificationScore}%</span>
                  </div>
                </div>

                {/* Tip */}
                <div className="mt-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-gray-700/50 text-[11px] font-medium text-slate-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-500 mt-0.5 shrink-0">lightbulb</span>
                  <span>{tips[0]}</span>
                </div>
              </div>
            </div>
          </section>
        );
      })()}




      {/* Row 2: Spend Graph + AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="visualization-grid">
        {/* Spending Card with Conic-gradient Donut Chart */}
        <section className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 flex flex-col" id="section-spending-chart">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Spending</h2>
          
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="donut-chart mb-6 shadow-sm" style={conicGradientStyle} id="spending-donut">
              <div className="donut-hole shadow-inner">
                <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">Total</span>
                <span className={`${fontSizeClass} font-bold text-slate-800 dark:text-white animate-in fade-in tracking-tight`} id="donut-total">
                  {hideBalances ? "••••" : totalExpenseText}
                </span>
              </div>
            </div>

            {/* Legend Map matching the mockup visually */}
            <div className="flex gap-4 flex-wrap justify-center w-full" id="donut-legend">
              {hasExpenses ? (
                gradientSlices.map((slice) => (
                  <div key={slice.name} className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full transition-all" 
                      style={{ backgroundColor: slice.color.hex }}
                    ></span>
                    <span className="text-sm font-semibold text-slate-600 dark:text-gray-300">
                      {slice.name} ({slice.pct}%)
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs font-semibold text-slate-400 dark:text-gray-500">
                  Belum ada pengeluaran
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI Chat History Section */}
        <section className="bg-sky-50/50 dark:bg-sky-950/15 rounded-[24px] p-6 flex flex-col relative overflow-hidden border border-sky-100/50 dark:border-sky-900/20 group min-h-[320px] max-h-[500px]" id="section-ai-insight">
          {/* Decorative bubble */}
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-sky-200/20 dark:bg-sky-900/10 rounded-full blur-3xl opacity-50"></div>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center shrink-0 text-[#10b981]">
                <span className="material-symbols-outlined fill text-[20px]">smart_toy</span>
              </div>
              <div>
                <h3 className="text-md font-bold text-slate-800 dark:text-white">DevFinancial AI</h3>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-500">{chatHistory.length} pesan</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {chatHistory.length > 2 && (
                <button
                  onClick={onClearChat}
                  className="p-1.5 rounded-full hover:bg-white dark:hover:bg-gray-700 text-slate-400 hover:text-red-400 transition-all cursor-pointer active:scale-95 text-[11px] font-bold"
                  title="Hapus riwayat chat"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                </button>
              )}
              <button
                onClick={onRefreshInsight}
                disabled={isLoadingInsight}
                className="p-1.5 rounded-full hover:bg-white dark:hover:bg-gray-700 text-slate-400 hover:text-[#10b981] disabled:opacity-50 transition-all cursor-pointer active:scale-95"
                title="Minta saran baru"
              >
                <Bot size={16} className={`${isLoadingInsight ? "animate-spin text-[#10b981]" : ""}`} />
              </button>
            </div>
          </div>

          {/* Chat Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-3 relative z-10 pr-1 mb-3 min-h-[120px]" id="chat-messages-scroll">
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-1 duration-200`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === "user" 
                    ? "bg-[#006c49] dark:bg-[#10b981] text-white rounded-br-md" 
                    : "bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-200 border border-slate-100 dark:border-gray-700 shadow-xs rounded-bl-md"
                }`}>
                  <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[9px] mt-1 font-semibold ${
                    msg.role === "user" ? "text-white/60" : "text-slate-400 dark:text-gray-500"
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {isLoadingInsight && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-[#10b981] rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef}></div>
          </div>

          {/* Quick Prompt Chips & Chat Input */}
          <div className="flex flex-col gap-2.5 relative z-10 w-full border-t border-sky-100/50 dark:border-sky-900/30 pt-3">
            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5" id="chat-quick-chips">
              <button type="button" onClick={() => handleChipClick("Bagaimana cara berhemat minggu ini?")} disabled={isLoadingInsight} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-[#006c49] dark:hover:text-[#10b981] border border-slate-100 dark:border-gray-700 hover:border-emerald-200 px-2.5 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50">💡 Berhemat</button>
              <button type="button" onClick={() => handleChipClick("Analisis pola pengeluaran dan kategori belanja saya.")} disabled={isLoadingInsight} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-[#006c49] dark:hover:text-[#10b981] border border-slate-100 dark:border-gray-700 hover:border-emerald-200 px-2.5 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50">📊 Analisis</button>
              <button type="button" onClick={() => handleChipClick("Berikan saran investasi cerdas untuk pemula.")} disabled={isLoadingInsight} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-[#006c49] dark:hover:text-[#10b981] border border-slate-100 dark:border-gray-700 hover:border-emerald-200 px-2.5 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50">💰 Investasi</button>
            </div>
            {/* Chat Form */}
            <form onSubmit={handleChatSubmit} className="flex gap-2 w-full">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={isLoadingInsight} placeholder="Tanya AI tentang keuangan..." className="flex-1 bg-white dark:bg-gray-900 text-slate-800 dark:text-white text-xs font-semibold rounded-xl px-4 py-2.5 border border-slate-200 dark:border-gray-700 focus:outline-hidden focus:border-[#006c49] dark:focus:border-[#10b981] transition-all placeholder:text-slate-400" />
              <button type="submit" disabled={!chatInput.trim() || isLoadingInsight} className="bg-[#006c49] hover:bg-[#005236] dark:bg-[#10b981] dark:hover:bg-[#0e9f6e] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50">Tanya</button>
            </form>
          </div>
        </section>
      </div>

      {/* Recent Transactions List Section */}
      <section className="bg-white dark:bg-gray-800 rounded-[24px] p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50" id="section-recent-transactions">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Recent Transactions</h2>
          <div className="flex items-center gap-4">
            {transactions.length > 0 && (
              <button 
                onClick={onDownloadCSV}
                className="flex items-center gap-1 bg-[#e6f4ea] dark:bg-emerald-950/20 hover:bg-[#d5eedc] dark:hover:bg-emerald-950/30 text-[#006c49] dark:text-[#10b981] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                id="btn-download-dashboard"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Unduh Rekapan</span>
              </button>
            )}
            <button 
              onClick={() => onNavigate("activity")}
              className="text-sm font-bold text-[#006c49] dark:text-[#10b981] hover:underline cursor-pointer"
              id="view-all-transactions"
            >
              View All
            </button>
          </div>
        </div>

        <div className="flex flex-col" id="transaction-list-container">
          {transactions.slice(0, 5).map((tx, idx) => {
            const isInc = tx.type === "income";
            return (
              <div 
                key={tx.id || idx}
                className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-gray-700 last:border-0 hover:bg-slate-50/50 dark:hover:bg-gray-900/10 transition-colors rounded-xl px-2.5 -mx-2.5"
                id={`tx-row-${tx.id}`}
              >
                <div className="flex items-center gap-4">
                  {/* Circular icons tailored by category */}
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
                      {tx.recurringRule && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 text-[9px] font-bold uppercase tracking-wider">
                          <Repeat size={8} />
                          {tx.recurringRule.frequency === "daily" ? "Harian" : tx.recurringRule.frequency === "weekly" ? "Mingguan" : "Bulanan"}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-gray-400 font-medium">
                      {isInc ? "Income" : "Expense"} • {tx.date === new Date().toISOString().split("T")[0] ? "Today" : tx.note || "Transaksi"}
                    </div>
                  </div>
                </div>

                <div className={`text-md font-bold font-mono tracking-tight ${isInc ? "text-[#10b981]" : "text-slate-800 dark:text-slate-200"}`}>
                  {isInc ? "+" : "-"}{hideBalances ? "••••" : formatValue(tx.amount)}
                </div>
              </div>
            );
          })}

          {transactions.length === 0 && (
            <div className="text-center py-8 text-slate-400 dark:text-gray-500 font-medium select-none">
              Belum ada transaksi. Klik tombol (+) di kanan bawah untuk menambah transaksi!
            </div>
          )}
        </div>
      </section>

    </div>
  );
};
