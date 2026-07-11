import { useNavigate } from 'react-router-dom';
import { useServices } from '@/context/ServicesContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { useFolders } from '@/hooks/useLibrary';
import { DEFAULT_FOLDER_ID } from '@/domain/types';

export default function FoldersScreen() {
  const navigate = useNavigate();
  const { folders: folderService } = useServices();
  const { show } = useToast();
  const { prompt, confirm } = useDialogs();
  const folders = useFolders();

  const createFolder = async () => {
    const name = await prompt({
      title: 'New folder',
      label: 'Folder name',
      confirmLabel: 'Create',
      placeholder: 'e.g. Receipts',
      validate: (v) => (v.trim() ? null : 'Please enter a name.'),
    });
    if (!name) return;
    try {
      await folderService.create(name);
      show('Folder created.', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not create folder.', 'error');
    }
  };

  const renameFolder = async (id: string, current: string) => {
    const name = await prompt({
      title: 'Rename folder',
      label: 'Folder name',
      initialValue: current,
      confirmLabel: 'Rename',
      validate: (v) => (v.trim() ? null : 'Please enter a name.'),
    });
    if (!name) return;
    try {
      await folderService.rename(id, name);
      show('Folder renamed.', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not rename folder.', 'error');
    }
  };

  const deleteFolder = async (id: string, name: string) => {
    const count = await folderService.documentCount(id);
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message:
        count > 0
          ? `This folder contains ${count} document${count === 1 ? '' : 's'}. They will be moved to Documents, then the folder will be deleted.`
          : 'This empty folder will be deleted.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await folderService.delete(id, true);
      show('Folder deleted.', 'info');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not delete folder.', 'error');
    }
  };

  return (
    <div>
      <div className="screen-header">
        <h1 className="grow">Folders</h1>
        <button type="button" className="btn btn--primary" onClick={createFolder}>
          ＋ New
        </button>
      </div>

      <ul className="list">
        {(folders ?? []).map((folder) => (
          <li key={folder.id} className="doc-row" style={{ cursor: 'default' }}>
            <button
              type="button"
              className="row grow"
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/folders/${folder.id}`)}
            >
              <span className="folder-card__icon" aria-hidden="true">
                📁
              </span>
              <span className="doc-row__title">{folder.name}</span>
            </button>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label={`Rename ${folder.name}`}
                onClick={() => renameFolder(folder.id, folder.name)}
              >
                ✏
              </button>
              {folder.id !== DEFAULT_FOLDER_ID && (
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  aria-label={`Delete ${folder.name}`}
                  onClick={() => deleteFolder(folder.id, folder.name)}
                >
                  🗑
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
