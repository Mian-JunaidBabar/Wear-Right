import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
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
  HelpCircle,
} from "lucide-react";
import { UserState } from "../types";
import { API_ENDPOINTS } from "../config/api";

interface FaceScanViewProps {
  user: UserState;
  setUser: React.Dispatch<React.SetStateAction<UserState>>;
}

type ScanState = 'idle' | 'camera' | 'scanning' | 'complete' | 'error';
type ScanState = "idle" | "camera" | "scanning" | "complete" | "error";

export default function FaceScanView({ user, setUser }: FaceScanViewProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);
  const [activeTelemetry, setActiveTelemetry] = useState('CAMERA IDLE');
  const [detectedTone, setDetectedTone] = useState('');
  const [activeTelemetry, setActiveTelemetry] = useState("CAMERA IDLE");
  const [detectedTone, setDetectedTone] = useState("");
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [lightingQuality, setLightingQuality] = useState('');
  const [lightingQuality, setLightingQuality] = useState("");
  const [brightness, setBrightness] = useState<number | null>(null);
  const [backendMessage, setBackendMessage] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [backendMessage, setBackendMessage] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [framesAnalyzed, setFramesAnalyzed] = useState<number | null>(null);

  const telemetrySteps = [
    'ACCESSING CAMERA STREAM...',
    'CAPTURING MULTIPLE FRAMES...',
    'SELECTING BEST LIGHTING FRAME...',
    'UPLOADING FRAMES TO DJANGO API...',
    'APPLYING ILLUMINATION NORMALIZATION...',
    'CLASSIFYING SKIN TONE WITH LAB / ITA...'
    "ACCESSING CAMERA STREAM...",
    "CAPTURING MULTIPLE FRAMES...",
    "SELECTING BEST LIGHTING FRAME...",
    "UPLOADING FRAMES TO DJANGO API...",
    "APPLYING ILLUMINATION NORMALIZATION...",
    "CLASSIFYING SKIN TONE WITH LAB / ITA...",
  ];

  const getColorName = (colorHex: string) => {
    const names: Record<string, string> = {
      // Fair
      '#FCD5C8': 'Soft Peach',
      '#D4E6F1': 'Powder Blue',
      '#E6DCD2': 'Desert Sand',
      '#FADBD8': 'Pastel Rose',
      '#E8F8F5': 'Mint Ice',
      "#FCD5C8": "Soft Peach",
      "#D4E6F1": "Powder Blue",
      "#E6DCD2": "Desert Sand",
      "#FADBD8": "Pastel Rose",
      "#E8F8F5": "Mint Ice",
      // Dark
      '#004B23': 'Forest Green',
      '#0A1128': 'Midnight Navy',
      '#5F0F40': 'Deep Plum',
      '#E3A857': 'Warm Gold',
      '#78281F': 'Oxblood Red',
      "#004B23": "Forest Green",
      "#0A1128": "Midnight Navy",
      "#5F0F40": "Deep Plum",
      "#E3A857": "Warm Gold",
      "#78281F": "Oxblood Red",
      // Medium
      '#C87A53': 'Terracotta',
      '#6E8B3D': 'Olive Green',
      '#D4AF37': 'Antique Gold',
      '#7D6608': 'Rich Ochre',
      '#2E4053': 'Slate Blue'
      "#C87A53": "Terracotta",
      "#6E8B3D": "Olive Green",
      "#D4AF37": "Antique Gold",
      "#7D6608": "Rich Ochre",
      "#2E4053": "Slate Blue",
    };
    return names[colorHex.toUpperCase()] || colorHex;
  };

  useEffect(() => {
    return () => {
      stopCamera();
      clearAutoTimers();
    };
  }, []);

  // Smooth scroll to result section on completion
  useEffect(() => {
    if (scanState === 'complete') {
    if (scanState === "complete") {
      const scrollTimer = window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 150);
      return () => window.clearTimeout(scrollTimer);
    }
  }, [scanState]);

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
      setErrorMessage("");
      setDetectedTone("");
      setConfidenceScore(null);
      setLightingQuality('');
      setLightingQuality("");
      setBrightness(null);
      setBackendMessage('');
      setPreviewImage('');
      setBackendMessage("");
      setPreviewImage("");
      setCountdown(null);
      setFramesAnalyzed(null);

      setScanState('camera');
      setActiveTelemetry('WAITING FOR CAMERA PERMISSION...');
      setScanState("camera");
      setActiveTelemetry("WAITING FOR CAMERA PERMISSION...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 960 }
          height: { ideal: 960 },
        },
        audio: false
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCountdown(4);
      setActiveTelemetry('CAMERA READY. AUTO MULTI-FRAME SCAN STARTING...');
      setActiveTelemetry("CAMERA READY. AUTO MULTI-FRAME SCAN STARTING...");

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
      console.error("Camera Error:", error);
      setScanState("error");
      setErrorMessage("Camera access denied or camera not available.");
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
        telemetrySteps.length - 1,
      );

      setActiveTelemetry(telemetrySteps[stepIndex]);

      if (currentProgress >= 100) {
        clearInterval(timer);
      }
    }, 120);
  };

  const captureOneFrame = async (): Promise<{ blob: Blob; imageDataUrl: string } | null> => {
  const captureOneFrame = async (): Promise<{
    blob: Blob;
    imageDataUrl: string;
  } | null> => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext('2d');
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((createdBlob) => {
        resolve(createdBlob);
      }, 'image/jpeg', 0.9);
      canvas.toBlob(
        (createdBlob) => {
          resolve(createdBlob);
        },
        "image/jpeg",
        0.9,
      );
    });

    if (!blob) return null;

    return { blob, imageDataUrl };
  };

  const sendImagesToBackend = async (blobs: Blob[]) => {
    try {
      setScanState('scanning');
      setErrorMessage('');
      setScanState("scanning");
      setErrorMessage("");
      setFramesAnalyzed(null);
      runProgressAnimation();

      const formData = new FormData();

      if (blobs.length === 1) {
        formData.append('image', blobs[0], 'face-scan.jpg');
        formData.append("image", blobs[0], "face-scan.jpg");
      } else {
        blobs.forEach((blob, index) => {
          formData.append('images', blob, `face-frame-${index + 1}.jpg`);
          formData.append("images", blob, `face-frame-${index + 1}.jpg`);
        });
      }

      const response = await fetch('http://127.0.0.1:8000/api/scanner/analyze/', {
        method: 'POST',
        body: formData
      const response = await fetch(API_ENDPOINTS.scannerAnalyze, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Skin tone analysis failed.');
        throw new Error(data.error || "Skin tone analysis failed.");
      }

      const tone = data.detected_skin_tone || 'Rescan Required';
      const tone = data.detected_skin_tone || "Rescan Required";
      const confidence = Number(data.confidence_score || 0);

      setDetectedTone(tone);
      setConfidenceScore(confidence);
      setLightingQuality(data.lighting_quality || 'Unknown');
      setLightingQuality(data.lighting_quality || "Unknown");
      setBrightness(
        typeof data.brightness === 'number'
        typeof data.brightness === "number"
          ? data.brightness
          : Number(data.brightness || 0)
          : Number(data.brightness || 0),
      );
      setBackendMessage(data.message || '');
      setBackendMessage(data.message || "");
      setFramesAnalyzed(data.total_frames_analyzed || blobs.length);

      if (tone !== 'Rescan Required' && tone !== 'Unknown') {
      if (tone !== "Rescan Required" && tone !== "Unknown") {
        setUser((prevUser) => ({
          ...prevUser,
          contrastType: tone
          contrastType: tone,
        }));
      }
      setTimeout(() => {
        setProgress(100);
        setActiveTelemetry('SCAN COMPLETE');
        setScanState('complete');
        setActiveTelemetry("SCAN COMPLETE");
        setScanState("complete");
      }, 800);
    } catch (error) {
      console.error('Scan API Error:', error);
      setScanState('error');
      setErrorMessage('Unable to analyze image. Make sure Django backend is running.');
      console.error("Scan API Error:", error);
      setScanState("error");
      setErrorMessage(
        "Unable to analyze image. Make sure Django backend is running.",
      );
    }
  };

  const captureMultipleFrames = async () => {
    clearAutoTimers();
    setCountdown(null);

    if (!videoRef.current || !canvasRef.current) {
      setScanState('error');
      setErrorMessage('Camera frame not available.');
      setScanState("error");
      setErrorMessage("Camera frame not available.");
      return;
    }

    try {
      setActiveTelemetry('CAPTURING MULTIPLE FRAMES FOR BEST RESULT...');
      setActiveTelemetry("CAPTURING MULTIPLE FRAMES FOR BEST RESULT...");

      const capturedBlobs: Blob[] = [];
      let latestPreview = '';
      let latestPreview = "";

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
        setScanState("error");
        setErrorMessage("Unable to capture frames.");
        return;
      }

      stopCamera();
      await sendImagesToBackend(capturedBlobs);
    } catch (error) {
      console.error('Multi-frame Capture Error:', error);
      setScanState('error');
      setErrorMessage('Unable to complete multi-frame scan.');
      console.error("Multi-frame Capture Error:", error);
      setScanState("error");
      setErrorMessage("Unable to complete multi-frame scan.");
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    setScanState("idle");
    setProgress(0);
    setActiveTelemetry('CAMERA IDLE');
    setDetectedTone('');
    setActiveTelemetry("CAMERA IDLE");
    setDetectedTone("");
    setConfidenceScore(null);
    setLightingQuality('');
    setLightingQuality("");
    setBrightness(null);
    setBackendMessage('');
    setPreviewImage('');
    setErrorMessage('');
    setBackendMessage("");
    setPreviewImage("");
    setErrorMessage("");
    setCountdown(null);
    setFramesAnalyzed(null);
  };

  const getPaletteSwatches = (tone: string) => {
    const lowerTone = String(tone || '').toLowerCase();
    if (lowerTone.includes('fair')) {
      return ['#FCD5C8', '#D4E6F1', '#E6DCD2', '#FADBD8', '#E8F8F5'];
    } else if (lowerTone.includes('dark')) {
      return ['#004B23', '#0A1128', '#5F0F40', '#E3A857', '#78281F'];
    const lowerTone = String(tone || "").toLowerCase();
    if (lowerTone.includes("fair")) {
      return ["#FCD5C8", "#D4E6F1", "#E6DCD2", "#FADBD8", "#E8F8F5"];
    } else if (lowerTone.includes("dark")) {
      return ["#004B23", "#0A1128", "#5F0F40", "#E3A857", "#78281F"];
    } else {
      return ['#C87A53', '#6E8B3D', '#D4AF37', '#7D6608', '#2E4053'];
      return ["#C87A53", "#6E8B3D", "#D4AF37", "#7D6608", "#2E4053"];
    }
  };

  const getSuggestedOutfit = (tone: string) => {
    const lowerTone = String(tone || '').toLowerCase();
    if (lowerTone.includes('fair')) {
      return 'Shirt: White | Pant: Navy Blue | Shoes: Black';
    } else if (lowerTone.includes('dark')) {
      return 'Shirt: Peach / Gold | Pant: Olive Green | Shoes: Brown';
    const lowerTone = String(tone || "").toLowerCase();
    if (lowerTone.includes("fair")) {
      return "Shirt: White | Pant: Navy Blue | Shoes: Black";
    } else if (lowerTone.includes("dark")) {
      return "Shirt: Peach / Gold | Pant: Olive Green | Shoes: Brown";
    } else {
      return 'Shirt: Terracotta / Cream | Pant: Charcoal | Shoes: Dark Brown';
      return "Shirt: Terracotta / Cream | Pant: Charcoal | Shoes: Dark Brown";
    }
  };

  const isWarningResult =
    detectedTone === 'Rescan Required' ||
    lightingQuality === 'Too Low' ||
    lightingQuality === 'Too Bright';
    detectedTone === "Rescan Required" ||
    lightingQuality === "Too Low" ||
    lightingQuality === "Too Bright";

  return (
    <div className="w-full bg-cream-base min-h-[calc(100vh-80px)] py-12 px-6 flex flex-col items-center justify-center font-sans tracking-tight relative overflow-hidden">
      
      {/* Background ambient light gradients */}
      <div className="absolute right-[-100px] top-10 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-[-100px] bottom-10 w-96 h-96 bg-blue-50/20 rounded-full blur-3xl pointer-events-none" />
      

      {/* Subtle premium dots background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#C08E3E_0.6px,transparent_0.6px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

      {/* Centered Page Layout Wrapper */}
      <div className="w-full max-w-[640px] flex flex-col items-center relative z-10">

        {/* Header Section */}
        <header className="max-w-xl text-center mb-10 relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 w-max mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
              AI-POWERED SCANNING
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-brand-dark tracking-tight leading-tight">
            Adaptive Skin Tone Scanner
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-3 leading-relaxed max-w-md mx-auto font-sans font-medium">
            The system captures multiple frames, selects the best usable frame, applies lighting correction, and classifies skin tone using LAB / ITA analysis.
            The system captures multiple frames, selects the best usable frame,
            applies lighting correction, and classifies skin tone using LAB /
            ITA analysis.
          </p>
        </header>

        {/* Camera / Scan Box */}
        <div className="relative w-full max-w-[380px] aspect-[3/4] bg-white border-2 border-brand-gold/15 shadow-[0_20px_50px_-12px_rgba(35,33,29,0.18)] rounded-[2rem] overflow-hidden group select-none transition-all duration-500 hover:border-brand-gold/30">

          {scanState === 'camera' ? (
          {scanState === "camera" ? (
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
            /* Premium Empty State */
            <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center text-white px-6 text-center">
              <div className="p-5 rounded-full bg-slate-800/40 border border-slate-700/30 mb-5 relative">
                <Camera className="w-16 h-16 text-brand-gold animate-pulse" />
                <div className="absolute inset-0 rounded-full border border-brand-gold/30 animate-ping opacity-20" />
              </div>
              <p className="text-sm font-serif text-slate-200 tracking-wide mb-1">
                No Face Frame Captured
              </p>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                Start auto multi-frame scan or upload face image to calibrate
              </p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Lens overlay */}
          <div className="absolute inset-0 bg-slate-950/10 pointer-events-none" />

          {/* Decorative Corner Brackets */}
          <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-brand-gold/70 z-20 rounded-tl-md transition-all duration-300 group-hover:scale-105" />
          <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-brand-gold/70 z-20 rounded-tr-md transition-all duration-300 group-hover:scale-105" />
          <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-brand-gold/70 z-20 rounded-bl-md transition-all duration-300 group-hover:scale-105" />
          <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-brand-gold/70 z-20 rounded-br-md transition-all duration-300 group-hover:scale-105" />

          {/* Camera Count Down Overlay */}
          {scanState === 'camera' && countdown !== null && (
          {scanState === "camera" && countdown !== null && (
            <div className="absolute top-6 left-6 right-6 bg-slate-950/85 backdrop-blur-md text-white rounded-2xl px-4 py-4.5 z-30 text-center shadow-2xl border border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-brand-gold font-bold">
                Multi-frame scan starting
              </p>
              <p className="text-4xl font-serif font-bold text-white mt-1.5 animate-pulse">{countdown}</p>
              <p className="text-4xl font-serif font-bold text-white mt-1.5 animate-pulse">
                {countdown}
              </p>
            </div>
          )}

          {/* Scanning Beam Animation */}
          {scanState === 'scanning' && (
          {scanState === "scanning" && (
            <motion.div
              initial={{ top: '10%' }}
              animate={{ top: '90%' }}
              initial={{ top: "10%" }}
              animate={{ top: "90%" }}
              transition={{
                repeat: Infinity,
                repeatType: 'reverse',
                repeatType: "reverse",
                duration: 2.2,
                ease: 'easeInOut'
                ease: "easeInOut",
              }}
              className="absolute left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-brand-gold to-transparent shadow-[0_0_15px_4px_#C08E3E] z-25 pointer-events-none"
            />
          )}

          {scanState === 'complete' && (
            <div className={`absolute inset-0 pointer-events-none border-4 ${
              isWarningResult ? 'border-amber-500/50 bg-amber-900/5' : 'border-blue-500/40 bg-slate-900/10'
            }`} />
          {scanState === "complete" && (
            <div
              className={`absolute inset-0 pointer-events-none border-4 ${
                isWarningResult
                  ? "border-amber-500/50 bg-amber-900/5"
                  : "border-blue-500/40 bg-slate-900/10"
              }`}
            />
          )}

          {scanState === 'scanning' && (
          {scanState === "scanning" && (
            <div className="absolute top-5 left-5 bg-slate-950/80 px-3.5 py-2 text-[9px] text-brand-gold font-mono font-bold tracking-widest rounded-lg flex items-center gap-2 backdrop-blur-md shadow z-30 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>ANALYZING: {progress}%</span>
            </div>
          )}
        </div>

        {/* Action Controls Section */}
        <div className={`mt-8 flex flex-col items-center gap-5 w-full ${scanState === 'complete' ? 'max-w-[480px]' : 'max-w-sm'}`}>

          {scanState === 'complete' ? (
        <div
          className={`mt-8 flex flex-col items-center gap-5 w-full ${scanState === "complete" ? "max-w-[480px]" : "max-w-sm"}`}
        >
          {scanState === "complete" ? (
            /* Scan Complete Card with smooth entrance animation */
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full bg-white rounded-3xl p-7 sm:p-8 border border-blue-100 shadow-[0_20px_50px_-12px_rgba(35,33,29,0.12)] text-left flex flex-col gap-6 relative overflow-hidden transition-all duration-300 hover:shadow-[0_25px_60px_-10px_rgba(35,33,29,0.15)]"
            >
              {/* Subtle top decoration line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-brand-gold to-blue-500" />

              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Scan Successful
                </span>
                <h3 className="text-2xl sm:text-3xl font-serif font-normal text-brand-dark mt-3.5 capitalize">
                  Your Skin Tone: <span className="font-bold text-blue-600">{detectedTone}</span>
                  Your Skin Tone:{" "}
                  <span className="font-bold text-blue-600">
                    {detectedTone}
                  </span>
                </h3>
                

                {confidenceScore !== null && (
                  <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4.5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">Analysis Confidence</span>
                      <span className="text-sm font-sans font-bold text-brand-gold">{confidenceScore}%</span>
                      <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500">
                        Analysis Confidence
                      </span>
                      <span className="text-sm font-sans font-bold text-brand-gold">
                        {confidenceScore}%
                      </span>
                    </div>
                    {/* Progress Bar Track */}
                    <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${confidenceScore}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
                        transition={{
                          duration: 1.2,
                          ease: "easeOut",
                          delay: 0.15,
                        }}
                        className="h-full bg-gradient-to-r from-brand-gold via-blue-500 to-blue-600 rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Color Palette Section */}
              <div>
                <h4 className="font-sans font-bold text-xs uppercase tracking-widest text-slate-800 mb-3">
                  Recommended Palette
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  {getPaletteSwatches(detectedTone).map((color, idx) => (
                    <div
                      key={idx}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-transform duration-300 hover:scale-115 cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={`${getColorName(color)} (${color})`}
                    />
                  ))}
                </div>
              </div>

              {/* Suggested Outfit Summary Card */}
              <div className="bg-[#FBF9F4] rounded-2xl p-5 border border-brand-gold/15 shadow-sm relative overflow-hidden">
                {/* Visual subtle left gold highlight bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-gold" />
                <h4 className="font-sans font-bold text-[10px] uppercase tracking-widest text-brand-gold mb-2.5 pl-2">
                  Suggested Outfit
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 font-sans font-semibold leading-relaxed pl-2">
                  {getSuggestedOutfit(detectedTone)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={() => {
                    const finalTone = String(detectedTone || '').toLowerCase().includes('fair')
                      ? 'fair'
                      : String(detectedTone || '').toLowerCase().includes('dark')
                        ? 'dark'
                        : 'medium';
                    navigate(`/recommended?skinTone=${finalTone}&confidence=${confidenceScore || ''}`);
                    const finalTone = String(detectedTone || "")
                      .toLowerCase()
                      .includes("fair")
                      ? "fair"
                      : String(detectedTone || "")
                            .toLowerCase()
                            .includes("dark")
                        ? "dark"
                        : "medium";
                    navigate(
                      `/recommended?skinTone=${finalTone}&confidence=${confidenceScore || ""}`,
                    );
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase py-4.5 tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/10 cursor-pointer border-none flex items-center justify-center gap-2.5 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  View Recommended Products
                </button>

                <button
                  onClick={resetScan}
                  className="w-full border-2 border-blue-600/30 hover:border-blue-600/60 hover:bg-blue-50/50 text-blue-800 font-bold text-xs uppercase py-4 tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer bg-transparent hover:scale-[1.02] active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-Scan
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Telemetry Display */}
              {(scanState === 'scanning' || scanState === 'camera') && (
              {(scanState === "scanning" || scanState === "camera") && (
                <div className="flex items-center gap-2.5 p-3.5 bg-slate-900/95 text-blue-300 text-[10px] font-mono font-bold uppercase rounded-2xl w-full justify-center shadow-xl tracking-widest leading-none border border-slate-800/80 backdrop-blur-sm">
                  <Binary className="w-4 h-4 text-brand-gold animate-spin" />
                  <span className="text-slate-200">{activeTelemetry}</span>
                </div>
              )}

              {/* Error Box */}
              {scanState === 'error' && (
              {scanState === "error" && (
                <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4.5 py-3.5 text-xs font-bold rounded-2xl shadow-sm w-full">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Highlighted Instruction Box */}
              <div className="flex items-start gap-3 p-3.5 bg-blue-50/50 border border-blue-100/50 rounded-2xl w-full max-w-sm mt-1 shadow-sm text-left">
                <HelpCircle className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-900 leading-relaxed font-sans font-medium">
                  Use clear, natural lighting and keep your face centered. The system captures and analyzes multiple frames automatically for highest accuracy.
                  Use clear, natural lighting and keep your face centered. The
                  system captures and analyzes multiple frames automatically for
                  highest accuracy.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Main Action Buttons */}
              <div className="w-full flex flex-col gap-3.5 mt-2">
                {scanState === 'idle' || scanState === 'error' ? (
                {scanState === "idle" || scanState === "error" ? (
                  <>
                    <button
                      onClick={startCamera}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase py-4 tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Camera className="w-4 h-4 text-white animate-pulse" />
                      Start Camera
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-blue-600/30 hover:border-blue-600/60 hover:bg-blue-50/50 text-blue-800 font-bold text-xs uppercase py-4 tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Face Image
                    </button>
                  </>
                ) : (
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={captureMultipleFrames}
                      className="flex-1 bg-brand-gold hover:opacity-95 text-white font-bold text-xs uppercase py-4 tracking-wider rounded-xl transition-all duration-300 shadow-md shadow-brand-gold/10 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Scan Now
                    </button>

                    <button
                      onClick={resetScan}
                      className="flex-1 border-2 border-blue-600/30 hover:border-blue-600/60 hover:bg-blue-50/50 text-blue-800 font-bold text-xs uppercase py-4 tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer bg-transparent hover:scale-[1.02] active:scale-[0.98]"
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

    </div>
  );
}