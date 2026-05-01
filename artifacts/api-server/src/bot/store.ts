export interface Purchase {
  id: string;
  date: Date;
  grams: number;
  totalCost: number;
  pricePerGram: number;
}

export interface Sale {
  id: string;
  date: Date;
  grams: number;
  totalRevenue: number;
  pricePerGram: number;
}

export interface PersonalUse {
  id: string;
  date: Date;
  grams: number;
}

export interface UserState {
  purchases: Purchase[];
  sales: Sale[];
  personalUse: PersonalUse[];
  awaitingInput:
    | null
    | "purchase_grams"
    | "purchase_cost"
    | "sale_grams"
    | "sale_revenue"
    | "personal_grams";
  tempData: Record<string, number>;
}

const store = new Map<number, UserState>();

export function getUser(userId: number): UserState {
  if (!store.has(userId)) {
    store.set(userId, {
      purchases: [],
      sales: [],
      personalUse: [],
      awaitingInput: null,
      tempData: {},
    });
  }
  return store.get(userId)!;
}

export function setUser(userId: number, state: UserState): void {
  store.set(userId, state);
}

export function getTotalStock(userId: number): number {
  const user = getUser(userId);
  const totalPurchased = user.purchases.reduce((s, p) => s + p.grams, 0);
  const totalSold = user.sales.reduce((s, p) => s + p.grams, 0);
  const totalPersonal = user.personalUse.reduce((s, p) => s + p.grams, 0);
  return totalPurchased - totalSold - totalPersonal;
}

export function getTotalSpent(userId: number): number {
  const user = getUser(userId);
  return user.purchases.reduce((s, p) => s + p.totalCost, 0);
}

export function getTotalRevenue(userId: number): number {
  const user = getUser(userId);
  return user.sales.reduce((s, p) => s + p.totalRevenue, 0);
}

export function getTotalCOGS(userId: number): number {
  const user = getUser(userId);
  const avgCost = getAvgCostPerGram(userId);
  return user.sales.reduce((s, p) => s + p.grams * avgCost, 0);
}

export function getAvgCostPerGram(userId: number): number {
  const user = getUser(userId);
  const totalGrams = user.purchases.reduce((s, p) => s + p.grams, 0);
  const totalCost = user.purchases.reduce((s, p) => s + p.totalCost, 0);
  if (totalGrams === 0) return 0;
  return totalCost / totalGrams;
}

export function getAvgSalePricePerGram(userId: number): number {
  const user = getUser(userId);
  const totalGrams = user.sales.reduce((s, p) => s + p.grams, 0);
  const totalRevenue = user.sales.reduce((s, p) => s + p.totalRevenue, 0);
  if (totalGrams === 0) return 0;
  return totalRevenue / totalGrams;
}

export function getProfit(userId: number): number {
  return getTotalRevenue(userId) - getTotalCOGS(userId);
}

export function getNetCash(userId: number): number {
  return getTotalRevenue(userId) - getTotalSpent(userId);
}

export function getLastSaleRevenue(userId: number): number | null {
  const user = getUser(userId);
  if (user.sales.length === 0) return null;
  const sorted = [...user.sales].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  return sorted[0]!.totalRevenue;
}

export function getEffectiveCapital(userId: number): number {
  const netCash = getNetCash(userId);
  const stockValue = getTotalStock(userId) * getAvgCostPerGram(userId);
  return netCash + stockValue;
}
