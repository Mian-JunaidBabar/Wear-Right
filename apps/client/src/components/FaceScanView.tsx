import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Binary,
  Upload,
  HelpCircle
} from 'lucide-react';
import { UserState } from '../types';

interface FaceScanViewProps {
  user: UserState;
  setUser: React.Dispatch<React.SetStateAction<UserState>>;
}

type ScanState = 'idle' | 'camera' | 'scanning' | 'complete' | 'error';

export default function FaceScanView({ user, setUser }: FaceScanViewProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [progress, setProgress] = useState(0);
  const [activeTelemetry, setActiveTelemetry] = useState('CAMERA IDLE');
  const [detectedTone, setDetectedTone] = useState('');
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [lightingQuality, setLightingQuality] = useState('');
  const [brightness, setBrightness] = useState<number | null>(null);
  const [backendMessage, setBackendMessage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [framesAnalyzed, setFramesAnalyzed] = useState<number | null>(null);

  const telemetrySteps = [
    'ACCESSING CAMERA STREAM...',
    'CAPTURING MULTIPLE FRAMES...',
    'SELECTING BEST LIGHTING FRAME...',
    'UPLOADING FRAMES TO DJANGO API...',
    'APPLYING ILLUMINATION NORMALIZATION...',
    'CLASSIFYING SKIN TONE WITH LAB / ITA...'
  ];

  useEffect(() => {
    return () => {
      stopCamera();
      clearAutoTimers();
    };
  }, []);
  useEffect(() => {
  if (scanState !== 'complete') return;
  if (!detectedTone) return;

  const normalizedTone = String(detectedTone).toLowerCase();

  if (
    normalizedTone.includes('rescan') ||
    normalizedTone.includes('unknown')
  ) {
    return;
  }

  const finalTone = normalizedTone.includes('fair')
    ? 'fair'
    : normalizedTone.includes('dark')
      ? 'dark'
      : 'medium';

  const redirectTimer = window.setTimeout(() => {
    navigate(`/recommended?skinTone=${finalTone}&confidence=${confidenceScore || ''}`);
  }, 3000);

  return () => {
    window.clearTimeout(redirectTimer);
  };
}, [scanState, detectedTone, navigate]);

  const clearAutoTimers = () => {
    if (autoCaptureTimerRef.current) {
      window.clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const delay = (ms: number) => {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      clearAutoTimers();

      setErrorMessage('');
      setDetectedTone('');
      setConfidenceScore(null);
      setLightingQuality('');
      setBrightness(null);
      setBackendMessage('');
      setPreviewImage('');
      setCountdown(null);
      setFramesAnalyzed(null);

      setScanState('camera');
      setActiveTelemetry('WAITING FOR CAMERA PERMISSION...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 960 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCountdown(4);
      setActiveTelemetry('CAMERA READY. AUTO MULTI-FRAME SCAN STARTING...');

      let remaining = 4;

      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);

        if (remaining <= 0 && countdownTimerRef.current) {
          window.clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }, 1000);

      autoCaptureTimerRef.current = window.setTimeout(() => {
        captureMultipleFrames();
      }, 4000);
    } catch (error) {
      console.error('Camera Error:', error);
      setScanState('error');
      setErrorMessage('Camera access denied or camera not available.');
    }
  };

  const runProgressAnimation = () => {
    setProgress(0);
    setActiveTelemetry(telemetrySteps[0]);

    let currentProgress = 0;

    const timer = setInterval(() => {
      currentProgress += 8;
      setProgress(Math.min(currentProgress, 100));

      const stepIndex = Math.min(
        Math.floor((currentProgress / 100) * telemetrySteps.length),
        telemetrySteps.length - 1
      );

      setActiveTelemetry(telemetrySteps[stepIndex]);

      if (currentProgress >= 100) {
        clearInterval(timer);
      }
    }, 120);
  };

  const captureOneFrame = async (): Promise<{ blob: Blob; imageDataUrl: string } | null> => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((createdBlob) => {
        resolve(createdBlob);
      }, 'image/jpeg', 0.9);
    });

    if (!blob) return null;

    return { blob, imageDataUrl };
  };

  const sendImagesToBackend = async (blobs: Blob[]) => {
    try {
      setScanState('scanning');
      setErrorMessage('');
      setFramesAnalyzed(null);
      runProgressAnimation();

      const formData = new FormData();

      if (blobs.length === 1) {
        formData.append('image', blobs[0], 'face-scan.jpg');
      } else {
        blobs.forEach((blob, index) => {
          formData.append('images', blob, `face-frame-${index + 1}.jpg`);
        });
      }

      const response = await fetch('http://127.0.0.1:8000/api/scanner/analyze/', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Skin tone analysis failed.');
      }

      const tone = data.detected_skin_tone || 'Rescan Required';
      const confidence = Number(data.confidence_score || 0);

      setDetectedTone(tone);
      setConfidenceScore(confidence);
      setLightingQuality(data.lighting_quality || 'Unknown');
      setBrightness(
        typeof data.brightness === 'number'
          ? data.brightness
          : Number(data.brightness || 0)
      );
      setBackendMessage(data.message || '');
      setFramesAnalyzed(data.total_frames_analyzed || blobs.length);

      if (tone !== 'Rescan Required' && tone !== 'Unknown') {
        setUser((prevUser) => ({
          ...prevUser,
          contrastType: tone
        }));
      }
setTimeout(() => {
  setProgress(100);
  setActiveTelemetry('SCAN COMPLETE');
  setScanState('complete');

  const normalizedTone = String(tone || '').toLowerCase();

  if (
    normalizedTone.includes('fair') ||
    normalizedTone.includes('medium') ||
    normalizedTone.includes('dark')
  ) {
    const finalTone = normalizedTone.includes('fair')
      ? 'fair'
      : normalizedTone.includes('dark')
        ? 'dark'
        : 'medium';

    setTimeout(() => {
      navigate(`/recommended?skinTone=${finalTone}&confidence=${confidenceScore || ''}`);
    }, 1200);
  }
}, 800);
    } catch (error) {
      console.error('Scan API Error:', error);
      setScanState('error');
      setErrorMessage('Unable to analyze image. Make sure Django backend is running.');
    }
  };

  const captureMultipleFrames = async () => {
    clearAutoTimers();
    setCountdown(null);

    if (!videoRef.current || !canvasRef.current) {
      setScanState('error');
      setErrorMessage('Camera frame not available.');
      return;
    }

    try {
      setActiveTelemetry('CAPTURING MULTIPLE FRAMES FOR BEST RESULT...');

      const capturedBlobs: Blob[] = [];
      let latestPreview = '';

      for (let i = 0; i < 6; i++) {
        const frame = await captureOneFrame();

        if (frame) {
          capturedBlobs.push(frame.blob);
          latestPreview = frame.imageDataUrl;
          setPreviewImage(latestPreview);
        }

        await delay(350);
      }

      if (capturedBlobs.length === 0) {
        setScanState('error');
        setErrorMessage('Unable to capture frames.');
        return;
      }

      stopCamera();
      await sendImagesToBackend(capturedBlobs);
    } catch (error) {
      console.error('Multi-frame Capture Error:', error);
      setScanState('error');
      setErrorMessage('Unable to complete multi-frame scan.');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    clearAutoTimers();
    setPreviewImage(URL.createObjectURL(file));
    stopCamera();
    await sendImagesToBackend([file]);
  };

  const resetScan = () => {
    clearAutoTimers();
    stopCamera();

    setScanState('idle');
    setProgress(0);
    setActiveTelemetry('CAMERA IDLE');
    setDetectedTone('');
    setConfidenceScore(null);
    setLightingQuality('');
    setBrightness(null);
    setBackendMessage('');
    setPreviewImage('');
    setErrorMessage('');
    setCountdown(null);
    setFramesAnalyzed(null);
  };

  const getPaletteSwatches = (tone: string) => {
    const lowerTone = String(tone || '').toLowerCase();
    if (lowerTone.includes('fair')) {
      return ['#FCD5C8', '#D4E6F1', '#E6DCD2', '#FADBD8', '#E8F8F5'];
    } else if (lowerTone.includes('dark')) {
      return ['#004B23', '#0A1128', '#5F0F40', '#E3A857', '#78281F'];
    } else {
      return ['#C87A53', '#6E8B3D', '#D4AF37', '#7D6608', '#2E4053'];
    }
  };

  const getSuggestedOutfit = (tone: string) => {
    const lowerTone = String(tone || '').toLowerCase();
    if (lowerTone.includes('fair')) {
      return 'Shirt: White | Pant: Navy Blue | Shoes: Black';
    } else if (lowerTone.includes('dark')) {
      return 'Shirt: Peach / Gold | Pant: Olive Green | Shoes: Brown';
    } else {
      return 'Shirt: Terracotta / Cream | Pant: Charcoal | Shoes: Dark Brown';
    }
  };

  const isWarningResult =
    detectedTone === 'Rescan Required' ||
    lightingQuality === 'Too Low' ||
    lightingQuality === 'Too Bright';

  return (
    <div className="w-full bg-cream-base min-h-[calc(100vh-80px)] py-12 px-6 flex flex-col items-center justify-center font-sans tracking-tight relative">

      <div className="absolute right-10 top-20 w-72 h-72 bg-blue-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-10 bottom-20 w-72 h-72 bg-blue-200/5 rounded-full blur-3xl pointer-events-none" />

      <header className="max-w-xl text-center mb-8 relative z-10 font-sans">
        <h2 className="text-3xl font-display font-bold text-brand-dark tracking-tight">
          Adaptive Skin Tone Scanner
        </h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto font-sans font-medium">
          The system captures multiple frames, selects the best usable frame, applies lighting correction, and classifies skin tone using LAB / ITA analysis.
        </p>
      </header>

      <div className="relative w-full max-w-[400px] aspect-[3/4] bg-white border border-brand-border/60 shadow-2xl rounded-2xl overflow-hidden group select-none">

        {scanState === 'camera' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover bg-slate-900"
          />
        ) : previewImage ? (
          <img
            src={previewImage}
            alt="Captured face scan preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white">
            <Camera className="w-14 h-14 text-sage-green mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest">
              No Face Frame Captured
            </p>
            <p className="text-[10px] text-slate-400 mt-2">
              Start auto multi-frame scan or upload image
            </p>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 bg-slate-950/10 pointer-events-none" />

        <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 border-sage-green z-10 rounded-tl-md" />
        <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 border-sage-green z-10 rounded-tr-md" />
        <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 border-sage-green z-10 rounded-bl-md" />
        <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 border-sage-green z-10 rounded-br-md" />

        {scanState === 'camera' && countdown !== null && (
          <div className="absolute top-4 left-4 right-4 bg-black/80 text-white rounded-xl px-4 py-3 z-30 text-center shadow-lg">
            <p className="text-[10px] uppercase tracking-widest text-sage-green/80 font-bold">
              Multi-frame scan starting
            </p>
            <p className="text-3xl font-black mt-1">{countdown}</p>
          </div>
        )}

        {scanState === 'scanning' && (
          <motion.div
            initial={{ top: '10%' }}
            animate={{ top: '90%' }}
            transition={{
              repeat: Infinity,
              repeatType: 'reverse',
              duration: 2.2,
              ease: 'easeInOut'
            }}
            className="absolute left-0 w-full h-[2px] bg-sage-green/100 shadow-[0_0_15px_3px_#2563eb] z-20 pointer-events-none"
          />
        )}

        {scanState === 'complete' && (
          <div className={`absolute inset-0 pointer-events-none border-2 ${
            isWarningResult ? 'border-amber-500/50 bg-amber-900/5' : 'border-emerald-500/40 bg-slate-900/10'
          }`} />
        )}

        {scanState === 'scanning' && (
          <div className="absolute top-4 left-4 bg-black/75 px-3 py-1 text-[10px] text-sage-green font-mono font-bold tracking-widest rounded flex items-center gap-1.5 backdrop-blur-sm shadow z-20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>ANALYSIS PROGRESS: {progress}%</span>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-sm">

        {scanState === 'complete' ? (
          <div className="w-full bg-[#FAF7F2] rounded-2xl p-6 border border-emerald-950/10 shadow-md text-left flex flex-col gap-5">
            {/* Heading & Confidence */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
                Scan Result
              </span>
              <h3 className="text-xl sm:text-2xl font-serif font-normal text-slate-900 mt-1 capitalize">
                Your Skin Tone: {detectedTone}
              </h3>
              {confidenceScore !== null && (
                <p className="text-xs text-slate-500 font-sans mt-1">
                  Confidence Score: <span className="font-bold text-emerald-700">{confidenceScore}%</span>
                </p>
              )}
            </div>

            {/* Color Palette Section */}
            <div>
              <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                Recommended Palette
              </h4>
              <div className="flex gap-2">
                {getPaletteSwatches(detectedTone).map((color, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded-full border border-slate-200/50 shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Suggested Outfit Summary Card */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm">
              <h4 className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                Suggested Outfit
              </h4>
              <p className="text-xs text-slate-700 font-sans font-medium">
                {getSuggestedOutfit(detectedTone)}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  const finalTone = String(detectedTone || '').toLowerCase().includes('fair')
                    ? 'fair'
                    : String(detectedTone || '').toLowerCase().includes('dark')
                      ? 'dark'
                      : 'medium';
                  navigate(`/recommended?skinTone=${finalTone}&confidence=${confidenceScore || ''}`);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase py-3.5 tracking-wider rounded-xl transition-all shadow-md cursor-pointer border-none flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                View Recommended Products
              </button>

              <button
                onClick={resetScan}
                className="w-full border-2 border-brand-border/60 hover:bg-cream-card/60 text-slate-800 font-bold text-xs uppercase py-3 tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer bg-transparent"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Scan
              </button>
            </div>
          </div>
        ) : (
          <>
            {(scanState === 'scanning' || scanState === 'camera') && (
              <div className="flex items-center gap-2 p-3.5 bg-slate-900 text-sage-green text-[10px] font-mono font-bold uppercase rounded-xl w-full justify-center shadow-lg tracking-widest leading-none border border-slate-800">
                <Binary className="w-4 h-4 text-sage-green animate-spin" />
                <span>{activeTelemetry}</span>
              </div>
            )}

            {scanState === 'error' && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-xs font-bold rounded-xl">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            <p className="text-xs text-slate-500 text-center leading-relaxed font-sans font-medium mt-2 max-w-xs">
              Use clear lighting and keep your face centered. The system will scan multiple frames automatically.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="w-full flex flex-col gap-2 mt-2">
              {scanState === 'idle' || scanState === 'error' ? (
                <>
                  <button
                    onClick={startCamera}
                    className="w-full bg-brand-gold hover:opacity-90 text-white font-bold text-xs uppercase py-4 tracking-widest rounded-xl transition-all shadow-lg shadow-brand-gold/10 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-white animate-pulse" />
                    Start Camera
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-brand-border/60 hover:bg-cream-card/60 text-slate-800 font-bold text-xs uppercase py-3.5 tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Face Image
                  </button>
                </>
              ) : (
                <div className="flex gap-2 w-full">
                  <button
                    onClick={captureMultipleFrames}
                    className="flex-1 bg-brand-gold hover:opacity-90 text-white font-bold text-xs uppercase py-3.5 tracking-wider rounded-xl transition-all shadow-md shadow-brand-gold/10 cursor-pointer"
                  >
                    Scan Now
                  </button>

                  <button
                    onClick={resetScan}
                    className="flex-1 border-2 border-brand-border/60 hover:bg-cream-card/60 text-slate-800 font-bold text-xs uppercase py-3.5 tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        )}

      </div>

    </div>
  );
}