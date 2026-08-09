'use client';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

export function InternalNoteToggle({ value, onChange, disabled }: Props) {
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs ${
        disabled ? 'opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="size-3.5 rounded border-border accent-warning"
      />
      <span className={value ? 'font-medium text-warning' : 'text-muted-foreground'}>
        Nota interna
        {value ? (
          <span className="ml-1 text-[10px] text-muted-foreground">
            no se envía al cliente
          </span>
        ) : null}
      </span>
    </label>
  );
}
