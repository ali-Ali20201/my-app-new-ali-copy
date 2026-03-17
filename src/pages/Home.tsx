import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShoppingCart, Folder, ChevronRight, Gift } from "lucide-react";
import { io } from "socket.io-client";
import { useCurrency } from "../context/CurrencyContext";
import { convertPrice } from "../utils/currency";
import { apiFetch } from '../utils/api';

type Product = {
  id: number;
  name: string;
  description: string;
  image_url: string;
  price: number;
  old_price: number | null;
  category_id: number | null;
  currency: string;
  profit_try: number;
  has_quantity: boolean;
  quantity: number;
};

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  image_url: string | null;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(null);
  const { user, refreshUser } = useAuth();
  const { sypRate, tryRate, convert } = useCurrency();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [phoneOrId, setPhoneOrId] = useState("");
  const [activeDiscount, setActiveDiscount] = useState<{ value: number, code: string, currency: string, excluded_categories?: number[] } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
    if (user) {
      fetchUserDiscount();
    }

    const socket = io();
    socket.on("categories_updated", () => {
      fetchData();
    });
    socket.on("products_updated", () => {
      fetchData();
    });
    socket.on("promo_codes_updated", () => {
      if (user) {
        fetchUserDiscount();
      }
    });

    const handleAppRefresh = () => {
      fetchData();
      if (user) fetchUserDiscount();
    };

    window.addEventListener('app-refresh', handleAppRefresh);

    return () => {
      socket.disconnect();
      window.removeEventListener('app-refresh', handleAppRefresh);
    };
  }, [user]);

  const fetchUserDiscount = async () => {
    try {
      const res = await apiFetch(`/api/users/${user?.id}/discount`);
      if (res.ok) {
        const data = await res.json();
        setActiveDiscount(data.discount || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async (retries = 3, delay = 1000) => {
    try {
      const [prodRes, catRes] = await Promise.all([
        apiFetch("/api/products"),
        apiFetch("/api/categories")
      ]);
      
      if (!prodRes.ok || !catRes.ok) throw new Error('Failed to fetch data');

      const prodData = await prodRes.json();
      const catData = await catRes.json();
      
      if (Array.isArray(prodData)) setProducts(prodData);
      if (Array.isArray(catData)) setCategories(catData);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchData(retries - 1, delay * 2), delay);
      } else {
        console.error('Failed to fetch data after retries:', err);
      }
    }
  };

  const handleBuy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !user) return;
    
    if (!user.preferred_currency || user.preferred_currency === "") {
      setError("يجب عليك اختيار العملة أولاً للمتابعة");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          product_id: selectedProduct.id,
          phone_or_id: phoneOrId,
        }),
      });

      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (!res.ok) {
        setError(data.error || "حدث خطأ أثناء الشراء");
      } else {
        setSuccess(
          "تم إرسال طلب الشراء بنجاح! يمكنك متابعة حالته من قائمة طلباتي.",
        );
        setSelectedProduct(null);
        setPhoneOrId("");
        refreshUser(); // Update balance
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    }
  };

  const currentCategories = categories.filter(c => c.parent_id === currentCategoryId);
  const currentProducts = products.filter(p => p.category_id === currentCategoryId);

  const handleBack = () => {
    if (currentCategoryId === null) return;
    const currentCat = categories.find(c => c.id === currentCategoryId);
    if (currentCat) {
      setCurrentCategoryId(currentCat.parent_id);
    } else {
      setCurrentCategoryId(null);
    }
  };

  const isProductExcluded = (categoryId: number | null) => {
    if (!activeDiscount || !activeDiscount.excluded_categories || !categoryId) return false;
    const category = categories.find(c => c.id === categoryId);
    if (!category) return false;
    
    const excluded = Array.isArray(activeDiscount.excluded_categories) 
      ? activeDiscount.excluded_categories.map(Number) 
      : [];
    
    if (excluded.includes(Number(category.id))) return true;
    if (category.parent_id && excluded.includes(Number(category.parent_id))) return true;
    
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {currentCategoryId === null ? "الرئيسية" : categories.find(c => c.id === currentCategoryId)?.name}
        </h1>
        {currentCategoryId !== null && (
          <button
            onClick={handleBack}
            className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <ChevronRight className="w-5 h-5 ml-1" />
            رجوع
          </button>
        )}
      </div>

      {success && (
        <div className="p-4 bg-green-100 text-green-700 rounded-md">
          {success}
        </div>
      )}

      {currentCategories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {currentCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCurrentCategoryId(category.id)}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col items-center justify-center text-center group"
            >
              {category.image_url ? (
                <img 
                  src={category.image_url} 
                  alt={category.name} 
                  className="w-24 h-24 object-contain rounded-lg mb-3 bg-gray-50" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/cat/200/200';
                  }}
                />
              ) : (
                <Folder className="w-16 h-16 text-indigo-400 group-hover:text-indigo-600 mb-3 transition-colors" />
              )}
              <span className="font-medium text-gray-900">{category.name}</span>
            </button>
          ))}
        </div>
      )}

      {currentProducts.length > 0 ? (
        <div className="space-y-4">
          {currentProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
            >
              {product.has_quantity && product.quantity <= 0 && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <div className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg transform -rotate-3 border-2 border-white">
                    لقد نفد المنتج
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 flex-1">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-20 h-20 object-contain rounded-lg border border-gray-50 bg-gray-50 flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/placeholder/200/200';
                    }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {product.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                <div className="flex flex-col items-end">
                  {activeDiscount && !isProductExcluded(product.category_id) ? (
                    <>
                      <span className="text-xl font-bold text-indigo-600">
                        {(() => {
                          const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
                            ? product.price + (product.profit_try || 0)
                            : product.price + (product.profit_try || 0) / tryRate;
                          const priceInUserCurrency = convertPrice(basePrice, product.currency, user?.preferred_currency || '$', sypRate, tryRate);
                          const discountInUserCurrency = convertPrice(activeDiscount.value, activeDiscount.currency, user?.preferred_currency || '$', sypRate, tryRate);
                          return Math.max(0, priceInUserCurrency - discountInUserCurrency).toFixed(2);
                        })()} {user?.preferred_currency || '$'}
                      </span>
                      <span className="text-sm text-gray-400 line-through">
                        {(() => {
                          const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
                            ? product.price + (product.profit_try || 0)
                            : product.price + (product.profit_try || 0) / tryRate;
                          return convertPrice(basePrice, product.currency, user?.preferred_currency || '$', sypRate, tryRate).toFixed(2);
                        })()} {user?.preferred_currency || '$'}
                      </span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-indigo-600">
                      {(() => {
                        const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
                          ? product.price + (product.profit_try || 0)
                          : product.price + (product.profit_try || 0) / tryRate;
                        return convertPrice(basePrice, product.currency, user?.preferred_currency || '$', sypRate, tryRate).toFixed(2);
                      })()} {user?.preferred_currency || '$'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!user?.preferred_currency || user.preferred_currency === "") {
                      alert("يجب عليك اختيار العملة أولاً للمتابعة");
                      return;
                    }
                    setSelectedProduct(product);
                  }}
                  disabled={product.has_quantity && product.quantity <= 0}
                  className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4 ml-2" />
                  شراء
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        currentCategories.length === 0 && currentCategoryId !== null && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100 text-gray-500">
            لا توجد منتجات في هذا القسم حالياً.
          </div>
        )
      )}

      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setSelectedProduct(null);
            setError("");
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">تأكيد الشراء</h2>
            <div className="flex items-center space-x-4 space-x-reverse mb-6">
              {selectedProduct.image_url && (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-20 h-20 object-contain rounded-lg border bg-gray-50"
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <h3 className="font-semibold text-xl">{selectedProduct.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  {activeDiscount && (!activeDiscount.excluded_categories || !activeDiscount.excluded_categories.includes(selectedProduct.category_id || 0)) ? (
                    <>
                      <p className="text-indigo-600 font-bold text-lg">
                        {(() => {
                          const basePrice = selectedProduct.currency === 'TRY' || selectedProduct.currency === 'ل.ت'
                            ? selectedProduct.price + (selectedProduct.profit_try || 0)
                            : selectedProduct.price + (selectedProduct.profit_try || 0) / tryRate;
                          const priceInUserCurrency = convertPrice(basePrice, selectedProduct.currency, user?.preferred_currency || '$', sypRate, tryRate);
                          const discountInUserCurrency = convertPrice(activeDiscount.value, activeDiscount.currency, user?.preferred_currency || '$', sypRate, tryRate);
                          return Math.max(0, priceInUserCurrency - discountInUserCurrency).toFixed(2);
                        })()} {user?.preferred_currency || '$'}
                      </p>
                      <p className="text-gray-400 line-through text-sm">
                        {(() => {
                          const basePrice = selectedProduct.currency === 'TRY' || selectedProduct.currency === 'ل.ت'
                            ? selectedProduct.price + (selectedProduct.profit_try || 0)
                            : selectedProduct.price + (selectedProduct.profit_try || 0) / tryRate;
                          return convertPrice(basePrice, selectedProduct.currency, user?.preferred_currency || '$', sypRate, tryRate).toFixed(2);
                        })()} {user?.preferred_currency || '$'}
                      </p>
                    </>
                  ) : (
                    <p className="text-indigo-600 font-bold text-lg">
                      {(() => {
                        const basePrice = selectedProduct.currency === 'TRY' || selectedProduct.currency === 'ل.ت'
                          ? selectedProduct.price + (selectedProduct.profit_try || 0)
                          : selectedProduct.price + (selectedProduct.profit_try || 0) / tryRate;
                        return convertPrice(basePrice, selectedProduct.currency, user?.preferred_currency || '$', sypRate, tryRate).toFixed(2);
                      })()} {user?.preferred_currency || '$'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleBuy} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  رقم الهاتف أو المعرف (ID)
                </label>
                <input
                  type="text"
                  required
                  value={phoneOrId}
                  onChange={(e) => setPhoneOrId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                  placeholder="أدخل رقم الهاتف أو ID"
                />
              </div>
              {activeDiscount && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-sm text-green-700 font-medium flex items-center">
                    <Gift className="w-4 h-4 ml-2" />
                    تم تطبيق خصم الكود: {activeDiscount.code}
                  </p>
                </div>
              )}
              <div className="flex space-x-3 space-x-reverse pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 font-medium"
                >
                  تأكيد الطلب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setError("");
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
