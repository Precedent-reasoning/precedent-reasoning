"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AgentStatus } from "@/components/AgentStatus";
import { ResultsPanel } from "@/components/ResultsPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { ExampleQueries } from "@/components/ExampleQueries";
import { Sidebar } from "@/components/Sidebar";

// API URL from environment variable (default to localhost for development)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface SSEEvent {
  type: "status" | "token" | "done" | "error";
  message?: string;
  text?: string;
}

export interface Turn {
  situation: string;
  steps: string[];
  response: string;
  state: "searching" | "done" | "error";
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  turns: Turn[];
  titleFailed?: boolean;  // Set if the title generation failed
}

// Helper: Extract meaningful error message from backend response or error object
async function extractErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return "You've made too many searches. Please wait a minute before trying again.";
  }
  try {
    const data = await response.clone().json();
    // FastAPI returns {"detail": "error message"}
    if (data.detail && typeof data.detail === "string") {
      return data.detail;
    }
    if (data.message && typeof data.message === "string") {
      return data.message;
    }
    if (data.error && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // Response is not JSON, fall through
  }
  // Fallback to HTTP status text
  return response.statusText || `Server error (HTTP ${response.status})`;
}

function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem("nsw-legal-conversations");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveToStorage(conversations: Conversation[]) {
  try {
    localStorage.setItem("nsw-legal-conversations", JSON.stringify(conversations));
  } catch {}
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // null = "new conversation" state — no conversation created yet
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Token render queue — drains one character at a time so text appears smoothly
  const tokenQueue = useRef<string[]>([]);
  const drainingRef = useRef(false);
  const drainTargetRef = useRef<{ convId: string; turnIndex: number } | null>(null);

  function startDrain(convId: string, turnIndex: number) {
    drainTargetRef.current = { convId, turnIndex };
    if (!drainingRef.current) {
      drainingRef.current = true;
      drainNext();
    }
  }

  function drainNext() {
    if (tokenQueue.current.length === 0) {
      drainingRef.current = false;
      return;
    }
    // Adaptive batch: at least 3 chars per tick (~375 chars/sec baseline,
    // faster than the model streams), scaling up when the queue backlogs so
    // rendering never lags far behind generation.
    const batch = Math.max(3, Math.ceil(tokenQueue.current.length / 40));
    const text = tokenQueue.current.splice(0, batch).join("");
    const target = drainTargetRef.current;
    if (target) {
      updateConversation(target.convId, (c) => ({
        ...c,
        turns: c.turns.map((t, i) =>
          i === target.turnIndex ? { ...t, response: t.response + text } : t
        ),
      }));
    }
    // Auto-scroll here (not in useEffect) so we control exactly when it fires
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
    setTimeout(drainNext, 8);
  }

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    setConversations(stored);
    // Start in "new conversation" state — no conversation selected
    setActiveId(null);
  }, []);

  // Persist whenever conversations change
  useEffect(() => {
    if (conversations.length > 0) saveToStorage(conversations);
  }, [conversations]);

  // Listen for user scroll — set flag when they scroll up, clear when back at bottom
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
      userScrolledUpRef.current = !atBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to bottom when switching conversations or starting a new one
  useEffect(() => {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [activeId]);

  // Resize textarea whenever inputValue changes (including programmatic updates from example queries)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [inputValue]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const updateConversation = useCallback(
    (id: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
    },
    []
  );

  function clearQueue() {
    tokenQueue.current = [];
    drainingRef.current = false;
    drainTargetRef.current = null;
  }

  function handleNew() {
    abortRef.current?.abort();
    clearQueue();
    setIsSearching(false);
    setActiveId(null);
    setInputValue("");
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setInputValue("");
  }

  function handleDelete(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) saveToStorage([]);
      return next;
    });
    if (activeId === id) setActiveId(null);
  }

  async function handleSearch(situation: string) {
    const trimmed = situation.trim();
    if (!trimmed || isSearching) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    clearQueue();
    userScrolledUpRef.current = false;

    setInputValue("");
    setIsSearching(true);

    // Create a new conversation if we're in "new" state
    let convId = activeId;
    let turnIndex = 0;

    if (convId === null) {
      const newConv: Conversation = {
        id: crypto.randomUUID(),
        title: "…",
        createdAt: Date.now(),
        turns: [
          { situation: trimmed, steps: ["Analysing your situation..."], response: "", state: "searching" },
        ],
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newConv.id);
      convId = newConv.id;
      turnIndex = 0;
    } else {
      turnIndex = activeConversation?.turns.length ?? 0;
      updateConversation(convId, (c) => ({
        ...c,
        turns: [
          ...c.turns,
          { situation: trimmed, steps: ["Analysing your situation..."], response: "", state: "searching" },
        ],
      }));
    }

    // Generate title in background from first message
    if (turnIndex === 0) {
      fetch(`${API_URL}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation: trimmed }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const errMsg = await extractErrorMessage(r);
            throw new Error(errMsg);
          }
          return r.json();
        })
        .then(({ title }) => {
          if (title) updateConversation(convId!, (c) => ({ ...c, title }));
        })
        .catch((err) => {
          // Fall back to truncated input and mark as failed
          const fallbackTitle = trimmed.slice(0, 50);
          const errorMsg = err instanceof Error ? err.message : "Could not generate title";
          updateConversation(convId!, (c) => ({
            ...c,
            title: fallbackTitle,
            titleFailed: true,
          }));
          // Log so developer/support can see it, but don't block the search
          console.debug("Title generation failed:", errorMsg);
        });
    }

    try {
      // Build history from all completed turns in this conversation
      const currentTurns = conversations.find(c => c.id === convId)?.turns ?? [];
      const history = currentTurns
        .slice(0, turnIndex)  // only turns before this one
        .filter(t => t.state === "done" && t.response)
        .flatMap(t => [
          { role: "user", content: t.situation },
          { role: "assistant", content: t.response },
        ]);

      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation: trimmed, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errMsg = await extractErrorMessage(res);
        throw new Error(errMsg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      // Carry partial lines across reads — one SSE event can straddle two
      // network chunks, and parsing a half-received JSON line would throw.
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SSEEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue; // skip malformed event rather than failing the turn
          }

          if (event.type === "status") {
            updateConversation(convId!, (c) => ({
              ...c,
              turns: c.turns.map((t, i) => {
                if (i !== turnIndex) return t;
                const last = t.steps[t.steps.length - 1];
                return last === event.message
                  ? t
                  : { ...t, steps: [...t.steps, event.message ?? ""] };
              }),
            }));
          } else if (event.type === "token") {
            // Push each character into the queue for smooth rendering
            const chars = (event.text ?? "").split("");
            tokenQueue.current.push(...chars);
            startDrain(convId!, turnIndex);
          } else if (event.type === "done") {
            // Wait for queue to drain before marking done
            const markDone = () => {
              if (tokenQueue.current.length > 0) {
                setTimeout(markDone, 50);
                return;
              }
              updateConversation(convId!, (c) => ({
                ...c,
                turns: c.turns.map((t, i) => (i === turnIndex ? { ...t, state: "done" } : t)),
              }));
              setIsSearching(false);
            };
            markDone();
          } else if (event.type === "error") {
            updateConversation(convId!, (c) => ({
              ...c,
              turns: c.turns.map((t, i) =>
                i === turnIndex
                  ? { ...t, state: "error", error: event.message ?? "Unknown error" }
                  : t
              ),
            }));
            setIsSearching(false);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      updateConversation(convId!, (c) => ({
        ...c,
        turns: c.turns.map((t, i) =>
          i === turnIndex
            ? { ...t, state: "error", error: err instanceof Error ? err.message : "Unknown error" }
            : t
        ),
      }));
      setIsSearching(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch(inputValue);
    }
  }

  const conversationMetas = conversations.map(({ id, title, createdAt, titleFailed }) => ({
    id,
    title,
    createdAt,
    titleFailed,
  }));

  const isNewState = activeId === null;

  return (
    <div className="app">
      <div className={"scrim" + (sidebarOpen ? " show" : "")} onClick={() => setSidebarOpen(false)} />
      <Sidebar
        conversations={conversationMetas}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        {/* Mobile top bar with hamburger */}
        <div className="topbar">
          <button className="burger" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="t-name">Precedent Reasoning</span>
        </div>

        {/* Scrollable chat area */}
        <div ref={scrollContainerRef} className="chat">
          <div className="chat-inner">

            {/* Empty / new conversation state */}
            {isNewState && (
              <>
                <div className="intro-head">
                  <h2>Precedent Reasoning</h2>
                  <p>Find the cases that matter.</p>
                </div>

                <div className="about">
                  <h3>About this tool</h3>
                  <p>
                    <strong>What it does:</strong> Enter a description of your legal situation. The AI will search for relevant court cases from NSW and federal courts that apply to your circumstances.
                  </p>
                  <p>
                    <strong>What you&apos;ll get:</strong> For each relevant case, you&apos;ll see the court decision, legal principle, and how it compares to your situation.
                  </p>
                  <p>
                    <strong>Important:</strong> This tool provides legal <em>information</em> only, not legal <em>advice</em>. Always verify case details, check for overruling cases, and consult a qualified NSW solicitor before making decisions.
                  </p>
                  <p>
                    For free legal help, contact <a href="https://www.legalaid.nsw.gov.au" target="_blank" rel="noopener noreferrer">Legal Aid NSW</a>.
                  </p>
                </div>

                <ExampleQueries onSelect={(q) => setInputValue(q)} disabled={isSearching} />
              </>
            )}

            {/* Header shown above first turn of an existing conversation */}
            {!isNewState && activeConversation?.turns.length === 0 && (
              <>
                <div className="intro-head">
                  <h2>Precedent Reasoning</h2>
                  <p>Find the cases that matter.</p>
                </div>
                <ExampleQueries onSelect={(q) => setInputValue(q)} disabled={isSearching} />
              </>
            )}

            {/* Conversation turns */}
            {activeConversation?.turns.map((turn, i) => (
              <div key={i} className="turn">
                <div className="user-row">
                  <div className="user-bub">{turn.situation}</div>
                </div>

                {turn.state === "searching" && <AgentStatus steps={turn.steps} />}
                {turn.response && (
                  <ResultsPanel markdown={turn.response} streaming={turn.state === "searching"} />
                )}

                {turn.state === "error" && (
                  <div className="turn-error">{turn.error}</div>
                )}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Sticky input bar */}
        <div className="composer">
          <div className="composer-inner">
            <div className="field">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Describe your legal situation…  (Enter to send, Shift+Enter for new line)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSearching}
                maxLength={2000}
              />
              <button
                className="send"
                onClick={() => handleSearch(inputValue)}
                disabled={isSearching || !inputValue.trim()}
              >
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
            <div className="cc">
              <span>{inputValue.length}/2000</span>
            </div>
            <Disclaimer />
          </div>
        </div>
      </div>
    </div>
  );
}
