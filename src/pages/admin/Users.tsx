import React, { useEffect, useState } from "react";
import { Users as UsersIcon, Search, Mail, Key, Shield, Clock, CreditCard, Edit, Trash2, LogOut, X, Eye, EyeOff, Copy } from "lucide-react";
import { format } from "date-fns";
import { useSocket } from "../../hooks/useSocket";
import { apiFetch } from '../../utils/api';

type User = {
  id: number;
  name: string;
  email: string;
  password?: string;
  plain_password?: string;
  balance: number;
  role: string;
  a_code: string;
  preferred_currency: string;
  created_at: string;
  last_login?: string;
  is_modified?: number;
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ userCount: 0 });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const socket = useSocket();

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchOnlineUsers();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('user_registered', (newUser: User) => {
        setUsers(prev => [newUser, ...prev]);
        setStats(prev => ({ ...prev, userCount: prev.userCount + 1 }));
      });
      
      socket.on('balance_updated', ({ userId, newBalance }: { userId: number, newBalance: number }) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: newBalance } : u));
      });

      socket.on('user_active', (activeUser: User) => {
        setUsers(prev => {
          const filtered = prev.filter(u => u.id !== activeUser.id);
          const existing = prev.find(u => u.id === activeUser.id);
          const updatedUser = existing ? { ...existing, ...activeUser } : activeUser;
          return [updatedUser, ...filtered];
        });
      });

      socket.on('user_status_changed', ({ userId, status }: { userId: number, status: string }) => {
        setOnlineUsers(prev => {
          if (status === 'online') {
            return [...new Set([...prev, userId])];
          } else {
            return prev.filter(id => id !== userId);
          }
        });
      });

      return () => {
        socket.off('user_registered');
        socket.off('user_active');
        socket.off('balance_updated');
        socket.off('user_status_changed');
      };
    }
  }, [socket]);

  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const fetchUsers = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/admin/users");
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchUsers(retries - 1), 1000);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/admin/stats");
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchStats(retries - 1), 1000);
      } else {
        console.error(err);
      }
    }
  };

  const fetchOnlineUsers = async (retries = 3) => {
    try {
      const res = await apiFetch("/api/admin/online-users");
      if (!res.ok) throw new Error('Failed to fetch online users');
      const data = await res.json();
      setOnlineUsers(data);
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => fetchOnlineUsers(retries - 1), 1000);
      } else {
        console.error(err);
      }
    }
  };

  const handleEditClick = (user: User) => {
    console.log("handleEditClick called for user:", user.id);
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      balance: user.balance,
      role: user.role,
      a_code: user.a_code,
      preferred_currency: user.preferred_currency,
      plain_password: user.plain_password || ''
    });
    setIsModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          password: editForm.plain_password // Send plain_password as password to be hashed
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({ error: 'حدث خطأ غير متوقع' }));
        alert(data.error || 'حدث خطأ أثناء التحديث');
      }
    } catch (err) {
      alert('حدث خطأ في الاتصال');
    }
  };

  const handleDelete = async () => {
    console.log("handleDelete called for user:", selectedUser?.id);
    if (!selectedUser) return;
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;

    try {
      const res = await apiFetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE'
      });

      console.log("Delete response status:", res.status);
      if (res.ok) {
        setIsModalOpen(false);
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        setStats(prev => ({ ...prev, userCount: prev.userCount - 1 }));
      } else {
        const data = await res.json().catch(() => ({ error: 'حدث خطأ غير متوقع' }));
        console.error("Delete error data:", data);
        alert('حدث خطأ أثناء الحذف: ' + (data.error || ''));
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert('حدث خطأ في الاتصال');
    }
  };

  const handleForceLogout = async () => {
    console.log("handleForceLogout called for user:", selectedUser?.id);
    if (!selectedUser) return;
    if (!confirm('هل أنت متأكد من تسجيل خروج هذا المستخدم؟')) return;

    try {
      const res = await apiFetch(`/api/admin/users/${selectedUser.id}/logout`, {
        method: 'POST'
      });

      console.log("Logout response status:", res.status);
      if (res.ok) {
        alert('تم إرسال أمر تسجيل الخروج للمستخدم');
      } else {
        const data = await res.json().catch(() => ({ error: 'فشل الاتصال بالخادم' }));
        console.error("Logout error data:", data);
        alert('حدث خطأ أثناء العملية: ' + (data.error || ''));
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert('حدث خطأ في الاتصال');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.a_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="w-6 h-6 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">إجمالي المستخدمين</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.userCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <UsersIcon className="w-6 h-6 ml-2 text-indigo-600" />
            إدارة المستخدمين
          </h1>
          
          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="ابحث بالاسم، البريد، الكود أو المعرف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المعرف (ID)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">البريد الإلكتروني</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">كلمة المرور</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الرصيد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدور</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">آخر نشاط</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">جاري التحميل...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">لا يوجد مستخدمين مطابقين للبحث</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">#{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{user.name}</span>
                          {user.is_modified === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-800 rounded-full">
                              معدل
                            </span>
                          )}
                        </div>
                        <span 
                          className="text-xs text-indigo-600 font-mono truncate max-w-[150px] inline-block cursor-pointer hover:text-indigo-800 transition-colors"
                          title={user.a_code}
                          onClick={() => {
                            navigator.clipboard.writeText(user.a_code || '');
                            alert("تم نسخ الكود");
                          }}
                        >
                          {user.a_code}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 ml-2 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        <Key className="w-4 h-4 ml-2 text-gray-400" />
                        {user.plain_password ? (
                          <div className="flex items-center gap-2">
                            <span>{visiblePasswords[user.id] ? user.plain_password : '••••••••'}</span>
                            <button
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {visiblePasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        ) : (
                          'مخفية (حساب قديم)'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-bold text-green-600">
                        <CreditCard className="w-4 h-4 ml-2 text-green-400" />
                        {user.balance} {user.preferred_currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-bold rounded-full flex items-center w-fit ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        <Shield className="w-3 h-3 ml-1" />
                        {user.role === 'admin' ? 'مسؤول' : 'مستخدم'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {onlineUsers.includes(user.id) ? (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 flex items-center w-fit">
                          <div className="w-2 h-2 bg-green-500 rounded-full ml-1 animate-pulse"></div>
                          متصل
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-600 flex items-center w-fit">
                          <div className="w-2 h-2 bg-gray-400 rounded-full ml-1"></div>
                          مسجل خروج
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 ml-2 text-indigo-400" />
                        {user.last_login ? format(new Date(user.last_login), "MM-dd HH:mm") : "غير نشط"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleEditClick(user)}
                        className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg transition-colors"
                        title="تعديل المستخدم"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">جاري التحميل...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">لا يوجد مستخدمين مطابقين للبحث</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-500">#{user.id}</span>
                    <span className="font-bold text-gray-900">{user.name}</span>
                    {user.is_modified === 1 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-800 rounded-full">
                        معدل
                      </span>
                    )}
                  </div>
                  {onlineUsers.includes(user.id) ? (
                    <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-green-100 text-green-700 flex items-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-1 animate-pulse"></div>
                      متصل
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600 flex items-center">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full ml-1"></div>
                      غير متصل
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 ml-2 text-gray-400" />
                    {user.email}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 font-mono">
                    <Key className="w-4 h-4 ml-2 text-gray-400" />
                    {user.plain_password ? (
                      <div className="flex items-center gap-2">
                        <span>{visiblePasswords[user.id] ? user.plain_password : '••••••••'}</span>
                        <button
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {visiblePasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ) : (
                      'مخفية (حساب قديم)'
                    )}
                  </div>
                  <div className="flex items-center text-sm font-bold text-green-600">
                    <CreditCard className="w-4 h-4 ml-2 text-green-400" />
                    {user.balance} {user.preferred_currency}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-4 h-4 ml-2 text-gray-400" />
                    {user.last_login ? format(new Date(user.last_login), "yyyy-MM-dd HH:mm") : 'لم يسجل دخول'}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-xs text-indigo-600 font-mono font-bold truncate max-w-[120px] inline-block cursor-pointer hover:text-indigo-800 transition-colors"
                        title={user.a_code}
                        onClick={() => {
                          navigator.clipboard.writeText(user.a_code || '');
                          alert("تم نسخ الكود");
                        }}
                      >
                        {user.a_code}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(user.a_code || '');
                          alert("تم نسخ الكود");
                        }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        title="نسخ"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-full flex items-center w-fit ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      <Shield className="w-3 h-3 ml-1" />
                      {user.role === 'admin' ? 'مسؤول' : 'مستخدم'}
                    </span>
                  </div>
                  <div className="flex space-x-2 space-x-reverse">
                    <button
                      onClick={() => handleEditClick(user)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="تعديل"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Edit className="w-6 h-6 ml-2 text-indigo-600" />
                تعديل بيانات المستخدم
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الاسم</label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ''}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={editForm.email || ''}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور (اتركه فارغاً لعدم التغيير)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={editForm.plain_password || ''}
                      onChange={e => setEditForm({...editForm, plain_password: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الرصيد</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.balance || 0}
                    onChange={e => setEditForm({...editForm, balance: parseFloat(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الدور</label>
                  <select
                    value={editForm.role || 'user'}
                    onChange={e => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="user">مستخدم</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">كود المستخدم</label>
                  <input
                    type="text"
                    required
                    value={editForm.a_code || ''}
                    onChange={e => setEditForm({...editForm, a_code: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">العملة المفضلة</label>
                  <select
                    value={editForm.preferred_currency || '$'}
                    onChange={e => setEditForm({...editForm, preferred_currency: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="$">الدولار الأمريكي ($)</option>
                    <option value="SYR">الليرة السورية (SYR)</option>
                    <option value="TRY">الليرة التركية (TRY)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={handleForceLogout}
                  className="flex-1 bg-yellow-100 text-yellow-700 px-6 py-3 rounded-xl font-bold hover:bg-yellow-200 transition-colors flex items-center justify-center"
                >
                  <LogOut className="w-5 h-5 ml-2" />
                  تسجيل خروج إجباري
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 bg-red-100 text-red-700 px-6 py-3 rounded-xl font-bold hover:bg-red-200 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-5 h-5 ml-2" />
                  حذف المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
