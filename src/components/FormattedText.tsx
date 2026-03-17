import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

function CopyablePart({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      onClick={handleCopy}
      className={`inline-flex items-center cursor-pointer px-1.5 py-0.5 rounded transition-all duration-200 border-b-2 ${
        copied 
          ? "bg-green-100 border-green-500 text-green-700" 
          : "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-900"
      } mx-0.5 font-mono relative group max-w-[200px]`}
      title={content}
    >
      <span className="truncate">
        {content}
      </span>
      {copied ? <Check className="w-3 h-3 mr-1 flex-shrink-0" /> : <Copy className="w-3 h-3 mr-1 opacity-40 group-hover:opacity-100 flex-shrink-0" />}
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-100 whitespace-nowrap z-10">
          تم النسخ!
        </span>
      )}
    </span>
  );
}

export default function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  // 1. Split by URLs to handle linkify
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // 2. Split by double quotes to handle copyable parts
  // We need to be careful with overlapping regex.
  // Let's handle copyable parts first, then linkify the rest.
  
  const parts = text.split(/("(?:[^"]*)")/g);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('"') && part.endsWith('"')) {
          const content = part.slice(1, -1);
          return (
            <React.Fragment key={index}>
              <CopyablePart content={content} />
            </React.Fragment>
          );
        }
        
        // Handle linkify for non-copyable parts
        const subParts = part.split(urlRegex);
        return subParts.map((subPart, i) => {
          if (subPart.match(urlRegex)) {
            return (
              <a 
                key={`${index}-${i}`} 
                href={subPart} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline inline-block"
                dir="ltr"
              >
                {subPart}
              </a>
            );
          }
          return <span key={`${index}-${i}`}>{subPart}</span>;
        });
      })}
    </>
  );
}
