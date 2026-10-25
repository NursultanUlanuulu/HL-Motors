import { heicTo } from 'heic-to/next';

// Keep decoding and PNG encoding off the UI thread. The caller terminates this
// worker after each photo to release the decoder and its image buffers.
self.onmessage = async (event: MessageEvent<File>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await heicTo({ blob: event.data, type: 'bitmap' });
    if (bitmap.width * bitmap.height > 60_000_000) {
      throw new Error('HEIC больше 60 мегапикселей. Выберите другое фото.');
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error();
    context.drawImage(bitmap, 0, 0);
    // PNG preserves the decoded pixels without resizing or JPEG recompression.
    // HEIC depth/HDR/EXIF and additional frames are not preserved by this decoder.
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error instanceof Error && error.message.startsWith('HEIC больше')
      ? error.message : 'Не удалось преобразовать HEIC. Попробуйте другое фото или экспортируйте его в PNG.' });
  } finally {
    bitmap?.close();
  }
};
