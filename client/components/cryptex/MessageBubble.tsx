import React from "react";

export type Message = {
  id: string;
  role: "user" | "bot" | "system";
  content: string | React.ReactNode;
  variant?: "default" | "step" | "success" | "error";
};

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isBot = message.role === "bot";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        {isUser ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-gray-600"
          >
            <path
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle
              cx="12"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        ) : (
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
        )}
      </div>
      <div
        className={`max-w-[75%] px-5 py-3 rounded-2xl shadow-sm ${
          isUser
            ? "bg-[hsl(var(--primary))] text-white rounded-tr-lg"
            : "bg-gray-100 text-gray-800 rounded-tl-lg"
        }`}
      >
        <div className="text-sm leading-relaxed break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
