import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, User, ArrowRight, KeyRound, Eye, EyeOff, Bell, Smartphone } from "lucide-react";
import { apiFetch } from '../utils/api';

export default function Auth() {
  const { login, verifyLogin, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showVerifyLogin, setShowVerifyLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState("");

  useEffect(() => {
    // Check if we should show push prompt
    const checkPushPrompt = async () => {
      const hasSeenPrompt = localStorage.getItem('push_prompt_seen');
      if (hasSeenPrompt) return;

      const isWebView = 
        (window as any).gonative || 
        (window as any).webkit?.messageHandlers || 
        navigator.userAgent.includes('wv') ||
        navigator.userAgent.includes('WebView');

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display === 'prompt' || permStatus.display === 'prompt-with-rationale') {
            setShowPushPrompt(true);
          }
          return;
        }
      } catch (e) {
        // Fallback for web if capacitor fails to load
      }

      if (isWebView || ('Notification' in window && Notification.permission === 'default')) {
        setShowPushPrompt(true);
      }
    };

    checkPushPrompt();

    apiFetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setWhatsappLink(data.whatsapp_link || "");
      })
      .catch(console.error);
  }, []);

  const handlePushResponse = (accepted: boolean) => {
    localStorage.setItem('push_prompt_seen', 'true');
    setShowPushPrompt(false);
    if (accepted) {
      window.dispatchEvent(new CustomEvent('subscribe-push'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        const res = await login(email, password);
        if (res && res.require_code) {
          setShowVerifyLogin(true);
          setMessage("تم إرسال كود التحقق إلى بريدك الإلكتروني");
          return;
        }
      } else {
        await register(name, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (res.ok) {
        setMessage("تم إرسال كود التحقق إلى بريدك الإلكتروني");
        setShowForgot(false);
        setShowReset(true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json().catch(() => ({ error: "حدث خطأ في الاتصال" }));
      if (res.ok) {
        setMessage("تم تغيير كلمة السر بنجاح، يمكنك الآن تسجيل الدخول");
        setShowReset(false);
        setIsLogin(true);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verifyLogin(email, code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showVerifyLogin) {
    return (
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">التحقق من تسجيل الدخول</h2>
        <p className="text-gray-600 mb-6 text-center text-sm">أدخل الكود المكون من 5 أرقام الذي تم إرساله إلى بريدك الإلكتروني</p>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">{message}</div>}
        
        <form onSubmit={handleVerifyLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كود التحقق</label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-widest text-lg"
                placeholder="12345"
                maxLength={5}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "جاري التحقق..." : "تأكيد الدخول"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVerifyLogin(false);
              setCode("");
              setError("");
              setMessage("");
            }}
            className="w-full text-sm text-indigo-600 hover:underline mt-4"
          >
            العودة لتسجيل الدخول
          </button>
        </form>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">نسيت كلمة السر</h2>
        <p className="text-gray-600 mb-6 text-center text-sm">أدخل بريدك الإلكتروني وسنرسل لك كود لإعادة تعيين كلمة السر</p>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        
        <form onSubmit={handleForgot} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="example@gmail.com"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "جاري الإرسال..." : "إرسال الكود"}
          </button>
          <button
            type="button"
            onClick={() => setShowForgot(false)}
            className="w-full text-sm text-indigo-600 hover:underline mt-4"
          >
            العودة لتسجيل الدخول
          </button>
        </form>
      </div>
    );
  }

  if (showReset) {
    return (
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">تعيين كلمة سر جديدة</h2>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
        
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كود التحقق</label>
            <div className="relative">
              <KeyRound className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="أدخل الكود المكون من 6 أرقام"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة السر الجديدة</label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pr-10 pl-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "جاري التغيير..." : "تغيير كلمة السر"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowReset(false);
              setError("");
            }}
            className="w-full text-sm text-indigo-600 hover:underline mt-4"
          >
            العودة لتسجيل الدخول
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
      </h2>
      
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">{message}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
            <div className="relative">
              <User className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                placeholder="أدخل اسمك"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
          <div className="relative">
            <Mail className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="example@gmail.com"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">كلمة السر</label>
          <div className="relative">
            <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pr-10 pl-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="********"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isLogin && (
          <div className="text-left">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs text-indigo-600 hover:underline"
            >
              نسيت كلمة السر؟
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? "جاري المعالجة..." : (isLogin ? "دخول" : "إنشاء حساب")}
          <ArrowRight className="w-5 h-5 mr-2" />
        </button>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setMessage("");
            }}
            className="text-sm text-gray-600 hover:text-indigo-600"
          >
            {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب بالفعل؟ سجل دخولك"}
          </button>
        </div>

        {whatsappLink && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500 mb-3">هل تحتاج للمساعدة؟ تواصل معنا</p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-transform hover:scale-110"
              title="تواصل معنا عبر واتساب"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
          </div>
        )}
      </form>

      {/* Push Notification Prompt */}
      {showPushPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-indigo-600 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">تفعيل الإشعارات</h3>
            <p className="text-gray-600 mb-6">
              هل ترغب في تفعيل الإشعارات لتصلك تحديثات طلباتك وشحن رصيدك فوراً؟
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePushResponse(true)}
                className="py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
              >
                نعم، تفعيل
              </button>
              <button
                onClick={() => handlePushResponse(false)}
                className="py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                ليس الآن
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-400">
              يمكنك دائماً تغيير هذا من إعدادات المتصفح أو التطبيق
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
