import React, { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import FormattedText from "../components/FormattedText";
import { apiFetch } from '../utils/api';

export default function ContactUs() {
  const [contactUsText, setContactUsText] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonLink, setButtonLink] = useState("");
  const [buttonText2, setButtonText2] = useState("");
  const [buttonLink2, setButtonLink2] = useState("");

  useEffect(() => {
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then((data) => {
        setContactUsText(data.contact_us_text || "يمكنك التواصل معنا عبر الروابط الموضحة.");
        setWhatsappLink(data.whatsapp_link || "");
        setButtonText(data.contact_us_button_text || "تواصل معنا");
        setButtonLink(data.contact_us_button_link || "");
        setButtonText2(data.contact_us_button_text2 || "");
        setButtonLink2(data.contact_us_button_link2 || "");
      })
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Phone className="w-6 h-6 ml-2 text-indigo-600" />
          اتصل بنا
        </h1>

        <div className="p-4 bg-indigo-50 text-indigo-900 rounded-lg text-lg leading-relaxed whitespace-pre-wrap mb-6">
          <FormattedText text={contactUsText} />
        </div>
        
        <div className="flex flex-wrap gap-4">
          {buttonLink && (
            <a
              href={buttonLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl shadow-md text-white bg-green-600 hover:bg-green-700 transition-all transform hover:scale-105"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-7 h-7 ml-3" />
              {buttonText || "اضغط لتتواصل معنا"}
            </a>
          )}

          {buttonLink2 && (
            <a
              href={buttonLink2}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all transform hover:scale-105"
            >
              {buttonText2 || "رابط إضافي"}
            </a>
          )}
          
          {whatsappLink && !buttonLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              تواصل معنا عبر واتساب
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6 mr-2" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
