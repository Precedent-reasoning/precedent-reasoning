interface Props {
  steps: string[];
}

export function AgentStatus({ steps }: Props) {
  if (steps.length === 0) return null;

  return (
    <div className="agent">
      <div className="agent-h">Agent working…</div>
      <div className="steps-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div className={"step-row" + (isLast ? " last" : "")} key={i}>
              <div className="step-dotcol">
                <div className="step-dot" />
                {!isLast && <div className="step-line" />}
              </div>
              <div className="step-tx">{step}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
