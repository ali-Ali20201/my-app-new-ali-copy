import React, { useEffect, useState } from "react";
import { CreditCard, CheckCircle, XCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { useSocket } from "../../hooks/useSocket";
import { apiFetch } from '../../utils/api';

export default function Recharges() {
  const [requests, setRequests] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ syp_rate: "15000", try_rate: "32" });
  const socket = useSocket();

  useEffect(() => {
    fetchRequests();
    apiFetch("/api/settings")
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then(setSettings)
      .catch(console.error);
  }, []);

  const convertCurrency = (amount: number, from: string, to: string) => {
    const fromMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
    const toMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
    
    const normalizedFrom = fromMap[from] || from;
    const normalizedTo = toMap[to] || to;
    
    if (normalizedFrom === normalizedTo) return amount;
    
    let inUsd = amount;
    if (normalizedFrom === 'SYR') inUsd = amount / parseFloat(settings.syp_rate);
    else if (normalizedFrom === 'TRY') inUsd = amount / parseFloat(settings.try_rate);
    
    let result = inUsd;
    if (normalizedTo === 'SYR') result = inUsd * parseFloat(settings.syp_rate);
    else if (normalizedTo === 'TRY') result = inUsd * parseFloat(settings.try_rate);
    
    return Math.round(result * 100) / 100;
  };

  useEffect(() => {
    if (socket) {
      socket.on('recharge_requested', fetchRequests);
      socket.on('recharge_updated', fetchRequests);
      return () => {
        socket.off('recharge_requested', fetchRequests);
        socket.off('recharge_updated', fetchRequests);
      };
    }
  }, [socket]);

  const fetchRequests = () => {
    apiFetch("/api/recharge")
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`Fetch error (${res.status}):`, text);
          throw new Error(`Failed to fetch recharges: ${res.status}`);
        }
        return res.json();
      })
      .then(setRequests)
      .catch(console.error);
  };

  const handleAction = async (id: number, status: "accepted" | "rejected") => {
    try {
      const res = await apiFetch(`/api/recharge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchRequests();
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
          <CreditCard className="w-6 h-6 ml-2 text-indigo-600" />
          طلبات الشحن
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
                  رقم العملية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المبلغ المرسل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  المبلغ في الرصيد
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
              {requests.map((req) => (
                <tr key={req.id} className={
                  req.transaction_number === 'سحب من قبل المسؤول' ? 'bg-red-50' : 
                  req.transaction_number === 'إيداع من قبل المسؤول' ? 'bg-green-50' : ''
                }>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>{req.user_name}</div>
                    {req.user_a_code && (
                      <div className="flex items-center gap-1 mt-1">
                        <div className="text-xs text-indigo-600 font-mono">{req.user_a_code}</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(req.user_a_code);
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
                    {format(new Date(req.created_at), "yyyy-MM-dd HH:mm")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span 
                        className="truncate max-w-[150px] inline-block cursor-pointer hover:text-indigo-600 transition-colors"
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
                        title="نسخ"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                    req.transaction_number === 'سحب من قبل المسؤول' ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {req.transaction_number === 'سحب من قبل المسؤول' ? '-' : '+'}{req.amount} {req.currency}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                    req.transaction_number === 'سحب من قبل المسؤول' ? 'text-red-600' : 'text-indigo-600'
                  }`}>
                    {req.transaction_number === 'سحب من قبل المسؤول' ? '-' : '+'}{convertCurrency(req.amount, req.currency, req.user_currency)} {req.user_currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {req.status === "pending" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        قيد الانتظار
                      </span>
                    )}
                    {req.status === "accepted" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        مقبول
                      </span>
                    )}
                    {req.status === "rejected" && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        مرفوض
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {req.status === "pending" && (
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleAction(req.id, "accepted")}
                          className="text-green-600 hover:text-green-900 flex items-center"
                        >
                          <CheckCircle className="w-5 h-5 ml-1" /> قبول
                        </button>
                        <button
                          onClick={() => handleAction(req.id, "rejected")}
                          className="text-red-600 hover:text-red-900 flex items-center"
                        >
                          <XCircle className="w-5 h-5 ml-1" /> رفض
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    لا توجد طلبات شحن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-4">
          {requests.map((req) => (
            <div key={req.id} className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm ${
              req.transaction_number === 'سحب من قبل المسؤول' ? 'bg-red-50' : 
              req.transaction_number === 'إيداع من قبل المسؤول' ? 'bg-green-50' : ''
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-gray-900">{req.user_name}</div>
                  {req.user_a_code && (
                    <div className="flex items-center gap-1">
                      <div className="text-xs text-indigo-600 font-mono">{req.user_a_code}</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(req.user_a_code);
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
                  {format(new Date(req.created_at), "yyyy-MM-dd HH:mm")}
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg mb-3">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-500">رقم العملية:</span>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm font-medium truncate max-w-[150px] cursor-pointer hover:text-indigo-600 transition-colors"
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
                  </div>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-500">المبلغ المرسل:</span>
                  <span className={`text-sm font-bold ${
                    req.transaction_number === 'سحب من قبل المسؤول' ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {req.transaction_number === 'سحب من قبل المسؤول' ? '-' : '+'}{req.amount} {req.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">في الرصيد:</span>
                  <span className={`text-sm font-bold ${
                    req.transaction_number === 'سحب من قبل المسؤول' ? 'text-red-600' : 'text-indigo-600'
                  }`}>
                    {req.transaction_number === 'سحب من قبل المسؤول' ? '-' : '+'}{convertCurrency(req.amount, req.currency, req.user_currency)} {req.user_currency}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4">
                <div>
                  {req.status === "pending" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      قيد الانتظار
                    </span>
                  )}
                  {req.status === "accepted" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      مقبول
                    </span>
                  )}
                  {req.status === "rejected" && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      مرفوض
                    </span>
                  )}
                </div>
                
                {req.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(req.id, "accepted")}
                      className="flex items-center justify-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 ml-1" /> قبول
                    </button>
                    <button
                      onClick={() => handleAction(req.id, "rejected")}
                      className="flex items-center justify-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
                    >
                      <XCircle className="w-4 h-4 ml-1" /> رفض
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
              لا توجد طلبات شحن
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
