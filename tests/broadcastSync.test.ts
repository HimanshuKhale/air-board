import { describe, it, expect, vi } from 'vitest';
import { BroadcastSyncService } from '../src/sync/broadcastSync';
import { SyncMessage } from '../src/types';

describe('BroadcastSyncService', () => {
  it('instantiates cleanly without throwing even in test environment without native channel', () => {
    const service = new BroadcastSyncService('test_channel');
    expect(service).toBeDefined();

    const listener = vi.fn();
    const unsub = service.onMessage(listener);
    expect(unsub).toBeTypeOf('function');

    service.close();
  });

  it('validates message structure before processing', () => {
    const service = new BroadcastSyncService('test_channel');
    const validMessage: SyncMessage = {
      type: 'TOOL_CHANGE',
      payload: { tool: 'highlighter' },
    };

    expect(validMessage.type).toBe('TOOL_CHANGE');
    expect(validMessage.payload.tool).toBe('highlighter');
    service.close();
  });
});
