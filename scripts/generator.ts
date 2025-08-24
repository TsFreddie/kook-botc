import { validateRoles, type ScriptInput, type Role } from './validator';

const TEAM_NAMES = {
  fabled: '•──⋅☾　传　奇　☽⋅──•',
  townsfolk: '•──⋅☾　镇　民　☽⋅──•',
  outsider: '•──⋅☾　外来者　☽⋅──•',
  minion: '•──⋅☾　爪　牙　☽⋅──•',
  demon: '•──⋅☾　恶　魔　☽⋅──•',
  traveller: '•──⋅☾　旅行者　☽⋅──•',
};

/**
 * Get role icon URL for custom icon tag
 */
function getRoleIconUrl(role: Role): string | undefined {
  // If role has a custom image and it's not 'none', use it
  if (role.image) {
    if (role.image == 'none') return undefined;
    return role.image;
  }
  // Otherwise use the default icon path
  return `/icons/${role.id}.png`;
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
  const parts: string[] = ['染・钟楼谜团剧本'];

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
  return parts.join('·');
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
      fabled: [],
      townsfolk: [],
      outsider: [],
      minion: [],
      demon: [],
      traveller: [],
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
  const socialIcon = firstDemon ? getRoleIconUrl(firstDemon) : '/favicons/icon.png';
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
    <meta property="og:title" content="《${escapeHtml(scriptData.name)}》">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${socialIcon}">
    <meta property="og:image:alt" content="${escapeHtml(socialIconAlt)}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="《${escapeHtml(scriptData.name)}》">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${socialIcon}">
    <meta name="twitter:image:alt" content="${escapeHtml(socialIconAlt)}">

    <!-- Favicons -->
    <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
    <link rel="manifest" href="/favicons/site.webmanifest">

    <!-- html2canvas library -->
    <script src="/js/html2canvas.js"></script>
    <style>
        hr {
          opacity: 0.5;
          margin: 0.1em;
        }
        body {
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
        .good {
          color: #2a94c2ff;
        }
        .bad {
          color: #a9252eff;
        }
        .traveller {
          color: #a92395ff;
        }
        .fabled {
          color: #9f7905ff;
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
            cursor: pointer;
            padding: 0.25em;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        .role:hover {
            background-color: rgba(0, 0, 0, 0.05);
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
        .team-header.clickable {
            cursor: pointer;
            user-select: none;
            transition: opacity 0.2s ease;
        }
        .team-header.clickable:hover {
            opacity: 0.8;
        }
        .team-header.clickable::before {
            content: "▼ ";
            font-size: 0.8em;
            margin-right: 0.5em;
            transition: transform 0.2s ease;
            display: inline-block;
        }
        .team-header.clickable.collapsed::before {
            transform: rotate(-90deg);
        }
        .team-section.collapsed {
            display: none;
        }
        .team-header.clickable {
            cursor: pointer;
            user-select: none;
            transition: opacity 0.2s ease;
        }
        .team-header.clickable:hover {
            opacity: 0.8;
        }
        .team-section.collapsed {
            display: none;
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
        body.dark {
            background-color: #1a1a1a;
            color: #e0e0e0;
        }
        body.dark hr {
            border-color: #444;
        }
        body.dark .role:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        body.dark .theme-toggle, body.dark .download-btn {
            background: #333;
            color: #e0e0e0;
            border-color: #555;
        }
        body.dark .theme-toggle::before {
            content: "☀️";
        }
        body.dark .theme-toggle:hover, body.dark .download-btn:hover {
            background: #444;
        }
        body.dark .good {
            color: #4db8e8ff;
        }
        body.dark .bad {
            color: #d64545ff;
        }
        body.dark .traveller {
            color: #d649c7ff;
        }
        body.dark .fabled {
            color: #d4b332ff;
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

        body.dark .footer {
            border-top-color: #444;
            color: #999;
        }
        .nav-links {
            margin-top: 1em;
            display: flex;
            gap: 1em;
            justify-content: center;
            flex-wrap: wrap;
        }
        .nav-link {
            display: inline-block;
            padding: 0.5em 1em;
            background: #f0f0f0;
            color: #333;
            text-decoration: none;
            border-radius: 4px;
            border: 1px solid #ccc;
            transition: background-color 0.2s ease;
        }
        .nav-link:hover {
            background: #e0e0e0;
            text-decoration: none;
        }
        body.dark .nav-link {
            background: #333;
            color: #e0e0e0;
            border-color: #555;
        }
        body.dark .nav-link:hover {
            background: #444;
        }
        .nav-links {
            margin-top: 1em;
            display: flex;
            gap: 1em;
            justify-content: center;
            flex-wrap: wrap;
        }
        .nav-link {
            display: inline-block;
            padding: 0.5em 1em;
            background: #f0f0f0;
            color: #333;
            text-decoration: none;
            border-radius: 4px;
            border: 1px solid #ccc;
            transition: background-color 0.2s ease;
        }
        .nav-link:hover {
            background: #e0e0e0;
            text-decoration: none;
        }
        body.dark .nav-link {
            background: #333;
            color: #e0e0e0;
            border-color: #555;
        }
        body.dark .nav-link:hover {
            background: #444;
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

  const teamType = {
    townsfolk: 'good',
    outsider: 'good',
    minion: 'bad',
    demon: 'bad',
    traveller: 'traveller',
    fabled: 'fabled',
  };

  // Count teams with roles to determine if we should make them collapsible
  const teamsWithRoles = Object.entries(categorizedRoles).filter(
    ([team, roles]) => roles.length > 0,
  );
  const shouldMakeCollapsible = teamsWithRoles.length > 1;

  // Add teams
  for (const [team, roles] of Object.entries(categorizedRoles)) {
    if (roles.length === 0) continue;

    const teamName = TEAM_NAMES[team as keyof typeof TEAM_NAMES];
    const headerClass = teamType[team as keyof typeof teamType];

    // Make all teams clickable if there are multiple teams, but travellers start collapsed
    const isClickable = shouldMakeCollapsible;
    const startsCollapsed = isClickable && team === 'traveller';
    const clickableClass = isClickable
      ? startsCollapsed
        ? 'clickable collapsed'
        : 'clickable'
      : '';
    const sectionClass = isClickable
      ? startsCollapsed
        ? 'team-section collapsed'
        : 'team-section'
      : 'team-section';

    html += `
    <h2 class="team-header ${headerClass} ${clickableClass}"${isClickable ? ` onclick="toggleTeamSection(this)"` : ''}>${escapeHtml(teamName)}</h2>`;

    html += `
    <div class="${sectionClass}">`;

    if (useGrid) {
      html += `
        <div class="team-roles">`;
    }

    // Add roles
    for (const role of roles) {
      const roleClass = teamType[team as keyof typeof teamType];

      html += `
            <div class="role" onclick="captureRoleToClipboard(this)" title="点击复制角色卡片到剪贴板">`;

      // Role icon using custom icon tag - only render if image is not 'none'
      if (role.image !== 'none') {
        const iconUrl = getRoleIconUrl(role);
        html += `
                <icon src="${iconUrl}" alt="${escapeHtml(role.name)}" class="role-icon"></icon>`;
      }

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

    html += `
    </div>`;
  }

  html += `
    <div class="footer">
        <div class="nav-links">
            <a href="/travellers" class="nav-link">查看所有旅行者</a>
            <a href="/fabled" class="nav-link">查看所有传奇</a>
        </div>
        <p>版权所有 <a href="https://bloodontheclocktower.com/" target="_blank">The Pandemonium Institute</a> 与 <a href="https://clocktower.gstonegames.com/" target="_blank">集石</a></p>
        <p>本页面由第三方工具"钟小楼"生成</p>
    </div>

    <script>
        // Function to toggle team section visibility
        function toggleTeamSection(headerElement) {
            const isCollapsed = headerElement.classList.contains('collapsed');
            const teamSection = headerElement.nextElementSibling;

            if (isCollapsed) {
                headerElement.classList.remove('collapsed');
                teamSection.classList.remove('collapsed');
            } else {
                headerElement.classList.add('collapsed');
                teamSection.classList.add('collapsed');
            }
        }

        // Function to capture role element and copy to clipboard
        async function captureRoleToClipboard(roleElement) {
            try {
                // Create a temporary container with the role content
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.left = '-9999px';
                tempContainer.style.top = '-9999px';
                tempContainer.style.width = '480px';
                tempContainer.style.padding = '8px';
                tempContainer.style.paddingTop = '2px';
                tempContainer.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
                tempContainer.style.color = getComputedStyle(document.body).color;
                tempContainer.style.fontFamily = getComputedStyle(document.body).fontFamily;

                // Clone the role element
                const clonedRole = roleElement.cloneNode(true);
                clonedRole.style.cursor = 'default';
                clonedRole.removeAttribute('onclick');
                clonedRole.removeAttribute('title');

                tempContainer.appendChild(clonedRole);
                document.body.appendChild(tempContainer);

                // Use html2canvas to capture the element
                const canvas = await html2canvas(tempContainer, {
                    backgroundColor: getComputedStyle(document.body).backgroundColor,
                    scale: 2, // Higher resolution
                    useCORS: true,
                    allowTaint: true
                });

                // Remove temporary container
                document.body.removeChild(tempContainer);

                // Convert canvas to blob
                canvas.toBlob(async (blob) => {
                    try {
                        // Copy to clipboard using the Clipboard API
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'image/png': blob
                            })
                        ]);

                        // Show success feedback
                        showCopyFeedback(roleElement, true);
                    } catch (clipboardError) {
                        console.error('Failed to copy to clipboard:', clipboardError);
                        showCopyFeedback(roleElement, false);
                    }
                }, 'image/png');

            } catch (error) {
                console.error('Failed to capture role:', error);
                showCopyFeedback(roleElement, false);
            }
        }

        // Function to show copy feedback
        function showCopyFeedback(element, success) {
            const feedback = document.createElement('div');
            feedback.textContent = success ? '已复制到剪贴板!' : '复制失败';
            feedback.style.position = 'fixed';
            feedback.style.top = '20px';
            feedback.style.right = '20px';
            feedback.style.padding = '8px 16px';
            feedback.style.backgroundColor = success ? '#4CAF50' : '#f44336';
            feedback.style.color = 'white';
            feedback.style.borderRadius = '4px';
            feedback.style.zIndex = '10000';
            feedback.style.fontSize = '14px';
            feedback.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

            document.body.appendChild(feedback);

            // Remove feedback after 2 seconds
            setTimeout(() => {
                if (feedback.parentNode) {
                    document.body.removeChild(feedback);
                }
            }, 2000);
        }

        function downloadPage() {
            // Clone the entire document
            const clonedDoc = document.cloneNode(true);

            // Remove the download button from the cloned document
            const downloadBtn = clonedDoc.querySelector('.download-btn');
            if (downloadBtn) {
                downloadBtn.remove();
            }

            // Remove html2canvas script from the cloned document
            const html2canvasScript = clonedDoc.querySelector('script[src="/js/html2canvas.js"]');
            if (html2canvasScript) {
                html2canvasScript.remove();
            }

            // Remove onclick handlers and titles from role elements
            const roleElements = clonedDoc.querySelectorAll('.role[onclick]');
            roleElements.forEach(role => {
                role.removeAttribute('onclick');
                role.removeAttribute('title');
                role.style.cursor = 'default';
            });

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
            const isCurrentlyDark = body.classList.contains('dark');

            if (isCurrentlyDark) {
                // Currently dark, switch to light
                body.classList.remove('dark');
                localStorage.setItem('themeMode', 'light');
            } else {
                // Currently light, switch to dark
                body.classList.add('dark');
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
                    // Replace with img tag using URL as src instead of data URI
                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = alt;
                    img.className = className;
                    iconEl.parentNode.replaceChild(img, iconEl);
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

            // Determine if we should use dark mode
            const shouldUseDark = savedMode === 'dark' || (savedMode === null && systemDarkMode);

            if (shouldUseDark) {
                body.classList.add('dark');
            } else {
                body.classList.remove('dark');
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
