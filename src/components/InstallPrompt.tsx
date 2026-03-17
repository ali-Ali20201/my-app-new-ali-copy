import { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-[9999] shadow-2xl flex flex-col gap-2" dir="rtl">
      {deferredPrompt ? (
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900">ثبّت التطبيق</h3>
            <p className="text-sm text-gray-500">للوصول السريع والتنبيهات</p>
          </div>
          <button 
            onClick={async () => {
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === 'accepted') {
                setIsInstalled(true);
              }
            }}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold"
          >
            تثبيت
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            لإضافة التطبيق إلى شاشتك الرئيسية، اضغط على <strong>الثلاث نقاط (⋮)</strong> في متصفحك ثم اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
