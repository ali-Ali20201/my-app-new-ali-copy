import React, { useState } from "react";
import { Mail, Send, Users, User } from "lucide-react";
import { apiFetch } from '../../utils/api';

export default function Messages() {
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [targetCode, setTargetCode] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetCode: targetType === "specific" ? targetCode : null,
          title,
          content,
        }),
      });

      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (res.ok) {
        setMessage("تم إرسال الرسالة بنجاح");
        setTitle("");
        setContent("");
        setTargetCode("");
      } else {
        setError(data.error || "حدث خطأ أثناء إرسال الرسالة");
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
          <Mail className="w-6 h-6 ml-2 text-indigo-600" />
          إرسال رسالة
        </h1>

        {message && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTargetType("all")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                targetType === "all"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-indigo-300 text-gray-600"
              }`}
            >
              <Users className="w-8 h-8" />
              <span className="font-bold">الكل</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetType("specific")}
              className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                targetType === "specific"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-indigo-300 text-gray-600"
              }`}
            >
              <User className="w-8 h-8" />
              <span className="font-bold">مستخدم مخصص</span>
            </button>
          </div>

          {targetType === "specific" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كود المستخدم (يبدأ بحرف A)
              </label>
              <input
                type="text"
                required
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="A123456"
                dir="ltr"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              عنوان الرسالة
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              محتوى الرسالة
            </label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center font-bold disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Send className="w-5 h-5 ml-2" />
                إرسال الرسالة
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
