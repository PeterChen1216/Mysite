/**
 * The settings window (PLAN-EXPERIENCE §2.1; markup in src/components/sections/PrefsWindow.astro):
 * a modal <dialog> over a plain form — radio groups for theme, motion, text size and shortcuts.
 * Each choice applies and is saved at once; `reset` goes back to the defaults. Loaded on first
 * use by src/scripts/prefs.ts, so it costs nothing until a visitor opens it.
 */
import type { Prefs } from '../prefs/model';
import { PREFS_EVENT, getPrefs, resetPrefs, setPrefs } from './prefs';

type Field = keyof Pick<Prefs, 'theme' | 'motion' | 'text' | 'keys'>;
const FIELDS: readonly Field[] = ['theme', 'motion', 'text', 'keys'];

let bound: HTMLDialogElement | null = null;
let returnTo: HTMLElement | null = null;

/** The stored value of a field as its radio value. */
const asValue = (field: Field, prefs: Prefs): string =>
  field === 'keys' ? (prefs.keys ? 'on' : 'off') : String(prefs[field]);

/** A radio value back into the stored type. */
function fromValue(field: Field, value: string): Partial<Prefs> {
  if (field === 'text') return { text: Number(value) as Prefs['text'] };
  if (field === 'keys') return { keys: value === 'on' };
  return { [field]: value } as Partial<Prefs>;
}

/** Check the radio of every field's current value; show the notes that apply to this device. */
function sync(dialog: HTMLDialogElement) {
  const prefs = getPrefs();
  for (const field of FIELDS) {
    const value = asValue(field, prefs);
    for (const input of dialog.querySelectorAll<HTMLInputElement>(`input[name="${field}"]`))
      input.checked = input.value === value;
  }
  for (const note of dialog.querySelectorAll<HTMLElement>('[data-note-media]'))
    note.hidden = !matchMedia(note.dataset.noteMedia ?? 'not all').matches;
}

function bind(dialog: HTMLDialogElement) {
  dialog.addEventListener('change', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
    const field = input.name as Field;
    if (FIELDS.includes(field)) setPrefs(fromValue(field, input.value));
  });
  dialog.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('[data-prefs-reset]')) {
      resetPrefs();
      sync(dialog);
    } else if (target?.closest('[data-prefs-close]')) dialog.close();
    // A click on the backdrop (outside the window's box) closes it too.
    else if (target === dialog) {
      const r = dialog.getBoundingClientRect();
      const { clientX: x, clientY: y } = e as MouseEvent;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    // Back to whatever opened it (the nav key, the footer button, or where `,` was pressed).
    if (returnTo?.isConnected) returnTo.focus();
    returnTo = null;
  });
  // Another tab changed them, or the device did: keep the form in step.
  document.addEventListener(PREFS_EVENT, () => sync(dialog));
  for (const query of ['(prefers-contrast: more)', '(prefers-reduced-motion: reduce)'])
    matchMedia(query).addEventListener('change', () => sync(dialog));
}

/** Open the window with the current values checked and focus on the first group's choice. */
export function showSettings(opener: HTMLElement | null): void {
  const dialog = document.getElementById('prefs');
  if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
  if (bound !== dialog) {
    bind(dialog);
    bound = dialog;
  }
  sync(dialog);
  returnTo = opener && opener !== document.body ? opener : null;
  dialog.showModal();
  const first = dialog.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  first?.focus();
}
