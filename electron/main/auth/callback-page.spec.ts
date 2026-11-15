// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { callbackPage } from './callback-page';

describe('callback page', () => {
  it('tells the user the login is done, in the language of the app', () => {
    expect(callbackPage('en', 'done')).toContain('You are signed in');
    expect(callbackPage('es', 'done')).toContain('Sesión iniciada');
    expect(callbackPage('pt-BR', 'done')).toContain('Login concluído');
    expect(callbackPage('pt-BR', 'done')).toContain('<html lang="pt-BR">');
  });

  it('sends the user back to the app when the login did not complete', () => {
    const page = callbackPage('pt-BR', 'failed');

    expect(page).toContain('O login não foi concluído');
    expect(page).not.toContain('Login concluído');
  });

  it.each(['fr', 'constructor', '"><script>alert(1)</script>'])(
    'falls back to English for %s, which never reaches the page',
    (language) => {
      const page = callbackPage(language, 'done');

      expect(page).toContain('<html lang="en">');
      expect(page).toContain('You are signed in');
      expect(page).not.toContain('<script');
    },
  );

  it('is a whole page that loads nothing from anywhere', () => {
    const page = callbackPage('en', 'done');

    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('<meta charset="utf-8" />');
    expect(page).not.toMatch(/\b(src|href)=/);
  });
});
