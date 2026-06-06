import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { watchlistService, Watchlist } from '@/services/watchlistService';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface AddToWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  companyName: string;
  sourceModule: string;
  currentPrice: number;
}

export default function AddToWatchlistModal({
  isOpen,
  onClose,
  symbol,
  companyName,
  sourceModule,
  currentPrice
}: AddToWatchlistModalProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadWatchlists();
      setError(null);
      setIsCreatingNew(false);
      setNewWatchlistName('');
    }
  }, [isOpen]);

  const loadWatchlists = async () => {
    try {
      setLoading(true);
      const data = await watchlistService.getWatchlists();
      setWatchlists(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (watchlistId: string) => {
    try {
      setAddingTo(watchlistId);
      setError(null);
      await watchlistService.addStock(watchlistId, {
        symbol,
        company_name: companyName,
        source_module: sourceModule,
        added_price: currentPrice
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;
    
    try {
      setAddingTo('new');
      setError(null);
      const newWl = await watchlistService.createWatchlist(newWatchlistName);
      await handleAdd(newWl.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create watchlist');
      setAddingTo(null);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                    Add to Watchlist
                  </Dialog.Title>
                  <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="mb-4 text-sm text-slate-400">
                  Select a watchlist to add <span className="font-semibold text-white">{symbol}</span>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="py-8 text-center text-slate-500">Loading watchlists...</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {watchlists.map(wl => (
                      <button
                        key={wl.id}
                        onClick={() => handleAdd(wl.id)}
                        disabled={addingTo !== null}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all text-left"
                      >
                        <div>
                          <div className="text-white font-medium">{wl.name}</div>
                          <div className="text-xs text-slate-400">{wl.stock_count} stocks</div>
                        </div>
                        {addingTo === wl.id && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                      </button>
                    ))}
                    {watchlists.length === 0 && !isCreatingNew && (
                      <div className="text-center py-4 text-slate-500 text-sm">
                        No watchlists found. Create one to get started!
                      </div>
                    )}
                  </div>
                )}

                {!isCreatingNew ? (
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Create New Watchlist
                  </button>
                ) : (
                  <form onSubmit={handleCreateAndAdd} className="mt-4 space-y-3">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Swing Trades"
                      value={newWatchlistName}
                      onChange={e => setNewWatchlistName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingNew(false)}
                        className="flex-1 py-2 px-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newWatchlistName.trim() || addingTo !== null}
                        className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                      >
                        {addingTo === 'new' ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : 'Create & Add'}
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
