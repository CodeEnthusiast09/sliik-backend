export function detectAudioMimeType(buffer: Buffer): string | null {
  // MPEG-4 family container (m4a/mp4/3gp) - what expo-audio's native
  // recorder produces (HIGH_QUALITY -> .m4a, Android LOW_QUALITY -> .3gp).
  // Both use the ISO base media "ftyp" box starting at byte 4.
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }

  // WebM (EBML header) - what browsers' MediaRecorder produces, which is
  // what expo-audio's web implementation records with.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'audio/webm';
  }

  return null;
}
