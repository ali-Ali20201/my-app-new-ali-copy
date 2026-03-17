import React, { useState, useEffect } from "react";
import { CreditCard, Search, Plus, Minus } from "lucide-react";
import { useSocket } from "../../hooks/useSocket";
import { useCurrency } from "../../context/CurrencyContext";
import { convertPrice } from "../../utils/currency";
import { apiFetch } from '../../utils/api';

type UserData = {
  id: number;
  name: string;
  email: string;
  balance: number;
  a_code: string;
  preferred_currency: string;
};

export default function Balance() {
  const socket = useSocket();
  const { sypRate, tryRate } = useCurrency();
  const [searchCode, setSearchCode] = useState("");
  const [user, setUser] = useState<UserData | null>(null);
  const [amount, setAmount] = useState("");
  const [transactionCurrency, setTransactionCurrency] = useState("$");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (socket && user) {
      const handleBalanceUpdated = (data: any) => {
        if (data.userId === user.id) {
          setUser(prev => prev ? { ...prev, balance: data.newBalance } : null);
        }
      };
      const handleCurrencyUpdated = (data: any) => {
        if (data.userId === user.id) {
          setUser(prev => prev ? { ...prev, preferred_currency: data.preferred_currency, balance: data.newBalance } : null);
        }
      };

      socket.on('balance_updated', handleBalanceUpdated);
      socket.on('currency_updated', handleCurrencyUpdated);

      return () => {
        socket.off('balance_updated', handleBalanceUpdated);
        socket.off('currency_updated', handleCurrencyUpdated);
      };
    }
  }, [socket, user?.id]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setUser(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/api/admin/users/search?code=${searchCode}`);
      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      
      if (res.ok) {
        setUser(data);
      } else {
        setError(data.error || "المستخدم غير موجود");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const calculateAmount = (amt: number, fromCurrency: string, toCurrency: string) => {
    return convertPrice(amt, fromCurrency, toCurrency, sypRate, tryRate);
  };

  const handleUpdateBalance = async (action: "add" | "subtract") => {
    if (!user || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/admin/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: Number(amount),
          currency: transactionCurrency,
          action,
        }),
      });

      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (res.ok) {
        setMessage(`تم ${action === "add" ? "إضافة" : "خصم"} المبلغ بنجاح`);
        setUser({ ...user, balance: data.newBalance });
        setAmount("");
      } else {
        setError(data.error || "حدث خطأ أثناء تحديث الرصيد");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <CreditCard className="w-6 h-6 ml-2 text-indigo-600" />
          إدارة الرصيد
        </h1>

        <form onSubmit={handleSearch} className="mb-8 relative">
          <input
            type="text"
            required
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            placeholder="ابحث بكود المستخدم (مثال: A123456)"
            className="w-full pl-14 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            dir="auto"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading && !user ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </form>

        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
            {message}
          </div>
        )}

        {user && (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-gray-900">بيانات المستخدم المختار</h2>
              <button 
                onClick={() => setUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                إغلاق
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">اسم المستخدم</p>
                <p className="font-bold text-lg text-gray-900">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">البريد الإلكتروني</p>
                <p className="font-bold text-lg text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">كود المستخدم</p>
                <p className="font-mono font-bold text-lg text-indigo-600">{user.a_code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">الرصيد الحالي</p>
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-green-600 ${user.balance.toString().length > 4 ? 'text-lg' : 'text-2xl'}`}>
                    {user.balance} {user.preferred_currency}
                  </p>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">
                    العملة المختارة: {user.preferred_currency}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex flex-col md:flex-row gap-6 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المبلغ المراد معالجته
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0.00"
                    dir="ltr"
                  />
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عملة العملية (التي استلمت بها)
                  </label>
                  <div className="relative">
                    <select
                      value={transactionCurrency}
                      onChange={(e) => setTransactionCurrency(e.target.value)}
                      className="w-full rounded-lg border-2 border-indigo-200 px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 bg-indigo-50 appearance-none"
                    >
                      <option value="$">$ الدولار الأمريكي</option>
                      <option value="SYR">SYR الليرة السورية</option>
                      <option value="TRY">TRY الليرة التركية</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2 text-indigo-700">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              {amount && !isNaN(Number(amount)) && (
                <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100">
                  <p className="text-sm text-indigo-700 mb-1">معاينة العملية:</p>
                  <p className="text-lg font-bold text-indigo-900">
                    {transactionCurrency === user.preferred_currency ? (
                      <>{amount} {transactionCurrency}</>
                    ) : (
                      <>{amount} {transactionCurrency} ≈ {calculateAmount(Number(amount), transactionCurrency, user.preferred_currency)} {user.preferred_currency}</>
                    )}
                  </p>
                  <p className="text-xs text-indigo-500 mt-1">* سيتم إضافة/خصم هذا المبلغ من رصيد المستخدم بعملته المختارة ({user.preferred_currency}).</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => handleUpdateBalance("add")}
                  disabled={loading || !amount}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 font-bold shadow-sm"
                >
                  <Plus className="w-5 h-5 ml-2" />
                  إضافة للرصيد
                </button>
                <button
                  onClick={() => handleUpdateBalance("subtract")}
                  disabled={loading || !amount}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50 font-bold shadow-sm"
                >
                  <Minus className="w-5 h-5 ml-2" />
                  خصم من الرصيد
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
