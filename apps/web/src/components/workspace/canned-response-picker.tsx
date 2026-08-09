'use client';

import { ChatText } from '@phosphor-icons/react';
import {
  resolverVariables,
  type CannedResponseSummary,
  type CannedVariableContext,
} from '@/lib/dashboard/canned-shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Props {
  cannedResponses: ReadonlyArray<CannedResponseSummary>;
  context: CannedVariableContext;
  onPick: (resolved: string, cannedId: string) => void;
  disabled?: boolean;
}

export function CannedResponsePicker({
  cannedResponses,
  context,
  onPick,
  disabled,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <ChatText size={12} aria-hidden /> Plantillas
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar plantilla" />
          <CommandList>
            <CommandEmpty>
              {cannedResponses.length === 0
                ? 'Sin plantillas disponibles'
                : 'Sin coincidencias'}
            </CommandEmpty>
            <CommandGroup>
              {cannedResponses.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.titulo}
                  onSelect={() => {
                    const resolved = resolverVariables(c.contenido_md, context);
                    onPick(resolved, c.id);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{c.titulo}</span>
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {c.contenido_md.slice(0, 120)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
