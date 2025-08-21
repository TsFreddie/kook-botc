import data from './data.json';

type Role = (typeof data)[number];

interface ScriptInput {
  name: string;
  level: number;
  author: string;
  roles: { id: string }[];
  min_player: number;
  max_player: number;
}

const TEAM_NAMES = {
  townsfolk: '•──⋅☾　镇　民　☽⋅──•',
  outsider: '•──⋅☾　外来者　☽⋅──•',
  minion: '•──⋅☾　爪　牙　☽⋅──•',
  demon: '•──⋅☾　恶　魔　☽⋅──•',
};

const normalizeId = (id: string) => {
  return id.toLowerCase().replace(/[ -_]/g, '');
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
    // Create a map for faster lookup with normalized IDs
    const rolesMap = new Map<string, Role>();
    for (const role of data) {
      rolesMap.set(normalizeId(role.id), role);
    }

    // Filter roles based on input IDs and check for missing roles
    const selectedRoles: Role[] = [];
    const missingRoles: string[] = [];

    for (const { id } of scriptData.roles) {
      const normalizedInputId = normalizeId(id);
      const role = rolesMap.get(normalizedInputId);

      if (role) {
        selectedRoles.push(role);
      } else {
        missingRoles.push(id);
      }
    }

    // If there are missing roles, throw error
    if (missingRoles.length > 0) {
      throw new Error(`没有找到这些角色：${missingRoles.join(', ')}`);
    }

    // Use selectedRoles instead of rolesData
    const rolesData = selectedRoles;

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
    return generateHTML(scriptData, categorizedRoles);
  } catch (error) {
    throw new Error(`页面生成错误：${error}`);
  }
}

function generateHTML(scriptData: ScriptInput, categorizedRoles: Record<string, Role[]>): string {
  // Count total roles to determine if we need grid layout
  const totalRoles = Object.values(categorizedRoles).reduce((sum, roles) => sum + roles.length, 0);
  const useGrid = totalRoles > 12;

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(scriptData.name)} - Blood on the Clocktower Script</title>
    <style>
        hr {
          opacity: 0.5;
          margin: 0.1em;
        }
        body {
          font-size: 10pt;
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
          color: #0085bd;
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
        }
        .role-name {
            margin: 0;
            font-weight: bold;
            font-size: 1.1em;
        }
        .role-ability {
            margin: 0;
        }${
          useGrid
            ? `
        .team-roles {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5em 2em;
        }
        @media (max-width: 480px) {
            .team-roles {
                display: flex;
                flex-direction: column;
                gap: 0.5em;
            }
        }`
            : ''
        }
        .header-buttons {
            position: fixed;
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
            color: #0085bd;
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
            color: #0085bd;
            text-decoration: none;
        }
        .footer a:visited {
            color: #0085bd;
        }
        .footer a:hover {
            text-decoration: underline;
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
        <button class="download-btn" onclick="downloadPage()"></button>
        <button class="theme-toggle" onclick="toggleTheme()"></button>
    </div>
    <hr>`;

  // Add teams
  for (const [team, roles] of Object.entries(categorizedRoles)) {
    if (roles.length === 0) continue;

    const teamName = TEAM_NAMES[team as keyof typeof TEAM_NAMES];
    const headerClass = team === 'townsfolk' || team === 'outsider' ? 'blue' : 'red';

    html += `
    <h2 class="${headerClass}">${escapeHtml(teamName)}</h2>`;

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

            // Load icons after DOM is ready
            loadIcons();
        });
    </script>
</body>
</html>`;

  return html;
}

// Export the main function for use in the server
