import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="text-gray-600"
        >
          <path
            d="M12 2l8 4v6c0 5-3.5 9.74-8 10-4.5-.26-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8.5 12.5l3 3 4.5-6"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </div>
      <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tl-lg shadow-sm">
        <div className="flex items-center gap-1">
          <span className="sr-only">Typing…</span>
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
