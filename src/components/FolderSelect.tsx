import { useFolders } from '@/hooks/useLibrary';
import { useServices } from '@/context/ServicesContext';
import { useDialogs } from '@/context/DialogsContext';
import { useToast } from '@/context/ToastContext';
import { DEFAULT_FOLDER_ID } from '@/domain/types';

/**
 * A folder <select> with an inline "New folder" action. Used on the Save screen and in the
 * new-scan flow so the destination folder can be created or changed at any point.
 */
export function FolderSelect({
  value,
  onChange,
  id = 'folder-select',
}: {
  value: string | undefined;
  onChange: (folderId: string) => void;
  id?: string;
}) {
  const folders = useFolders();
  const { folders: folderService } = useServices();
  const { prompt } = useDialogs();
  const { show } = useToast();

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
      const folder = await folderService.create(name);
      onChange(folder.id);
      show(`Folder "${folder.name}" created.`, 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not create folder.', 'error');
    }
  };

  return (
    <div className="row" style={{ gap: '0.5rem', alignItems: 'stretch' }}>
      <select
        id={id}
        className="select grow"
        value={value ?? DEFAULT_FOLDER_ID}
        onChange={(e) => onChange(e.target.value)}
      >
        {(folders ?? []).map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn" onClick={createFolder}>
        ＋ New
      </button>
    </div>
  );
}
