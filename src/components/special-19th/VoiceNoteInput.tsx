"use client";

import { useEffect, useRef, useState } from "react";

type VoiceNoteInputProps = {
  disabled?: boolean;
  existingFileName?: string;
  existingUrl?: string;
  value: File | null;
  onChange: (file: File | null) => void;
};

export function VoiceNoteInput({
  disabled = false,
  existingFileName = "",
  existingUrl = "",
  value,
  onChange
}: VoiceNoteInputProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");
  const [canRecord, setCanRecord] = useState<boolean | null>(null);

  useEffect(() => {
    setCanRecord(
      "MediaRecorder" in window && Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  useEffect(() => {
    if (!value) {
      setPreviewUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(value);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }

      const recorder = recorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }

      stopStream();
    };
  }, []);

  async function startRecording() {
    if (canRecord !== true || disabled) {
      setRecordingError("Recording is unavailable here. Choose an audio file instead.");
      return;
    }

    setRecordingError("");
    setRecordingSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const resolvedType = recorder.mimeType || mimeType || "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: resolvedType });

        if (blob.size > 0) {
          const extension = getAudioExtension(resolvedType);
          onChange(
            new File([blob], `our-19th-voice-${Date.now()}.${extension}`, {
              type: resolvedType
            })
          );
        }

        setIsRecording(false);
        stopTimer();
        stopStream();
      };
      recorder.start(500);
      setIsRecording(true);
      timerRef.current = window.setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000
      );
    } catch (error) {
      console.error("[Special 19th] Voice recording could not start", error);
      setRecordingError(
        "The microphone could not start. You can choose an audio file instead."
      );
      stopTimer();
      stopStream();
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setRecordingError("");
    onChange(file);
    event.target.value = "";
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const audioSource = previewUrl || existingUrl;
  const audioLabel = value?.name || existingFileName;

  return (
    <div className="rounded-3xl bg-rose-50/75 p-4 ring-1 ring-rose-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-rose-950">A voice note for you</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            Record here, or choose an audio file.
          </p>
        </div>
        {isRecording ? (
          <span className="shrink-0 rounded-full bg-rose-950 px-3 py-1 text-xs font-semibold text-white">
            {formatDuration(recordingSeconds)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || (canRecord !== true && !isRecording)}
          className={`min-h-12 rounded-2xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
            isRecording
              ? "bg-rose-600 text-white"
              : "bg-rose-950 text-rose-50 shadow-md shadow-rose-950/15"
          }`}
        >
          {isRecording ? "Stop recording" : value || existingUrl ? "Record again" : "Record"}
        </button>

        <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-white px-3 text-center text-sm font-semibold text-rose-700 ring-1 ring-rose-200 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
          Choose audio
          <input
            type="file"
            accept="audio/*"
            disabled={disabled || isRecording}
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
      </div>

      {canRecord === false ? (
        <p className="mt-3 text-xs leading-5 text-stone-500">
          Recording is not supported in this browser, but audio upload still works.
        </p>
      ) : null}

      {recordingError ? (
        <p className="mt-3 text-sm font-medium leading-5 text-rose-700" role="status">
          {recordingError}
        </p>
      ) : null}

      {audioSource ? (
        <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-rose-100">
          <p className="truncate text-xs font-semibold text-stone-500">
            {audioLabel || "Saved voice note"}
          </p>
          <audio controls preload="metadata" src={audioSource} className="mt-2 h-10 w-full" />
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || isRecording}
              className="mt-2 min-h-10 text-xs font-semibold text-rose-600 disabled:opacity-50"
            >
              {existingUrl ? "Use saved voice note instead" : "Remove this recording"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getPreferredAudioMimeType(): string {
  const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) {
    return "m4a";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
