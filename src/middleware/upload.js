import multer from 'multer';
import { HttpError } from '../lib/httpError.js';

const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_MB ?? 10) * 1024 * 1024;
const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_MB ?? 15) * 1024 * 1024;

/**
 * Détecte le type réel d'une image à partir de ses octets d'en-tête.
 * Le `mimetype` fourni par le client n'est jamais fiable (EF-11, section 12).
 *
 * @param {Buffer} buffer contenu du fichier
 * @returns {'image/jpeg' | 'image/png' | null}
 */
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG : FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((octet, i) => buffer[i] === octet)) return 'image/png';

  return null;
}

/**
 * Détecte le type réel d'un fichier audio : WAV, MP3, M4A, OGG, WEBM, FLAC.
 * @param {Buffer} buffer
 * @returns {string|null} type MIME réel
 */
export function sniffAudioType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  const ascii = (start, end) => buffer.toString('ascii', start, end);

  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 4) === 'fLaC') return 'audio/flac';
  if (ascii(0, 3) === 'ID3') return 'audio/mpeg';

  // Trame MPEG audio : 11 bits de synchronisation à 1.
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';

  // Conteneur ISO BMFF (m4a, mp4).
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4';

  // EBML (WebM / Matroska, sortie de MediaRecorder).
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'audio/webm';
  }

  return null;
}

/** Extension de fichier associée à un type audio réel. */
export function audioExtension(mimeType) {
  return (
    {
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/flac': 'flac',
    }[mimeType] ?? 'bin'
  );
}

/**
 * Réception d'une image en mémoire (jamais sur disque ici : le service
 * d'inspection décide ensuite de la persistance et du nommage).
 * Limite : 1 fichier, 10 Mo par défaut, JPEG ou PNG uniquement.
 */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(
        new HttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          "Format non pris en charge. Formats acceptés : JPEG ou PNG.",
        ),
      );
    }
    return cb(null, true);
  },
}).single('image');

/**
 * Variante « promesse » du middleware Multer, pour rester lisible dans les
 * routes asynchrones et laisser remonter les erreurs au gestionnaire global.
 */
export function receiveImage(req, res) {
  return new Promise((resolve, reject) => {
    imageUpload(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Réception d'un message vocal de marin (EF-20).
 * 15 Mo par défaut (`MAX_AUDIO_MB`), un seul fichier, formats audio acceptés.
 * Le type réel est vérifié ensuite par `sniffAudioType`.
 */
export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^audio\/|^application\/ogg$/.test(file.mimetype)) {
      return cb(
        new HttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Format non pris en charge. Formats acceptés : WAV, MP3, M4A, OGG, WEBM, FLAC.',
        ),
      );
    }
    return cb(null, true);
  },
}).single('audio');

/** Variante « promesse » générique, pour les routes asynchrones. */
export function receive(req, res, middleware) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err) => (err ? reject(err) : resolve()));
  });
}
