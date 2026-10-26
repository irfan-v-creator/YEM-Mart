/**
 * Product Image URL Normalizer and Fallback Utilities
 * Safely converts Google Drive links to direct high-speed CDN image links
 * and provides robust fallback rendering for inaccessible or broken images.
 */

export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: /file/d/{fileId} (e.g. https://drive.google.com/file/d/1hYrIY38YHlac5TMsd8iNs-mBLdhBFHsU/view?usp=drivesdk)
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

  // Pattern 2: ?id={fileId} or &id={fileId} (e.g. https://drive.google.com/uc?export=view&id=...)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idMatch && idMatch[1]) return idMatch[1];

  // Pattern 3: googleusercontent.com/d/{fileId}
  const lh3Match = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{20,})/);
  if (lh3Match && lh3Match[1]) return lh3Match[1];

  return null;
}

export function isGoogleDriveUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return Boolean(
    url.includes('drive.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('googleusercontent.com/d/')
  );
}

/**
 * Normalizes product image URLs:
 * Converts Google Drive preview/sharing URLs to direct lh3.googleusercontent.com/d/{id} CDN links
 * which return image/jpeg directly with CORS access-control-allow-origin: *.
 */
export function normalizeProductImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const driveFileId = extractGoogleDriveFileId(trimmed);
  if (driveFileId) {
    return `https://lh3.googleusercontent.com/d/${driveFileId}`;
  }

  return trimmed;
}

/**
 * Graceful SVG placeholder data URI for products when an image fails to load.
 * 1:1 square canvas, neutral palette, clean package icon.
 */
export const IMAGE_FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="#F7F6F2"/>
  <rect x="20" y="20" width="360" height="360" rx="16" fill="none" stroke="#E7E5E0" stroke-width="2"/>
  <g transform="translate(140, 130)" stroke="#A3A3A3" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 30 L60 5 L110 30 L110 90 L60 115 L10 90 Z"/>
    <path d="M60 5 L60 115"/>
    <path d="M10 30 L60 55 L110 30"/>
    <path d="M35 17.5 L85 42.5"/>
  </g>
  <text x="200" y="280" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#737373" text-anchor="middle">
    Image Unavailable
  </text>
  <text x="200" y="302" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#A3A3A3" text-anchor="middle">
    YEM MART Genuine Product
  </text>
</svg>
`)}`;
