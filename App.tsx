import toast, { Toaster } from 'react-hot-toast';


import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, 
  PlusCircle, 
  MinusCircle, 
  BrainCircuit, 
  Home, 
  Wifi, 
  Zap, 
  Wind, 
  Utensils, 
  Brush, 
  PiggyBank, 
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CloudSync,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { INITIAL_BUCKETS } from './constants';
import { Bucket, Transaction } from './types';
import { GlassCard } from './components/GlassCard';
import { AnimatedNumber } from './components/AnimatedNumber';
import { StorageService, AppData } from './services/storage';

const App: React.FC = () => {
  const [buckets, setBuckets] = useState<Bucket[]>(INITIAL_BUCKETS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amountInput, setAmountInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Load data from "Database" on mount
  useEffect(() => {
    const init = async () => {
      const data = await StorageService.load();
      if (data) {
        setBuckets(data.buckets);
        setTransactions(data.transactions);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  // 2. Auto-save helper
  const syncWithDatabase = async (newBuckets: Bucket[], newTransactions: Transaction[]) => {
    setIsSyncing(true);
    try {
      await StorageService.save({
        buckets: newBuckets,
        transactions: newTransactions,
        lastSync: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to sync with DB", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const totalBalance = useMemo(() => {
    return buckets.reduce((acc, bucket) => acc + bucket.current, 0);
  }, [buckets]);

  const handleTogglePaid = (id: string) => {
    const updated = buckets.map(b => b.id === id ? { ...b, isPaid: !b.isPaid } : b);
    setBuckets(updated);
    syncWithDatabase(updated, transactions);
  };

  const resetMonth = async () => {
  if (window.confirm("Reset Month? This clears transactions but KEEPS your Extra Savings.")) {
    
    const cleanedBuckets = buckets.map(b => {
      // If it's the Savings bucket, DO NOT reset the current amount
      if (b.id === 'extra_savings' || b.name.toLowerCase().includes('savings')) {
        return { 
          ...b, 
          isPaid: false // Keep the money, just reset the 'paid' checkmark
        };
      }

      // For all other buckets, reset them to zero
      return {
        ...b,
        current: 0,
        isPaid: false,
        target: b.id === 'daily' ? 600 : b.target
      };
    });
    
    try {
      await fetch('/.netlify/functions/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'RESET', 
          buckets: cleanedBuckets 
        }),
      });

      setBuckets(cleanedBuckets);
      setTransactions([]); 
      
      alert("Month Reset! Savings preserved.");
    } catch (err) {
      console.error("Reset failed:", err);
      alert("Failed to reset data.");
    }
  }
};

  const handleIncome = () => {
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;

    let nextBuckets = JSON.parse(JSON.stringify(buckets)) as Bucket[];
    
    // Step A: Survival Cut (8%)
    const daily = nextBuckets.find(b => b.id === 'daily')!;
    const dailyLimit = daily.target || 600;
    const dailySpace = Math.max(0, dailyLimit - daily.current);
    const dailyRefill = Math.min(amount * 0.08, dailySpace);
    daily.current += dailyRefill;
    
    let remaining = amount - dailyRefill;

    // Step B: Critical Bills
    const criticalIds = ['rent', 'wifi', 'elec'];
    for (const id of criticalIds) {
      if (remaining <= 0) break;
      const b = nextBuckets.find(x => x.id === id)!;
      if (b.isPaid) continue;
      const needed = Math.max(0, (b.target || 0) - b.current);
      const fill = Math.min(remaining, needed);
      b.current += fill;
      remaining -= fill;
    }

    // Step C: The Split
    if (remaining > 0) {
      const vapePortion = remaining * 0.4;
      const mealPortion = remaining * 0.6;
      const vape = nextBuckets.find(b => b.id === 'vape')!;
      const meal = nextBuckets.find(b => b.id === 'meal')!;
      const vapeNeeded = Math.max(0, (vape.target || 0) - vape.current);
      const vapeFill = Math.min(vapePortion, vapeNeeded);
      vape.current += vapeFill;
      const mealNeeded = Math.max(0, (meal.target || 0) - meal.current);
      const mealFill = Math.min(mealPortion, mealNeeded);
      meal.current += mealFill;
      let overflow = (vapePortion - vapeFill) + (mealPortion - mealFill);

      if (overflow > 0) {
        const maid = nextBuckets.find(b => b.id === 'maid')!;
        const maidNeeded = Math.max(0, (maid.target || 0) - maid.current);
        const maidFill = Math.min(overflow, maidNeeded);
        maid.current += maidFill;
        overflow -= maidFill;
        const savings = nextBuckets.find(b => b.id === 'savings')!;
        savings.current += overflow;
      }
    }

    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'income',
      amount,
      timestamp: new Date(),
      note: noteInput || 'Received Funds'
    };

    const nextTxs = [newTx, ...transactions];
    setBuckets(nextBuckets);
    setTransactions(nextTxs);
    syncWithDatabase(nextBuckets, nextTxs);
    setAmountInput('');
    setNoteInput('');
  };

  const handleSpend = () => {
  const amount = parseFloat(amountInput);
  if (isNaN(amount) || amount <= 0) return;

  const daily = buckets.find(b => b.id === 'daily')!;
  const savings = buckets.find(b => b.id === 'extra_savings')!; // Make sure ID matches your savings bucket

  // 1. Calculate TOTAL money available
  const totalAvailable = daily.current + savings.current;

  // 2. Check if you have enough money
  if (amount > totalAvailable) {
    // NEW: This shows a beautiful red error bubble!
    toast.error("Insufficient funds! Check Daily & Savings.", {
      style: { background: '#333', color: '#fff' }
    });
    return;
  }

  let nextBuckets: Bucket[];

  if (amount <= 100) {
    if (daily.current >= amount) {
      nextBuckets = buckets.map(b => 
        b.id === 'daily' 
          ? { ...b, current: b.current - amount, target: Math.max(0, (b.target || 600) - amount) } 
          : b
      );
    } else {
      const fromDaily = daily.current;
      const fromSavings = amount - fromDaily;
      nextBuckets = buckets.map(b => {
        if (b.id === 'daily') return { ...b, current: 0, target: Math.max(0, (b.target || 600) - fromDaily) };
        if (b.id === 'extra_savings') return { ...b, current: b.current - fromSavings };
        return b;
      });
    }
  } else {
    const fromDaily = Math.min(daily.current, 100);
    const fromSavings = amount - fromDaily;

    nextBuckets = buckets.map(b => {
      if (b.id === 'daily') return { ...b, current: b.current - fromDaily, target: Math.max(0, (b.target || 600) - fromDaily) };
      if (b.id === 'extra_savings') return { ...b, current: b.current - fromSavings };
      return b;
    });
  }

  const newTx: Transaction = {
    id: Math.random().toString(36).substr(2, 9),
    type: 'spend',
    amount,
    timestamp: new Date(),
    note: noteInput || 'Purchased Item'
  };
  const nextTxs = [newTx, ...transactions];
  setBuckets(nextBuckets);
  setTransactions(nextTxs);
  syncWithDatabase(nextBuckets, nextTxs);

  setAmountInput('');
  setNoteInput('');
  
  // NEW: A green success bubble!
  toast.success("Transaction Added!", {
    icon: '💸',
    style: { background: '#333', color: '#fff' }
  });
};
  const aiComment = useMemo(() => {
    const rent = buckets.find(b => b.id === 'rent')!;
    const vape = buckets.find(b => b.id === 'vape')!;
    const daily = buckets.find(b => b.id === 'daily')!;
    const savings = buckets.find(b => b.id === 'savings')!;

    if (!rent.isPaid && rent.current < (rent.target || 2150)) return "⚠️ Priority Alert: Rent is still pending. Don't spend on snacks.";
    if (vape.current >= (vape.target || 2500)) return "💨 Vape fund is maxed out. You are breathing easy.";
    if (daily.target && daily.target < 100) return "🛑 You are broke on daily cash. Go home.";
    if (savings.current > 500) return "💰 Nice. You have overflow cash in savings.";
    return "System stable. Waiting for income.";
  }, [buckets]);

  const getBucketIcon = (id: string) => {
    switch(id) {
      case 'rent': return <Home className="w-5 h-5" />;
      case 'wifi': return <Wifi className="w-5 h-5" />;
      case 'elec': return <Zap className="w-5 h-5" />;
      case 'vape': return <Wind className="w-5 h-5" />;
      case 'daily': return <Wallet className="w-5 h-5" />;
      case 'meal': return <Utensils className="w-5 h-5" />;
      case 'maid': return <Brush className="w-5 h-5" />;
      case 'savings': return <PiggyBank className="w-5 h-5" />;
      default: return <Wallet className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#020617]">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">Decrypting Vault...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-7xl mx-auto pt-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-500">
              Glass Wallet
            </h1>
            {isSyncing && (
              <motion.div 
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase"
              >
                <CloudSync className="w-3 h-3" />
                Syncing
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-400 text-sm font-medium">Professional Finance OS</p>
            <button 
              onClick={resetMonth}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
            >
              <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
              Reset Month
            </button>
          </div>
        </div>

        <GlassCard className="min-w-[240px] flex flex-col items-end border-r-4 border-r-emerald-500/50">
          <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-1">Total Liquid Assets</span>
          <div className="text-4xl font-mono font-bold text-emerald-400 flex items-baseline">
            <span className="text-2xl mr-1">৳</span>
            <AnimatedNumber value={totalBalance} />
          </div>
        </GlassCard>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Control Panel */}
        <div className="lg:col-span-4 space-y-8">
          <GlassCard title="Operations Center">
            <div className="space-y-5">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Entry Amount (৳)</label>
                <input 
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-2xl font-mono text-white focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-700"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Transaction Memo</label>
                <input 
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Note..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleIncome}
                  className="flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-4 rounded-2xl font-bold transition-all active:scale-95 group"
                >
                  <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> Income
                </button>
                <button 
                  onClick={handleSpend}
                  className="flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-4 rounded-2xl font-bold transition-all active:scale-95 group"
                >
                  <MinusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> Spend
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <BrainCircuit className="w-20 h-20" />
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-blue-500/20 p-3 rounded-2xl text-blue-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">AI Financial Insight</span>
                <p className="text-slate-100 mt-2 text-lg font-medium leading-relaxed italic">
                  "{aiComment}"
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Journal" className="max-h-[320px] overflow-hidden flex flex-col">
            <div className="overflow-y-auto space-y-3 pr-2 flex-1">
              <AnimatePresence initial={false}>
                {transactions.length === 0 ? (
                  <p className="text-center text-slate-600 py-10 italic text-sm">No activity recorded yet.</p>
                ) : (
                  transactions.map(t => (
                    <motion.div 
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-200">{t.note}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">{t.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <div className={`flex items-center gap-2 font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.type === 'income' ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {t.type === 'income' ? '+' : '-'}{t.amount}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>

        {/* Right Dashboard Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {buckets.map((bucket, index) => {
            const progress = bucket.target ? Math.min((bucket.current / bucket.target) * 100, 100) : 100;
            const isBill = ['rent', 'wifi', 'elec', 'maid'].includes(bucket.id);
            
            return (
              <motion.div
                key={bucket.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard className={`relative h-full flex flex-col justify-between group ${bucket.isPaid ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${bucket.color} shadow-lg shadow-black/40`}>
                        {getBucketIcon(bucket.id)}
                      </div>
                      {isBill && (
                        <button 
                          onClick={() => handleTogglePaid(bucket.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            bucket.isPaid 
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                              : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/30'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest">Paid</span>
                          <CheckCircle2 className={`w-4 h-4 ${bucket.isPaid ? 'opacity-100' : 'opacity-20'}`} />
                        </button>
                      )}
                    </div>

                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-1">
                        <h4 className="text-xl font-bold text-white">{bucket.name}</h4>
                        {bucket.id === 'daily' && (
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">Shrinking Cap</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-mono font-bold text-white">
                          ৳<AnimatedNumber value={bucket.current} />
                        </span>
                        {bucket.target !== null && (
                          <span className="text-slate-500 text-sm font-medium">/ ৳{bucket.target}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {bucket.target !== null && (
                    <div className="mt-auto">
                      <div className="flex justify-between text-[10px] uppercase font-black text-slate-500 mb-2 tracking-[0.1em]">
                        <span>Allocation Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 p-[1px]">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className={`h-full bg-gradient-to-r ${bucket.color} rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                        />
                      </div>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      <footer className="mt-20 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Glass Wallet Engine v2.4</span>
        <div className="flex gap-6">
          <span className="text-[10px] font-bold uppercase tracking-widest">Security: Cloud Vault Ready</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">Methodology: Waterfall + Shrinking Cap</span>
        </div>
      </footer>

      <Toaster position="bottom-center" reverseOrder={false} />
    </div>
  );
};

export default App;
