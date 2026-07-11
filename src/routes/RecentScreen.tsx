import { DocumentListView } from '@/components/DocumentListView';

export default function RecentScreen() {
  return (
    <div>
      <div className="screen-header">
        <h1 className="grow">Recent</h1>
      </div>
      <DocumentListView emptyMessage="No documents yet. Start a scan to see it here." />
    </div>
  );
}
