"use client";

import { Streamdown } from "streamdown";

interface Props {
  markdown: string;
  streaming?: boolean;
}

export function ResultsPanel({ markdown, streaming = false }: Props) {
  if (!markdown) return null;

  return (
    <div className="rp">
      <div className="rp-head">
        <span>Results</span>
      </div>
      <div className="rp-body">
        <div className="rp-markdown">
          <Streamdown
            mode={streaming ? "streaming" : "static"}
            controls={false}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {markdown}
          </Streamdown>
        </div>
      </div>
    </div>
  );
}
