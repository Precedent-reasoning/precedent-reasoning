"use client";

import { useState } from "react";

interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  titleFailed?: boolean;
}

interface Props {
  conversations: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, isOpen, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = conversations
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className={"side" + (isOpen ? " open" : "")}>
      <div className="side-head">
        <div className="meta">
          <img src="/logo-wordmark.png" alt="Precedent Reasoning" className="side-wordmark" />
        </div>
        <button className="close" onClick={onClose} aria-label="Close sidebar">×</button>
      </div>

      <div className="side-block">
        <button className="new-btn" onClick={() => { onNew(); onClose(); }}>
          <span className="plus">+</span> New conversation
        </button>
      </div>

      <div className="side-block">
        <input
          className="side-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
        />
      </div>

      <div className="hist">
        <div className="hist-label">Recent</div>
        {filtered.length === 0 ? (
          <p className="hist-empty">{search ? "No matching conversations." : "No conversations yet."}</p>
        ) : (
          filtered.map((conv) => (
            <div key={conv.id} className={"hist-item" + (conv.id === activeId ? " active" : "")}>
              <button
                className="h-open"
                title={conv.titleFailed ? `${conv.title} (title generation failed)` : conv.title}
                onClick={() => { onSelect(conv.id); onClose(); }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{conv.title}</span>
                {conv.titleFailed && <span title="Title generation failed">⚠️</span>}
              </button>
              <button
                className="h-del"
                title="Delete conversation"
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="side-foot">
        Legal information, not advice. Always verify each citation against the original judgment.
      </div>
    </aside>
  );
}
