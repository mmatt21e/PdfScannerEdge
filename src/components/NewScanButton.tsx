import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/Dialog';
import { FolderSelect } from '@/components/FolderSelect';
import { useScanFlow } from '@/context/ScanFlowContext';
import { DEFAULT_FOLDER_ID } from '@/domain/types';

/**
 * Primary "New Scan" entry point. Implements the recommended workflow's choice: scan now
 * and pick a folder later, or select/create a folder before scanning.
 */
export function NewScanButton({
  className = 'btn btn--primary btn--block',
  label = 'New Scan',
  folderId: presetFolderId,
}: {
  className?: string;
  label?: string;
  /** When provided, scanning starts directly into this folder without prompting. */
  folderId?: string;
}) {
  const navigate = useNavigate();
  const { startNew } = useScanFlow();
  const [choosing, setChoosing] = useState(false);
  const [pickFolder, setPickFolder] = useState(false);
  const [folderId, setFolderId] = useState(presetFolderId ?? DEFAULT_FOLDER_ID);

  const scanNow = (folder?: string) => {
    startNew(folder);
    setChoosing(false);
    setPickFolder(false);
    navigate('/scan');
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => (presetFolderId ? scanNow(presetFolderId) : setChoosing(true))}
      >
        <span aria-hidden="true">📷</span> {label}
      </button>

      <Dialog
        open={choosing && !pickFolder}
        title="Start a new scan"
        onClose={() => setChoosing(false)}
      >
        <div className="stack">
          <p className="muted text-sm">
            You can organize this scan now or after you capture your pages.
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => scanNow()}>
            Scan now, choose folder later
          </button>
          <button type="button" className="btn btn--block" onClick={() => setPickFolder(true)}>
            Select or create a folder first
          </button>
        </div>
      </Dialog>

      <Dialog
        open={choosing && pickFolder}
        title="Choose a destination folder"
        onClose={() => setPickFolder(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setPickFolder(false)}>
              Back
            </button>
            <button type="button" className="btn btn--primary" onClick={() => scanNow(folderId)}>
              Start scanning
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="new-scan-folder">Folder</label>
          <FolderSelect id="new-scan-folder" value={folderId} onChange={setFolderId} />
        </div>
      </Dialog>
    </>
  );
}
