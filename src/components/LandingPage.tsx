export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 text-white p-6 text-center" dir="rtl">
      <img 
        src="https://picsum.photos/seed/ali-cash/256/256" 
        alt="Ali Cash Icon" 
        className="w-64 h-64 rounded-3xl shadow-2xl mb-10 object-contain" 
        referrerPolicy="no-referrer" 
      />
      <h1 className="text-5xl font-bold mb-6">مرحباً بك في علي كاش</h1>
      <p className="text-xl mb-10 opacity-90 leading-relaxed">تطبيقك المفضل للوصول السريع والخدمات المتميزة</p>
    </div>
  );
}
