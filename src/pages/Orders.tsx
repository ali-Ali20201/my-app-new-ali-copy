import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Copy } from "lucide-react";
import { format } from "date-fns";
import { useSocket } from "../hooks/useSocket";
import { apiFetch } from '../utils/api';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [recharges, setRecharges] = useState<any[]>([]);
  const socket = useSocket();

  useEffect(() => {
    if (!user || typeof user.id !== 'number') return;

    const fetchData = () => {
      apiFetch(`/api/orders?user_id=${user.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch orders');
          return res.json();
        })
        .then(setOrders)
        .catch(console.error);

      apiFetch(`/api/recharge?user_id=${user.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch recharges');
          return res.json();
        })
        .then(setRecharges)
        .catch(console.error);

      // Mark notifications as read
      apiFetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      .then(() => {
        window.dispatchEvent(new Event('refreshNotifications'));
      })
      .catch(console.error);
    };

    fetchData();

    if (socket) {
      const handleOrderUpdate = (data: any) => {
        if (data.userId === user.id) fetchData();
      };
      const handleRechargeUpdate = (data: any) => {
        if (data.userId === user.id) fetchData();
      };

      socket.on('order_updated', handleOrderUpdate);
      socket.on('recharge_updated', handleRechargeUpdate);
      socket.on('order_created', () => fetchData());
      socket.on('recharge_requested', () => fetchData());
      
      const handleAppRefresh = () => {
        fetchData();
      };
      window.addEventListener('app-refresh', handleAppRefresh);

      return () => {
        socket.off('order_updated', handleOrderUpdate);
        socket.off('recharge_updated', handleRechargeUpdate);
        socket.off('order_created');
        socket.off('recharge_requested');
        window.removeEventListener('app-refresh', handleAppRefresh);
      };
    }
  }, [user, socket]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
            مقبول
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
            مرفوض
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
            قيد الانتظار
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">طلبات الشراء</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {orders.length === 0 ? (
              <li className="p-4 text-gray-500 text-center">
                لا توجد طلبات شراء
              </li>
            ) : (
              orders.map((order) => (
                <li
                  key={order.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center">
                    <div className="min-w-0">
                      <div className="text-xs text-indigo-600 font-medium mb-1 truncate max-w-[250px]" title={`${order.parent_category_name ? order.parent_category_name + ' / ' : ''}${order.category_name || ''} / ${order.product_name}`}>
                        {order.parent_category_name && <><span dir="auto">{order.parent_category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                        {order.category_name && <><span dir="auto">{order.category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                        <span dir="auto">{order.product_name}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {order.product_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        التاريخ:{" "}
                        {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <span>الهاتف/ID:</span>
                        <span 
                          className="truncate max-w-[120px] inline-block cursor-pointer hover:text-indigo-600 transition-colors font-mono"
                          title={order.phone_or_id}
                          onClick={() => {
                            navigator.clipboard.writeText(order.phone_or_id);
                            alert("تم نسخ رقم اللاعب / ID");
                          }}
                        >
                          {order.phone_or_id}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(order.phone_or_id);
                            alert("تم نسخ رقم اللاعب / ID");
                          }}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-4 space-x-reverse w-full sm:w-auto mt-2 sm:mt-0">
                    <span className="text-sm font-bold text-indigo-600">
                      {order.product_price}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">طلبات الشحن</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {recharges.length === 0 ? (
              <li className="p-4 text-gray-500 text-center">
                لا توجد طلبات شحن
              </li>
            ) : (
              recharges.map((req) => (
                <li
                  key={req.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    req.transaction_number === 'سحب من قبل المسؤول' ? 'bg-red-50' : 
                    req.transaction_number === 'إيداع من قبل المسؤول' ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                      {req.transaction_number === 'سحب من قبل المسؤول' || req.transaction_number === 'إيداع من قبل المسؤول' 
                        ? req.transaction_number 
                        : (
                          <>
                            <span>رقم العملية:</span>
                            <span 
                              className="truncate max-w-[120px] inline-block cursor-pointer hover:text-indigo-600 transition-colors font-mono"
                              title={req.transaction_number}
                              onClick={() => {
                                navigator.clipboard.writeText(req.transaction_number);
                                alert("تم نسخ رقم العملية");
                              }}
                            >
                              {req.transaction_number}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(req.transaction_number);
                                alert("تم نسخ رقم العملية");
                              }}
                              className="text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      التاريخ:{" "}
                      {format(new Date(req.created_at), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end space-x-4 space-x-reverse w-full sm:w-auto mt-2 sm:mt-0">
                    <span className={`text-sm font-bold ${
                      req.transaction_number === 'سحب من قبل المسؤول' ? 'text-red-600' : 'text-indigo-600'
                    }`}>
                      {req.transaction_number === 'سحب من قبل المسؤول' ? '-' : '+'}{req.amount} {req.currency}
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
