import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '@/context/ServicesContext';
import { useScanFlow } from '@/context/ScanFlowContext';
import { useToast } from '@/context/ToastContext';
import { useDialogs } from '@/context/DialogsContext';
import { usePreferences } from '@/hooks/usePreferences';
import { ImportButton } from '@/components/ImportButton';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { CameraPermissionError } from '@/services/camera/CameraService';
import type { ScanPage } from '@/domain/types';

type CamState = 'starting' | 'live' | 'error';

export default function ScanScreen() {
  const navigate = useNavigate();
  const { camera } = useServices();
  const { session, startNew, addCapture, clear } = useScanFlow();
  const { show } = useToast();
  const { confirm } = useDialogs();
  const { preferences, update: updatePrefs } = usePreferences();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [camState, setCamState] = useState<CamState>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const autoCapture = preferences?.autoCapture ?? false;

  // Ensure there is a session to capture into.
  useEffect(() => {
    if (!session) startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = useCallback(async () => {
    setCamState('starting');
    try {
      const info = await camera.start({ facingMode: 'environment' });
      setHasTorch(info.hasTorch);
      const video = videoRef.current;
      if (video) {
        video.srcObject = info.stream;
        await video.play().catch(() => undefined);
      }
      setCamState('live');
    } catch (err) {
      const message =
        err instanceof CameraPermissionError
          ? err.message
          : 'The camera could not be started. You can import an image instead.';
      setErrorMsg(message);
      setCamState('error');
    }
  }, [camera]);

  useEffect(() => {
    void startCamera();
    return () => camera.stop();
  }, [startCamera, camera]);

  // Release the camera when backgrounded; re-acquire when visible again. Captured pages are
  // already persisted, so nothing is lost if the browser suspends us.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        camera.stop();
      } else if (camState !== 'error') {
        void startCamera();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [camera, camState, startCamera]);

  const doCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturing) return;
    setCapturing(true);
    try {
      const blob = await camera.captureFrame(video);
      await addCapture(blob);
    } catch (err) {
      show(err instanceof Error ? err.message : 'Capture failed. Please try again.', 'error');
    } finally {
      setCapturing(false);
    }
  }, [camera, addCapture, capturing, show]);

  // Optional automatic capture: capture when the frame is stable (low motion).
  useEffect(() => {
    if (!autoCapture || camState !== 'live') return;
    let raf = 0;
    let prev: ImageData | null = null;
    let stableFrames = 0;
    let cooldown = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (video && ctx && video.videoWidth) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (prev) {
          let diff = 0;
          for (let i = 0; i < frame.data.length; i += 4) {
            diff += Math.abs(frame.data[i]! - prev.data[i]!);
          }
          const avg = diff / (frame.data.length / 4);
          if (avg < 6) stableFrames++;
          else stableFrames = 0;
        }
        prev = frame;
        if (cooldown > 0) cooldown--;
        if (stableFrames > 12 && cooldown === 0 && !capturing) {
          stableFrames = 0;
          cooldown = 90; // ~1.5s at 60fps between auto captures
          void doCapture();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoCapture, camState, doCapture, capturing]);

  const toggleTorch = async () => {
    try {
      await camera.setTorch(!torchOn);
      setTorchOn((v) => !v);
    } catch {
      show('Torch is not available on this device.', 'info');
    }
  };

  const finish = () => {
    if (!session || session.pages.length === 0) {
      show('Capture at least one page first.', 'info');
      return;
    }
    camera.stop();
    navigate('/review');
  };

  const cancel = async () => {
    if (session && session.pages.length > 0) {
      const ok = await confirm({
        title: 'Discard scan?',
        message: `You have ${session.pages.length} captured page${
          session.pages.length === 1 ? '' : 's'
        }. Discard them and exit?`,
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
      await clear();
    }
    camera.stop();
    navigate('/');
  };

  const pages = session?.pages ?? [];

  return (
    <div className="camera">
      <video
        ref={videoRef}
        className="camera__video"
        playsInline
        muted
        autoPlay
        aria-label="Camera preview"
      />

      {camState === 'live' && <div className="camera__overlay" aria-hidden="true" />}

      <div className="camera__topbar">
        <button type="button" className="camera__pill" onClick={cancel}>
          ✕ Cancel
        </button>
        <span className="camera__pill" aria-live="polite">
          {pages.length} page{pages.length === 1 ? '' : 's'}
        </span>
        {hasTorch ? (
          <button
            type="button"
            className="camera__pill"
            aria-pressed={torchOn}
            onClick={toggleTorch}
          >
            {torchOn ? '🔦 On' : '🔦 Off'}
          </button>
        ) : (
          <span style={{ width: 44 }} aria-hidden="true" />
        )}
      </div>

      {camState === 'error' && (
        <div
          className="card"
          style={{ position: 'absolute', top: '20%', left: 16, right: 16, zIndex: 2 }}
          role="alert"
        >
          <h2>Camera unavailable</h2>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-sm muted">Your captured pages are safe.</p>
          <div className="stack">
            <button type="button" className="btn btn--primary" onClick={() => void startCamera()}>
              Try again
            </button>
            <ImportButton label="Import image instead" />
            {pages.length > 0 && (
              <button type="button" className="btn" onClick={finish}>
                Continue with {pages.length} page{pages.length === 1 ? '' : 's'}
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {pages.length > 0 && (
        <div className="camera__thumbs" aria-label="Captured pages">
          {pages.map((p) => (
            <PageThumb key={p.id} page={p} />
          ))}
        </div>
      )}

      {camState === 'live' && (
        <div className="camera__controls">
          <label className="camera__pill" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={autoCapture}
              onChange={(e) => void updatePrefs({ autoCapture: e.target.checked })}
            />
            Auto
          </label>
          <button
            type="button"
            className="camera__shutter"
            onClick={() => void doCapture()}
            disabled={capturing}
            aria-label="Capture page"
          />
          <button
            type="button"
            className="camera__pill"
            onClick={finish}
            disabled={pages.length === 0}
          >
            Finish ✓
          </button>
        </div>
      )}
    </div>
  );
}

function PageThumb({ page }: { page: ScanPage }) {
  const url = useObjectUrl(page.thumbnailImage ?? page.processedImage);
  return url ? (
    <img className="camera__thumb" src={url} alt="" />
  ) : (
    <span className="camera__thumb" />
  );
}
