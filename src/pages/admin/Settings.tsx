import React, { useEffect, useState, useRef } from "react";
import { Settings as SettingsIcon, Upload, Trash2 } from "lucide-react";
import { useSocket } from "../../hooks/useSocket";
import { apiFetch } from '../../utils/api';

export default function Settings() {
  const socket = useSocket();
  const [rechargeText, setRechargeText] = useState("");
  const [rechargeImage, setRechargeImage] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [contactUsText, setContactUsText] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [contactUsButtonText, setContactUsButtonText] = useState("");
  const [contactUsButtonLink, setContactUsButtonLink] = useState("");
  const [contactUsButtonText2, setContactUsButtonText2] = useState("");
  const [contactUsButtonLink2, setContactUsButtonLink2] = useState("");
  const [appPaused, setAppPaused] = useState(false);
  const [appPausedMessage, setAppPausedMessage] = useState("");
  const [sypRate, setSypRate] = useState("");
  const [tryRate, setTryRate] = useState("");
  const [sypMode, setSypMode] = useState("manual");
  const [tryMode, setTryMode] = useState("auto");
  const [sypOffset, setSypOffset] = useState("0");
  const [tryOffset, setTryOffset] = useState("0");
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = () => {
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch settings");
        return res.json();
      })
      .then((data) => {
        setRechargeText(data.recharge_text || "");
        setRechargeImage(data.recharge_image || "");
        setInstructionsText(data.instructions_text || "");
        setContactUsText(data.contact_us_text || "");
        setWhatsappLink(data.whatsapp_link || "");
        setContactUsButtonText(data.contact_us_button_text || "");
        setContactUsButtonLink(data.contact_us_button_link || "");
        setContactUsButtonText2(data.contact_us_button_text2 || "");
        setContactUsButtonLink2(data.contact_us_button_link2 || "");
        setAppPaused(data.app_paused === "true");
        setAppPausedMessage(data.app_paused_message || "");
        setSypRate(data.syp_rate || "");
        setTryRate(data.try_rate || "");
        setSypMode(data.syp_rate_mode || "manual");
        setTryMode(data.try_rate_mode || "auto");
        setSypOffset(data.syp_offset || "0");
        setTryOffset(data.try_offset || "0");
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchSettings();
    if (socket) {
      socket.on("settings_updated", fetchSettings);
      return () => {
        socket.off("settings_updated", fetchSettings);
      };
    }
  }, [socket]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      if (rechargeImage) {
        await apiFetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: rechargeImage }),
        }).catch(console.error);
      }

      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setRechargeImage(data.url);
      } else {
        setMessage("فشل رفع الصورة");
      }
    } catch (err) {
      setMessage("خطأ في الاتصال أثناء رفع الصورة");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recharge_text: rechargeText,
          recharge_image: rechargeImage,
          instructions_text: instructionsText,
          contact_us_text: contactUsText,
          whatsapp_link: whatsappLink,
          contact_us_button_text: contactUsButtonText,
          contact_us_button_link: contactUsButtonLink,
          contact_us_button_text2: contactUsButtonText2,
          contact_us_button_link2: contactUsButtonLink2,
          app_paused: appPaused,
          app_paused_message: appPausedMessage,
          syp_rate: sypRate,
          try_rate: tryRate,
          syp_rate_mode: sypMode,
          try_rate_mode: tryMode,
          syp_offset: sypOffset,
          try_offset: tryOffset,
        }),
      });

      if (res.ok) {
        setMessage("تم حفظ الإعدادات بنجاح");
      } else {
        setMessage("حدث خطأ أثناء حفظ الإعدادات");
      }
    } catch (err) {
      setMessage("حدث خطأ في الاتصال");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <SettingsIcon className="w-6 h-6 ml-2 text-indigo-600" />
          إعدادات التطبيق
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              النص المعروض في صفحة الشحن
            </label>
            <textarea
              required
              rows={5}
              value={rechargeText}
              onChange={(e) => setRechargeText(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
              placeholder="أدخل النص الذي سيظهر للمستخدمين في صفحة شحن الرصيد..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              صورة صفحة الشحن
            </label>
            <div className="flex items-center space-x-4 space-x-reverse">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                id="recharge-image-upload"
              />
              <label
                htmlFor="recharge-image-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload className="w-4 h-4 ml-2" />
                {isUploading ? "جاري الرفع..." : "اختر صورة من الجهاز"}
              </label>
              {rechargeImage && (
                <div className="relative">
                  <img
                    src={rechargeImage}
                    alt="Preview"
                    className="h-20 w-40 object-contain rounded-lg border bg-gray-50"
                    referrerPolicy="no-referrer"
                    onError={(e) =>
                      ((e.target as HTMLImageElement).src =
                        "https://picsum.photos/seed/err/200/100")
                    }
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const oldImage = rechargeImage;
                      setRechargeImage("");
                      try {
                        if (oldImage) {
                          await apiFetch("/api/upload", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url: oldImage }),
                          });
                        }
                        await apiFetch("/api/settings", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            recharge_text: rechargeText,
                            recharge_image: "",
                            instructions_text: instructionsText,
                            contact_us_text: contactUsText,
                            whatsapp_link: whatsappLink,
                            contact_us_button_text: contactUsButtonText,
                            contact_us_button_link: contactUsButtonLink,
                            contact_us_button_text2: contactUsButtonText2,
                            contact_us_button_link2: contactUsButtonLink2,
                            app_paused: appPaused,
                            app_paused_message: appPausedMessage,
                            syp_rate: sypRate,
                            try_rate: tryRate,
                          }),
                        });
                        setMessage("تم حذف الصورة بنجاح");
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              صفحة التعليمات
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                محتوى صفحة التعليمات (سيتم تحويل الروابط إلى روابط قابلة للضغط
                تلقائياً)
              </label>
              <textarea
                rows={8}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-right"
                placeholder="اكتب التعليمات هنا، أي رابط مثل https://youtube.com سيصبح قابلاً للضغط تلقائياً..."
              />
              <p className="mt-2 text-sm text-gray-500">
                فقط قم بكتابة النص ولصق الروابط، وسيقوم النظام بتحويلها إلى
                روابط زرقاء يمكن الضغط عليها.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              صفحة اتصل بنا
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                محتوى صفحة اتصل بنا
              </label>
              <textarea
                rows={5}
                value={contactUsText}
                onChange={(e) => setContactUsText(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-right"
                placeholder="اكتب معلومات التواصل هنا، الروابط ستصبح قابلة للضغط تلقائياً..."
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رابط واتساب (اختياري)
              </label>
              <input
                type="url"
                value={whatsappLink}
                onChange={(e) => setWhatsappLink(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                placeholder="https://wa.me/..."
              />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نص الزر الرئيسي (مثلاً: اضغط لتتواصل معنا)
                </label>
                <input
                  type="text"
                  value={contactUsButtonText}
                  onChange={(e) => setContactUsButtonText(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-right"
                  placeholder="اضغط لتتواصل معنا"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رابط الزر (سيظهر شعار واتساب بجانبه)
                </label>
                <input
                  type="url"
                  value={contactUsButtonLink}
                  onChange={(e) => setContactUsButtonLink(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  placeholder="ضع الرابط هنا (مثلاً رابط واتساب أو تيليجرام)"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  نص الزر الثاني (اختياري)
                </label>
                <input
                  type="text"
                  value={contactUsButtonText2}
                  onChange={(e) => setContactUsButtonText2(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-right"
                  placeholder="مثلاً: تابعنا على تيليجرام"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رابط الزر الثاني
                </label>
                <input
                  type="url"
                  value={contactUsButtonLink2}
                  onChange={(e) => setContactUsButtonLink2(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  placeholder="ضع الرابط هنا"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              أسعار الصرف
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              يمكنك اختيار التحديث التلقائي أو اليدوي لكل عملة.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    الليرة السورية (مقابل الدولار)
                  </label>
                  <select 
                    value={sypMode} 
                    onChange={(e) => setSypMode(e.target.value)}
                    className="text-xs border-gray-300 rounded-md"
                  >
                    <option value="auto">تلقائي</option>
                    <option value="manual">يدوي</option>
                  </select>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={sypRate}
                  onChange={(e) => setSypRate(e.target.value)}
                  disabled={sypMode === 'auto'}
                  className={`w-full rounded-md border-gray-300 shadow-sm p-3 border ${sypMode === 'auto' ? 'bg-gray-50 cursor-not-allowed' : 'focus:border-indigo-500 focus:ring-indigo-500'}`}
                />
                {sypMode === 'auto' && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      تعديل السعر التلقائي (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={sypOffset}
                      onChange={(e) => setSypOffset(e.target.value)}
                      className="w-full text-xs rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="مثال: 4.4 لزيادة السعر بنسبة 4.4%"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    الليرة التركية (مقابل الدولار)
                  </label>
                  <select 
                    value={tryMode} 
                    onChange={(e) => setTryMode(e.target.value)}
                    className="text-xs border-gray-300 rounded-md"
                  >
                    <option value="auto">تلقائي</option>
                    <option value="manual">يدوي</option>
                  </select>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={tryRate}
                  onChange={(e) => setTryRate(e.target.value)}
                  disabled={tryMode === 'auto'}
                  className={`w-full rounded-md border-gray-300 shadow-sm p-3 border ${tryMode === 'auto' ? 'bg-gray-50 cursor-not-allowed' : 'focus:border-indigo-500 focus:ring-indigo-500'}`}
                />
                {tryMode === 'auto' && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      تعديل السعر التلقائي (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tryOffset}
                      onChange={(e) => setTryOffset(e.target.value)}
                      className="w-full text-xs rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="مثال: 1.0 لزيادة السعر بنسبة 1%"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              إيقاف التطبيق
            </h2>

            <div className="flex items-center mb-4">
              <input
                id="appPaused"
                type="checkbox"
                checked={appPaused}
                onChange={(e) => setAppPaused(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label
                htmlFor="appPaused"
                className="ml-2 block text-sm text-gray-900 mr-2"
              >
                تفعيل وضع إيقاف التطبيق (سيمنع المستخدمين من استخدام التطبيق)
              </label>
            </div>

            {appPaused && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  النص المعروض عند إيقاف التطبيق
                </label>
                <textarea
                  rows={3}
                  value={appPausedMessage}
                  onChange={(e) => setAppPausedMessage(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
                  placeholder="مثال: التطبيق متوقف حالياً للصيانة، يرجى العودة لاحقاً..."
                />
              </div>
            )}
          </div>

          {message && (
            <div className="mt-6 p-4 bg-green-100 text-green-700 rounded-lg text-center font-medium">
              {message}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            حفظ الإعدادات
          </button>
        </form>
      </div>
    </div>
  );
}
