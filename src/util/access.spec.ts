import { describe, expect, it } from 'vitest';
import { accessProblem } from '@/util/access';

describe('accessProblem', () => {
  it.each(['network', 'timeout', 'server', 'not-found', undefined] as const)(
    'is no problem of access for %s',
    (code) => {
      expect(accessProblem(code, true, false)).toBeNull();
    },
  );

  it('tells the desktop app what the settings can solve', () => {
    expect(accessProblem('missing-credential', true, false)).toBe('noAccess');
    expect(accessProblem('unauthorized', true, false)).toBe('appRefused');
    expect(accessProblem('unauthorized', true, true)).toBe('ownKeyRefused');
  });

  it('has nothing for a visitor of the web version to solve', () => {
    expect(accessProblem('missing-credential', false, false)).toBe(
      'webUnavailable',
    );
    expect(accessProblem('unauthorized', false, false)).toBe('webUnavailable');
  });
});
