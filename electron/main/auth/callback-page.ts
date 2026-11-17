import type { CallbackOutcome } from './loopback';

type Text = { title: string; body: string };

// The page is served by the main process, which has no access to the
// translations of the renderer (src/locales).
const TEXT: Record<string, Record<CallbackOutcome, Text>> = {
  en: {
    done: {
      title: 'You are signed in',
      body: 'You can close this tab and go back to Media App.',
    },
    failed: {
      title: 'The sign-in was not completed',
      body: 'Go back to Media App to see what happened and try again.',
    },
  },
  es: {
    done: {
      title: 'Sesión iniciada',
      body: 'Puedes cerrar esta pestaña y volver a Media App.',
    },
    failed: {
      title: 'No se completó el inicio de sesión',
      body: 'Vuelve a Media App para ver qué pasó e intentarlo de nuevo.',
    },
  },
  'pt-BR': {
    done: {
      title: 'Login concluído',
      body: 'Pode fechar esta aba e voltar para o Media App.',
    },
    failed: {
      title: 'O login não foi concluído',
      body: 'Volte para o Media App para ver o que aconteceu e tentar de novo.',
    },
  },
};

/**
 * What the browser shows when TMDB sends it back to the app, in the language
 * of the app when there is a translation and in English otherwise.
 */
export function callbackPage(language: string, outcome: CallbackOutcome) {
  const lang = Object.hasOwn(TEXT, language) ? language : 'en';
  const { title, body } = TEXT[lang][outcome];

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Media App</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: system-ui, sans-serif;
        margin: 15vh auto;
        max-width: 32rem;
        padding: 0 1rem;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>${body}</p>
  </body>
</html>
`;
}
