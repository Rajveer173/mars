import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check, X } from 'lucide-react';
import { type ReactNode } from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/format';
import { Button, IconButton } from './core';

/* ----------------------------------------------------------------- dialog */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/35 data-[state=open]:animate-rise" />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-paper shadow-float focus:outline-none',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-5">
            <div>
              <DialogPrimitive.Title className="display text-xl text-ink">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-base text-ink-2">{description}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" className="-mr-2 -mt-1">
                <X className="size-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-rule px-6 py-3.5">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  busy,
  danger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-base leading-relaxed text-ink-2">{children}</div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------- menu */

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-48 rounded-lg border border-rule bg-paper p-1 shadow-float data-[state=open]:animate-rise"
      >
        {children}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <MenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-1.5 text-base outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-desk data-[disabled]:opacity-40',
        danger ? 'text-red' : 'text-ink',
      )}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export const MenuSeparator = () => <MenuPrimitive.Separator className="my-1 h-px bg-rule-2" />;

/* ---------------------------------------------------------------- tooltip */

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-xs rounded bg-ink px-2 py-1 text-sm text-white data-[state=delayed-open]:animate-rise"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ toast */

interface ToastItem {
  id: number;
  message: string;
  tone: 'done' | 'error';
}

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let nextId = 1;

const push = (message: string, tone: ToastItem['tone']) => {
  const id = nextId++;
  useToasts.setState((state) => ({ items: [...state.items, { id, message, tone }] }));
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500);
};
const dismiss = (id: number) => useToasts.setState((state) => ({ items: state.items.filter((t) => t.id !== id) }));

/** `toast.done('Published')` after an action that says "Publish". */
export const toast = {
  done: (message: string) => push(message, 'done'),
  error: (message: string) => push(message, 'error'),
};

export function Toaster() {
  const items = useToasts((state) => state.items);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex animate-rise items-start gap-2.5 rounded-lg bg-ink px-3.5 py-3 text-base text-white shadow-float"
        >
          {item.tone === 'done' ? (
            <Check className="mt-0.5 size-4 shrink-0 text-mark" strokeWidth={3} aria-hidden />
          ) : (
            <X className="mt-0.5 size-4 shrink-0 text-red" strokeWidth={3} aria-hidden />
          )}
          <span className="flex-1">{item.message}</span>
          <button onClick={() => dismiss(item.id)} aria-label="Dismiss" className="text-white/60 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
