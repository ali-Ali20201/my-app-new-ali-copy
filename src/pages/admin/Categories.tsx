import React, { useState, useEffect, useRef } from "react";
import { Folder, Plus, Pencil, Trash2, FolderOpen, Upload } from "lucide-react";
import { io } from "socket.io-client";
import { apiFetch } from '../../utils/api';

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  image_url: string | null;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [imageUrl, setImageUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories();

    const socket = io();
    socket.on("categories_updated", () => {
      fetchCategories();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchCategories = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setError(data.error || "فشل في جلب الأقسام");
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchCategories(retries - 1), 1000);
      } else {
        console.error(err);
        setError("حدث خطأ في الاتصال");
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
      const data = await res.json().catch(() => ({ error: "فشل الرفع" }));
      if (res.ok) {
        setImageUrl(data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const url = editingId ? `/api/categories/${editingId}` : "/api/categories";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parent_id: parentId === "" ? null : Number(parentId),
          image_url: imageUrl || null,
        }),
      });

      if (res.ok) {
        setName("");
        setParentId("");
        setImageUrl("");
        setEditingId(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchCategories();
      } else {
        const data = await res.json().catch(() => ({ error: "حدث خطأ غير متوقع" }));
        setError(data.error || "حدث خطأ أثناء حفظ القسم");
      }
    } catch (err) {
      console.error(err);
      setError("حدث خطأ في الاتصال");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setParentId(category.parent_id || "");
    setImageUrl(category.image_url || "");
    
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryPath = (
    categoryId: number | null,
    visited = new Set<number>(),
  ): string => {
    if (!categoryId) return "القسم الرئيسي";
    if (visited.has(categoryId)) return "مسار دائري";
    visited.add(categoryId);

    const category = categories.find((c) => c.id === categoryId);
    if (!category) return "غير معروف";
    if (category.parent_id) {
      return `${getCategoryPath(category.parent_id, visited)} > ${category.name}`;
    }
    return category.name;
  };

  const getValidParents = () => {
    if (!editingId) return categories;

    const descendants = new Set<number>();
    const findDescendants = (parentId: number) => {
      categories.forEach((c) => {
        if (c.parent_id === parentId && !descendants.has(c.id)) {
          descendants.add(c.id);
          findDescendants(c.id);
        }
      });
    };
    findDescendants(editingId);

    return categories.filter(
      (c) => c.id !== editingId && !descendants.has(c.id),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الأقسام</h1>
      </div>

      <div 
        ref={formRef}
        className={`bg-white rounded-xl shadow-sm p-6 border transition-all duration-300 ${
          editingId ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-100"
        }`}
      >
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {editingId ? "تعديل قسم" : "إضافة قسم جديد"}
        </h2>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                اسم القسم
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                القسم الأب (اختياري)
              </label>
              <select
                value={parentId}
                onChange={(e) =>
                  setParentId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
              >
                <option value="">-- القسم الرئيسي --</option>
                {getValidParents().map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCategoryPath(c.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              صورة القسم
            </label>
            <div className="flex items-center space-x-4 space-x-reverse">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                id="category-image-upload"
              />
              <label
                htmlFor="category-image-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload className="w-4 h-4 ml-2" />
                {isUploading ? "جاري الرفع..." : "اختر صورة من الجهاز"}
              </label>
              {imageUrl && (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-20 w-20 object-contain rounded-lg border bg-gray-50"
                    referrerPolicy="no-referrer"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).src =
                        "https://picsum.photos/seed/err/200/200")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 space-x-reverse">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setParentId("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
            )}
            <button
              type="submit"
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              {editingId ? (
                <Pencil className="w-4 h-4 ml-2" />
              ) : (
                <Plus className="w-4 h-4 ml-2" />
              )}
              {editingId ? "حفظ التعديلات" : "إضافة قسم"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {categories.map((category) => (
          <div
            key={category.id}
            className="p-4 flex items-center justify-between"
          >
            <div className="flex items-center min-w-0">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-10 h-10 rounded-lg object-contain bg-gray-50 ml-3 border flex-shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).src =
                      "https://picsum.photos/seed/cat/100/100")
                  }
                />
              ) : (
                <Folder className="w-5 h-5 text-indigo-500 ml-3 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {category.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {getCategoryPath(category.parent_id)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mr-2">
              <button
                onClick={() => handleEdit(category)}
                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium p-2"
              >
                تعديل
              </button>
              <button
                onClick={() => handleDelete(category.id)}
                className="text-red-600 hover:text-red-900 text-sm font-medium p-2"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            لا توجد أقسام حالياً
          </div>
        )}
      </div>
    </div>
  );
}
