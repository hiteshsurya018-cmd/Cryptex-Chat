import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/cryptex/Header";
import MessageBubble, {
  type Message,
} from "@/components/cryptex/MessageBubble";
import TypingIndicator from "@/components/cryptex/TypingIndicator";
import KeyFileForm, { type MediaType } from "@/components/cryptex/KeyFileForm";

function useAutoScroll(dep: any) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dep]);
  return endRef;
}

type PendingAction = {
  mode: "encrypt" | "decrypt";
  type: MediaType;
  textData?: string;
};

function parseIntent(input: string): PendingAction | null {
  const lower = input.trim().toLowerCase();
  const isEncrypt = /\bencrypt\b/.test(lower);
  const isDecrypt = /\bdecrypt\b/.test(lower);
  if (!isEncrypt && !isDecrypt) return null;
  const mode = isEncrypt ? "encrypt" : "decrypt";

  // Determine type
  let type: MediaType = "text";
  if (/\bimage|photo|png|jpg|jpeg\b/.test(lower)) type = "image";
  else if (/\bvideo|mp4|mov|webm\b/.test(lower)) type = "video";
  else if (/\baudio|sound|mp3|wav|m4a\b/.test(lower)) type = "audio";

  // Text payload extraction (support with or without colon)
  let textData: string | undefined = undefined;
  if (type === "text") {
    const withColon = input.match(/(?:encrypt|decrypt)[^:]*:\s*([\s\S]+)/i);
    if (withColon?.[1]) {
      textData = withColon[1].trim();
    } else {
      // Remove only the leading verb and following spaces, preserve payload
      const after = input.replace(/^\s*(encrypt|decrypt)\b\s*/i, "");
      if (after && after.trim().length > 0) {
        textData = after.trim();
      }
    }
  }
  return { mode, type, textData };
}

export default function Index() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "bot",
      content: (
        <div>
          <p className="font-semibold text-[hsl(var(--primary))]">
            Welcome to Cryptex Chat
          </p>
          <p className="text-sm text-muted-foreground">
            I can chat normally and securely encrypt/decrypt text, images,
            video, and audio.
          </p>
        </div>
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const endRef = useAutoScroll(messages.length + (typing ? 1 : 0));

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const pushMessage = (msg: Message) => setMessages((m) => [...m, msg]);

  function botSay(content: React.ReactNode) {
    pushMessage({ id: crypto.randomUUID(), role: "bot", content });
  }

  async function handleGreeting(raw: string) {
    setTyping(true);
    await new Promise((r) => setTimeout(r, 600));
    setTyping(false);
    const t = raw.toLowerCase();
    if (/\b(hi|hello|hey)\b/.test(t))
      botSay("Hello! How can I assist with encryption today?");
    else if (/\bhow are you\b/.test(t))
      botSay("All systems secure and humming. How can I help?");
    else if (/\bbye|goodbye|see ya\b/.test(t))
      botSay("Stay safe. Lock it down! 🔐");
    else
      botSay(
        "I can help encrypt/decrypt text or files. Try: Encrypt this text: hello world",
      );
  }

  function askForKeyAndMaybeFile(pending: PendingAction) {
    botSay(
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {pending.type === "text"
            ? "Provide your secret key to proceed."
            : "Upload a file and provide your secret key."}
        </p>
        <KeyFileForm
          mode={pending.mode}
          type={pending.type}
          textData={pending.textData}
          onStatus={(s) =>
            pushMessage({ id: crypto.randomUUID(), role: "system", content: s })
          }
          onResult={(node) => botSay(node)}
          onError={(err) =>
            pushMessage({
              id: crypto.randomUUID(),
              role: "bot",
              content: <span className="text-red-400">{err}</span>,
            })
          }
        />
      </div>,
    );
  }

  async function onSubmit() {
    const text = input.trim();
    if (!text) return;
    pushMessage({ id: crypto.randomUUID(), role: "user", content: text });
    setInput("");

    // Intent detection
    const intent = parseIntent(text);
    if (intent) {
      askForKeyAndMaybeFile(intent);
      return;
    }

    // Greetings / smalltalk
    if (/\b(hi|hello|hey|how are you|bye|goodbye)\b/i.test(text)) {
      handleGreeting(text);
      return;
    }

    // Default polite response
    handleGreeting(text);
  }

  return (
    <div className="min-h-screen bg-background flex justify-center items-center p-4">
      <div className="w-full max-w-[min(92vw,640px)] h-[92vh] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 p-4 md:p-6 overflow-x-hidden overflow-y-auto">
          <div className="space-y-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {typing && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
            <div ref={endRef} className="mt-4" />
          </div>
        </main>

        <div className="bg-white border-t border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Type your message here..."
              className="flex-1 rounded-full px-4 py-3 bg-gray-100 border border-gray-200 focus:border-[hsl(var(--primary))] focus:bg-blue-50 outline-none text-gray-800 transition-all"
            />
            <button
              onClick={onSubmit}
              className="w-12 h-12 rounded-full bg-transparent text-[hsl(var(--primary))] hover:bg-blue-50 flex items-center justify-center transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 12l16-7-7 16-2-7-7-2Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
