import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail as MailIcon, Clock } from "lucide-react";
import { apiFetch } from '../utils/api';

type Message = {
  id: number;
  title: string;
  content: string;
  created_at: string;
};

export default function Mail() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || typeof user.id !== 'number') return;
    
    // Fetch messages
    apiFetch(`/api/messages/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
      })
      .then((data) => {
        setMessages(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Mark messages as read
    apiFetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, type: 'messages' })
    }).then(() => {
      // Refresh notifications badge in layout
      window.dispatchEvent(new CustomEvent('refreshNotifications'));
    }).catch(console.error);
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <MailIcon className="w-8 h-8 text-indigo-600" />
        <h1 className="text-3xl font-bold text-gray-900">البريد الوارد</h1>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-100">
          <MailIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-900 mb-2">لا توجد رسائل</h2>
          <p className="text-gray-500">صندوق الوارد الخاص بك فارغ حالياً.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{msg.title}</h3>
              <p className="text-gray-700 whitespace-pre-wrap mb-4">{msg.content}</p>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 ml-1" />
                {new Date(msg.created_at).toLocaleString("ar-SA")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
