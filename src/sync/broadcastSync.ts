/**
 * SAAI AirBoard - Multi-Window BroadcastChannel Synchronization
 *
 * Coordinates state between Studio window and Presentation window
 * entirely client-side without any backend or WebSocket server.
 */

import { SyncMessage } from '../types';

export const SYNC_CHANNEL_NAME = 'saai_airboard_broadcast_sync';

export type SyncMessageListener = (message: SyncMessage) => void;

export class BroadcastSyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncMessageListener> = new Set();
  private isSupported: boolean;

  constructor(channelName = SYNC_CHANNEL_NAME) {
    this.isSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;
    if (this.isSupported) {
      try {
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          this.handleIncoming(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }
  }

  send(message: SyncMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('Failed to broadcast message:', err);
      }
    }
  }

  onMessage(listener: SyncMessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleIncoming(message: SyncMessage): void {
    if (!message || typeof message.type !== 'string') return;
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (err) {
        console.error('Error in BroadcastSync listener:', err);
      }
    });
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }
}
