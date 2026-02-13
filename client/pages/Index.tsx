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

  // Determine type (only from command text, not payload)
  let type: MediaType = "text";
  const commandPart = lower.includes(":")
    ? lower.split(":", 1)[0]
    : lower;
  if (/\b(image|photo|png|jpg|jpeg)\b/.test(commandPart)) type = "image";
  else if (/\b(video|mp4|mov|webm)\b/.test(commandPart)) type = "video";
  else if (/\b(audio|sound|mp3|wav|m4a)\b/.test(commandPart)) type = "audio";
  else if (/\b(pdf|docx|doc|word|document|txt)\b/.test(commandPart))
    type = "file";

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
  // If payload looks like base64, force text type to avoid false media matches
  if (textData) {
    const compact = textData.replace(/\s+/g, "");
    const looksBase64 =
      compact.length >= 32 && /^[A-Za-z0-9+/=]+$/.test(compact);
    if (looksBase64) type = "text";
  }
  return { mode, type, textData };
}

export default function Index() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "bot",
      createdAt: Date.now(),
      content: (
        <div>
          <p className="font-semibold text-[hsl(var(--primary))]">
            Welcome to Cryptex Chat
          </p>
          <p className="text-sm text-muted-foreground">
            I can chat normally and securely encrypt/decrypt text, images,
            video, audio, and documents (PDF/DOCX/TXT).
          </p>
        </div>
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const endRef = useAutoScroll(messages.length + (typing ? 1 : 0));
  const intentHint = useMemo(() => parseIntent(input), [input]);
  const quickReplies = [
    "Show methodology with chart",
    "What encryption do you use?",
    "Why AES-GCM?",
    "Why scrypt vs PBKDF2?",
    "What is an IV, salt, and auth tag?",
    "What file types are supported?",
    "How do I share encrypted files safely?",
    "Common mistakes?",
    "How does this work?",
    "Is my data stored?",
  ];
  function scoreSuggestion(query: string, candidate: string) {
    const q = query.toLowerCase();
    const c = candidate.toLowerCase();
    if (c === q) return 100;
    if (c.startsWith(q)) return 80;
    if (c.includes(q)) return 60;
    const tokens = c.split(/[\s\-?]+/);
    if (tokens.some((t) => t.startsWith(q))) return 55;
    const acronym = tokens.map((t) => t[0]).join("");
    if (acronym.startsWith(q)) return 50;
    // Subsequence match
    let qi = 0;
    for (let i = 0; i < c.length && qi < q.length; i++) {
      if (c[i] === q[qi]) qi++;
    }
    if (qi === q.length) return 35;
    return 0;
  }
  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return [];
    return quickReplies
      .map((s) => ({ s, score: scoreSuggestion(q, s) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s)
      .slice(0, 6);
  }, [input]);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const pushMessage = (msg: Message) => setMessages((m) => [...m, msg]);

  function botSay(content: React.ReactNode) {
    pushMessage({
      id: crypto.randomUUID(),
      role: "bot",
      createdAt: Date.now(),
      content,
    });
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

  async function handleCryptoInfo() {
    setTyping(true);
    await new Promise((r) => setTimeout(r, 600));
    setTyping(false);
    botSay(
      <div className="grid gap-2 text-sm">
        <div>
          <span className="font-semibold">Technique:</span> AES-256-GCM (authenticated encryption)
        </div>
        <div>
          <span className="font-semibold">Key Derivation:</span> scrypt (memory-hard)
        </div>
        <div>
          <span className="font-semibold">Payload:</span> [salt | iv | auth tag | ciphertext], Base64 for text
        </div>
        <div className="text-xs text-muted-foreground">
          Each encryption uses a fresh salt and IV.
        </div>
      </div>,
    );
  }

  async function handleFaqResponse(kind: string) {
    setTyping(true);
    await new Promise((r) => setTimeout(r, 600));
    setTyping(false);
    if (kind === "best_practices") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Security best practices</div>
          <div>Use a long passphrase (12+ chars) with mixed types.</div>
          <div>Never reuse the same key for unrelated data.</div>
          <div>Store keys in a password manager, not notes or chat.</div>
          <div className="text-xs text-muted-foreground">
            Tip: a short key is the most common failure point.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "formats") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Formats & limits</div>
          <div>Text: any plain text input.</div>
          <div>Files: image, video, audio, and documents (PDF/DOCX/TXT).</div>
          <div>Max file size: depends on deployment (local supports larger files).</div>
          <div className="text-xs text-muted-foreground">
            For documents, you can extract and encrypt text directly.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "how_it_works") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">How it works</div>
          <div>1. Your key is turned into a strong key with scrypt.</div>
          <div>2. AES-256-GCM encrypts and authenticates the data.</div>
          <div>3. Output packs salt + iv + auth tag + ciphertext.</div>
          <div className="text-xs text-muted-foreground">
            Text outputs are Base64 for easy copy/paste.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "methodology") {
      botSay(
        <div className="grid gap-3 text-sm">
          <div className="font-semibold">Complete methodology</div>
          <div>
            Cryptex follows an authenticated encryption pipeline: user intent is
            parsed, the key is transformed with a KDF (scrypt), payload is
            encrypted/decrypted with AES-256-GCM, and result is returned as text
            (Base64) or downloadable file.
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Working Chart
            </div>
            <div className="space-y-2 text-xs">
              <div className="rounded-md bg-secondary px-2 py-1">
                1) Input: command + data/file + secret key
              </div>
              <div className="text-center text-muted-foreground">↓</div>
              <div className="rounded-md bg-secondary px-2 py-1">
                2) Intent Parser: detect encrypt/decrypt + payload type
              </div>
              <div className="text-center text-muted-foreground">↓</div>
              <div className="rounded-md bg-secondary px-2 py-1">
                3) KDF: derive 256-bit key using scrypt(salt, key)
              </div>
              <div className="text-center text-muted-foreground">↓</div>
              <div className="rounded-md bg-secondary px-2 py-1">
                4) Crypto Engine: AES-256-GCM (iv + auth tag + ciphertext)
              </div>
              <div className="text-center text-muted-foreground">↓</div>
              <div className="rounded-md bg-secondary px-2 py-1">
                5) Output Pack: [salt | iv | tag | ciphertext]
              </div>
              <div className="text-center text-muted-foreground">↓</div>
              <div className="rounded-md bg-secondary px-2 py-1">
                6) Delivery: Base64 text or download link for file
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Security note: wrong keys produce non-usable output and GCM
            authentication prevents silent tampering.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "troubleshooting") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Troubleshooting</div>
          <div>Wrong key: you’ll see garbled output (by design).</div>
          <div>Decrypt errors: ensure you used the same key and file.</div>
          <div>Large files: keep under 50MB or compress first.</div>
          <div className="text-xs text-muted-foreground">
            If decrypt looks wrong, double‑check key and file match.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "privacy") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Privacy model</div>
          <div>Encryption happens on the server in this build.</div>
          <div>Your key is sent to the server to perform encryption.</div>
          <div className="text-xs text-muted-foreground">
            For maximum privacy, use client‑side encryption.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "performance") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Performance</div>
          <div>Streaming file encryption reduces memory usage.</div>
          <div>Large files may take longer due to scrypt.</div>
          <div className="text-xs text-muted-foreground">
            Speed depends on file size and device.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "examples") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Examples</div>
          <div>Encrypt this text: hello world</div>
          <div>Decrypt: &lt;base64 text&gt;</div>
          <div>Encrypt PDF document</div>
          <div>Decrypt file</div>
        </div>,
      );
      return;
    }
    if (kind === "why_gcm") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Why AES‑GCM?</div>
          <div>It encrypts and authenticates in one step.</div>
          <div>It detects tampering via the auth tag.</div>
          <div className="text-xs text-muted-foreground">
            That’s safer than “AES + separate hash.”
          </div>
        </div>,
      );
      return;
    }
    if (kind === "why_scrypt") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Why scrypt?</div>
          <div>It is memory‑hard, making brute‑force harder.</div>
          <div>Better defense against GPU/ASIC attacks.</div>
          <div className="text-xs text-muted-foreground">
            PBKDF2 is supported for legacy payloads.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "encrypt_vs_decrypt") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Encrypt vs Decrypt</div>
          <div>Encrypt: turns readable data into protected ciphertext.</div>
          <div>Decrypt: restores the original data using the same key.</div>
          <div className="text-xs text-muted-foreground">
            If the key is wrong, output will look garbled.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "terms") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Key terms</div>
          <div>Salt: random bytes to protect the key derivation.</div>
          <div>IV: random nonce used once per encryption.</div>
          <div>Auth tag: integrity proof for AES‑GCM.</div>
        </div>,
      );
      return;
    }
    if (kind === "sharing") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Sharing encrypted files safely</div>
          <div>Send the encrypted file and key separately.</div>
          <div>Use a different channel for the key.</div>
          <div className="text-xs text-muted-foreground">
            Example: file via email, key via SMS or password manager.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "integrity") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Integrity & tampering</div>
          <div>GCM detects changes with the auth tag.</div>
          <div>If modified, decryption will fail (or look random).</div>
          <div className="text-xs text-muted-foreground">
            That is the expected secure behavior.
          </div>
        </div>,
      );
      return;
    }
    if (kind === "mistakes") {
      botSay(
        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Common mistakes</div>
          <div>Using a short or reused key.</div>
          <div>Mixing up which key was used.</div>
          <div>Decrypting a different file than the one encrypted.</div>
        </div>,
      );
      return;
    }
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
            pushMessage({
              id: crypto.randomUUID(),
              role: "system",
              createdAt: Date.now(),
              content: s.text,
              variant: s.variant,
            })
          }
          onResult={(node) => botSay(node)}
          onError={(err) =>
            pushMessage({
              id: crypto.randomUUID(),
              role: "system",
              createdAt: Date.now(),
              content: err,
              variant: "error",
            })
          }
        />
      </div>,
    );
  }

  function processText(text: string) {
    const intent = parseIntent(text);
    if (intent) {
      askForKeyAndMaybeFile(intent);
      return;
    }

    const lower = text.toLowerCase();
    if (/\b(best practice|secure|safety|key length|strong key|password)\b/i.test(lower)) {
      handleFaqResponse("best_practices");
      return;
    }
    if (/\b(format|file type|supported|limit|size|pdf|docx|document)\b/i.test(lower)) {
      handleFaqResponse("formats");
      return;
    }
    if (/\b(how it works|how does|steps|process|workflow)\b/i.test(lower)) {
      handleFaqResponse("how_it_works");
      return;
    }
    if (/\b(methodology|methedology|metehodolgy|architecture|architecture flow|working chart|flow chart)\b/i.test(lower)) {
      handleFaqResponse("methodology");
      return;
    }
    if (/\b(error|failed|garbled|wrong key|not working|issue|problem)\b/i.test(lower)) {
      handleFaqResponse("troubleshooting");
      return;
    }
    if (/\b(privacy|server|client-side|client side|data stored|logs)\b/i.test(lower)) {
      handleFaqResponse("privacy");
      return;
    }
    if (/\b(speed|performance|slow|time|memory)\b/i.test(lower)) {
      handleFaqResponse("performance");
      return;
    }
    if (/\b(example|usage|how to use|help)\b/i.test(lower)) {
      handleFaqResponse("examples");
      return;
    }
    if (/\b(why gcm|why aes|gcm vs)\b/i.test(lower)) {
      handleFaqResponse("why_gcm");
      return;
    }
    if (/\b(why scrypt|scrypt vs|pbkdf2)\b/i.test(lower)) {
      handleFaqResponse("why_scrypt");
      return;
    }
    if (/\b(encrypt vs decrypt|difference between encrypt|difference between decrypt)\b/i.test(lower)) {
      handleFaqResponse("encrypt_vs_decrypt");
      return;
    }
    if (/\b(salt|iv|nonce|auth tag|authentication tag)\b/i.test(lower)) {
      handleFaqResponse("terms");
      return;
    }
    if (/\b(share|sharing|send key|safely share)\b/i.test(lower)) {
      handleFaqResponse("sharing");
      return;
    }
    if (/\b(tamper|integrity|authenticate|authenticity)\b/i.test(lower)) {
      handleFaqResponse("integrity");
      return;
    }
    if (/\b(mistake|common mistakes|pitfalls)\b/i.test(lower)) {
      handleFaqResponse("mistakes");
      return;
    }

    if (
      /\b(encrypt|encryption|decrypt|decryption|algorithm|cipher|technique|aes|gcm|scrypt|kdf)\b/i.test(
        text,
      ) &&
      !/\b(encrypt|decrypt)\b\s*:/i.test(text)
    ) {
      handleCryptoInfo();
      return;
    }

    if (/\b(hi|hello|hey|how are you|bye|goodbye)\b/i.test(text)) {
      handleGreeting(text);
      return;
    }

    handleGreeting(text);
  }

  async function onSubmit() {
    const text = input.trim();
    if (!text) return;

    const id = crypto.randomUUID();
    pushMessage({
      id,
      role: "user",
      createdAt: Date.now(),
      content: text,
    });
    setInput("");
    processText(text);
  }

  return (
    <div className="min-h-screen bg-background flex justify-center items-center p-4">
      <div className="w-full max-w-[min(90vw,560px)] h-[92vh] bg-card rounded-3xl shadow-xl overflow-hidden flex flex-col border border-border animate-card-in chat-card">
        <div className="matrix-overlay" />
        <Header />
        <main className="flex-1 bg-secondary p-4 md:p-6 overflow-x-hidden overflow-y-auto">
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

        <div className="bg-card border-t border-border p-4 md:p-6">
          <div className="grid gap-2">
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput("");
                      pushMessage({
                        id: crypto.randomUUID(),
                        role: "user",
                        createdAt: Date.now(),
                        content: q,
                      });
                      processText(q);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-secondary text-muted-foreground border border-border hover:bg-[hsl(var(--primary))]/10 hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
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
                aria-label="Chat input"
                className="flex-1 rounded-full px-4 py-3 bg-secondary border border-border focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--primary))]/10 outline-none text-foreground transition-all"
              />
              <button
                onClick={onSubmit}
                className="w-12 h-12 rounded-full bg-transparent text-[hsl(var(--primary))] hover:bg-blue-50 flex items-center justify-center transition-colors"
                aria-label="Send message"
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
            {intentHint && (
              <div className="flex items-center justify-end text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-[hsl(var(--primary))] px-2 py-0.5">
                  {intentHint.mode.toUpperCase()} {intentHint.type.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
