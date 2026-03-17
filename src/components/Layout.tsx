
import React, { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ShoppingBag,
  CreditCard,
  ListOrdered,
  Settings,
  LogOut,
  PackagePlus,
  LayoutDashboard,
  Menu,
  X,
  Store,
  HelpCircle,
  Gift,
  Phone,
  Mail,
  Copy,
  Check,
  Users as UsersIcon,
  Pencil,
  Smartphone
} from "lucide-react";

import { useSocket } from "../hooks/useSocket";
import Auth from "./Auth";
import ProfileEditModal from "./ProfileEditModal";
import InstallPrompt from "./InstallPrompt";
import { apiFetch } from '../utils/api';

export default function Layout() {
  const { user, logout, updateCurrency, setUser } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [appPaused, setAppPaused] = useState(false);
  const [appPausedMessage, setAppPausedMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [notifications, setNotifications] = useState({ orders: 0, recharges: 0, messages: 0 });
  const [copied, setCopied] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  useEffect(() => {
    const requestNativePermission = async () => {
      if (!user) return;

      try {
        const { Capacitor } = await import('@capacitor/core');
        
        // Native Platform (Android/iOS)
        if (Capacitor.isNativePlatform()) {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          let permStatus = await PushNotifications.checkPermissions();
          
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            setIsSubscribed(true);
          }
          return;
        }

        // Web Browser
        if ('Notification' in window && 'serviceWorker' in navigator) {
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              subscribeToWebPush();
            }
          } else if (Notification.permission === 'granted') {
            subscribeToWebPush();
          }
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error);
      }
    };

    const subscribeToWebPush = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const keyRes = await apiFetch('/api/push/vapid-public-key');
        const { publicKey } = await keyRes.json();

        if (!publicKey) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        await apiFetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            subscription
          })
        });
        setIsSubscribed(true);
      } catch (err) {
        console.error("Failed to subscribe to web push:", err);
      }
    };

    requestNativePermission();
  }, [user]);

  useEffect(() => {
    const checkPushStatus = async () => {
      // Always show the button, handle unsupported in click handler
      setPushSupported(true);

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const permStatus = await LocalNotifications.checkPermissions();
          setIsSubscribed(permStatus.display === 'granted');
          return;
        }
      } catch (e) {
        // Fallback to web
      }

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.getSubscription().then(subscription => {
            setIsSubscribed(!!subscription);
          });
        });
      }
    };
    checkPushStatus();
  }, []);

  const handleSubscribe = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display === 'denied') {
          alert("لقد قمت بحظر الإشعارات مسبقاً. يرجى تفعيلها من إعدادات التطبيق.");
          return;
        }
        window.dispatchEvent(new CustomEvent('subscribe-push'));
        setTimeout(async () => {
          const newStatus = await LocalNotifications.checkPermissions();
          setIsSubscribed(newStatus.display === 'granted');
        }, 3000);
        return;
      }
    } catch (e) {
      // Fallback to web
    }

    const isWebView = 
      (window as any).gonative || 
      (window as any).webkit?.messageHandlers || 
      navigator.userAgent.includes('wv') ||
      navigator.userAgent.includes('WebView');

    if (isWebView) {
      // Optimistically set to true for WebViews as they handle it natively
      setIsSubscribed(true);
      window.dispatchEvent(new CustomEvent('subscribe-push'));
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("لتفعيل الإشعارات على الآيفون، يرجى إضافة التطبيق إلى الشاشة الرئيسية (Add to Home Screen) من قائمة المشاركة، ثم فتح التطبيق من هناك.");
      } else {
        alert("متصفحك لا يدعم الإشعارات.");
      }
      return;
    }

    if ('Notification' in window && Notification.permission === 'denied') {
      alert("لقد قمت بحظر الإشعارات مسبقاً. يرجى تفعيلها من إعدادات المتصفح.");
      return;
    }
    
    window.dispatchEvent(new CustomEvent('subscribe-push'));
    
    setTimeout(() => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.getSubscription().then(subscription => {
            setIsSubscribed(!!subscription);
          });
        });
      }
    }, 3000);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].pageY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0) return;
    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;
    if (diff > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      handleRefresh();
    }
    setPullDistance(0);
    setStartY(0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refresh settings, notifications, and current page data
    await Promise.all([
      fetchSettings(),
      fetchNotifications(),
      new Promise(resolve => setTimeout(resolve, 1000)) // Visual feedback
    ]);
    // Trigger a custom event that pages can listen to
    window.dispatchEvent(new CustomEvent('app-refresh'));
    setIsRefreshing(false);
  };

  const handleCopyCode = () => {
    if (user?.a_code) {
      navigator.clipboard.writeText(user.a_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchSettings = async (retries = 3, delay = 1000) => {
    try {
      const res = await apiFetch("/api/settings");
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setAppPaused(data.app_paused === "true");
      setAppPausedMessage(data.app_paused_message || "التطبيق متوقف حالياً للصيانة، يرجى العودة لاحقاً.");
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchSettings(retries - 1, delay * 2), delay);
      } else {
        console.error('Failed to fetch settings after retries:', err);
      }
    }
  };

  const fetchNotifications = () => {
    if (!user) return;
    apiFetch(`/api/notifications/${user.id}`)
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) {
          setNotifications({ 
            orders: data.orders, 
            recharges: data.recharges,
            messages: data.messages || 0
          });
        }
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

  // WebSocket for real-time updates
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
    
    if (socket && user) {
      socket.on('balance_updated', ({ userId, newBalance }: { userId: number, newBalance: number }) => {
        if (userId === user.id) {
          const updatedUser = { ...user, balance: newBalance };
          setUser(updatedUser);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }
      });

      socket.on('order_created', () => {
        if (user.role === 'admin') {
          fetchNotifications();
        }
      });

      socket.on('recharge_requested', () => {
        if (user.role === 'admin') {
          fetchNotifications();
        }
      });

      socket.on('order_updated', ({ userId }: { userId: number }) => {
        if (userId === user.id || user.role === 'admin') {
          fetchNotifications();
        }
      });

      socket.on('recharge_updated', ({ userId }: { userId: number }) => {
        if (userId === user.id || user.role === 'admin') {
          fetchNotifications();
        }
      });

      socket.on('new_message', ({ userId }: { userId: number }) => {
        if (userId === user.id) {
          fetchNotifications();
        }
      });

      socket.on('new_global_message', () => {
        fetchNotifications();
      });

      return () => {
        socket.off('balance_updated');
        socket.off('order_created');
        socket.off('recharge_requested');
        socket.off('order_updated');
        socket.off('recharge_updated');
        socket.off('new_message');
        socket.off('new_global_message');
      };
    }
  }, [socket, user]);

  // Poll for notifications as fallback
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds as fallback
    
    const handleRefresh = () => fetchNotifications();
    window.addEventListener('refreshNotifications', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refreshNotifications', handleRefresh);
    };
  }, [user]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
        <Auth />
      </div>
    );
  }

  const adminLinks = [
    { to: "/admin", icon: <LayoutDashboard className="w-5 h-5 ml-3" />, text: "لوحة التحكم" },
    { to: "/admin/products", icon: <PackagePlus className="w-5 h-5 ml-3" />, text: "المنتجات" },
    { to: "/admin/categories", icon: <ShoppingBag className="w-5 h-5 ml-3" />, text: "الأقسام" },
    { to: "/admin/recharges", icon: <CreditCard className="w-5 h-5 ml-3" />, text: "طلبات الشحن", badge: notifications.recharges },
    { to: "/admin/orders", icon: <ListOrdered className="w-5 h-5 ml-3" />, text: "الطلبات", badge: notifications.orders },
    { to: "/admin/promo-codes", icon: <Gift className="w-5 h-5 ml-3" />, text: "الشحن والسحب وأكواد الإحالة" },
    { to: "/instructions", icon: <HelpCircle className="w-5 h-5 ml-3" />, text: "التعليمات" },
    { to: "/contact-us", icon: <Phone className="w-5 h-5 ml-3" />, text: "اتصل بنا" },
    { to: "/admin/settings", icon: <Settings className="w-5 h-5 ml-3" />, text: "الإعدادات" },
    { to: "/admin/messages", icon: <Mail className="w-5 h-5 ml-3" />, text: "إرسال رسالة" },
    { to: "/admin/balance", icon: <CreditCard className="w-5 h-5 ml-3" />, text: "إدارة الرصيد" },
    { to: "/admin/users", icon: <UsersIcon className="w-5 h-5 ml-3" />, text: "المستخدمين" },
  ];

  const userLinks = [
    { to: "/", icon: <Store className="w-5 h-5 ml-3" />, text: "المنتجات" },
    { to: "/recharge", icon: <CreditCard className="w-5 h-5 ml-3" />, text: "شحن الرصيد" },
    { to: "/orders", icon: <ListOrdered className="w-5 h-5 ml-3" />, text: "طلباتي", badge: notifications.orders + notifications.recharges },
    { to: "/promo-codes", icon: <Gift className="w-5 h-5 ml-3" />, text: "أكواد الإحالة" },
    { to: "/mail", icon: <Mail className="w-5 h-5 ml-3" />, text: "البريد", badge: notifications.messages },
    { to: "/instructions", icon: <HelpCircle className="w-5 h-5 ml-3" />, text: "التعليمات" },
    { to: "/contact-us", icon: <Phone className="w-5 h-5 ml-3" />, text: "اتصل بنا" },
  ];

  const links = user.role === "admin" ? adminLinks : userLinks;
  const totalNotifications = notifications.orders + notifications.recharges + notifications.messages;

  const handleLogoutConfirm = () => {
    logout();
    navigate("/");
    setShowLogoutConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col" dir="rtl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <div 
        className="fixed top-0 left-0 right-0 z-[60] flex justify-center transition-transform duration-200"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {(pullDistance > 10 || isRefreshing) && (
          <div className="bg-white rounded-full shadow-lg p-2 mt-2">
            <div className={`w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full ${isRefreshing || pullDistance > 60 ? 'animate-spin' : ''}`}
              style={{ transform: pullDistance > 60 ? 'none' : `rotate(${pullDistance * 3}deg)` }}
            ></div>
          </div>
        )}
      </div>

      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Hamburger Menu Button (Right side in RTL) */}
            <div className="flex items-center">
              <button
                onClick={() => {
                  console.log('Menu button clicked, current state:', isMenuOpen);
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none relative z-50"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                {!isMenuOpen && totalNotifications > 0 && (
                  <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </button>
              <span className="text-xl font-bold text-indigo-600 mr-4">علي كاش</span>
            </div>

            {/* Balance Display (Left side in RTL) */}
            <div className="flex items-center space-x-3 space-x-reverse">
              <Link to="/mail" className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors">
                <Mail className="w-6 h-6" />
                {notifications.messages > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                    {notifications.messages}
                  </span>
                )}
              </Link>
              <div className="text-base sm:text-lg text-gray-700 flex items-center bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <span className="hidden sm:inline ml-2">الرصيد:</span>
                <span className="font-bold text-green-600 text-lg sm:text-xl">
                  {user.balance} {user.preferred_currency}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Side Drawer Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity" 
            onClick={() => setIsMenuOpen(false)}
          ></div>

          {/* Drawer */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl">
            <div className="pt-5 pb-4 px-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-indigo-600">القائمة</span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4 flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
                <div className="mr-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className="text-base font-medium text-gray-800 truncate max-w-full">{user?.name}</div>
                    <button 
                      onClick={() => setShowProfileEdit(true)}
                      className="text-gray-400 hover:text-indigo-600 transition-colors"
                      title="تعديل الملف الشخصي"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {user?.a_code && (
                      <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-indigo-700">{user?.a_code}</span>
                        <button 
                          onClick={handleCopyCode}
                          className="text-indigo-400 hover:text-indigo-600 transition-colors"
                          title="نسخ الكود"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-500 truncate flex items-center gap-2">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 h-0 overflow-y-auto">
              <nav className="px-2 py-4 space-y-1">
                <div className="px-2 py-2 text-sm font-medium text-gray-500">تحديد العملة</div>
                <div className="flex items-center gap-2 px-2 pb-4">
                  <button
                    onClick={() => user.preferred_currency !== '$' && updateCurrency('$')}
                    className={`flex-1 py-2 rounded-md font-bold ${user.preferred_currency === '$' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    $
                  </button>
                  <button
                    onClick={() => user.preferred_currency !== 'SYR' && updateCurrency('SYR')}
                    className={`flex-1 py-2 rounded-md font-bold ${user.preferred_currency === 'SYR' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    SYR
                  </button>
                  <button
                    onClick={() => user.preferred_currency !== 'TRY' && updateCurrency('TRY')}
                    className={`flex-1 py-2 rounded-md font-bold ${user.preferred_currency === 'TRY' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    TRY
                  </button>
                </div>
                {(!user.preferred_currency || user.preferred_currency === "") && (
                  <div className="px-2 pb-4">
                    <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm font-bold text-center">
                      يجب عليك اختيار العملة أولاً للمتابعة
                    </div>
                  </div>
                )}
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={(e) => {
                      if (!user.preferred_currency || user.preferred_currency === "") {
                        e.preventDefault();
                        alert("يجب عليك اختيار العملة أولاً للمتابعة");
                      }
                    }}
                    className={`group flex items-center justify-between px-2 py-3 text-base font-medium rounded-md ${
                      location.pathname === link.to
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center">
                      {link.icon}
                      {link.text}
                    </div>
                    {link.badge ? (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                        {link.badge}
                      </span>
                    ) : null}
                  </Link>
                ))}

                {pushSupported && (
                  <button
                    onClick={!isSubscribed ? handleSubscribe : undefined}
                    disabled={isSubscribed}
                    className={`w-full flex items-center px-2 py-3 text-base font-medium rounded-md group mt-2 ${
                      isSubscribed 
                        ? 'text-green-600 bg-green-50 cursor-default' 
                        : 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 ml-2" />
                    {isSubscribed ? 'إشعارات الهاتف مفعلة' : 'تفعيل إشعارات الهاتف'}
                  </button>
                )}
              </nav>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-5 h-5 ml-2" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">تسجيل الخروج</h3>
            <p className="text-gray-600 mb-6">هل تريد فعلاً الخروج من الحساب؟</p>
            <div className="flex space-x-3 space-x-reverse">
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                نعم
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                لا
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto py-6 px-4 sm:px-6 lg:px-8 relative pb-24 md:pb-6">
        {appPaused && user.role !== "admin" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center mx-4">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">تنبيه</h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                {appPausedMessage}
              </p>
            </div>
          </div>
        )}
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          {links.slice(0, 4).map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${
                location.pathname === link.to
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <div className="relative">
                {React.cloneElement(link.icon as React.ReactElement, { className: "w-6 h-6 ml-0" })}
                {link.badge ? (
                  <span className="absolute -top-1 -right-2 flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium">{link.text}</span>
            </Link>
          ))}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-500 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">المزيد</span>
          </button>
        </div>
      </div>
      {/* Profile Edit Modal */}
      <ProfileEditModal 
        isOpen={showProfileEdit} 
        onClose={() => setShowProfileEdit(false)} 
      />
      <InstallPrompt />
    </div>
  );
}
