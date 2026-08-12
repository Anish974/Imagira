'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

function firstImage(items: FileList | null): File | null {
  if (!items) return null;
  for (const file of Array.from(items)) {
    if (ACCEPTED.includes(file.type)) return file;
  }
  return null;
}

export default function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+V paste — heavily used, almost always forgotten.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && ACCEPTED.includes(item.type)) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = firstImage(e.dataTransfer.files);
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={`flex h-80 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center transition-colors ${
        dragging
          ? 'border-accent bg-blue-50/60'
          : 'border-neutral-300 bg-white hover:border-neutral-400'
      }`}
    >
      <p className="text-base text-neutral-800">Drop an image here</p>
      <p className="mt-2 text-sm text-neutral-500">
        or click to browse &middot; paste with <kbd className="font-sans">Ctrl</kbd>+
        <kbd className="font-sans">V</kbd>
      </p>
      <p className="mt-6 text-xs text-neutral-400">PNG, JPG, WebP</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = firstImage(e.target.files);
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
