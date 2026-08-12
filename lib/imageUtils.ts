export interface LoadedImage {
  imageData: ImageData;
  width: number;
  height: number;
  /** object URL of the original file — used for the "before" preview */
  objectUrl: string;
}

/** Decode a file to raw pixels. Never leaves the browser. */
export async function loadImageData(file: Blob): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get a 2D canvas context.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    imageData: ctx.getImageData(0, 0, width, height),
    width,
    height,
    objectUrl: URL.createObjectURL(file),
  };
}

/** Write the mask into the alpha channel of a copy of the original pixels. */
export function applyAlphaMask(imageData: ImageData, mask: Uint8Array): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  const d = out.data;
  for (let i = 0, p = 3; i < mask.length; i++, p += 4) {
    d[p] = mask[i];
  }
  return out;
}

export function toCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  return canvas;
}

/** Flatten the cutout onto a solid colour. `null` keeps transparency. */
export function compositeOnColour(source: HTMLCanvasElement, colour: string | null): HTMLCanvasElement {
  if (!colour) return source;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/** Object URL instead of a data URL — a 4000px PNG data URL is a ~30 MB string. */
export function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error('Could not encode the result.'));
    }, 'image/png');
  });
}

export function downloadCanvas(
  canvas: HTMLCanvasElement,
  type: 'image/png' | 'image/jpeg',
  filename: string
): void {
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    type,
    type === 'image/jpeg' ? 0.92 : undefined
  );
}

export function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, '') || 'image';
}
