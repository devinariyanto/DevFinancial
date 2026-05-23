import React, { useState } from "react";
import { UserSession } from "../types";
import { Mail, Lock, ArrowRight, LogOut } from "lucide-react";

interface AuthViewProps {
  user: UserSession;
  onLoginSuccess: (email: string) => void;
  onLogout: () => void;
  onContinueAsGuest: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  user,
  onLoginSuccess,
  onLogout,
  onContinueAsGuest,
}) => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  // Handle Login & Registration submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Harap isi email dan password Anda!");
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
      return;
    }

    setIsLoading(true);
    setErrorText(null);
    setSuccessText(null);

    const endpoint = activeTab === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan pada server");
      }

      setSuccessText(
        activeTab === "login"
          ? "Login berhasil! Memulihkan data..."
          : "Pendaftaran berhasil! Menyinkronkan data..."
      );

      // Timeout for visual feedback and smooth reading of success notice
      setTimeout(() => {
        onLoginSuccess(email.toLowerCase().trim());
        setIsLoading(false);
      }, 1000);
    } catch (err: any) {
      setErrorText(err.message || "Gagal menghubungkan ke server");
      setIsLoading(false);
      
      // Trigger smooth shake animation for the card
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-8 px-4" id="auth-main-container">
      {/* Transactional card for secure credentials */}
      <main className={`w-full max-w-[420px] bg-white dark:bg-gray-800 rounded-3xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 p-6 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300 transition-colors duration-300 ${shouldShake ? "animate-shake" : ""}`}>
        
        {/* Header & Branding with user avatar symbol */}
        <header className="flex flex-col items-center text-center gap-2 w-full">
          <div className="w-16 h-16 bg-[#006c49] dark:bg-[#10b981] text-white rounded-full flex items-center justify-center mb-1 shadow-md">
            <span className="material-symbols-outlined text-[32px] font-variation-settings-'FILL'-1">person</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">
            {activeTab === "login" ? "Masuk ke Akun" : "Daftar Akun Baru"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 max-w-[280px]">
            {activeTab === "login"
              ? "Masukkan email dan kata sandi Anda untuk mengakses akun."
              : "Buat akun baru untuk mencadangkan data keuangan Anda."}
          </p>
        </header>

        {/* Sync Session State check */}
        {user.isLoggedIn ? (
          <div className="w-full flex flex-col gap-4 py-4 text-center">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500 dark:text-[#10b981] text-[32px]">check_circle</span>
              <p className="text-sm font-bold text-slate-800 dark:text-white">Anda Telah Terhubung!</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">{user.email}</p>
            </div>
            
            <button
              onClick={onLogout}
              className="w-full py-3.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <LogOut size={16} />
              <span>Keluar dari Akun</span>
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Tabs Navigation for switching between LOGIN / REGISTER */}
            <div className="w-full flex border-b border-slate-100 dark:border-gray-700 relative" id="auth-tabs">
              <button
                onClick={() => {
                  setActiveTab("login");
                  setErrorText(null);
                  setSuccessText(null);
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold tracking-wider transition-colors cursor-pointer ${
                  activeTab === "login"
                    ? "text-[#006c49] dark:text-[#10b981] border-b-2 border-[#006c49] dark:border-[#10b981]"
                    : "text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                LOGIN
              </button>
              <button
                onClick={() => {
                  setActiveTab("register");
                  setErrorText(null);
                  setSuccessText(null);
                }}
                className={`flex-1 pb-3 text-center text-xs font-bold tracking-wider transition-colors cursor-pointer ${
                  activeTab === "register"
                    ? "text-[#006c49] dark:text-[#10b981] border-b-2 border-[#006c49] dark:border-[#10b981]"
                    : "text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                REGISTER
              </button>
            </div>

            {/* Error & Success Feedback displays */}
            {errorText && (
              <div className="p-4 bg-red-500/10 dark:bg-red-950/20 border border-red-500/20 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-3 fade-in duration-300 shadow-xs">
                <span className="material-symbols-outlined text-[18px] text-red-500">error</span>
                <span>{errorText}</span>
              </div>
            )}
            {successText && (
              <div className="p-4 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-3 fade-in duration-300 shadow-xs">
                <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
                <span>{successText}</span>
              </div>
            )}

            {/* Login/Register Form */}
            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4" id="auth-form-fields">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 tracking-wider uppercase ml-1" htmlFor="email-input">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-4 text-slate-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="email"
                    id="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white font-medium text-sm rounded-xl pl-11 pr-4 py-3 border border-transparent dark:border-gray-800 ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-inset focus:ring-[#006c49] dark:focus:ring-[#10b981] focus:bg-white dark:focus:bg-gray-900 transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5" id="password-group">
                <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 tracking-wider uppercase ml-1" htmlFor="password-input">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-4 text-slate-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="password"
                    id="password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white font-medium text-sm rounded-xl pl-11 pr-4 py-3 border border-transparent dark:border-gray-800 ring-1 ring-inset ring-transparent focus:ring-2 focus:ring-inset focus:ring-[#006c49] dark:focus:ring-[#10b981] focus:bg-white dark:focus:bg-gray-900 transition-all placeholder:text-slate-400 dark:placeholder:text-gray-600"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#006c49] hover:bg-[#005236] dark:bg-[#10b981] dark:hover:bg-[#0ea5e9] text-white text-sm font-bold rounded-xl py-3.5 hover:shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  id="submit-auth-button"
                >
                  <span>{isLoading ? "Memproses..." : activeTab === "login" ? "Masuk" : "Daftar Sekarang"}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* Guest continuation link */}
            <div className="w-full flex justify-center pt-2">
              <button
                onClick={onContinueAsGuest}
                className="text-xs text-slate-500 dark:text-gray-400 hover:text-[#006c49] dark:hover:text-[#10b981] transition-colors underline decoration-slate-200 dark:decoration-gray-700 hover:decoration-[#006c49] dark:hover:decoration-[#10b981] underline-offset-4 cursor-pointer font-bold"
              >
                Lanjutkan sebagai Tamu
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
