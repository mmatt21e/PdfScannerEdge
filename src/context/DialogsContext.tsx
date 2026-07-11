import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/Dialog';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  placeholder?: string;
  validate?: (value: string) => string | null;
}

interface DialogsValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsValue | null>(null);

type ConfirmState = ConfirmOptions & { resolve: (v: boolean) => void };
type PromptState = PromptOptions & { resolve: (v: string | null) => void };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    []
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPromptValue(options.initialValue ?? '');
        setPromptError(null);
        setPromptState({ ...options, resolve });
      }),
    []
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const closePrompt = (result: string | null) => {
    if (result !== null && promptState?.validate) {
      const err = promptState.validate(result);
      if (err) {
        setPromptError(err);
        return;
      }
    }
    promptState?.resolve(result);
    setPromptState(null);
  };

  const value = useMemo<DialogsValue>(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogsContext.Provider value={value}>
      {children}

      <Dialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        onClose={() => closeConfirm(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => closeConfirm(false)}>
              {confirmState?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${confirmState?.danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="text-sm">{confirmState?.message}</div>
      </Dialog>

      <Dialog
        open={!!promptState}
        title={promptState?.title ?? ''}
        onClose={() => closePrompt(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => closePrompt(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => closePrompt(promptValue)}
            >
              {promptState?.confirmLabel ?? 'OK'}
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            closePrompt(promptValue);
          }}
        >
          <label htmlFor="prompt-input">{promptState?.label}</label>
          <input
            id="prompt-input"
            className="input"
            value={promptValue}
            placeholder={promptState?.placeholder}
            onChange={(e) => {
              setPromptValue(e.target.value);
              setPromptError(null);
            }}
            autoFocus
          />
          {promptError && (
            <p className="text-sm" role="alert" style={{ color: 'var(--danger)' }}>
              {promptError}
            </p>
          )}
        </form>
      </Dialog>
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) {
    throw new Error('useDialogs must be used within a DialogsProvider.');
  }
  return ctx;
}
