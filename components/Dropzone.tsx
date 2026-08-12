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
      className={`group flex h-[26rem] cursor-pointer flex-col items-center justify-center border border-dashed transition-colors ${
        dragging ? 'border-signal bg-raise' : 'border-line-2 bg-panel hover:border-faint'
      }`}
    >
      <span className="tag">Input</span>

      <p className="mt-5 text-lg text-text">Drop an image</p>
      <p className="readout mt-2 text-xs text-dim">
        click to browse &nbsp;·&nbsp; or press{' '}
        <kbd className="border border-line-2 px-1.5 py-0.5 text-[11px] text-text">Ctrl</kbd>
        <span className="text-faint"> + </span>
        <kbd className="border border-line-2 px-1.5 py-0.5 text-[11px] text-text">V</kbd>
      </p>

      <div className="mt-10 flex items-center gap-6">
        <span className="tag">png</span>
        <span className="tag">jpg</span>
        <span className="tag">webp</span>
      </div>

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
