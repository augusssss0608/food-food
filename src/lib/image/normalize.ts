export async function normalizeImage(file: File): Promise<File> {
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;

  const heic2any = (await import('heic2any')).default;
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const finalBlob = Array.isArray(blob) ? blob[0]! : blob;
  return new File(
    [finalBlob],
    file.name.replace(/\.(heic|heif)$/i, '.jpg'),
    { type: 'image/jpeg' },
  );
}
