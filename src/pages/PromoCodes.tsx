import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Gift } from "lucide-react";
import { apiFetch } from '../utils/api';

export default function PromoCodes() {
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      const res = await apiFetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, user_id: user.id }),
      });

      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (res.ok) {
        if (data.type === 'balance') {
          setMessage(`تم استرداد الكود بنجاح! تمت إضافة ${data.amount} ${user?.preferred_currency} إلى رصيدك.`);
        } else {
          setMessage(`تم تفعيل كود الخصم بنجاح! ستحصل على خصم بقيمة ${data.value} ${user?.preferred_currency} على جميع المنتجات.`);
        }
        setCode("");
        refreshUser();
      } else {
        setError(data.error || "حدث خطأ أثناء استرداد الكود");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
        <h2 className="text-lg font-medium text-gray-700 mb-2">رصيدك الحالي</h2>
        <div className="text-4xl font-bold text-green-600">
          {user?.balance} {user?.preferred_currency}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Gift className="w-6 h-6 ml-2 text-indigo-600" />
          أكواد الإحالة والهدايا
        </h1>

        <p className="text-gray-600 mb-6">
          إذا كان لديك كود هدية لإضافة رصيد، يمكنك إدخاله هنا.
          <br />
          <span className="text-sm text-gray-500">
            ملاحظة: أكواد الخصم الخاصة بالمنتجات يتم إدخالها عند شراء المنتج مباشرة.
          </span>
        </p>

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

        <form onSubmit={handleRedeem} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              أدخل الكود
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-center font-mono text-lg tracking-widest uppercase"
              placeholder="مثال: WELCOME2026"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !code}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? "جاري التحقق..." : "استرداد الكود"}
          </button>
        </form>
      </div>
    </div>
  );
}
