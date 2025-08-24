import { generateScriptHTML } from './generator';
import { ScriptDatabase } from './database';
import { validateAndSeparateScript, type ScriptInput } from './validator';
import { createStaticFileHandler } from './fileServer';
import { stat } from 'fs/promises';

function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;

  // Decode base64 and then decode UTF-8
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function decodeAndDecompress(base64: string): string {
  // Add padding if needed
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/') + padding;

  // Decode base64 to compressed bytes
  const binaryString = atob(normalizedBase64);
  const compressedBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    compressedBytes[i] = binaryString.charCodeAt(i);
  }

  // Decompress and decode UTF-8
  const decompressed = Bun.gunzipSync(compressedBytes);
  return new TextDecoder().decode(decompressed);
}

// Initialize database
const db = new ScriptDatabase();

// Cache for generator.ts modification time
let generatorModTime: Date | null = null;

/**
 * Get the modification time of generator.ts for Last-Modified headers
 */
async function getGeneratorModTime(): Promise<Date> {
  if (!generatorModTime) {
    try {
      const stats = await stat('./generator.ts');
      generatorModTime = stats.mtime;
    } catch (error) {
      // Fallback to current time if file doesn't exist
      generatorModTime = new Date();
    }
  }
  return generatorModTime;
}

/**
 * Check if request should return 304 Not Modified based on generator.ts modification time
 */
async function checkNotModified(request: Request): Promise<boolean> {
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  if (!ifModifiedSince) {
    return false;
  }

  try {
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    const generatorMTime = await getGeneratorModTime();
    return generatorMTime <= ifModifiedSinceDate;
  } catch {
    return false;
  }
}

/**
 * Create headers for script viewer responses
 */
async function createScriptViewerHeaders(): Promise<Headers> {
  const headers = new Headers();
  headers.set('Content-Type', 'text/html');
  headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes

  const generatorMTime = await getGeneratorModTime();
  headers.set('Last-Modified', generatorMTime.toUTCString());

  return headers;
}

// Create file server handlers
const iconsHandler = createStaticFileHandler('/icons/', './icons', {
  debug: false,
  maxAge: 86400,
  enableETag: true,
});

const jsHandler = createStaticFileHandler('/js/', './js', {
  debug: false,
  maxAge: 3600,
  enableETag: true,
});

const htmlHandler = createStaticFileHandler('/', '.', {
  debug: false,
  enableETag: true,
});

const faviconHandler = createStaticFileHandler('/favicons/', './favicons', {
  debug: false,
  maxAge: 604800, // 7 days for favicons
  enableETag: true,
});

async function handleStoreScript(request: Request): Promise<Response> {
  try {
    const jsonData = await request.text();

    // Parse and validate the script data
    const scriptData = JSON.parse(jsonData) as ScriptInput;
    const validated = validateAndSeparateScript(scriptData);

    // Store in database and get IDs
    const { metadataId, rolesId } = await db.storeScript(validated.metadata, validated.roles);
    const shortUrl = `${new URL(request.url).origin}/s/${metadataId}/${rolesId}`;

    return new Response(JSON.stringify({ url: shortUrl }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function generateErrorHTML(title: string, message: string): string {
  return `
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>${title} - 《染・钟楼谜团》剧本查看器</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
          }
          h1 { color: #f44336; }
          a { color: #007bff; text-decoration: none; }
          a:hover { text-decoration: underline; }

          body.dark {
            background-color: #1a1a1a;
            color: #e0e0e0;
          }
          body.dark h1 { color: #ff6b6b; }
          body.dark a { color: #4da6ff; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="/">← 返回上传页面</a>

        <script>
          // Initialize theme based on localStorage or system preference
          document.addEventListener('DOMContentLoaded', function() {
            const body = document.body;
            const savedMode = localStorage.getItem('themeMode');
            const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // If user has manually set light mode, or system is light and no preference saved
            if (savedMode === 'light' || (savedMode === null && !systemDarkMode)) {
              if (systemDarkMode) {
                body.classList.add('revert');
              }
            }
            // If user has manually set dark mode
            else if (savedMode === 'dark') {
              if (!systemDarkMode) {
                // System is light but user wants dark - we can't force dark mode
                // Just remove revert class to use system default
                body.classList.remove('revert');
              }
            }
          });
        </script>
      </body>
    </html>
  `;
}

const server = Bun.serve({
  port: 8080,
  routes: {
    // API endpoint for storing scripts
    '/api/store': {
      POST: handleStoreScript,
    },

    // Travellers listing page
    '/travellers': async (req) => {
      try {
        // Check if client has current version
        if (await checkNotModified(req)) {
          return new Response(null, { status: 304 });
        }

        // Load all traveller roles from data.json
        const data = await import('./data.json');
        const travellerRoles = data.default.filter((role: any) => role.team === 'traveller');

        // Create a script data with all travellers
        const scriptData = {
          name: '旅行者列表',
          roles: travellerRoles.map((role: any) => role.id),
        };

        const html = generateScriptHTML(scriptData);
        const headers = await createScriptViewerHeaders();
        return new Response(html, { headers });
      } catch (error: any) {
        return new Response(generateErrorHTML('错误', `生成旅行者列表时出错：${error.message}`), {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    },

    // Fabled listing page
    '/fabled': async (req) => {
      try {
        // Check if client has current version
        if (await checkNotModified(req)) {
          return new Response(null, { status: 304 });
        }

        // Load all fabled roles from data.json
        const data = await import('./data.json');
        const fabledRoles = data.default.filter((role: any) => role.team === 'fabled');

        // Create a script data with all fabled
        const scriptData = {
          name: '传奇角色列表',
          roles: fabledRoles.map((role: any) => role.id),
        };

        const html = generateScriptHTML(scriptData);
        const headers = await createScriptViewerHeaders();
        return new Response(html, { headers });
      } catch (error: any) {
        return new Response(generateErrorHTML('错误', `生成传奇列表时出错：${error.message}`), {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    },

    // Home page with caching
    '/': async (req) => {
      // Create a modified request for index.html
      const url = new URL(req.url);
      url.pathname = '/index.html';

      const modifiedRequest = new Request(url.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });

      return htmlHandler(modifiedRequest);
    },

    // Static file serving for icons with caching
    '/icons/*': iconsHandler,

    // Static file serving for JavaScript files with caching
    '/js/*': jsHandler,

    // Favicon serving with long cache
    '/favicons/*': faviconHandler,

    // Root favicon.ico redirect
    '/favicon.ico': async (req) => {
      const url = new URL(req.url);
      url.pathname = '/favicons/favicon.ico';

      const modifiedRequest = new Request(url.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });

      return faviconHandler(modifiedRequest);
    },

    // Short URL script viewer - retrieve from database
    '/s/:metadataId/:rolesId': async (req) => {
      const { metadataId, rolesId } = req.params;

      try {
        // Check if client has current version
        if (await checkNotModified(req)) {
          return new Response(null, { status: 304 });
        }

        const scriptRecord = db.getScript(metadataId, rolesId);

        if (!scriptRecord) {
          return new Response(generateErrorHTML('未找到', '指定的剧本不存在或已被删除'), {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Combine metadata and roles back into script format
        const scriptData = { ...scriptRecord.metadata, ...scriptRecord.roles };
        const html = generateScriptHTML(scriptData);

        const headers = await createScriptViewerHeaders();
        return new Response(html, { headers });
      } catch (error: any) {
        return new Response(generateErrorHTML('错误', `处理剧本数据时出错：${error.message}`), {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    },

    // Compressed script viewer - decode gzipped base64 and generate HTML
    '/z/*': async (req) => {
      const url = new URL(req.url);
      const base64Data = url.pathname.slice(3); // Remove '/z/'

      if (!base64Data) {
        return new Response(generateErrorHTML('错误', '缺少压缩数据'), {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      try {
        // Check if client has current version
        if (await checkNotModified(req)) {
          return new Response(null, { status: 304 });
        }

        // Decode and decompress gzipped base64 string
        const jsonString = decodeAndDecompress(base64Data);
        const scriptData = JSON.parse(jsonString);

        // Generate HTML using the modified html_generator
        const html = generateScriptHTML(scriptData);

        const headers = await createScriptViewerHeaders();
        return new Response(html, { headers });
      } catch (error: any) {
        return new Response(
          generateErrorHTML('错误', `无法解码或处理压缩剧本数据：${error.message}`),
          {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      }
    },

    // Legacy base64 script viewer - decode base64 and generate HTML
    '/b/*': async (req) => {
      const url = new URL(req.url);
      const base64Data = url.pathname.slice(3); // Remove '/b/'

      if (!base64Data) {
        return new Response(generateErrorHTML('错误', '缺少base64数据'), {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      try {
        // Check if client has current version
        if (await checkNotModified(req)) {
          return new Response(null, { status: 304 });
        }

        // Decode base64 URL-safe string
        const jsonString = base64UrlDecode(base64Data);
        const scriptData = JSON.parse(jsonString);

        // Generate HTML using the modified html_generator
        const html = generateScriptHTML(scriptData);

        const headers = await createScriptViewerHeaders();
        return new Response(html, { headers });
      } catch (error: any) {
        return new Response(generateErrorHTML('错误', `无法解码或处理剧本数据：${error.message}`), {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    },
  },
});

console.log(`Server Running: http://localhost:${server.port}`);
