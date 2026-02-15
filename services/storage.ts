
import { Bucket, Transaction } from '../types';

export interface AppData {
  buckets: Bucket[];
  transactions: Transaction[];
  lastSync: string;
}

const API_ENDPOINT = '/.netlify/functions/api';

export const StorageService = {
  /**
   * Saves data to MongoDB via Netlify Functions
   */
  async save(data: AppData): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Cloud save rejected: ${response.status} - ${errorText}`);
      }
      
      // Always sync to local storage as a reliable fallback/cache
      localStorage.setItem('glass_wallet_backup', JSON.stringify(data));
    } catch (err) {
      // Silently fall back to local storage if the network/endpoint is unavailable
      localStorage.setItem('glass_wallet_backup', JSON.stringify(data));
    }
  },

  /**
   * Loads data from MongoDB via Netlify Functions
   */
  async load(): Promise<AppData | null> {
    try {
      const response = await fetch(API_ENDPOINT);
      
      // If endpoint doesn't exist (404), we are likely in local dev without Netlify CLI
      if (response.status === 404) {
        console.info("Cloud API not found (likely local dev). Using local cache.");
        return this.getLocalBackup();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        console.error("Cloud database error:", errorData.error);
        return this.getLocalBackup();
      }
      
      const data = await response.json();
      
      if (!data) {
        return this.getLocalBackup();
      }

      // Format dates correctly from the wire
      return {
        ...data,
        transactions: (data.transactions || []).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }))
      };
    } catch (err) {
      // Network failures (offline, CORS, etc)
      return this.getLocalBackup();
    }
  },

  getLocalBackup(): AppData | null {
    const backup = localStorage.getItem('glass_wallet_backup');
    if (!backup) return null;
    try {
      const parsed = JSON.parse(backup);
      return {
        ...parsed,
        transactions: (parsed.transactions || []).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp)
        }))
      };
    } catch {
      return null;
    }
  }
};
