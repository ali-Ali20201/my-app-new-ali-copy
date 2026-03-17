import React from "react";
import { useAuth } from "../../context/AuthContext";
import { PackagePlus, CreditCard, ListOrdered, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();

  const cards = [
    {
      title: "إضافة منتجات",
      icon: PackagePlus,
      link: "/admin/products",
      color: "bg-blue-500",
    },
    {
      title: "طلبات الشحن",
      icon: CreditCard,
      link: "/admin/recharges",
      color: "bg-green-500",
    },
    {
      title: "طلبات الشراء",
      icon: ListOrdered,
      link: "/admin/orders",
      color: "bg-purple-500",
    },
    {
      title: "الإعدادات",
      icon: Settings,
      link: "/admin/settings",
      color: "bg-gray-500",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">لوحة تحكم الإدارة</h1>
      <p className="text-gray-600">مرحباً بك يا {user?.name} في لوحة التحكم.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <Link key={idx} to={card.link} className="block group">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1">
              <div
                className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center text-white mb-4`}
              >
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {card.title}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
