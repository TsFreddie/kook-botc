import data from './data.json';
import { validateRoles, type ScriptInput } from './validator';

type Role = (typeof data)[number];

const TEAM_NAMES = {
  townsfolk: '•──⋅☾　镇　民　☽⋅──•',
  outsider: '•──⋅☾　外来者　☽⋅──•',
  minion: '•──⋅☾　爪　牙　☽⋅──•',
  demon: '•──⋅☾　恶　魔　☽⋅──•',
};

/**
 * Get role icon URL for custom icon tag
 */
function getRoleIconUrl(roleId: string): string {
  return `/icons/${roleId}.png`;
}

/**
 * Generate sub-info line with difficulty and player count if provided
 */
function generateSubInfo(scriptData: ScriptInput): string {
  const parts: string[] = [];

  // Add difficulty if level is provided and > 0
  if (scriptData.level && scriptData.level > 0) {
    const difficultyStars =
      '★'.repeat(scriptData.level) + '☆'.repeat(Math.max(0, 5 - scriptData.level));
    parts.push(`难度：${difficultyStars}`);
  }

  // Add player count if both min and max are provided and > 0
  if (
    scriptData.min_player &&
    scriptData.max_player &&
    scriptData.min_player > 0 &&
    scriptData.max_player > 0
  ) {
    parts.push(`推荐人数：${scriptData.min_player} - ${scriptData.max_player}`);
  }

  // Return formatted sub-info or empty string
  return parts.length > 0 ? `<p class="sub">${parts.join(' ')}</p>` : '';
}

/**
 * Generate description for social media metadata
 */
function generateDescription(scriptData: ScriptInput): string {
  const parts: string[] = [];

  // Add author info
  if (scriptData.author) {
    parts.push(`剧本设计：${scriptData.author}`);
  }

  // Add difficulty if level is provided and > 0
  if (scriptData.level && scriptData.level > 0) {
    const difficultyStars =
      '★'.repeat(scriptData.level) + '☆'.repeat(Math.max(0, 5 - scriptData.level));
    parts.push(`难度：${difficultyStars}`);
  }

  // Add player count if both min and max are provided and > 0
  if (
    scriptData.min_player &&
    scriptData.max_player &&
    scriptData.min_player > 0 &&
    scriptData.max_player > 0
  ) {
    parts.push(`推荐人数：${scriptData.min_player} - ${scriptData.max_player}`);
  }

  // Join with newlines, or provide fallback
  return parts.length > 0 ? parts.join('\n') : '钟楼谜团剧本';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateScriptHTML(scriptData: ScriptInput): string {
  try {
    // Validate roles using the shared validator
    const rolesData = validateRoles({ roles: scriptData.roles });

    // Ensure name is defined
    const normalizedScriptData = {
      ...scriptData,
      name: scriptData.name || '未命名剧本',
    };

    // Filter and categorize roles (exclude travelers and other types)
    const categorizedRoles: Record<string, Role[]> = {
      townsfolk: [],
      outsider: [],
      minion: [],
      demon: [],
    };

    for (const role of rolesData) {
      if (role.team in categorizedRoles) {
        categorizedRoles[role.team]?.push(role);
      }
    }

    // Generate HTML
    return generateHTML(normalizedScriptData, categorizedRoles);
  } catch (error) {
    throw new Error(`页面生成错误：${error}`);
  }
}

function generateHTML(
  scriptData: ScriptInput & { name: string },
  categorizedRoles: Record<string, Role[]>,
): string {
  // Count total roles to determine if we need grid layout
  const totalRoles = Object.values(categorizedRoles).reduce((sum, roles) => sum + roles.length, 0);
  const useGrid = totalRoles > 12;

  // Find the first demon for social media icon, fallback to favicon
  const firstDemon = categorizedRoles.demon?.[0];
  const socialIcon = firstDemon ? getRoleIconUrl(firstDemon.id) : '/favicons/favicon-32x32.png';
  const socialIconAlt = firstDemon ? firstDemon.name : '钟楼谜团';

  // Generate description for social media
  const description = generateDescription(scriptData);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(scriptData.name)} - 染・钟楼谜团剧本</title>
    <meta name="description" content="${escapeHtml(description)}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(scriptData.name)} - 染・钟楼谜团剧本">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${socialIcon}">
    <meta property="og:image:alt" content="${escapeHtml(socialIconAlt)}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(scriptData.name)} - 染・钟楼谜团剧本">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${socialIcon}">
    <meta name="twitter:image:alt" content="${escapeHtml(socialIconAlt)}">

    <!-- Favicons -->
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
    <link rel="manifest" href="/favicons/site.webmanifest">
    <style>
        hr {
          opacity: 0.5;
          margin: 0.1em;
        }
        body {
          font-size: 10pt;
          padding: 0.5em 2em;
          max-width: 1024px;
          margin: auto;
        }
        h1 {
          font-size: 1.25em;
          display: inline;
          margin: 0;
        }
        h2 {
          font-size: 1.1em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        .blue {
          color: #0696d3;
        }
        .red {
          color: #6d090c;
        }
        p {
          margin: 0;
        }
        .sub {
          opacity: 0.5;
        }
        .role {
            display: flex;
            gap: 0.5em;
        }
        .role-icon {
            margin-top: 0.5em;
            width: 48px;
            height: 48px;
            flex-shrink: 0;
        }
        .role-content {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .role-name {
            margin: 0;
            font-weight: bold;
            font-size: 1.1em;
        }
        .role-ability {
            margin: 0;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
            body {
                font-size: 11pt;
                padding: 0.75em;
            }
            h1 {
                font-size: 1.4em;
                display: block;
                margin-bottom: 0.25em;
            }
            .role-icon {
                width: 40px;
                height: 40px;
                margin-top: 0.25em;
            }
            .role-name {
                font-size: 1.05em;
            }
        }

        @media (max-width: 480px) {
            body {
                font-size: 11pt;
                padding: 0.5em;
            }
            h1 {
                font-size: 1.5em;
            }
            h2 {
                font-size: 1.2em;
            }
            .role {
                gap: 0.4em;
            }
            .role-icon {
                width: 36px;
                height: 36px;
                margin-top: 0.2em;
            }
        }${
          useGrid
            ? `
        .team-roles {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5em 2em;
        }
        @media (max-width: 640px) {
            .team-roles {
                grid-template-columns: 1fr;
                gap: 0.5em;
            }
        }`
            : ''
        }
        .team-header {
            opacity: 0.6;
        }
        .header-buttons {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 8px;
            z-index: 1000;
        }
        .theme-toggle, .download-btn {
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 0.9em;
            width: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Mobile header buttons */
        @media (max-width: 480px) {
            .header-buttons {
                top: 8px;
                right: 8px;
                gap: 6px;
            }
        }
        .theme-toggle::before {
            content: "🌙";
        }
        .download-btn::before {
            content: "📥";
        }
        .theme-toggle:hover, .download-btn:hover {
            background: #e0e0e0;
        }
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #1a1a1a;
                color: #e0e0e0;
            }
            .blue {
                color: #4da6ff;
            }
            .red {
                color: #ff6b6b;
            }
            hr {
                border-color: #444;
            }
            .theme-toggle, .download-btn {
                background: #333;
                color: #e0e0e0;
                border-color: #555;
            }
            .theme-toggle::before {
                content: "☀️";
            }
            .theme-toggle:hover, .download-btn:hover {
                background: #444;
            }
        }
        body.revert {
            background-color: white;
            color: black;
        }
        body.revert .blue {
            color: #0696d3;
        }
        body.revert .red {
            color: #6d090c;
        }
        body.revert hr {
            border-color: #ccc;
        }
        body.revert .theme-toggle, body.revert .download-btn {
            background: #f0f0f0;
            color: black;
            border-color: #ccc;
        }
        body.revert .theme-toggle::before {
            content: "🌙";
        }
        body.revert .theme-toggle:hover, body.revert .download-btn:hover {
            background: #e0e0e0;
        }
        .footer {
            margin-top: 2em;
            padding-top: 1em;
            border-top: 1px solid #ccc;
            font-size: 0.8em;
            color: #666;
        }
        .footer a {
            color: #0696d3;
            text-decoration: none;
        }
        .footer a:visited {
            color: #0696d3;
        }
        .footer a:hover {
            text-decoration: underline;
        }

        /* Mobile footer */
        @media (max-width: 480px) {
            .footer {
                font-size: 0.75em;
                margin-top: 1.5em;
            }
        }

        @media (prefers-color-scheme: dark) {
            .footer {
                border-top-color: #444;
                color: #999;
            }
        }
        body.revert .footer {
            border-top-color: #ccc;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(scriptData.name)}</h1>
    ${scriptData.author ? `<span> by ${escapeHtml(scriptData.author)}</span>` : ''}
    ${generateSubInfo(scriptData)}
    <div class="header-buttons">
        <button class="download-btn" onclick="downloadPage()" title="下载页面"></button>
        <button class="theme-toggle" onclick="toggleTheme()" title="切换主题"></button>
    </div>
    <hr>`;

  // Add teams
  for (const [team, roles] of Object.entries(categorizedRoles)) {
    if (roles.length === 0) continue;

    const teamName = TEAM_NAMES[team as keyof typeof TEAM_NAMES];
    const headerClass = team === 'townsfolk' || team === 'outsider' ? 'blue' : 'red';

    html += `
    <h2 class="team-header ${headerClass}">${escapeHtml(teamName)}</h2>`;

    if (useGrid) {
      html += `
    <div class="team-roles">`;
    }

    // Add roles
    for (const role of roles) {
      const roleClass = role.team === 'townsfolk' || role.team === 'outsider' ? 'blue' : 'red';

      html += `
        <div class="role">`;

      // Role icon using custom icon tag
      const iconUrl = getRoleIconUrl(role.id);
      html += `
            <icon src="${iconUrl}" alt="${escapeHtml(role.name)}" class="role-icon"></icon>`;

      html += `
            <div class="role-content">
                <span class="role-name ${roleClass}">${escapeHtml(role.name)}</span>
                <span class="role-ability">${escapeHtml(role.ability)}</span>
            </div>
        </div>`;
    }

    if (useGrid) {
      html += `
    </div>`;
    }
  }

  html += `
    <div class="footer">
        <p>版权所有 <a href="https://bloodontheclocktower.com/" target="_blank">The Pandemonium Institute</a> 与 <a href="https://clocktower.gstonegames.com/" target="_blank">集石</a></p>
        <p>本页面由第三方工具"钟小楼"生成</p>
    </div>

    <script>
        function downloadPage() {
            // Clone the entire document
            const clonedDoc = document.cloneNode(true);

            // Remove the download button from the cloned document
            const downloadBtn = clonedDoc.querySelector('.download-btn');
            if (downloadBtn) {
                downloadBtn.remove();
            }

            // Get the HTML content
            const htmlContent = '<!DOCTYPE html>\\n' + clonedDoc.documentElement.outerHTML;

            // Create blob and download
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = '${escapeHtml(scriptData.name)}.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up
            URL.revokeObjectURL(url);
        }

        function toggleTheme() {
            const body = document.body;
            const savedMode = localStorage.getItem('themeMode');
            const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Determine current effective mode
            const isCurrentlyDark = body.classList.contains('revert') ? false : systemDarkMode;

            if (isCurrentlyDark) {
                // Currently dark, switch to light
                body.classList.add('revert');
                localStorage.setItem('themeMode', 'light');
            } else {
                // Currently light, switch to dark
                body.classList.remove('revert');
                localStorage.setItem('themeMode', 'dark');
            }
        }

        // Convert custom icon tags to img tags with data URIs
        async function loadIcons() {
            const iconElements = document.querySelectorAll('icon[src]');

            // Create promises for all icon loading operations
            const iconPromises = Array.from(iconElements).map(async (iconEl) => {
                const src = iconEl.getAttribute('src');
                const alt = iconEl.getAttribute('alt') || '';
                const className = iconEl.getAttribute('class') || '';

                try {
                    const response = await fetch(src);
                    if (response.ok) {
                        const blob = await response.blob();

                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = function() {
                                const img = document.createElement('img');
                                img.src = reader.result;
                                img.alt = alt;
                                img.className = className;
                                iconEl.parentNode.replaceChild(img, iconEl);
                                resolve({ success: true, element: iconEl });
                            };
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        throw new Error('Failed to fetch icon: ' + response.status);
                    }
                } catch (error) {
                    console.warn('Failed to load icon:', src, error);
                    // Replace with empty div on error
                    const div = document.createElement('div');
                    div.className = className;
                    iconEl.parentNode.replaceChild(div, iconEl);
                    return { success: false, element: iconEl, error };
                }
            });

            // Wait for all icon loading operations to complete
            const results = await Promise.allSettled(iconPromises);

            // Log summary of results
            const successful = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
            const failed = results.length - successful;

            if (failed > 0) {
                console.warn('Icon loading completed: ' + successful + ' successful, ' + failed + ' failed');
            } else {
                console.log('All ' + successful + ' icons loaded successfully');
            }
        }

        // Add transition styles after initial load to prevent flash
        function addTransitions() {
            const style = document.createElement('style');
            style.textContent = \`
                * {
                    transition:
                        background-color 0.3s ease,
                        color 0.3s ease,
                        border-color 0.3s ease,
                        box-shadow 0.3s ease;
                }
            \`;
            document.head.appendChild(style);
        }

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

            // Add transitions after theme is set to prevent flash
            setTimeout(addTransitions, 50);

            // Load icons after DOM is ready
            loadIcons();
        });
    </script>
</body>
</html>`;

  return html;
}
