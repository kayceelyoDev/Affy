import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../components/ui';
import { Plus, Trash2, Edit2, Check, X, Film, AlertTriangle, RefreshCw } from 'lucide-react';

interface ProductItem {
  id: number;
  name: string;
  category: string;
  folder_path: string;
  commission_rate: number;
  margin_rate: number;
  target_demographic?: string;
  active: boolean;
  clip_count: number;
  usable_duration: number;
}

interface AliasItem {
  id: number;
  raw_alias: string;
  confidence: number;
  status: string;
}

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [pendingAliases, setPendingAliases] = useState<AliasItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // New product form
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Electronics');
  const [newCommission, setNewCommission] = useState('0.15');

  useEffect(() => {
    fetchProducts();
    fetchPendingAliases();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/catalog/products');
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingAliases = async () => {
    try {
      const res = await fetch('/api/catalog/aliases?status_filter=pending_review');
      if (res.ok) {
        setPendingAliases(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getCsrf = () => {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrf_token='))
      ?.split('=')[1] || '';
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/catalog/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchProducts();
      } else {
        const err = await res.json();
        setErrorBanner(err.detail || 'Rename failed');
      }
    } catch (e: any) {
      setErrorBanner(e.message);
    }
  };

  const handleDelete = async (p: ProductItem) => {
    if (p.clip_count > 0) {
      setErrorBanner(`Delete Guard Triggered: Cannot delete "${p.name}" because it contains ${p.clip_count} active clips.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete "${p.name}"?`)) return;

    try {
      const res = await fetch(`/api/catalog/products/${p.id}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': getCsrf() },
      });
      if (res.ok) {
        await fetchProducts();
      } else {
        const err = await res.json();
        setErrorBanner(err.detail || 'Delete failed');
      }
    } catch (e: any) {
      setErrorBanner(e.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrf(),
        },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          commission_rate: parseFloat(newCommission) || 0.15,
        }),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewName('');
        await fetchProducts();
      }
    } catch (e: any) {
      setErrorBanner(e.message);
    }
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/catalog/catalog/rescan', {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrf() },
      });
      if (res.ok) {
        await fetchProducts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleLinkAlias = async (aliasId: number, productId: number) => {
    try {
      const res = await fetch(`/api/catalog/aliases/${aliasId}/link?product_id=${productId}`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCsrf() },
      });
      if (res.ok) {
        await fetchPendingAliases();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product Master & Clips Catalog</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Products mapped to folder structure, clip duration inventories, and TikTok title aliases.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleRescan} disabled={isScanning}>
            <RefreshCw size={14} className={isScanning ? 'animate-spin mr-1.5' : 'mr-1.5'} />
            Rescan Disk
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowNewModal(true)}>
            <Plus size={14} className="mr-1.5" />
            New Product
          </Button>
        </div>
      </div>

      {/* Error / Delete Guard Alert */}
      {errorBanner && (
        <div className="rounded-control p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="p-1 hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pending Aliases Review Queue Banner */}
      {pendingAliases.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Alias Review Queue ({pendingAliases.length} pending titles)
              </h3>
            </div>
            <span className="text-[11px] text-neutral-400">Low-confidence orders requiring manual link</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pendingAliases.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-2 rounded-control bg-white dark:bg-black hairline-border text-xs"
              >
                <div className="truncate max-w-md font-mono text-[11px]">
                  {a.raw_alias}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">Score: {(a.confidence * 100).toFixed(0)}%</span>
                  <select
                    className="h-7 text-xs rounded hairline-border bg-transparent px-2"
                    onChange={(e) => e.target.value && handleLinkAlias(a.id, parseInt(e.target.value))}
                    defaultValue=""
                  >
                    <option value="" disabled>Link to product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Products Table */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left table-dense border-collapse">
          <thead>
            <tr className="hairline-b bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 font-medium">
              <th>Product Name</th>
              <th>Category</th>
              <th>Clips</th>
              <th>Usable Dur</th>
              <th>Commission</th>
              <th>Margin</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/50 text-xs">
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400 font-sans">
                  No products found. Click "Rescan Disk" or "New Product".
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/20">
                  <td className="font-medium">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs w-48"
                          autoFocus
                        />
                        <button onClick={() => handleRename(p.id)} className="p-1 hover:text-emerald-500">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 hover:text-rose-500">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setEditName(p.name);
                          }}
                          className="opacity-40 hover:opacity-100 p-0.5"
                          title="Rename product & folder"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td><Badge>{p.category}</Badge></td>
                  <td>
                    <span className="flex items-center gap-1 font-mono">
                      <Film size={12} className="text-neutral-400" />
                      {p.clip_count}
                    </span>
                  </td>
                  <td className="font-mono text-neutral-400">{p.usable_duration}s</td>
                  <td className="font-mono">{(p.commission_rate * 100).toFixed(0)}%</td>
                  <td className="font-mono">{(p.margin_rate * 100).toFixed(0)}%</td>
                  <td>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                  </td>
                  <td>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-neutral-400 hover:text-rose-500 p-1"
                      title={p.clip_count > 0 ? "Cannot delete: delete guard active" : "Delete product"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* New Product Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card hairline-border bg-white dark:bg-[#141414] shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between hairline-b pb-2">
              <h2 className="text-sm font-semibold">Create New Product Folder</h2>
              <button onClick={() => setShowNewModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-500">Product Name</label>
                <Input
                  required
                  placeholder="e.g. Wireless Noise Cancelling Earbuds"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500">Category</label>
                  <select
                    className="w-full h-9 px-3 text-sm rounded-control hairline-border bg-transparent focus:outline-none"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Electronics" className="dark:bg-black">Electronics</option>
                    <option value="Beauty" className="dark:bg-black">Beauty</option>
                    <option value="Home" className="dark:bg-black">Home</option>
                    <option value="Fashion" className="dark:bg-black">Fashion</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500">Commission Rate</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Folder & Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
