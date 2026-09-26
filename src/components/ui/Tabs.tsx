import { Button } from "./Button";

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Tabs<T extends string>({ label, options, value, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="glass-inset flex gap-1 p-1 overflow-x-auto">
      {options.map((option) => (
        <Button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          aria-pressed={value === option.value}
          size="sm"
          className="shrink-0"
          onClick={() => onChange(option.value)}
        >
          {option.label}{option.count !== undefined ? ` (${option.count})` : ""}
        </Button>
      ))}
    </div>
  );
}
