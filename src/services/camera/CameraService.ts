// Camera abstraction. Wraps getUserMedia and MediaStreamTrack capabilities so the UI
// never touches the raw browser API. Torch/focus/exposure are detected per-stream.

export interface CameraStartOptions {
  /** Preferred facing mode; defaults to the rear camera. */
  facingMode?: 'environment' | 'user';
  /** Ideal capture width in pixels. */
  idealWidth?: number;
  idealHeight?: number;
}

export interface CameraStreamInfo {
  stream: MediaStream;
  hasTorch: boolean;
  hasFocus: boolean;
  hasExposure: boolean;
}

export class CameraPermissionError extends Error {
  constructor(
    message: string,
    public readonly reason: 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown'
  ) {
    super(message);
    this.name = 'CameraPermissionError';
  }
}

export interface CameraService {
  start(options?: CameraStartOptions): Promise<CameraStreamInfo>;
  stop(): void;
  /** Capture the current video frame from an attached <video> element as a JPEG blob. */
  captureFrame(video: HTMLVideoElement, quality?: number): Promise<Blob>;
  setTorch(enabled: boolean): Promise<void>;
  isActive(): boolean;
}

// Torch/focus live in non-standard track capability fields; keep the casts local.
interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  focusMode?: string[];
  exposureMode?: string[];
}
interface ExtendedConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

export class BrowserCameraService implements CameraService {
  private stream?: MediaStream;
  private track?: MediaStreamTrack;

  async start(options: CameraStartOptions = {}): Promise<CameraStreamInfo> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraPermissionError(
        'Live camera access is not supported in this browser.',
        'unsupported'
      );
    }
    this.stop();

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: options.facingMode ?? 'environment' },
        width: { ideal: options.idealWidth ?? 1920 },
        height: { ideal: options.idealHeight ?? 1080 },
      },
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      throw this.mapError(err);
    }

    this.stream = stream;
    this.track = stream.getVideoTracks()[0];

    const caps = (this.track?.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
    return {
      stream,
      hasTorch: caps.torch === true,
      hasFocus: Array.isArray(caps.focusMode) && caps.focusMode.length > 0,
      hasExposure: Array.isArray(caps.exposureMode) && caps.exposureMode.length > 0,
    };
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.track = undefined;
  }

  isActive(): boolean {
    return !!this.stream && this.track?.readyState === 'live';
  }

  async captureFrame(video: HTMLVideoElement, quality = 0.92): Promise<Blob> {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new Error('The camera is not ready yet. Please wait a moment and try again.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not capture the frame: 2D canvas is unavailable.');
    }
    ctx.drawImage(video, 0, 0, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture the camera frame.'))),
        'image/jpeg',
        quality
      );
    });
  }

  async setTorch(enabled: boolean): Promise<void> {
    if (!this.track) return;
    const caps = (this.track.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
    if (caps.torch !== true) {
      throw new Error('Torch is not supported on this device.');
    }
    await this.track.applyConstraints({
      advanced: [{ torch: enabled } as ExtendedConstraintSet],
    });
  }

  private mapError(err: unknown): CameraPermissionError {
    const name = err instanceof DOMException ? err.name : '';
    switch (name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return new CameraPermissionError(
          'Camera access was denied. Enable the camera in your browser settings, or import an image instead.',
          'denied'
        );
      case 'NotFoundError':
      case 'OverconstrainedError':
        return new CameraPermissionError(
          'No suitable camera was found. You can import an image from your photo library instead.',
          'not-found'
        );
      case 'NotReadableError':
      case 'AbortError':
        return new CameraPermissionError(
          'The camera is already in use by another app. Close it and try again, or import an image.',
          'in-use'
        );
      default:
        return new CameraPermissionError(
          'The camera could not be started. You can import an image instead.',
          'unknown'
        );
    }
  }
}
