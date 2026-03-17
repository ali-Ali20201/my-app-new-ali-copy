import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

export default function InstallPWA() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // 1. التحقق مما إذا كان التطبيق مثبتاً بالفعل
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  // 2. نجعل الصفحة تظهر دائماً بشكل افتراضي لكي لا تظهر شاشة بيضاء
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      setDeferredPrompt(null);
      // بعد التثبيت بنجاح، نوجهه للصفحة الرئيسية
      navigate('/home');
    } else {
      // إذا كان المتصفح يمنع النافذة (مثل الآيفون)، نظهر له رسالة إرشادية
      alert('لتثبيت التطبيق:\n\n📱 في الآيفون: اضغط زر المشاركة (السهم للأعلى) في أسفل الشاشة ثم اختر "إضافة للشاشة الرئيسية".\n\n🤖 في الأندرويد: من قائمة المتصفح (النقاط الثلاث) اختر "تثبيت التطبيق" أو "Add to Home screen".');
    }
  };

  // 3. إذا كان التطبيق مثبتاً، أو إذا كان الرابط هو رابط الأدمن، نوجهه فوراً ولا نظهر الشاشة الزرقاء
  if (isStandalone || window.location.pathname === '/adminali20112024') {
    return <Navigate to="/home" replace />;
  }

  if (!showBanner) return <Navigate to="/home" replace />;

  return (
    /* الخلفية الزرقاء التي تغطي كامل الشاشة كما في الصورة */
    <div className="fixed inset-0 bg-[#4f46e5] z-[100] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500" dir="rtl">
      
      <div className="flex flex-col items-center w-full max-w-sm text-center">
        
        {/* المربع الذي يحتوي على أيقونة التطبيق (icon.png) */}
        <div className="w-48 h-48 bg-white/10 backdrop-blur-sm rounded-[40px] shadow-2xl flex items-center justify-center mb-10 border border-white/20">
          <img 
            src="icon.png" 
            alt="Ali Cash Icon" 
            className="w-32 h-32 object-contain"
          />
        </div>

        {/* النصوص المطابقة للصورة تماماً */}
        <h1 className="text-white text-4xl font-bold mb-4 tracking-tight">
          مرحباً بك في علي كاش
        </h1>
        
        <p className="text-indigo-100 text-lg mb-12 leading-relaxed">
          ثبت التطبيق الآن للوصول السريع والتنبيهات الفورية
        </p>

        {/* زر التثبيت */}
        <button
          onClick={handleInstall}
          className="w-full bg-white text-[#4f46e5] py-4 rounded-2xl text-xl font-bold shadow-xl hover:bg-indigo-50 transition-all active:scale-95 mb-4"
        >
          تثبيت التطبيق
        </button>

        {/* زر الدخول للموقع (مهم جداً لكي لا يعلق المستخدم) */}
        <button
          onClick={() => navigate('/home')}
          className="w-full bg-transparent text-white border border-white/30 py-4 rounded-2xl text-lg font-bold hover:bg-white/10 transition-all active:scale-95"
        >
          الدخول للموقع
        </button>

      </div>
    </div>
  );
}
