import { useState } from 'react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isLogged, setIsLogged] = useState(false);

  // تم حذف الـ useEffect القديم لأن المتصفح الآن يختار المانيفست الصحيح من ملف index.html مباشرة

  const checkPassword = () => {
    if (password === 'fadiali1985$') {
      setIsLogged(true);
    } else {
      alert('كلمة المرور خاطئة!');
    }
  };

  if (!isLogged) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-900 p-6 text-center">
        <h2 className="text-white text-2xl mb-6">دخول الإدارة</h2>
        <input 
          type="password" 
          className="p-3 rounded-lg w-full max-w-xs mb-4 text-center text-black"
          placeholder="أدخل كلمة السر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={checkPassword} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold">
          دخول
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#b91c1c] z-[100] flex flex-col items-center justify-center p-8">
      <img src="/admin-icon.png" alt="Admin App" className="w-40 mb-8" />
      <h1 className="text-white text-3xl font-bold mb-4">نسخة المدير الخاصة</h1>
      <button 
        onClick={() => alert("الآن يمكنك الضغط على خيارات المتصفح (الثلاث نقاط) واختيار 'إضافة إلى الشاشة الرئيسية' ليظهر التطبيق بأيقونته الحمراء!")}
        className="bg-white text-[#b91c1c] px-10 py-4 rounded-2xl font-bold text-xl hover:bg-gray-100 transition-all"
      >
        تثبيت تطبيق الإدارة
      </button>
    </div>
  );
}
