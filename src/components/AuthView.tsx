import React, { useState } from "react";
import { UserSession } from "../types";
import { Mail, Lock, ArrowRight, CloudLightning, LogOut } from "lucide-react";

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

  // Google Chooser States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [isCustomGoogleInput, setIsCustomGoogleInput] = useState(false);

  const handleGoogleSignIn = () => {
    setShowGoogleModal(true);
    setErrorText(null);
    setSuccessText(null);
  };

  const handleSelectGoogleAccount = async (selectedEmail: string, selectedName: string, selectedAvatar: string) => {
    setShowGoogleModal(false);
    setIsLoading(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: selectedEmail, 
          name: selectedName,
          avatar: selectedAvatar 
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal masuk dengan Google");
      }

      setSuccessText(`Masuk sebagai ${selectedEmail} berhasil!`);
      setTimeout(() => {
        onLoginSuccess(data.email);
        setIsLoading(false);
      }, 750);
    } catch (err: any) {
      setErrorText(err.message || "Gagal menghubungkan ke server");
      setIsLoading(false);
    }
  };

  // Handle Login & Registration submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Harap isi email dan password Anda!");
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

      // Timeout for visual feedback
      setTimeout(() => {
        onLoginSuccess(data.email);
        setIsLoading(false);
      }, 750);
    } catch (err: any) {
      setErrorText(err.message || "Gagal menghubungkan ke server");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-8 px-4" id="auth-main-container">
      {/* Transactional card for secure credentials */}
      <main className="w-full max-w-[420px] bg-white dark:bg-gray-800 rounded-3xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-gray-700/50 p-6 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300 transition-colors duration-300">
        
        {/* Header & Branding with sync symbols */}
        <header className="flex flex-col items-center text-center gap-2 w-full">
          <div className="w-16 h-16 bg-[#10b981] text-white rounded-full flex items-center justify-center mb-1 shadow-md">
            <span className="material-symbols-outlined text-[32px] font-variation-settings-'FILL'-1">cloud_sync</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Amankan Data Anda</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 max-w-[280px]">
            Hubungkan akun untuk mencadangkan data dari localStorage ke cloud.
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
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorText}</span>
              </div>
            )}
            {successText && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
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

              {/* Separator Line */}
              <div className="flex items-center my-1 select-none">
                <div className="flex-1 h-[1px] bg-slate-100 dark:bg-gray-700"></div>
                <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Atau</span>
                <div className="flex-1 h-[1px] bg-slate-100 dark:bg-gray-700"></div>
              </div>

              {/* Google Sign-in Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 font-bold text-sm rounded-xl py-3.5 shadow-xs hover:shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                id="google-auth-button"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Masuk dengan Google</span>
              </button>
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

      {/* Google Chooser Modal Dialog Overlay */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-[400px] bg-white dark:bg-gray-800 rounded-3xl border border-slate-100 dark:border-gray-700 shadow-2xl p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-200 transition-colors duration-300">
            {/* Logo and Header */}
            <div className="flex flex-col items-center text-center gap-2 select-none">
              <svg className="w-8 h-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mt-1">Pilih Akun Google</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">untuk melanjutkan ke <strong className="text-[#006c49] dark:text-[#10b981]">DevFinancial</strong></p>
            </div>

            {/* List of Accounts */}
            {!isCustomGoogleInput ? (
              <div className="flex flex-col gap-2">
                {/* Account Devin */}
                <button
                  type="button"
                  onClick={() => handleSelectGoogleAccount(
                    "devinmaulana234@gmail.com", 
                    "Devin Maulana", 
                    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23006c49"/><text x="50%" y="60%" font-size="50" font-family="system-ui, sans-serif" font-weight="bold" fill="white" text-anchor="middle">DM</text></svg>`
                  )}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/60 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-[#006c49] flex items-center justify-center text-white text-xs font-bold shadow-xs select-none">
                      DM
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white">Devin Maulana</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">devinmaulana234@gmail.com</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 dark:text-gray-500 text-[18px]">chevron_right</span>
                </button>

                {/* Account Tamu */}
                <button
                  type="button"
                  onClick={() => handleSelectGoogleAccount(
                    "tamu.devfinancial@gmail.com", 
                    "Tamu Keuangan", 
                    `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%233b82f6"/><text x="50%" y="60%" font-size="50" font-family="system-ui, sans-serif" font-weight="bold" fill="white" text-anchor="middle">TK</text></svg>`
                  )}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/60 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-xs select-none">
                      TK
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800 dark:text-white">Tamu Keuangan</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">tamu.devfinancial@gmail.com</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 dark:text-gray-500 text-[18px]">chevron_right</span>
                </button>

                {/* Account Custom Trigger */}
                <button
                  type="button"
                  onClick={() => setIsCustomGoogleInput(true)}
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/60 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-slate-500 dark:text-gray-400 shadow-xs select-none">
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-gray-300">Gunakan akun lain</div>
                      <div className="text-xs text-slate-500 dark:text-gray-500 font-medium">Masuk dengan email Google lainnya</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-400 dark:text-gray-500 text-[18px]">add</span>
                </button>
              </div>
            ) : (
              /* Custom Google Email Form */
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-gray-500 tracking-wider uppercase ml-1">Email Google</label>
                  <input
                    type="email"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="nama.anda@gmail.com"
                    className="w-full bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-white font-medium text-sm rounded-xl px-4 py-3 border border-transparent dark:border-gray-700 focus:outline-hidden focus:border-[#006c49] dark:focus:border-[#10b981] focus:bg-white dark:focus:bg-gray-900 transition-all"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomGoogleInput(false);
                      setCustomGoogleEmail("");
                    }}
                    className="flex-1 py-3 bg-slate-50 dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customGoogleEmail.includes("@")) {
                        alert("Masukkan alamat email yang valid!");
                        return;
                      }
                      const namePart = customGoogleEmail.split("@")[0];
                      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
                      const initialLetters = formattedName.slice(0, 2).toUpperCase();
                      const svgAvatar = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%238b5cf6"/><text x="50%" y="60%" font-size="50" font-family="system-ui, sans-serif" font-weight="bold" fill="white" text-anchor="middle">${initialLetters}</text></svg>`;
                      handleSelectGoogleAccount(customGoogleEmail, formattedName, svgAvatar);
                    }}
                    className="flex-1 py-3 bg-[#006c49] dark:bg-[#10b981] text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}

            {/* Cancel Button */}
            {!isCustomGoogleInput && (
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="w-full py-3 bg-slate-50 dark:bg-gray-700/50 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer text-center"
              >
                Batal
              </button>
            )}

            {/* Google terms subtext */}
            <p className="text-[10px] text-slate-400 dark:text-gray-500 leading-normal text-center select-none border-t border-slate-100/60 dark:border-gray-700/50 pt-4">
              Untuk melanjutkan, Google akan membagikan nama, alamat email, dan foto profil Anda dengan DevFinancial.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
