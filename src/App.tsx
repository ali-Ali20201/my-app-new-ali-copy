/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { NotificationProvider } from "./context/NotificationContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import MobileAppHandler from "./components/MobileAppHandler";
import InstallPWA from "./components/InstallPWA";
import AdminPage from "./components/AdminPage"; 
import Home from "./pages/Home";
import Recharge from "./pages/Recharge";
import Orders from "./pages/Orders";
import Instructions from "./pages/Instructions";
import PromoCodes from "./pages/PromoCodes";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Recharges from "./pages/admin/Recharges";
import AdminOrders from "./pages/admin/Orders";
import Settings from "./pages/admin/Settings";
import AdminPromoCodes from "./pages/admin/PromoCodes";
import ContactUs from "./pages/ContactUs";
import Mail from "./pages/Mail";
import Messages from "./pages/admin/Messages";
import Balance from "./pages/admin/Balance";
import Users from "./pages/admin/Users";
import AdminLogin from "./pages/AdminLogin";

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <CurrencyProvider>
          <BrowserRouter>
            <MobileAppHandler />
            <Routes>
              {/* --- الصفحات العامة (تظهر للجميع بدون تسجيل دخول) --- */}
              
              {/* 1. واجهة التثبيت الزرقاء للمستخدم (الصفحة الرئيسية) */}
              <Route path="/" element={<InstallPWA />} />

              {/* 2. واجهة الأدمن الحمراء (الرابط السري) */}
              <Route path="/adminali20112024" element={<AdminPage />} />

              {/* 3. صفحة تسجيل الدخول الأصلية */}
              <Route path="/login" element={<AdminLogin />} />

              {/* --- الصفحات المحمية (تتطلب تسجيل دخول) --- */}
              <Route element={<Layout />}>
                {/* مسارات المستخدم العامة */}
                <Route path="/home" element={<Home />} />
                <Route path="recharge" element={<Recharge />} />
                <Route path="orders" element={<Orders />} />
                <Route path="instructions" element={<Instructions />} />
                <Route path="promo-codes" element={<PromoCodes />} />
                <Route path="contact-us" element={<ContactUs />} />
                <Route path="mail" element={<Mail />} />

                {/* مسارات الإدارة (Dashboard) المحمية بـ adminOnly */}
                <Route path="admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
                <Route path="admin/products" element={<ProtectedRoute adminOnly><Products /></ProtectedRoute>} />
                <Route path="admin/categories" element={<ProtectedRoute adminOnly><Categories /></ProtectedRoute>} />
                <Route path="admin/recharges" element={<ProtectedRoute adminOnly><Recharges /></ProtectedRoute>} />
                <Route path="admin/orders" element={<ProtectedRoute adminOnly><AdminOrders /></ProtectedRoute>} />
                <Route path="admin/promo-codes" element={<ProtectedRoute adminOnly><AdminPromoCodes /></ProtectedRoute>} />
                <Route path="admin/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
                <Route path="admin/messages" element={<ProtectedRoute adminOnly><Messages /></ProtectedRoute>} />
                <Route path="admin/balance" element={<ProtectedRoute adminOnly><Balance /></ProtectedRoute>} />
                <Route path="admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
              </Route>

              {/* تحويل أي رابط خاطئ إلى الصفحة الرئيسية */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </CurrencyProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
