import { generateScriptHTML } from './html_generator';

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

// Remove the embedded HTML - now served as static files

const server = Bun.serve({
  port: 8080,
  fetch(request) {
    const url = new URL(request.url);

    // Home page - serve index.html
    if (url.pathname === '/') {
      const indexFile = Bun.file('./index.html');
      return new Response(indexFile);
    }

    // Serve icon files using Bun.file()
    if (url.pathname.startsWith('/icons/')) {
      const iconName = url.pathname.slice(7); // Remove '/icons/'
      const iconFile = Bun.file(`./icons/${iconName}`);

      // Return the file directly - Bun handles the streaming automatically
      return new Response(iconFile);
    }

    if (url.pathname.startsWith('/js/')) {
      const jsFile = Bun.file(`./js${url.pathname.slice(3)}`);
      return new Response(jsFile);
    }

    // Compressed script viewer - decode gzipped base64 and generate HTML
    if (url.pathname.startsWith('/z/')) {
      const base64Data = url.pathname.slice(3); // Remove '/z/'

      if (base64Data) {
        try {
          // Decode and decompress gzipped base64 string
          const jsonString = decodeAndDecompress(base64Data);
          const scriptData = JSON.parse(jsonString);

          // Generate HTML using the modified html_generator
          const html = generateScriptHTML(scriptData);

          return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
          });
        } catch (error: any) {
          return new Response(
            `
            <html lang="zh-CN">
              <head>
                <meta charset="UTF-8">
                <title>错误 - 剧本查看器</title>
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
                </style>
              </head>
              <body>
                <h1>错误</h1>
                <p>无法解码或处理压缩剧本数据：${error.message}</p>
                <a href="/">← 返回上传页面</a>
              </body>
            </html>
          `,
            {
              status: 400,
              headers: { 'Content-Type': 'text/html' },
            },
          );
        }
      }
    }

    // Script viewer - decode base64 and generate HTML (legacy support)
    const base64Data = url.pathname.slice(1); // Remove leading slash

    if (base64Data) {
      try {
        // Decode base64 URL-safe string
        const jsonString = base64UrlDecode(base64Data);
        const scriptData = JSON.parse(jsonString);

        // Generate HTML using the modified html_generator
        const html = generateScriptHTML(scriptData);

        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      } catch (error: any) {
        return new Response(
          `
          <html lang="zh-CN">
            <head>
              <meta charset="UTF-8">
              <title>错误 - 剧本查看器</title>
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
              </style>
            </head>
            <body>
              <h1>错误</h1>
              <p>无法解码或处理剧本数据：${error.message}</p>
              <a href="/">← 返回上传页面</a>
            </body>
          </html>
        `,
          {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 剧本查看器运行在 http://localhost:${server.port}`);
console.log('📝 上传剧本：http://localhost:8080');
console.log('👀 查看剧本：http://localhost:8080/<base64_encoded_json>');
