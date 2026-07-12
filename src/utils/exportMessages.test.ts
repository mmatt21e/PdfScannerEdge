import { describe, it, expect } from 'vitest';
import { exportOutcomeMessage } from './exportMessages';

describe('exportOutcomeMessage', () => {
  it('reports success for saved/downloaded with pluralization', () => {
    expect(exportOutcomeMessage('saved', 1)).toEqual({
      text: 'Exported 1 document to your chosen folder.',
      kind: 'success',
    });
    expect(exportOutcomeMessage('downloaded', 3)?.text).toBe(
      'Exported 3 documents to your Downloads folder.'
    );
  });

  it('returns null on cancel (silent)', () => {
    expect(exportOutcomeMessage('cancelled', 2)).toBeNull();
  });

  it('reports an error on failure', () => {
    expect(exportOutcomeMessage('failed', 1)?.kind).toBe('error');
  });

  it('gives share guidance when shared', () => {
    expect(exportOutcomeMessage('shared', 1)?.kind).toBe('info');
  });
});
