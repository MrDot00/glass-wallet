
export interface Bucket {
  id: string;
  name: string;
  current: number;
  target: number | null;
  isPaid?: boolean;
  priority: number;
  icon: string;
  color: string;
}

export type ActionType = 'income' | 'spend';

export interface Transaction {
  id: string;
  type: ActionType;
  amount: number;
  timestamp: Date;
  note: string;
}
