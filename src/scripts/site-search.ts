type SearchPage = { href: string; title: string; section: string; description?: string };

const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase();

// Index rendered content, so edits to pages and Markdown are searchable without
// maintaining another copy of their text or interpreting Astro source files.
function pageText(document: Document): string {
  const main = document.querySelector('#main')?.cloneNode(true) as HTMLElement | undefined;
  if (!main) throw new Error('The page has no searchable main content.');
  main.querySelectorAll('script, style, noscript, template, canvas, svg, [hidden], [aria-hidden="true"], .site-search').forEach((node) => node.remove());
  main.querySelectorAll('br, p, div, section, article, h1, h2, h3, h4, h5, h6, li, dt, dd, tr, pre, blockquote').forEach((node) => node.append(' '));
  return (main.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function snippet(text: string, tokens: string[]): string {
  const folded = normalize(text);
  const positions = tokens.map((token) => folded.indexOf(token)).filter((index) => index >= 0);
  const match = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, match - 42);
  if (start > 0) {
    const boundary = text.indexOf(' ', start);
    if (boundary >= 0 && boundary < match) start = boundary + 1;
  }
  const end = Math.min(text.length, Math.max(start + 150, match + (tokens[0]?.length ?? 0)));
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function startSiteSearch(search: HTMLElement) {
  const form = search.querySelector<HTMLFormElement>('form');
  const input = search.querySelector<HTMLInputElement>('input');
  const results = search.querySelector<HTMLElement>('.search-results');
  const list = search.querySelector<HTMLUListElement>('.search-list');
  const status = search.querySelector<HTMLElement>('.search-status');
  const retry = search.querySelector<HTMLButtonElement>('.search-retry');
  if (!form || !input || !results || !list || !status || !retry) return;

  let pages: SearchPage[];
  try {
    const manifest: unknown = JSON.parse(search.dataset.searchPages ?? '[]');
    if (!Array.isArray(manifest)) return;
    pages = manifest.filter((page): page is SearchPage => Boolean(page && typeof page === 'object'
      && typeof page.href === 'string' && typeof page.title === 'string' && typeof page.section === 'string'
      && page.href.startsWith('/') && !page.href.startsWith('//')));
  } catch { return; }

  const bodies = new Map<string, string>();
  const failed = new Set<string>();
  let loading = false;
  let open = false;
  let pendingFocus = false;
  let suppressFocusOnce = false;
  let focusCheck = 0;
  const rows = new Map<string, HTMLLIElement>();

  const current = pages.find(({ href }) => href === window.location.pathname);
  if (current) {
    try { bodies.set(current.href, pageText(document)); } catch { /* Fetch it below if needed. */ }
  }

  function sizeResults() {
    if (results!.hidden) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
    results!.style.setProperty('--search-room', `${Math.max(64, bottom - results!.getBoundingClientRect().top - 32)}px`);
  }

  function close(restoreFocus = false) {
    open = false;
    pendingFocus = false;
    results!.hidden = true;
    if (restoreFocus && document.activeElement !== input) {
      suppressFocusOnce = true;
      input!.focus({ preventScroll: true });
    }
  }

  function render() {
    results!.setAttribute('aria-busy', String(loading));
    const query = normalize(input!.value.trim());
    if (!query || !open) { results!.hidden = true; return; }
    const tokens = query.split(/\s+/).filter(Boolean);
    const matches = pages.map((page) => {
      const body = bodies.get(page.href) ?? '';
      const title = normalize(page.title);
      const text = normalize(`${page.title} ${page.section} ${page.description ?? ''} ${body}`);
      return {
        page,
        body,
        match: tokens.every((token) => text.includes(token)),
        score: title === query ? 3 : title.includes(query) ? 2 : tokens.some((token) => title.includes(token)) ? 1 : 0,
      };
    }).filter(({ match }) => match).sort((a, b) => b.score - a.score);

    const focused = document.activeElement instanceof HTMLAnchorElement && list!.contains(document.activeElement)
      ? document.activeElement.getAttribute('href') : null;
    const visibleHrefs = new Set(matches.map(({ page }) => page.href));
    for (const item of Array.from(list!.children)) {
      const href = item.querySelector('a')?.getAttribute('href');
      if (!href || !visibleHrefs.has(href)) item.remove();
    }
    let position = 0;
    for (const { page, body } of matches) {
      let item = rows.get(page.href);
      if (!item) {
        item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'search-result-link';
        link.href = page.href;
        const heading = document.createElement('span');
        heading.className = 'search-result-heading';
        const title = document.createElement('span');
        title.className = 'search-result-title';
        title.textContent = page.title;
        const arrow = document.createElement('span');
        arrow.className = 'material-icon';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = 'north_east';
        heading.append(title, arrow);
        const section = document.createElement('span');
        section.className = 'search-result-section';
        section.textContent = page.section;
        const summary = document.createElement('span');
        summary.className = 'search-result-snippet';
        link.append(heading, section, summary);
        item.append(link);
        rows.set(page.href, item);
      }
      const summary = item.querySelector<HTMLElement>('.search-result-snippet')!;
      const text = snippet(body || page.description || 'Open this page.', tokens);
      if (summary.textContent !== text) summary.textContent = text;
      // Keep existing anchors connected while background requests finish. A
      // replaced link can lose focus or disappear between pointerdown and click.
      const atPosition = list!.children[position++];
      if (atPosition !== item) list!.insertBefore(item, atPosition ?? null);
    }
    results!.hidden = false;
    const count = `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`;
    if (loading) {
      status!.textContent = `${matches.length ? `${count} so far. ` : ''}Searching page and article content… ${bodies.size} of ${pages.length} pages loaded.`;
    } else if (failed.size) {
      status!.textContent = `${matches.length ? `${count} found.` : 'No matches in the content loaded so far.'} Search is incomplete: ${failed.size} ${failed.size === 1 ? 'page could' : 'pages could'} not be loaded.`;
    } else {
      status!.textContent = matches.length ? `${count} found.` : 'No matching pages or articles found.';
    }
    retry!.hidden = !failed.size || loading;
    sizeResults();
    const links = Array.from(list!.querySelectorAll<HTMLAnchorElement>('a'));
    if (focused) links.find((link) => link.getAttribute('href') === focused)?.focus({ preventScroll: true });
    if (pendingFocus && links.length) {
      pendingFocus = false;
      links[0].focus({ preventScroll: true });
    }
  }

  async function loadIndex(retryFailures = false) {
    if (loading) return;
    const queue = pages.filter(({ href }) => !bodies.has(href) && (retryFailures || !failed.has(href)));
    if (!queue.length) return;
    loading = true;
    queue.forEach(({ href }) => failed.delete(href));
    render();
    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const page = queue[cursor++];
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(page.href, { credentials: 'same-origin', signal: controller.signal });
          if (!response.ok || new URL(response.url).origin !== location.origin) throw new Error('The page is unavailable.');
          const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
          bodies.set(page.href, pageText(parsed));
        } catch { failed.add(page.href); }
        finally { clearTimeout(timeout); }
        render();
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, () => worker()));
    loading = false;
    render();
  }

  function searchNow() {
    open = Boolean(input!.value.trim());
    pendingFocus = false;
    render();
    void loadIndex();
  }

  input.addEventListener('focus', () => {
    void loadIndex();
    if (suppressFocusOnce) { suppressFocusOnce = false; return; }
    open = Boolean(input.value.trim());
    render();
  });
  input.addEventListener('input', (event) => { if (!(event instanceof InputEvent) || !event.isComposing) searchNow(); });
  input.addEventListener('compositionend', searchNow);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' || !input.value.trim()) return;
    event.preventDefault();
    open = true;
    pendingFocus = true;
    render();
    void loadIndex();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    open = true;
    pendingFocus = true;
    render();
    void loadIndex();
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (!list.contains(event.target as Node) || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const links = Array.from(list.querySelectorAll<HTMLAnchorElement>('a'));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowUp' && index <= 0) input.focus({ preventScroll: true });
    else links[Math.min(links.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))]?.focus();
  });
  retry.addEventListener('click', () => {
    input.focus({ preventScroll: true });
    void loadIndex(true);
  });
  document.addEventListener('pointerdown', (event) => { if (!search.contains(event.target as Node)) close(); });
  search.addEventListener('focusin', () => cancelAnimationFrame(focusCheck));
  search.addEventListener('focusout', (event) => {
    cancelAnimationFrame(focusCheck);
    if (event.relatedTarget instanceof Node) {
      if (!search.contains(event.relatedTarget)) close();
      return;
    }
    // During blur, activeElement can briefly be body before the new target gets
    // focus. Wait for a frame only when the browser supplies no relatedTarget.
    focusCheck = requestAnimationFrame(() => {
      if (!search.contains(document.activeElement)) close();
    });
  });
  window.addEventListener('resize', sizeResults, { passive: true });
  window.addEventListener('scroll', sizeResults, { passive: true });
  window.visualViewport?.addEventListener('resize', sizeResults, { passive: true });
}
