import React, { useState, useEffect } from "react";
import { Gift, Trash2, CreditCard, Clock, Users as UsersIcon, Edit, Check, X } from "lucide-react";
import { format } from "date-fns";
import { useSocket } from "../../hooks/useSocket";
import { useCurrency } from "../../context/CurrencyContext";
import { convertPrice } from "../../utils/currency";
import { apiFetch } from '../../utils/api';

export default function AdminPromoCodes() {
  const socket = useSocket();
  const { sypRate, tryRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<'manual' | 'promo'>('manual');
  const [settings, setSettings] = useState({ syp_rate: "1", try_rate: "1" });
  
  // Promo Codes State
  const [codes, setCodes] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState("balance");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("$");
  const [usageLimit, setUsageLimit] = useState("0");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingCode, setEditingCode] = useState<any>(null);
  const [editingCategoriesFor, setEditingCategoriesFor] = useState<any>(null);
  const [selectedPromoForUsage, setSelectedPromoForUsage] = useState<any>(null);

  // Manual Transactions State
  const [manualTransactions, setManualTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchCodes();
    fetchManualTransactions();
    fetchCategories();
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then(setSettings)
      .catch(console.error);

    if (socket) {
      socket.on('promo_codes_updated', fetchCodes);
      socket.on('balance_updated', fetchManualTransactions);
      socket.on('categories_updated', fetchCategories);
      return () => {
        socket.off('promo_codes_updated', fetchCodes);
        socket.off('balance_updated', fetchManualTransactions);
        socket.off('categories_updated', fetchCategories);
      };
    }
  }, [socket]);

  const fetchCategories = async () => {
    try {
      const res = await apiFetch("/api/categories");
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCodes = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/admin/promo-codes-with-usage");
      if (!res.ok) {
        const text = await res.text();
        console.error(`Fetch error (${res.status}):`, text);
        throw new Error(`Failed to fetch promo codes: ${res.status}`);
      }
      const data = await res.json();
      setCodes(data);
    } catch (err) {
      console.error('fetchCodes error:', err);
      if (retries > 0) {
        setTimeout(() => fetchCodes(retries - 1), 1000);
      }
    }
  };

  const fetchManualTransactions = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/admin/manual-transactions");
      if (!res.ok) {
        const text = await res.text();
        console.error(`Fetch error (${res.status}):`, text);
        throw new Error(`Failed to fetch manual transactions: ${res.status}`);
      }
      const data = await res.json();
      setManualTransactions(data);
    } catch (err) {
      console.error('fetchManualTransactions error:', err);
      if (retries > 0) {
        setTimeout(() => fetchManualTransactions(retries - 1), 1000);
      }
    }
  };

  const calculateAmount = (amt: number, fromCurrency: string) => {
    return convertPrice(amt, fromCurrency, "$", sypRate, tryRate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await apiFetch("/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase(),
          type,
          value: parseFloat(value),
          currency,
          usage_limit: parseInt(usageLimit) || 0,
          excluded_categories: excludedCategories,
        }),
      });

      const data = await res.json().catch(() => ({ error: "حدث خطأ أثناء إضافة الكود" }));
      if (res.ok) {
        setMessage(`تم إضافة الكود بنجاح (${value} ${currency})`);
        setCode("");
        setValue("");
        setUsageLimit("0");
        setExcludedCategories([]);
        fetchCodes();
      } else {
        setError(data.error || "حدث خطأ أثناء إضافة الكود");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الكود؟")) return;
    try {
      const res = await apiFetch(`/api/promo-codes/${id}`, { method: "DELETE" });
      if (res.ok) fetchCodes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCode = async (id: number) => {
    try {
      const res = await apiFetch(`/api/promo-codes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editingCode.code.toUpperCase(),
          type: editingCode.type,
          value: editingCode.value,
          currency: editingCode.currency,
          usage_limit: editingCode.usage_limit,
          excluded_categories: editingCode.excluded_categories,
        }),
      });
      if (res.ok) {
        setEditingCode(null);
        fetchCodes();
      } else {
        alert("حدث خطأ أثناء التحديث");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUsage = async (usageId: number) => {
    if (!confirm("هل أنت متأكد من حذف سجل الاستخدام هذا؟")) return;
    try {
      const res = await apiFetch(`/api/admin/promo-codes/usage/${usageId}`, { method: "DELETE" });
      if (res.ok) fetchCodes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Gift className="w-6 h-6 ml-2 text-indigo-600" />
          الشحن والسحب وأكواد الإحالة
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'manual'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <CreditCard className="w-4 h-4 ml-2" />
              الشحن والسحب اليدوي
            </div>
          </button>
          <button
            onClick={() => setActiveTab('promo')}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'promo'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center">
              <Gift className="w-4 h-4 ml-2" />
              أكواد الإحالة
            </div>
          </button>
        </div>

        {/* Manual Transactions Tab */}
        {activeTab === 'manual' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المعرف (ID)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العملية</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المبلغ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {manualTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">#{t.user_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{t.user_name}</span>
                        <span className="text-xs text-indigo-600 font-mono">{t.user_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                        t.transaction_number.includes('إيداع') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {t.transaction_number.includes('إيداع') ? 'إضافة رصيد' : 'سحب رصيد'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold">
                      <span className={t.transaction_number.includes('إيداع') ? 'text-green-600' : 'text-red-600'}>
                        {t.transaction_number.includes('إيداع') ? '+' : '-'}{t.amount} {t.currency}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 ml-2 text-gray-400" />
                        {format(new Date(t.created_at), "yyyy-MM-dd HH:mm")}
                      </div>
                    </td>
                  </tr>
                ))}
                {manualTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      لا توجد عمليات شحن أو سحب يدوية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Promo Codes Tab */}
        {activeTab === 'promo' && (
          <div className="space-y-8">
            {message && (
              <div className="p-4 bg-green-100 text-green-700 rounded-lg">
                {message}
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">إنشاء كود جديد</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الكود (مثال: KHALED2026)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                        let result = '';
                        for (let i = 0; i < 8; i++) {
                          result += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        setCode(result);
                      }}
                      className="bg-gray-100 text-gray-600 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors border border-gray-300 whitespace-nowrap"
                      title="توليد كود عشوائي"
                    >
                      توليد
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    نوع الكود
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  >
                    <option value="balance">إضافة رصيد للمحفظة</option>
                    <option value="discount">خصم عند الشراء (إظهار السعر القديم)</option>
                  </select>
                </div>
                {(type === "balance" || type === "discount") && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {type === "balance" ? "القيمة" : "قيمة الخصم"}
                      </label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        العملة
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                      >
                        <option value="$">$</option>
                        <option value="SYP">SYP</option>
                        <option value="TRY">TRY</option>
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حد الاستخدام (0 = غير محدود)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  />
                </div>
              </div>

              {type === "discount" && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-bold text-gray-900">الأقسام المستبعدة من الخصم</h4>
                    <div className="space-x-2 space-x-reverse">
                      <button
                        type="button"
                        onClick={() => setExcludedCategories(categories.map(c => c.id))}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => setExcludedCategories([])}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        إزالة الكل
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border rounded-md p-4 max-h-60 overflow-y-auto">
                    {categories.filter(c => !c.parent_id).map(mainCat => (
                      <div key={mainCat.id} className="mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newExpanded = new Set(expandedCategories);
                              if (newExpanded.has(mainCat.id)) newExpanded.delete(mainCat.id);
                              else newExpanded.add(mainCat.id);
                              setExpandedCategories(newExpanded);
                            }}
                            className="text-gray-500 hover:text-gray-700 w-5 h-5 flex items-center justify-center"
                          >
                            {categories.some(c => c.parent_id === mainCat.id) ? (
                              expandedCategories.has(mainCat.id) ? '▼' : '▶'
                            ) : null}
                          </button>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={excludedCategories.includes(mainCat.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setExcludedCategories([...excludedCategories, mainCat.id]);
                                } else {
                                  setExcludedCategories(excludedCategories.filter(id => id !== mainCat.id));
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{mainCat.name}</span>
                          </label>
                        </div>
                        {expandedCategories.has(mainCat.id) && (
                          <div className="mr-8 mt-2 space-y-2 border-r-2 border-gray-100 pr-4">
                            {categories.filter(c => c.parent_id === mainCat.id).map(subCat => (
                              <label key={subCat.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={excludedCategories.includes(subCat.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setExcludedCategories([...excludedCategories, subCat.id]);
                                    } else {
                                      setExcludedCategories(excludedCategories.filter(id => id !== subCat.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-600">{subCat.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    المنتجات الموجودة في الأقسام المحددة لن يتم تطبيق الخصم عليها.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full sm:w-auto flex justify-center py-3 px-8 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                إضافة الكود
              </button>
            </form>

            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الكود</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">النوع</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">القيمة</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاستخدام</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدمين</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {codes.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-indigo-600">
                          {editingCode?.id === c.id ? (
                            <input
                              type="text"
                              value={editingCode.code}
                              onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1"
                            />
                          ) : (
                            <span 
                              className="truncate max-w-[150px] inline-block cursor-pointer hover:text-indigo-800 transition-colors"
                              title={c.code}
                              onClick={() => {
                                navigator.clipboard.writeText(c.code);
                                alert("تم نسخ الكود");
                              }}
                            >
                              {c.code}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCode?.id === c.id ? (
                            <select
                              value={editingCode.type}
                              onChange={(e) => setEditingCode({ ...editingCode, type: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="balance">إضافة رصيد</option>
                              <option value="discount">خصم شراء</option>
                            </select>
                          ) : c.type === "balance" ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              إضافة رصيد
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              خصم شراء
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold">
                          {editingCode?.id === c.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editingCode.value}
                                onChange={(e) => setEditingCode({ ...editingCode, value: parseFloat(e.target.value) })}
                                className="w-20 border border-gray-300 rounded px-2 py-1"
                              />
                              <select
                                value={editingCode.currency}
                                onChange={(e) => setEditingCode({ ...editingCode, currency: e.target.value })}
                                className="border border-gray-300 rounded px-1 py-1 text-xs"
                              >
                                <option value="$">$</option>
                                <option value="SYP">SYP</option>
                                <option value="TRY">TRY</option>
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-indigo-600">{c.value} {c.currency || "$"}</span>
                              {c.currency !== "$" && (
                                <span className="text-[10px] text-gray-400 font-normal">
                                  ≈ {calculateAmount(c.value, c.currency || "$").toFixed(2)} $
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCode?.id === c.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">حد:</span>
                              <input
                                type="number"
                                min="0"
                                value={editingCode.usage_limit}
                                onChange={(e) => setEditingCode({ ...editingCode, usage_limit: parseInt(e.target.value) })}
                                className="w-16 border border-gray-300 rounded px-1 py-1 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">
                                {c.usages?.length || 0} / {c.usage_limit === 0 ? "∞" : c.usage_limit}
                              </span>
                              {c.usage_limit > 0 && c.usages?.length >= c.usage_limit && (
                                <span className="text-[10px] text-red-500 font-bold">مكتمل</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedPromoForUsage(c)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                              c.usages?.length > 0 
                                ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' 
                                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            }`}
                            disabled={!c.usages || c.usages.length === 0}
                          >
                            {c.usages?.length > 0 ? `عرض المستخدمين (${c.usages.length})` : 'لم يُستخدم بعد'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingCode?.id === c.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleUpdateCode(c.id)} className="text-green-600 hover:text-green-900">
                                <Check className="w-5 h-5" />
                              </button>
                              <button onClick={() => setEditingCode(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button onClick={() => setEditingCode(c)} className="text-indigo-600 hover:text-indigo-900" title="تعديل">
                                <Edit className="w-5 h-5" />
                              </button>
                              {c.type === 'discount' && (
                                <button onClick={() => setEditingCategoriesFor(c)} className="text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50 px-2 py-1 rounded" title="تعديل الأقسام المستبعدة">
                                  الأقسام
                                </button>
                              )}
                              <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-900" title="حذف">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden grid grid-cols-1 gap-4">
                {codes.map((c) => (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 text-lg">{c.code}</span>
                          {c.type === "balance" ? (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-800">إضافة رصيد</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800">خصم شراء</span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          القيمة: {c.value} {c.currency || "$"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingCode(c)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg">
                          <Edit className="w-4 h-4" />
                        </button>
                        {c.type === 'discount' && (
                          <button onClick={() => setEditingCategoriesFor(c)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg text-xs font-bold">
                            الأقسام
                          </button>
                        )}
                        <button onClick={() => handleDelete(c.id)} className="p-2 text-red-600 bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-gray-500 text-xs">الاستخدام</span>
                        <span className="font-bold">
                          {c.usages?.length || 0} / {c.usage_limit === 0 ? "∞" : c.usage_limit}
                        </span>
                      </div>
                      <div className="flex flex-col text-left">
                        <button
                          onClick={() => setSelectedPromoForUsage(c)}
                          disabled={!c.usages || c.usages.length === 0}
                          className="text-indigo-600 text-xs font-bold underline disabled:text-gray-400 disabled:no-underline"
                        >
                          {c.usages?.length > 0 ? `عرض المستخدمين (${c.usages.length})` : 'لم يُستخدم بعد'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {codes.length === 0 && (
                <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  لا توجد أكواد حالياً
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Usage Details Modal */}
      {selectedPromoForUsage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <div>
                <h3 className="text-xl font-bold">المستخدمين الذين استعملوا الكود</h3>
                <p className="text-indigo-100 text-sm font-mono mt-1">{selectedPromoForUsage.code}</p>
              </div>
              <button 
                onClick={() => setSelectedPromoForUsage(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {selectedPromoForUsage.usages?.map((usage: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                      {usage.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{usage.name}</div>
                      <div className="text-xs text-indigo-600 font-mono">ID: {usage.a_code}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-xs font-bold text-gray-900">{format(new Date(usage.used_at), "yyyy-MM-dd")}</div>
                      <div className="text-[10px] text-gray-500">{format(new Date(usage.used_at), "HH:mm:ss")}</div>
                    </div>
                    <button 
                      onClick={() => handleDeleteUsage(usage.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="حذف سجل الاستخدام"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedPromoForUsage(null)}
                className="px-6 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Categories Modal */}
      {editingCategoriesFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
              <div>
                <h3 className="text-xl font-bold">تعديل الأقسام المستبعدة</h3>
                <p className="text-indigo-100 text-sm font-mono mt-1">{editingCategoriesFor.code}</p>
              </div>
              <button 
                onClick={() => setEditingCategoriesFor(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <div className="space-x-2 space-x-reverse">
                  <button
                    type="button"
                    onClick={() => setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: categories.map(c => c.id) })}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    تحديد الكل
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: [] })}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    إزالة الكل
                  </button>
                </div>
              </div>
              <div className="bg-white border rounded-md p-4">
                {categories.filter(c => !c.parent_id).map(mainCat => (
                  <div key={mainCat.id} className="mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newExpanded = new Set(expandedCategories);
                          if (newExpanded.has(mainCat.id)) newExpanded.delete(mainCat.id);
                          else newExpanded.add(mainCat.id);
                          setExpandedCategories(newExpanded);
                        }}
                        className="text-gray-500 hover:text-gray-700 w-5 h-5 flex items-center justify-center"
                      >
                        {categories.some(c => c.parent_id === mainCat.id) ? (
                          expandedCategories.has(mainCat.id) ? '▼' : '▶'
                        ) : null}
                      </button>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editingCategoriesFor.excluded_categories || []).includes(mainCat.id)}
                          onChange={(e) => {
                            const current = editingCategoriesFor.excluded_categories || [];
                            if (e.target.checked) {
                              setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: [...current, mainCat.id] });
                            } else {
                              setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: current.filter((id: number) => id !== mainCat.id) });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">{mainCat.name}</span>
                      </label>
                    </div>
                    {expandedCategories.has(mainCat.id) && (
                      <div className="mr-8 mt-2 space-y-2 border-r-2 border-gray-100 pr-4">
                        {categories.filter(c => c.parent_id === mainCat.id).map(subCat => (
                          <label key={subCat.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editingCategoriesFor.excluded_categories || []).includes(subCat.id)}
                              onChange={(e) => {
                                const current = editingCategoriesFor.excluded_categories || [];
                                if (e.target.checked) {
                                  setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: [...current, subCat.id] });
                                } else {
                                  setEditingCategoriesFor({ ...editingCategoriesFor, excluded_categories: current.filter((id: number) => id !== subCat.id) });
                                }
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-600">{subCat.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setEditingCategoriesFor(null)}
                className="px-6 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/api/promo-codes/${editingCategoriesFor.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        code: editingCategoriesFor.code,
                        type: editingCategoriesFor.type,
                        value: editingCategoriesFor.value,
                        currency: editingCategoriesFor.currency,
                        usage_limit: editingCategoriesFor.usage_limit,
                        excluded_categories: editingCategoriesFor.excluded_categories,
                      }),
                    });
                    if (res.ok) {
                      setEditingCategoriesFor(null);
                      fetchCodes();
                    } else {
                      alert("حدث خطأ أثناء التحديث");
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
