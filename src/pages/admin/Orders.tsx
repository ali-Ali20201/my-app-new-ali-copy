import React, { useEffect, useState } from "react";
import { ListOrdered, CheckCircle, XCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { useSocket } from "../../hooks/useSocket";
import { apiFetch } from '../../utils/api';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const socket = useSocket();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('order_created', fetchOrders);
      socket.on('order_updated', fetchOrders);
      return () => {
        socket.off('order_created', fetchOrders);
        socket.off('order_updated', fetchOrders);
      };
    }
  }, [socket]);

  const fetchOrders = () => {
    apiFetch("/api/orders")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(setOrders)
      .catch(console.error);
  };

  const handleAction = async (id: number, status: "accepted" | "rejected") => {
    try {
      const res = await apiFetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchOrders();
        window.dispatchEvent(new Event('refreshNotifications'));
      } else {
        alert("حدث خطأ أثناء تحديث حالة الطلب");
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <ListOrdered className="w-6 h-6 ml-2 text-indigo-600" />
          طلبات الشراء
        </h1>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  اسم المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المنتج
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الهاتف / ID
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>{order.user_name}</div>
                    {order.user_a_code && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="text-xs text-indigo-600 font-mono">{order.user_a_code}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(order.user_a_code);
                            alert("تم نسخ كود المستخدم");
                          }}
                          className="text-gray-400 hover:text-indigo-600 transition-colors"
                          title="نسخ"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.product_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="text-xs text-indigo-600 font-medium mb-1 truncate max-w-[200px]" title={`${order.parent_category_name ? order.parent_category_name + ' / ' : ''}${order.category_name || ''} / ${order.product_name}`}>
                      {order.parent_category_name && <><span dir="auto">{order.parent_category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                      {order.category_name && <><span dir="auto">{order.category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                      <span dir="auto">{order.product_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span 
                        className="truncate max-w-[150px] inline-block cursor-pointer hover:text-indigo-600 transition-colors"
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
                        title="نسخ"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.status === "pending" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        قيد الانتظار
                      </span>
                    )}
                    {order.status === "accepted" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        مقبول
                      </span>
                    )}
                    {order.status === "rejected" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        مرفوض
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {order.status === "pending" && (
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleAction(order.id, "accepted")}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <CheckCircle className="w-5 h-5 ml-1" /> قبول
                        </button>
                        <button
                          onClick={() => handleAction(order.id, "rejected")}
                          className="text-red-600 hover:text-red-900 flex items-center"
                        >
                          <XCircle className="w-5 h-5 ml-1" /> رفض
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    لا توجد طلبات شراء
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-gray-900">{order.user_name}</div>
                  {order.user_a_code && (
                    <div className="flex items-center gap-1">
                      <div className="text-xs text-indigo-600 font-mono">{order.user_a_code}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.user_a_code);
                          alert("تم نسخ كود المستخدم");
                        }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {format(new Date(order.created_at), "yyyy-MM-dd HH:mm")}
                </div>
              </div>
              
              <div className="mb-3 bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-indigo-600 font-medium mb-2">
                  {order.parent_category_name && <><span dir="auto">{order.parent_category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                  {order.category_name && <><span dir="auto">{order.category_name}</span> <span className="mx-1 text-gray-400">/</span> </>}
                  <span dir="auto">{order.product_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-gray-900">{order.product_name}</div>
                  <div className="text-sm text-gray-600 font-mono flex items-center gap-1">
                    ID/Phone: 
                    <span 
                      className="truncate max-w-[120px] inline-block cursor-pointer hover:text-indigo-600 transition-colors"
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
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <div>
                  {order.status === "pending" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      قيد الانتظار
                    </span>
                  )}
                  {order.status === "accepted" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      مقبول
                    </span>
                  )}
                  {order.status === "rejected" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      مرفوض
                    </span>
                  )}
                </div>
                
                {order.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(order.id, "accepted")}
                      className="flex items-center justify-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 ml-1" /> قبول
                    </button>
                    <button
                      onClick={() => handleAction(order.id, "rejected")}
                      className="flex items-center justify-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
                    >
                      <XCircle className="w-4 h-4 ml-1" /> رفض
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              لا توجد طلبات شراء
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
