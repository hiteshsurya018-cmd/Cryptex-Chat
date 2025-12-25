import React from "react";

export default function Header() {
  return (
    <header className="bg-[hsl(var(--primary))] text-white border-b border-gray-200">
      <div className="flex items-center justify-center gap-4 px-4 py-4">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shadow-lg">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="text-white"
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
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-wide">Cryptex Chat</h1>
          <p className="text-sm opacity-90">Encryption Assistant</p>
        </div>
      </div>
    </header>
  );
}
