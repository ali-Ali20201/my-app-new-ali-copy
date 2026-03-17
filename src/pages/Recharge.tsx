import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { UploadCloud } from "lucide-react";
import FormattedText from "../components/FormattedText";
import { useSocket } from "../hooks/useSocket";
import { apiFetch } from '../utils/api';

export default function Recharge() {
  const { user } = useAuth();
  const socket = useSocket();
  const [settings, setSettings] = useState({
    recharge_text: "",
    recharge_image: "",
    syp_rate: "1",
    try_rate: "1",
  });
  const [transactionNumber, setTransactionNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("$");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchSettings = () => {
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then(setSettings)
      .catch(console.error);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('settings_updated', fetchSettings);
      return () => {
        socket.off('settings_updated', fetchSettings);
      };
    }
  }, [socket]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMessage("");
    setError("");

    try {
      const res = await apiFetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          transaction_number: transactionNumber,
          amount: parseFloat(amount),
          currency,
        }),
      });

      if (res.ok) {
        setMessage("تم إرسال طلب الشحن بنجاح! سيتم مراجعته من قبل الإدارة.");
        setTransactionNumber("");
        setAmount("");
      } else {
        const data = await res.json().catch(() => ({ error: "حدث خطأ أثناء إرسال الطلب" }));
        setError(data.error || "حدث خطأ أثناء إرسال الطلب");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <UploadCloud className="w-6 h-6 ml-2 text-indigo-600" />
          شحن الرصيد
        </h1>
        
        <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-indigo-900 font-bold space-y-2">
          <p className="text-lg border-b border-indigo-200 pb-2 mb-2">أسعار الصرف المعتمدة:</p>
          <div className="grid grid-cols-1 gap-2">
            <p>1 دولار ($) = {settings.syp_rate} ليرة سورية (SYR)</p>
            <p>1 دولار ($) = {settings.try_rate} ليرة تركية (TRY)</p>
          </div>
        </div>

        {settings.recharge_text && (
          <div className="p-4 bg-indigo-50 text-indigo-900 rounded-lg mb-8 text-lg leading-relaxed whitespace-pre-wrap">
            <FormattedText text={settings.recharge_text} />
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم العملية (Transaction Number)
            </label>
            <input
              type="text"
              required
              value={transactionNumber}
              onChange={(e) => setTransactionNumber(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
              placeholder="أدخل رقم العملية للتحويل"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المبلغ
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                placeholder="أدخل المبلغ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                العملة
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
              >
                <option value="$">$</option>
                <option value="SYR">SYR</option>
                <option value="TRY">TRY</option>
              </select>
            </div>
          </div>

          {amount && !isNaN(Number(amount)) && (
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <p className="text-sm text-indigo-700 mb-1">معاينة الرصيد الذي سيصلك:</p>
              <p className="text-lg font-bold text-indigo-900">
                {amount} {currency} ≈ {(() => {
                  const fromMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
                  const toMap: Record<string, string> = { '$': '$', 'SYP': 'SYR', 'TRY': 'TRY', 'ل.س': 'SYR', 'ل.ت': 'TRY', 'SYR': 'SYR' };
                  const from = fromMap[currency] || currency;
                  const to = toMap[user?.preferred_currency || '$'] || (user?.preferred_currency || '$');
                  if (from === to) return Number(amount);
                  let inUsd = Number(amount);
                  if (from === 'SYR') inUsd = Number(amount) / parseFloat(settings.syp_rate);
                  else if (from === 'TRY') inUsd = Number(amount) / parseFloat(settings.try_rate);
                  
                  let result = inUsd;
                  if (to === 'SYR') result = inUsd * parseFloat(settings.syp_rate);
                  else if (to === 'TRY') result = inUsd * parseFloat(settings.try_rate);
                  
                  return Math.round(result * 100) / 100;
                })()} {user?.preferred_currency}
              </p>
              <p className="text-xs text-indigo-500 mt-1">* سيتم إضافة هذا المبلغ إلى رصيدك بعملتك المفضلة بعد مراجعة الطلب.</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            إرسال طلب الشحن
          </button>
        </form>

        {settings.recharge_image && (
          <img
            src={settings.recharge_image}
            alt="تعليمات الشحن"
            className="w-full h-auto object-contain rounded-lg mt-8"
            referrerPolicy="no-referrer"
            onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/err/400/200'}
          />
        )}
      </div>
    </div>
  );
}
