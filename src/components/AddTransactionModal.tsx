import React, { useState, useEffect } from "react";
import { Category, Transaction, TransactionType, RecurringFrequency } from "../types";
import { DEFAULT_CATEGORIES } from "../data";
import { X, Check, Calendar, Repeat } from "lucide-react";

interface AddTransactionModalProps {
  onClose: () => void;
  onSave: (tx: Omit<Transaction, "id">) => void;
  currency: "USD" | "IDR";
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  onClose,
  onSave,
  currency,
}) => {
  const [type, setType] = useState<TransactionType>("expense");
  const [displayAmount, setDisplayAmount] = useState<string>("");
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORIES[0]);

  const handleAmountChange = (val: string) => {
    if (currency === "IDR") {
      const digits = val.replace(/\D/g, "");
      if (!digits) {
        setDisplayAmount("");
        return;
      }
      const parsed = parseInt(digits, 10);
      setDisplayAmount(parsed.toLocaleString("id-ID"));
    } else {
      let cleaned = val.replace(/[^0-9.]/g, "");
      const dotIndex = cleaned.indexOf(".");
      if (dotIndex !== -1) {
        cleaned = cleaned.substring(0, dotIndex + 1) + cleaned.substring(dotIndex + 1).replace(/\./g, "");
      }
      const parts = cleaned.split(".");
      const integerPart = parts[0];
      const decimalPart = parts.length > 1 ? "." + parts[1].slice(0, 2) : "";
      
      if (!integerPart && !decimalPart) {
        setDisplayAmount("");
        return;
      }
      const parsedInt = integerPart ? parseInt(integerPart, 10) : 0;
      const formattedInt = integerPart ? parsedInt.toLocaleString("en-US") : "0";
      
      if (cleaned.endsWith(".") && !decimalPart) {
        setDisplayAmount(formattedInt + ".");
      } else {
        setDisplayAmount(formattedInt + decimalPart);
      }
    }
  };
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<RecurringFrequency>("monthly");
  const [selectedGroup, setSelectedGroup] = useState<"umum" | "saham" | "crypto">("umum");

  // Filter categories depending on selected type and group
  const availableCategories = DEFAULT_CATEGORIES.filter(
    (c) => c.type === type && c.group === selectedGroup
  );

  // Sync default category when switching types or groups
  useEffect(() => {
    const matchingCats = DEFAULT_CATEGORIES.filter(
      (c) => c.type === type && c.group === selectedGroup
    );
    if (matchingCats.length > 0) {
      setCategory(matchingCats[0]);
    }
  }, [type, selectedGroup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumStr = currency === "IDR" 
      ? displayAmount.replace(/\D/g, "") 
      : displayAmount.replace(/,/g, "");
      
    const parsedAmount = parseFloat(cleanNumStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Masukkan nominal transaksi yang valid!");
      return;
    }

    // Convert Rupiah inputs to USD baseline units for database consistency
    const dbAmount = currency === "IDR" ? parsedAmount / 15000 : parsedAmount;

    onSave({
      type,
      amount: dbAmount,
      category: category.name,
      date,
      note: note.trim(),
      ...(isRecurring ? { recurringRule: { frequency: recurringFreq, lastGenerated: date } } : {}),
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-0 md:p-4 overflow-hidden animate-in fade-in duration-200"
      id="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Container simulating mobile viewport inside desktop or taking full screen in mobile */}
      <div 
        className="w-full max-w-md h-full md:h-[780px] md:rounded-[32px] bg-white dark:bg-gray-800 flex flex-col relative overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 transition-colors duration-300"
        id="app-modal-container"
      >
        {/* Header bar mirroring Indonesian title tambah transaksi */}
        <header className="flex justify-between items-center px-4 w-full h-16 bg-white dark:bg-gray-800 border-b border-slate-200/50 dark:border-gray-700/50 sticky top-0 z-20 transition-colors duration-300">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors cursor-pointer active:scale-95 text-slate-700 dark:text-gray-300"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <h1 className="text-[18px] font-bold text-slate-800 dark:text-white">Tambah Transaksi</h1>
          <div className="w-10"></div> {/* Balanced spacer */}
        </header>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-y-auto" id="add-transaction-form">
          <div className="px-5 py-6 flex flex-col gap-6">
            
            {/* Toggle Button for expense ("Pengeluaran") and income ("Pemasukan") */}
            <div className="flex p-1 bg-slate-100 dark:bg-gray-900 rounded-2xl select-none transition-colors duration-300" id="tx-toggle-control">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-all cursor-pointer ${
                  type === "expense" 
                    ? "bg-white dark:bg-gray-800 shadow-sm text-red-500" 
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold text-center transition-all cursor-pointer ${
                  type === "income" 
                    ? "bg-white dark:bg-gray-800 shadow-sm text-emerald-500" 
                    : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Pemasukan
              </button>
            </div>

            {/* nominal Input field with focus glow animation */}
            <div className="group flex flex-col items-center justify-center py-6 text-center">
              <label className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-gray-500 uppercase mb-3">Nominal</label>
              <div className="flex items-center justify-center relative w-full">
                <span className="text-2xl font-bold text-slate-400 dark:text-gray-500 mr-2 select-none">
                  {currency === "USD" ? "$" : "Rp"}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={displayAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className="w-[240px] text-center text-3xl font-bold text-slate-800 dark:text-white bg-transparent border-none outline-hidden focus:ring-0 p-0"
                  autoFocus
                  required
                />
              </div>
              {/* Focus bottom indicator: red for expense, green for income */}
              <div className={`h-0.5 w-16 bg-slate-200 dark:bg-gray-700 rounded-full mt-3 transition-all duration-300 group-focus-within:w-48 ${
                type === "expense" ? "group-focus-within:bg-red-500" : "group-focus-within:bg-emerald-500"
              }`} id="focus-line-effect"></div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Grup Kategori</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-gray-900 rounded-2xl select-none transition-colors duration-300" id="group-toggle-control">
                <button
                  type="button"
                  onClick={() => setSelectedGroup("umum")}
                  className={`py-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    selectedGroup === "umum" 
                      ? "bg-white dark:bg-gray-800 shadow-xs text-[#006c49] dark:text-[#10b981]" 
                      : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Umum
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroup("saham")}
                  className={`py-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    selectedGroup === "saham" 
                      ? "bg-white dark:bg-gray-800 shadow-xs text-[#006c49] dark:text-[#10b981]" 
                      : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Saham
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroup("crypto")}
                  className={`py-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                    selectedGroup === "crypto" 
                      ? "bg-white dark:bg-gray-800 shadow-xs text-[#006c49] dark:text-[#10b981]" 
                      : "text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Crypto
                </button>
              </div>
            </div>

            {/* Categories scroll select wrapper */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Pilih Item</label>
              <div className="grid grid-cols-3 gap-2.5 max-h-[190px] overflow-y-auto p-1" id="category-selector-grid">
                {availableCategories.map((cat) => {
                  const isSelected = category.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected 
                          ? type === "expense"
                            ? "border-red-400 dark:border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 scale-[1.02]"
                            : "border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 scale-[1.02]"
                          : "border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/40 hover:bg-slate-100/50 dark:hover:bg-gray-700/50 text-slate-600 dark:text-gray-300"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${cat.color} ${isSelected ? 'scale-110 shadow-xs' : ''}`}>
                        <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                      </div>
                      <span className="text-xs font-bold truncate w-full">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Picker Input */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-slate-700 dark:text-white bg-slate-50 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700 rounded-xl px-4 py-3 pb-3 text-sm focus:outline-hidden focus:border-slate-300 dark:focus:border-gray-500 transition-all font-medium select-all"
                required
              />
            </div>

            {/* Optional Catatan TextArea layout mapping */}
            <div className="flex flex-col gap-2" id="notes-input-wrapper">
              <label className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Catatan</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tambahkan deskripsi opsional..."
                rows={2}
                className="w-full text-slate-700 dark:text-white bg-slate-50 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700 rounded-xl px-4 py-3 placeholder:text-slate-400 dark:placeholder:text-gray-600 text-sm focus:outline-hidden focus:border-slate-300 dark:focus:border-gray-500 resize-none font-medium"
              ></textarea>
            </div>

            {/* Recurring Transaction Toggle */}
            <div className="flex flex-col gap-2" id="recurring-toggle-wrapper">
              <label className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <Repeat size={12} />
                Transaksi Berulang
              </label>
              <div className="bg-slate-50 dark:bg-gray-900/50 border border-slate-100 dark:border-gray-700 rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-gray-300">
                    {isRecurring ? "Aktif — otomatis berulang" : "Nonaktif"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(!isRecurring)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer ${
                      isRecurring ? "bg-[#10b981]" : "bg-slate-300 dark:bg-gray-600"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                      isRecurring ? "translate-x-5" : "translate-x-0"
                    }`}></span>
                  </button>
                </div>
                {isRecurring && (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    {(["daily", "weekly", "monthly"] as RecurringFrequency[]).map(freq => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFreq(freq)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer ${
                          recurringFreq === freq
                            ? "bg-[#006c49] dark:bg-[#10b981] text-white shadow-sm"
                            : "bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200 border border-slate-100 dark:border-gray-700"
                        }`}
                      >
                        {freq === "daily" ? "Harian" : freq === "weekly" ? "Mingguan" : "Bulanan"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Action Footer */}
          <div className="mt-auto p-4 border-t border-slate-100 dark:border-gray-700/50 sticky bottom-0 bg-white dark:bg-gray-800 shadow-xs transition-colors duration-300">
            <button
              type="submit"
              className={`w-full py-4 rounded-2xl text-md font-bold tracking-tight text-white flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98 ${
                type === "expense" 
                  ? "bg-red-500 hover:bg-red-600 shadow-red-500/10" 
                  : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
              }`}
              id="submit-transaction"
            >
              <span>Simpan Transaksi</span>
              <Check size={18} className="stroke-[2.5]" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
