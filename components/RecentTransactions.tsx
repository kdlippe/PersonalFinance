import { Transaction, Account } from '@/lib/types';
import { format } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';

// Helper function to parse date string without timezone issues
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface RecentTransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
}

export default function RecentTransactions({ transactions, accounts }: RecentTransactionsProps) {
  const getAccountName = (accountId: number) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'income':
        return <ArrowUpCircle className="text-green-600 dark:text-green-400" size={20} />;
      case 'expense':
        return <ArrowDownCircle className="text-red-600 dark:text-red-400" size={20} />;
      case 'transfer':
        return <ArrowRightLeft className="text-blue-600 dark:text-blue-400" size={20} />;
      default:
        return null;
    }
  };

  if (transactions.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No transactions yet</p>;
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div 
          key={transaction.id} 
          className={`flex items-center justify-between gap-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
            transaction.category === 'Uncategorized' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-400 dark:border-l-yellow-600 pl-2' : ''
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {getTransactionIcon(transaction.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate" title={transaction.description}>
                {transaction.description}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="whitespace-nowrap">{format(parseLocalDate(transaction.date), 'MMM d, yyyy')}</span>
                <span>•</span>
                <span className="truncate" title={getAccountName(transaction.accountId)}>
                  {getAccountName(transaction.accountId)}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {(() => {
              const isCreditCard = accounts.find(a => a.id === transaction.accountId)?.type === 'credit_card';
              const isRefund = transaction.type === 'expense' && transaction.amount > 0 && isCreditCard;
              const amountColor = transaction.type === 'income' ? 'text-green-600 dark:text-green-400' :
                isRefund ? 'text-green-600 dark:text-green-400' :
                transaction.type === 'expense' ? 'text-red-600 dark:text-red-400' :
                'text-gray-900 dark:text-gray-100';
              const prefix = isRefund ? '+' : transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : transaction.amount < 0 ? '-' : '+';
              return (
                <>
                  <p className={`font-semibold whitespace-nowrap ${amountColor}`}>
                    {prefix}${Math.abs(transaction.amount).toFixed(2)}
                    {isRefund ? ' ↩' : ''}
                  </p>
                  <p className={`text-xs truncate max-w-[100px] ${
                    transaction.category === 'Uncategorized' 
                      ? 'text-yellow-700 dark:text-yellow-400 font-semibold' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`} title={transaction.category}>
                    {transaction.category}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      ))}
    </div>
  );
}
