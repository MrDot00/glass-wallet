
import { Bucket } from './types';

export const INITIAL_BUCKETS: Bucket[] = [
  { id: 'rent', name: 'Rent', current: 0, target: 2150, isPaid: false, priority: 1, icon: 'fa-house', color: 'from-blue-500 to-indigo-600' },
  { id: 'wifi', name: 'WiFi/Trash', current: 0, target: 115, isPaid: false, priority: 2, icon: 'fa-wifi', color: 'from-cyan-500 to-blue-600' },
  { id: 'elec', name: 'Electricity', current: 0, target: 200, isPaid: false, priority: 3, icon: 'fa-bolt', color: 'from-amber-400 to-orange-500' },
  { id: 'vape', name: 'Vape Supplies', current: 0, target: 2500, priority: 4, icon: 'fa-wind', color: 'from-purple-500 to-pink-600' },
  { id: 'daily', name: 'Daily Allowance', current: 0, target: 600, priority: 5, icon: 'fa-wallet', color: 'from-emerald-500 to-teal-600' },
  { id: 'meal', name: 'Meal/Mess', current: 0, target: 3500, priority: 6, icon: 'fa-utensils', color: 'from-rose-500 to-orange-600' },
  { id: 'maid', name: 'Maid/Khala', current: 0, target: 600, priority: 7, icon: 'fa-broom', color: 'from-sky-500 to-blue-400' },
  { id: 'savings', name: 'Extra Savings', current: 0, target: null, priority: 8, icon: 'fa-piggy-bank', color: 'from-yellow-400 to-emerald-500' },
];
