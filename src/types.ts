export type TransactionType = "income" | "expense";

export type RecurringFrequency = "daily" | "weekly" | "monthly";

export interface RecurringRule {
  frequency: RecurringFrequency;
  lastGenerated: string; // YYYY-MM-DD — last date this rule auto-generated a tx
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  note: string;
  recurringRule?: RecurringRule; // if set, this tx is a recurring template
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Material symbol icon name
  color: string; // Tailwind background color class, e.g., 'bg-emerald-100' or similar
  textColor: string; // Tailwind text color class
  type: TransactionType;
  group: "umum" | "saham" | "crypto";
}

export interface Budget {
  category: string;
  limit: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: string; // ISO string
}

export interface UserSession {
  email: string | null;
  isLoggedIn: boolean;
  name?: string;
  avatar?: string;
}

export interface AppState {
  transactions: Transaction[];
  user: UserSession;
  activeTab: "dashboard" | "activity" | "profile" | "secure";
  isLoadingInsight: boolean;
  insightText: string;
}
