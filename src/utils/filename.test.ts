import { describe, it, expect } from 'vitest';
import {
  sanitizeFilenameBase,
  ensurePdfExtension,
  stripPdfExtension,
  suggestFilenameBase,
  incrementFilename,
  isDuplicateName,
} from './filename';

describe('filename utils', () => {
  it('strips invalid characters but keeps spaces and dashes', () => {
    expect(sanitizeFilenameBase('My/Invoice:2026?')).toBe('MyInvoice2026');
    expect(sanitizeFilenameBase('Trip to Berlin - 2026')).toBe('Trip to Berlin - 2026');
  });

  it('falls back to a default when empty and guards reserved names', () => {
    expect(sanitizeFilenameBase('   ')).toBe('Scan');
    expect(sanitizeFilenameBase('///')).toBe('Scan');
    expect(sanitizeFilenameBase('CON')).toBe('CON_file');
  });

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilenameBase('report...  ')).toBe('report');
  });

  it('ensures a single lowercase .pdf extension', () => {
    expect(ensurePdfExtension('report')).toBe('report.pdf');
    expect(ensurePdfExtension('report.PDF')).toBe('report.pdf');
    expect(stripPdfExtension('report.pdf')).toBe('report');
  });

  it('suggests a timestamped name', () => {
    const name = suggestFilenameBase(new Date('2026-07-11T14:30:00'));
    expect(name).toBe('Scan_2026-07-11_1430');
  });

  it('detects duplicates case-insensitively ignoring extension', () => {
    expect(isDuplicateName('Report', ['report.pdf'])).toBe(true);
    expect(isDuplicateName('Other', ['report.pdf'])).toBe(false);
  });

  it('increments to the next available name', () => {
    expect(incrementFilename('Report', ['Report.pdf'])).toBe('Report (2)');
    expect(incrementFilename('Report', ['Report.pdf', 'Report (2).pdf'])).toBe('Report (3)');
    expect(incrementFilename('Report (2)', ['Report (2).pdf'])).toBe('Report (3)');
    expect(incrementFilename('Fresh', ['Report.pdf'])).toBe('Fresh');
  });
});
