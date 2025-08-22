import { stat } from 'fs/promises';
import { join } from 'path';

export interface FileServerOptions {
  /** Base directory for serving files */
  baseDir?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Default cache control max-age in seconds */
  maxAge?: number;
  /** Enable ETag generation */
  enableETag?: boolean;
}

export interface FileServerHandler {
  (request: Request): Promise<Response>;
}

/**
 * Parse HTTP date string to Date object
 */
function parseHttpDate(dateStr: string): Date | null {
  try {
    return new Date(dateStr);
  } catch {
    return null;
  }
}

/**
 * Format Date object to HTTP date string
 */
function formatHttpDate(date: Date): string {
  return date.toUTCString();
}

/**
 * Generate ETag from file stats
 */
function generateETag(stats: { mtime: Date; size: number }): string {
  const mtime = Math.floor(stats.mtime.getTime() / 1000);
  return `"${mtime.toString(16)}-${stats.size.toString(16)}"`;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    
    // Scripts and styles
    'js': 'application/javascript',
    'mjs': 'application/javascript',
    'css': 'text/css',
    
    // Documents
    'html': 'text/html',
    'htm': 'text/html',
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    
    // Fonts
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
    
    // Audio/Video
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'audio/ogg',
    
    // Archives
    'zip': 'application/zip',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Create a file server handler for a specific route pattern
 */
export function createFileServer(options: FileServerOptions = {}): FileServerHandler {
  const {
    baseDir = '.',
    debug = false,
    maxAge = 0,
    enableETag = true,
  } = options;

  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const pathname = decodeURIComponent(url.pathname);
      
      if (debug) {
        console.log(`[FileServer] Request: ${request.method} ${pathname}`);
      }

      // Only handle GET and HEAD requests
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      // Security: prevent directory traversal
      if (pathname.includes('..') || pathname.includes('\0')) {
        return new Response('Bad Request', { status: 400 });
      }

      // Build file path (pathname should already have the route prefix removed)
      const filePath = join(baseDir, pathname);
      
      try {
        // Get file stats
        const stats = await stat(filePath);
        
        if (!stats.isFile()) {
          return new Response('Not Found', { status: 404 });
        }

        const lastModified = stats.mtime;
        const etag = enableETag ? generateETag(stats) : null;
        
        // Check If-Modified-Since header
        const ifModifiedSince = request.headers.get('If-Modified-Since');
        if (ifModifiedSince) {
          const ifModifiedSinceDate = parseHttpDate(ifModifiedSince);
          if (ifModifiedSinceDate && lastModified <= ifModifiedSinceDate) {
            if (debug) {
              console.log(`[FileServer] 304 Not Modified: ${pathname}`);
            }
            return new Response(null, { status: 304 });
          }
        }

        // Check If-None-Match header (ETag)
        if (etag) {
          const ifNoneMatch = request.headers.get('If-None-Match');
          if (ifNoneMatch && ifNoneMatch === etag) {
            if (debug) {
              console.log(`[FileServer] 304 Not Modified (ETag): ${pathname}`);
            }
            return new Response(null, { status: 304 });
          }
        }

        // Prepare response headers
        const headers = new Headers();
        const mimeType = getMimeType(pathname);
        headers.set('Content-Type', mimeType);
        headers.set('Last-Modified', formatHttpDate(lastModified));
        if (maxAge > 0) {
          headers.set('Cache-Control', `public, max-age=${maxAge}`);
        }
        
        if (etag) {
          headers.set('ETag', etag);
        }

        // For HEAD requests, return headers only
        if (request.method === 'HEAD') {
          headers.set('Content-Length', stats.size.toString());
          return new Response(null, { headers });
        }

        // Serve the file
        const file = Bun.file(filePath);
        
        if (debug) {
          console.log(`[FileServer] Serving: ${pathname} (${mimeType}, ${stats.size} bytes)`);
        }

        return new Response(file, { headers });

      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return new Response('Not Found', { status: 404 });
        }
        
        console.error(`[FileServer] Error serving ${pathname}:`, error);
        return new Response('Internal Server Error', { status: 500 });
      }

    } catch (error) {
      console.error('[FileServer] Request processing error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  };
}

/**
 * Create a file server handler for a specific directory with route prefix
 */
export function createStaticFileHandler(routePrefix: string, directory: string, options: FileServerOptions = {}): FileServerHandler {
  const fileServer = createFileServer({ ...options, baseDir: directory });
  
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    
    // Remove the route prefix from pathname
    if (!url.pathname.startsWith(routePrefix)) {
      return new Response('Not Found', { status: 404 });
    }
    
    const relativePath = url.pathname.slice(routePrefix.length);
    
    // Create a new request with the modified pathname
    const modifiedUrl = new URL(request.url);
    modifiedUrl.pathname = relativePath;
    
    const modifiedRequest = new Request(modifiedUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    
    return fileServer(modifiedRequest);
  };
}
