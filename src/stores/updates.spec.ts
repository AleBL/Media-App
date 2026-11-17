import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { UpdateState } from '@shared/api';
import { useUpdatesStore } from '@/stores/updates';
import { installFakeApi } from '@/test/fakeApi';

const AVAILABLE: UpdateState = {
  status: 'available',
  version: '0.3.0',
  url: 'https://github.com/AleBL/Media-App/releases/tag/v0.3.0',
};

describe('updates store', () => {
  let api: ReturnType<typeof installFakeApi>;

  const announce = (state: UpdateState) =>
    api.updates.onChange.mock.calls[0][0](state);

  beforeEach(() => {
    setActivePinia(createPinia());
    api = installFakeApi();
  });

  afterEach(() => {
    delete window.api;
  });

  it('reads the state and follows its changes', async () => {
    api.updates.state.mockResolvedValue({
      status: 'downloading',
      version: '0.3.0',
    });
    const store = useUpdatesStore();

    await store.load();

    expect(store.state).toEqual({ status: 'downloading', version: '0.3.0' });
    expect(store.visible).toBe(false);

    announce({ status: 'ready', version: '0.3.0' });

    expect(store.visible).toBe(true);
  });

  it('keeps a change that came while the state was asked', async () => {
    let answer!: (state: UpdateState) => void;
    api.updates.state.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const store = useUpdatesStore();

    const loading = store.load();
    announce({ status: 'ready', version: '0.3.0' });
    answer({ status: 'idle' });
    await loading;

    expect(store.state).toEqual({ status: 'ready', version: '0.3.0' });
  });

  it('listens once, however often it loads', async () => {
    const store = useUpdatesStore();

    await store.load();
    await store.load();

    expect(api.updates.onChange).toHaveBeenCalledOnce();
  });

  it('hides the notice of a version until a newer one comes', async () => {
    api.updates.state.mockResolvedValue(AVAILABLE);
    const store = useUpdatesStore();
    await store.load();

    store.dismiss();
    expect(store.visible).toBe(false);

    announce({ ...AVAILABLE, version: '0.4.0' });
    expect(store.visible).toBe(true);
  });

  it('installs through the main process', async () => {
    const store = useUpdatesStore();

    await store.install();

    expect(api.updates.install).toHaveBeenCalledOnce();
  });
});
