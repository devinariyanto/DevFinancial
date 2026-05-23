import { Category, Transaction } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense Categories - Umum
  {
    id: "makanan",
    name: "Makanan",
    icon: "restaurant",
    color: "bg-red-50 text-red-500",
    textColor: "text-red-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "transport",
    name: "Transport",
    icon: "directions_car",
    color: "bg-blue-50 text-blue-500",
    textColor: "text-blue-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "belanja",
    name: "Belanja",
    icon: "shopping_bag",
    color: "bg-amber-50 text-amber-500",
    textColor: "text-amber-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "hiburan",
    name: "Hiburan",
    icon: "sports_esports",
    color: "bg-purple-50 text-purple-500",
    textColor: "text-purple-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "tagihan",
    name: "Tagihan",
    icon: "receipt_long",
    color: "bg-orange-50 text-orange-500",
    textColor: "text-orange-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "kesehatan",
    name: "Kesehatan",
    icon: "medical_services",
    color: "bg-teal-50 text-teal-500",
    textColor: "text-teal-600",
    type: "expense",
    group: "umum",
  },
  {
    id: "lainnya_out",
    name: "Lainnya",
    icon: "more_horiz",
    color: "bg-slate-50 text-slate-500",
    textColor: "text-slate-600",
    type: "expense",
    group: "umum",
  },
  
  // Expense Categories - Saham
  {
    id: "saham_out",
    name: "SAHAM",
    icon: "show_chart",
    color: "bg-blue-50 text-blue-600",
    textColor: "text-blue-700",
    type: "expense",
    group: "saham",
  },
  
  // Expense Categories - Crypto
  {
    id: "crypto_out",
    name: "CRYPTO",
    icon: "currency_bitcoin",
    color: "bg-amber-50 text-amber-600",
    textColor: "text-amber-700",
    type: "expense",
    group: "crypto",
  },

  // Income Categories - Umum
  {
    id: "gaji",
    name: "Gaji",
    icon: "payments",
    color: "bg-emerald-50 text-emerald-500",
    textColor: "text-emerald-600",
    type: "income",
    group: "umum",
  },
  {
    id: "sampingan",
    name: "Sampingan",
    icon: "savings",
    color: "bg-indigo-50 text-indigo-500",
    textColor: "text-indigo-600",
    type: "income",
    group: "umum",
  },
  {
    id: "lainnya_in",
    name: "Lainnya",
    icon: "more_horiz",
    color: "bg-slate-50 text-slate-500",
    textColor: "text-slate-600",
    type: "income",
    group: "umum",
  },

  // Income Categories - Saham
  {
    id: "saham_in",
    name: "SAHAM",
    icon: "show_chart",
    color: "bg-blue-50 text-blue-600",
    textColor: "text-blue-700",
    type: "income",
    group: "saham",
  },
  
  // Income Categories - Crypto
  {
    id: "crypto_in",
    name: "CRYPTO",
    icon: "currency_bitcoin",
    color: "bg-amber-50 text-amber-600",
    textColor: "text-amber-700",
    type: "income",
    group: "crypto",
  },
];

// Seed standard default transactions matching user screenshot values but in currency (can be formatted as USD or Rupiah)
export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    type: "income",
    amount: 5200, // represented as basic units, formatted based on selected currency
    category: "Gaji",
    date: new Date().toISOString().split("T")[0], // Today
    note: "Gaji bulanan utama",
  },
  {
    id: "tx-2",
    type: "expense",
    amount: 45.5,
    category: "Makanan",
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0]; // Yesterday
    })(),
    note: "Makan siang sushi",
  },
  {
    id: "tx-3",
    type: "expense",
    amount: 15,
    category: "Transport",
    date: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      return d.toISOString().split("T")[0]; // 2 days ago
    })(),
    note: "Bensin kendaraan",
  },
];
