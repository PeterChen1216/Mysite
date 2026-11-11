/**
 * The hero terminal's mini prompt (PLAN-EXPERIENCE §6 row 12), loaded on first use: the `$ █`
 * line becomes a real, labelled text field; Enter runs a command (src/lib/prompt.ts), its output
 * is a log screen readers hear; Escape or `exit` closes it and focus returns to the line. The
 * terminal keeps its size (its body scrolls), so nothing on the page moves. Single-key shortcuts
 * stay out of the field (src/scripts/prefs.ts).
 */
import { runCommand, type PromptWords } from '../lib/prompt';
import { setPrefs } from './prefs';

export interface PromptCopy extends PromptWords {
  label: string;
  hint: string;
}

let open = false;

export function openPrompt(line: HTMLElement, key: HTMLButtonElement): void {
  if (open) return;
  let w: PromptCopy;
  try {
    w = JSON.parse(line.dataset.prompt ?? '') as PromptCopy;
  } catch {
    return;
  }
  const body = line.parentElement;
  if (!body) return;
  open = true;
  // The terminal keeps its height from now on; new lines scroll inside it. The height as laid
  // out, fractions included: offsetHeight rounds, and half a pixel more pushed the page under the
  // terminal down whenever its lines added up to x.5 px.
  body.style.height = getComputedStyle(body).height;
  body.classList.add('term__body--prompt');

  const id = 'term-prompt';
  const log = document.createElement('div');
  log.className = 'prompt__log';
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'prompt__hint';
  hint.id = `${id}-hint`;
  hint.textContent = w.hint;
  const form = document.createElement('form');
  form.className = 'prompt';
  form.innerHTML = `<label class="visually-hidden" for="${id}"></label><span class="prompt__dollar" aria-hidden="true">$ </span><input class="prompt__input" id="${id}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send">`;
  form.querySelector('label')!.textContent = w.label;
  const input = form.querySelector('input')!;
  input.setAttribute('aria-describedby', hint.id);
  line.hidden = true;
  body.append(log, hint, form);

  const say = (text: string, cls = 'prompt__out') => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    log.append(p);
  };
  const close = () => {
    form.remove();
    hint.remove();
    log.remove();
    line.hidden = false;
    body.style.removeProperty('height');
    body.classList.remove('term__body--prompt');
    open = false;
    key.focus();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const typed = input.value;
    input.value = '';
    if (!typed.trim()) return;
    say(`$ ${typed.trim()}`, 'prompt__echo');
    const r = runCommand(typed, w);
    for (const l of r.lines) say(l);
    switch (r.action?.kind) {
      case 'theme':
        setPrefs({ theme: r.action.theme });
        break;
      case 'open': {
        const a = document.createElement('a');
        a.href = r.action.href;
        a.download = '';
        a.click();
        break;
      }
      case 'clear':
        log.replaceChildren();
        break;
      case 'exit':
        close();
        return;
    }
    body.scrollTop = body.scrollHeight;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  body.scrollTop = body.scrollHeight;
  input.focus();
}
