import React, { useState, useEffect } from "react";
import { Search, ShoppingBag, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { Button, Card, Badge, Table } from "../components/ui";

interface OrderItem {
  id: number;
  order_id: string;
  status_stage: string;
  product_name: string;
  price: number;
  quantity: number;
  gmv: number;
  commission_rate: number;
  est_commission: number | null;
  actual_commission: number | null;
  settle_date_est: string | null;
  settle_date_changes: number;
  created_at: string;
}

interface SummaryData {
  total_orders: number;
  total_gmv: number;
  total_est_commission: number;
  total_settled_commission: number;
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/api/orders?page=${page}&page_size=30`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const [resOrders, resSummary] = await Promise.all([
        fetch(url),
        fetch("/api/orders/summary"),
      ]);

      if (resOrders.ok) {
        const data = await resOrders.json();
        setOrders(data.items || []);
        setTotal(data.total || 0);
      }
      if (resSummary.ok) {
        setSummary(await resSummary.json());
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Orders Master Log
          </h1>
          <p className="text-sm text-neutral-500">
            TikTok Shop Affiliate orders ingested from mobile screenshots and reports with full digit fidelity.
          </p>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">
            {summary?.total_orders.toLocaleString() ?? "-"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Gross Merchandise (GMV)</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100">
            ₱{summary?.total_gmv.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Estimated Commission</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            ₱{summary?.total_est_commission.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Settled Payouts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            ₱{summary?.total_settled_commission.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by 18-digit Order ID or Product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-md text-xs bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border rounded-md text-xs bg-white dark:bg-neutral-900"
            >
              <option value="">All Stages</option>
              <option value="unpaid">Awaiting Payment</option>
              <option value="to_ship">To Ship</option>
              <option value="shipped">In Transit (Shipped)</option>
              <option value="delivered">Delivered</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>

            <Button type="submit" size="sm">Search</Button>
          </div>
        </form>
      </Card>

      {/* Orders Table */}
      <Card className="p-4 overflow-x-auto">
        <Table>
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs font-semibold text-neutral-500">
              <th className="py-2.5">Order ID</th>
              <th className="py-2.5">Stage</th>
              <th className="py-2.5">Product</th>
              <th className="py-2.5 text-right">GMV</th>
              <th className="py-2.5 text-right">Est. Comm</th>
              <th className="py-2.5 text-right">Settled Comm</th>
              <th className="py-2.5">Settle Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="py-3 font-mono font-medium text-neutral-800 dark:text-neutral-200">
                  {o.order_id}
                </td>
                <td className="py-3">
                  <Badge
                    variant={
                      o.status_stage === "settled"
                        ? "default"
                        : o.status_stage === "shipped" || o.status_stage === "delivered"
                        ? "secondary"
                        : o.status_stage === "cancelled"
                        ? "destructive"
                        : "warning"
                    }
                  >
                    {o.status_stage}
                  </Badge>
                </td>
                <td className="py-3 max-w-xs truncate" title={o.product_name}>
                  {o.product_name}
                </td>
                <td className="py-3 text-right font-medium">₱{o.gmv.toFixed(2)}</td>
                <td className="py-3 text-right text-amber-600 dark:text-amber-400">
                  {o.est_commission ? `₱${o.est_commission.toFixed(2)}` : "-"}
                </td>
                <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                  {o.actual_commission ? `₱${o.actual_commission.toFixed(2)}` : "-"}
                </td>
                <td className="py-3 text-neutral-400 text-[11px]">
                  {o.settle_date_est || "-"}
                  {o.settle_date_changes > 0 && (
                    <span className="ml-1 text-amber-500 font-semibold" title={`Changed ${o.settle_date_changes} times`}>
                      ({o.settle_date_changes}x)
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-400">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
          <div>Showing {orders.length} of {total} orders</div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={orders.length < 30 || page * 30 >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
