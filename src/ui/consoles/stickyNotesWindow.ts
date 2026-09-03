/**
 * ui/consoles/stickyNotesWindow.ts — VM Sticky Notes window.
 *
 * Multiple coloured sticky notes, each draggable and editable.
 * Content persists to localStorage.
 */
const STICKY_KEY = 'sticky_notes';

interface SavedNote {
  text: string;
  color: string;
  left: number;
  top: number;
}

const COLORS = ['#fef08a', '#fda4af', '#93c5fd', '#86efac', '#c4b5fd'];
const DEFAULT_NOTES: SavedNote[] = [
  { text: 'Remember: always verify identity before granting access!', color: '#fef08a', left: 10, top: 10 },
  { text: 'SSO ticket #2847 — pending approval from HR', color: '#fda4af', left: 80, top: 80 },
  { text: 'Review least-privilege policy for Finance group next week', color: '#93c5fd', left: 40, top: 160 },
];

export function renderStickyNotesWindow(body: HTMLElement): void {
  body.style.cssText = 'position:relative;overflow:hidden;background:#1a1a2e;';

  const wrapper = document.createElement('div');
  wrapper.id = 'sn-wrapper';
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;';
  body.appendChild(wrapper);

  // Load notes
  let notes: SavedNote[] = DEFAULT_NOTES;
  try {
    const raw = localStorage.getItem(STICKY_KEY);
    if (raw) notes = JSON.parse(raw) as SavedNote[];
  } catch { /* use defaults */ }

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    position:absolute;bottom:0;left:0;right:0;height:36px;
    background:rgba(27,31,36,0.9);border-top:1px solid #2d343d;
    display:flex;align-items:center;padding:0 10px;gap:8px;z-index:10;
  `;
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ New Note';
  addBtn.style.cssText = `
    background:#4ec9b0;color:#0e1116;border:none;border-radius:4px;
    padding:4px 12px;font-size:11px;cursor:pointer;font-weight:600;
  `;
  toolbar.appendChild(addBtn);
  body.appendChild(toolbar);

  function save(): void {
    const items: SavedNote[] = [];
    wrapper.querySelectorAll<HTMLElement>('.sn-note').forEach((el) => {
      items.push({
        text: el.dataset['text'] ?? '',
        color: el.dataset['color'] ?? '#fef08a',
        left: parseInt(el.style.left) || 0,
        top: parseInt(el.style.top) || 0,
      });
    });
    localStorage.setItem(STICKY_KEY, JSON.stringify(items));
  }

  function makeNote(data: SavedNote): HTMLElement {
    const note = document.createElement('div');
    note.className = 'sn-note';
    note.dataset['text'] = data.text;
    note.dataset['color'] = data.color;
    note.style.cssText = `
      position:absolute;left:${data.left}px;top:${data.top}px;
      width:160px;min-height:100px;background:${data.color};
      border-radius:2px;box-shadow:2px 3px 10px rgba(0,0,0,0.35);
      padding:10px 8px 28px;cursor:grab;user-select:none;
      display:flex;flex-direction:column;gap:2px;
    `;

    const textEl = document.createElement('div');
    textEl.contentEditable = 'true';
    textEl.style.cssText = `
      font-size:12px;color:#1a1a2e;line-height:1.5;outline:none;
      min-height:60px;word-break:break-word;white-space:pre-wrap;
    `;
    textEl.textContent = data.text;
    textEl.addEventListener('input', () => {
      note.dataset['text'] = textEl.textContent ?? '';
      save();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete note';
    deleteBtn.style.cssText = `
      position:absolute;bottom:4px;right:4px;background:transparent;
      border:none;font-size:14px;cursor:pointer;color:rgba(0,0,0,0.4);
      line-height:1;padding:0 2px;
    `;
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); note.remove(); save(); });

    note.appendChild(textEl);
    note.appendChild(deleteBtn);

    // Drag
    let dragging = false;
    let dx = 0, dy = 0;
    note.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).contentEditable === 'true') return;
      dragging = true;
      const r = note.getBoundingClientRect();
      const pr = wrapper.getBoundingClientRect();
      dx = e.clientX - (r.left - pr.left);
      dy = e.clientY - (r.top - pr.top);
      note.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const pr = wrapper.getBoundingClientRect();
      const maxX = pr.width - 170;
      const maxY = pr.height - 110;
      const x = Math.max(0, Math.min(maxX, e.clientX - pr.left - dx));
      const y = Math.max(0, Math.min(maxY, e.clientY - pr.top - dy));
      note.style.left = `${x}px`;
      note.style.top = `${y}px`;
    });
    document.addEventListener('mouseup', () => {
      if (dragging) {
        dragging = false;
        note.style.cursor = 'grab';
        note.dataset['left'] = note.style.left;
        note.dataset['top'] = note.style.top;
        save();
      }
    });

    return note;
  }

  for (const n of notes) wrapper.appendChild(makeNote(n));

  let noteCounter = notes.length;
  addBtn.addEventListener('click', () => {
    const color = COLORS[noteCounter % COLORS.length] ?? '#fef08a';
    noteCounter++;
    const el = makeNote({ text: 'New note — click to edit', color, left: 20 + (noteCounter * 15) % 100, top: 20 + (noteCounter * 25) % 80 });
    wrapper.appendChild(el);
    save();
    (el.querySelector('[contenteditable]') as HTMLElement)?.focus();
  });
}
