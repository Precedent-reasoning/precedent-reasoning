const EXAMPLES = [
  {
    category: "Consumer & Contracts",
    queries: [
      "I agreed to sell my small business and the buyer is now backing out at the last minute. Can I keep their deposit and what are my options?",
    ],
  },
  {
    category: "Property & Planning",
    queries: [
      "I applied for approval to build a granny flat and the council knocked it back with no explanation and never let me respond to their concerns. Do I have any rights here?",
    ],
  },
  {
    category: "Family Law",
    queries: [
      "My ex wants to move to Queensland with our kids and I don't agree. What usually happens in these situations and what do the courts look at?",
    ],
  },
];

interface Props {
  onSelect: (query: string) => void;
  disabled: boolean;
}

export function ExampleQueries({ onSelect, disabled }: Props) {
  return (
    <div>
      <div className="ex-label">Example legal scenarios</div>
      {EXAMPLES.map((group) => (
        <div className="ex-group" key={group.category}>
          <div className="ex-cat">{group.category}</div>
          {group.queries.map((example) => (
            <button
              key={example}
              className="ex-q"
              disabled={disabled}
              onClick={() => onSelect(example)}
            >
              {example}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
