const MAX_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 2000;

export function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > MAX_SIZE && quality > 0.3) {
              quality -= 0.15;
              tryCompress();
            } else if (blob.size > MAX_SIZE) {
              reject(new Error('图片过大，无法发送'));
            } else {
              resolve({ blob, width, height });
            }
          },
          'image/jpeg',
          quality,
        );
      };
      tryCompress();
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
