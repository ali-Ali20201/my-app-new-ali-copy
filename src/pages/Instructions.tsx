import React, { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import FormattedText from "../components/FormattedText";
import { apiFetch } from '../utils/api';

export default function Instructions() {
  const [instructionsText, setInstructionsText] = useState("");

  useEffect(() => {
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then((data) => {
        setInstructionsText(data.instructions_text || "لا توجد تعليمات حالياً.");
      })
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <HelpCircle className="w-6 h-6 ml-2 text-indigo-600" />
          التعليمات
        </h1>

        <div className="p-4 bg-indigo-50 text-indigo-900 rounded-lg text-lg leading-relaxed whitespace-pre-wrap">
          <FormattedText text={instructionsText} />
        </div>
      </div>
    </div>
  );
}
