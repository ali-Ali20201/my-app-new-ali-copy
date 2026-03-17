import React, { useState, useEffect, useRef } from "react";
import { PackagePlus, Pencil, Trash2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { io } from "socket.io-client";
import { useCurrency } from "../../context/CurrencyContext";
import { apiFetch } from '../../utils/api';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { tryRate } = useCurrency();
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [profitTry, setProfitTry] = useState("");
  const [currency, setCurrency] = useState("$");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [imageUrl, setImageUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [showSaveCategoryModal, setShowSaveCategoryModal] = useState(false);
  const [saveCategory, setSaveCategory] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const toggleCategory = (catId: number) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(catId)) newExpanded.delete(catId);
    else newExpanded.add(catId);
    setExpandedCategories(newExpanded);
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socket.on("categories_updated", () => {
      fetchData();
    });
    socket.on("products_updated", () => {
      fetchData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async (retries = 3) => {
    try {
      const [prodRes, catRes] = await Promise.all([
        apiFetch("/api/products"),
        apiFetch("/api/categories")
      ]);
      
      if (!prodRes.ok || !catRes.ok) throw new Error('Failed to fetch products or categories');

      const prodData = await prodRes.json();
      const catData = await catRes.json();
      
      if (Array.isArray(prodData)) setProducts(prodData);
      if (Array.isArray(catData)) setCategories(catData);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchData(retries - 1), 1000);
      } else {
        console.error(err);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageUrl(data.url);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          price: parseFloat(price),
          profit_try: parseFloat(profitTry || "0"),
          currency,
          category_id: categoryId === "" ? null : Number(categoryId),
          image_url: imageUrl || null,
        }),
      });

      if (res.ok) {
        setMessage(editingId ? "تم تعديل المنتج بنجاح" : "تم إضافة المنتج بنجاح");
        
        if (!editingId && saveCategory === null) {
          setShowSaveCategoryModal(true);
        } else {
          resetForm();
        }
        fetchData();
      } else {
        setMessage("حدث خطأ أثناء حفظ المنتج");
      }
    } catch (err) {
      setMessage("حدث خطأ في الاتصال");
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setProfitTry(product.profit_try?.toString() || "0");
    setCurrency(product.currency || "$");
    setCategoryId(product.category_id || "");
    setImageUrl(product.image_url || "");
    
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = (forceKeepCategory?: boolean) => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setProfitTry("");
    setCurrency("$");
    if (!forceKeepCategory && !saveCategory) {
      setCategoryId("");
    }
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getCategoryPath = (catId: number | null, visited = new Set<number>()): string => {
    if (!catId) return "القسم الرئيسي";
    if (visited.has(catId)) return "مسار دائري";
    visited.add(catId);
    
    const category = categories.find(c => c.id === catId);
    if (!category) return "غير معروف";
    if (category.parent_id) {
      return `${getCategoryPath(category.parent_id, visited)} > ${category.name}`;
    }
    return category.name;
  };

  // Group products by category
  const productsByCategory = categories.map(cat => ({
    ...cat,
    products: products.filter(p => p.category_id === cat.id)
  })).filter(cat => cat.products.length > 0);

  const productsWithoutCategory = products.filter(p => !p.category_id);

  return (
    <div className="space-y-8">
      {/* Modal for saving category */}
      {showSaveCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-center">حفظ القائمة؟</h3>
            <p className="text-gray-600 mb-6 text-center">
              هل تريد حفظ القائمة المختارة للمنتجات القادمة؟
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSaveCategory(true);
                  setShowSaveCategoryModal(false);
                  resetForm(true);
                }}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
              >
                نعم
              </button>
              <button
                onClick={() => {
                  setSaveCategory(null);
                  setShowSaveCategoryModal(false);
                  resetForm(false);
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={formRef}
        className={`bg-white rounded-xl shadow-sm p-6 border transition-all duration-300 ${
          editingId ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-100"
        }`}
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <PackagePlus className="w-6 h-6 ml-2 text-indigo-600" />
          {editingId ? "تعديل المنتج" : "إضافة منتج جديد"}
        </h1>

        {message && (
          <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم المنتج
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                السعر (USD) والربح (TRY)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  placeholder="السعر ($)"
                />
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={profitTry}
                  onChange={(e) => setProfitTry(e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  placeholder="الربح (TRY)"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                >
                  <option value="$">$</option>
                  <option value="SYP">SYP</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                القسم
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
              >
                <option value="">-- القسم الرئيسي --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCategoryPath(c.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              الوصف
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
            />
          </div>

          {imageUrl && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-2">معاينة الصورة:</p>
              <img 
                src={imageUrl} 
                alt="Preview" 
                className="w-32 h-32 object-contain rounded-lg border bg-gray-50"
                onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/200/200'}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 space-x-reverse">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
              >
                إلغاء
              </button>
            )}
            <button
              type="submit"
              className="flex-1 sm:flex-none flex justify-center py-3 px-8 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {editingId ? "حفظ التعديلات" : "إضافة المنتج"}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          المنتجات الحالية
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {productsByCategory.map(category => (
            <div key={category.id}>
              <h3 
                className="p-4 bg-gray-50 font-bold text-gray-800 cursor-pointer flex justify-between items-center"
                onClick={() => toggleCategory(category.id)}
              >
                {category.name}
                {expandedCategories.has(category.id) ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
              </h3>
              {expandedCategories.has(category.id) && category.products.map((product) => (
                <div key={product.id} className="p-4 flex items-center justify-between border-b">
                  <div className="flex items-center min-w-0 gap-3">
                    {product.image_url && (
                      <img 
                        src={product.image_url} 
                        alt="" 
                        className="w-10 h-10 object-contain rounded border bg-gray-50"
                        onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/err/100/100'}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {product.description}
                      </p>
                      <p className="text-xs text-indigo-600 font-bold mt-1">
                        {(() => {
                          const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
                            ? Number(product.price) + Number(product.profit_try || 0)
                            : Number(product.price) + (Number(product.profit_try || 0) / tryRate);
                          return basePrice.toFixed(2);
                        })()} {product.currency || "$"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium p-2"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium p-2"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {productsWithoutCategory.length > 0 && (
            <div>
              <h3 className="p-4 bg-gray-50 font-bold text-gray-800">بدون قسم</h3>
              {productsWithoutCategory.map((product) => (
                <div key={product.id} className="p-4 flex items-center justify-between border-b">
                  <div className="flex items-center min-w-0 gap-3">
                    {product.image_url && (
                      <img 
                        src={product.image_url} 
                        alt="" 
                        className="w-10 h-10 object-contain rounded border bg-gray-50"
                        onError={(e) => (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/err/100/100'}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {product.description}
                      </p>
                      <p className="text-xs text-indigo-600 font-bold mt-1">
                        {(() => {
                          const basePrice = product.currency === 'TRY' || product.currency === 'ل.ت'
                            ? Number(product.price) + Number(product.profit_try || 0)
                            : Number(product.price) + (Number(product.profit_try || 0) / tryRate);
                          return basePrice.toFixed(2);
                        })()} {product.currency || "$"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium p-2"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium p-2"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {products.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              لا توجد منتجات حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
