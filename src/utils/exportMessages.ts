import type { ExportOutcome } from '@/services/ExportService';
import type { ToastKind } from '@/context/ToastContext';

/** Map an export outcome to a user-facing toast (or null for a silent cancel). */
export function exportOutcomeMessage(
  outcome: ExportOutcome,
  count: number
): { text: string; kind: ToastKind } | null {
  const n = `${count} document${count === 1 ? '' : 's'}`;
  switch (outcome) {
    case 'saved':
      return { text: `Exported ${n} to your chosen folder.`, kind: 'success' };
    case 'shared':
      return { text: 'Choose a location in the share sheet to save it.', kind: 'info' };
    case 'downloaded':
      return { text: `Exported ${n} to your Downloads folder.`, kind: 'success' };
    case 'cancelled':
      return null;
    case 'failed':
    default:
      return { text: 'Export failed. Please try again.', kind: 'error' };
  }
}
