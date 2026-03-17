import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { io } from 'socket.io-client';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
};

type NotificationContextType = {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const socket = io();

    socket.on('order_updated', (data) => {
      if (data.userId === user.id) {
        addNotification({
          title: 'تحديث الطلب',
          message: `تم تحديث حالة طلبك إلى: ${data.status === 'completed' ? 'مكتمل' : 'مرفوض'}`,
          type: data.status === 'completed' ? 'success' : 'error'
        });
      }
    });

    socket.on('recharge_updated', (data) => {
      if (data.userId === user.id) {
        addNotification({
          title: 'تحديث الرصيد',
          message: 'تمت معالجة طلب الشحن الخاص بك',
          type: 'success'
        });
      }
    });

    socket.on('balance_updated', (data) => {
      if (data.userId === user.id) {
        addNotification({
          title: 'تحديث الرصيد',
          message: `رصيدك الجديد هو: ${data.newBalance.toFixed(2)}`,
          type: 'info'
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(7);
    const newNotification = { ...notification, id, timestamp: Date.now() };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      new window.Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png'
      });
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-4 z-[100] space-y-2 pointer-events-none">
        {notifications.slice(0, 3).map(n => (
          <div 
            key={n.id}
            className={`pointer-events-auto p-4 rounded-lg shadow-lg border-l-4 flex items-start justify-between animate-slide-in-right ${
              n.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
              n.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
              n.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
              'bg-blue-50 border-blue-500 text-blue-800'
            }`}
          >
            <div>
              <h4 className="font-bold text-sm">{n.title}</h4>
              <p className="text-xs mt-1">{n.message}</p>
            </div>
            <button 
              onClick={() => removeNotification(n.id)}
              className="text-gray-400 hover:text-gray-600 mr-2"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
