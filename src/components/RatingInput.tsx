import { RATING_SCALE } from "../types";

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
  name: string;
}

export default function RatingInput({ value, onChange, name }: RatingInputProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RATING_SCALE.slice()
        .reverse()
        .map((r) => {
          const active = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={active}
              name={name}
              title={`${r.value} — ${r.label}: ${r.description}`}
              onClick={() => onChange(r.value)}
              className={`group relative flex h-11 w-11 flex-col items-center justify-center rounded-full border text-sm font-bold font-mono transition ${
                active
                  ? "border-gold-500 bg-nu-900 text-gold-400 shadow-gold"
                  : "border-nu-100 bg-white text-nu-700 hover:border-nu-500 hover:text-nu-900"
              }`}
            >
              {r.value}
            </button>
          );
        })}
      <span className="ml-2 text-sm font-medium text-ink/70">
        {value ? RATING_SCALE.find((r) => r.value === value)?.label : "Not yet rated"}
      </span>
    </div>
  );
}
