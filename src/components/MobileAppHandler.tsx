import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileAppHandler() {
  const [showExitToast, setShowExitToast] = useState(false);

  // تم تعطيل جميع وظائف PWA المتقدمة مؤقتاً لحل مشكلة الشاشة البيضاء
  useEffect(() => {
    console.log("MobileAppHandler: PWA Caching is disabled.");
  }, []);

  return (
    <AnimatePresence>
      {showExitToast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] bg-gray-900/90 text-white px-6 py-3 rounded-full text-sm font-medium shadow-lg backdrop-blur-sm border border-white/10"
        >
          اضغط مرة أخرى للخروج
        </motion.div>
      )}
    </AnimatePresence>
  );
}
