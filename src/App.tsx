import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { UpdatePrompt } from '@/components/UpdatePrompt';

const HomeScreen = lazy(() => import('@/routes/HomeScreen'));
const FoldersScreen = lazy(() => import('@/routes/FoldersScreen'));
const FolderScreen = lazy(() => import('@/routes/FolderScreen'));
const RecentScreen = lazy(() => import('@/routes/RecentScreen'));
const AllDocumentsScreen = lazy(() => import('@/routes/AllDocumentsScreen'));
const SettingsScreen = lazy(() => import('@/routes/SettingsScreen'));
const TrashScreen = lazy(() => import('@/routes/TrashScreen'));
const ScanScreen = lazy(() => import('@/routes/ScanScreen'));
const ReviewScreen = lazy(() => import('@/routes/ReviewScreen'));
const SaveScreen = lazy(() => import('@/routes/SaveScreen'));
const DocumentDetailScreen = lazy(() => import('@/routes/DocumentDetailScreen'));

// Routes that are full-screen and hide the bottom navigation.
const FULLSCREEN_ROUTES = ['/scan'];

export function App() {
  const location = useLocation();
  const hideNav = FULLSCREEN_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="app">
      <main className="app__main" id="main-content">
        <Suspense
          fallback={
            <div className="full-spinner">
              <span className="spinner" role="status" aria-label="Loading" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/folders" element={<FoldersScreen />} />
            <Route path="/folders/:folderId" element={<FolderScreen />} />
            <Route path="/recent" element={<RecentScreen />} />
            <Route path="/documents" element={<AllDocumentsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/trash" element={<TrashScreen />} />
            <Route path="/scan" element={<ScanScreen />} />
            <Route path="/review" element={<ReviewScreen />} />
            <Route path="/save" element={<SaveScreen />} />
            <Route path="/documents/:documentId" element={<DocumentDetailScreen />} />
            <Route path="*" element={<HomeScreen />} />
          </Routes>
        </Suspense>
      </main>
      {!hideNav && <BottomNav />}
      <UpdatePrompt />
    </div>
  );
}
