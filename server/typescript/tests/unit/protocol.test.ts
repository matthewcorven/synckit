import { describe, test, expect } from 'bun:test';
import {
  MessageType,
  parseMessage,
  serializeMessage,
  createMessageId,
  type AuthMessage,
  type SyncRequestMessage,
  type DeltaMessage,
} from '../../src/websocket/protocol';

describe('Protocol - Message Serialization', () => {
  test('should create unique message IDs', () => {
    const id1 = createMessageId();
    const id2 = createMessageId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  test('should serialize AuthMessage correctly', () => {
    const message: AuthMessage = {
      type: MessageType.AUTH,
      id: 'test-123',
      timestamp: Date.now(),
      token: 'test-token',
    };

    // Explicitly request JSON text protocol for this assertion
    const serialized = serializeMessage(message, false);
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe('string');
    
    const parsed = JSON.parse(serialized);
    expect(parsed.type).toBe(MessageType.AUTH);
    expect(parsed.id).toBe('test-123');
    expect(parsed.token).toBe('test-token');
  });

  test('should serialize SyncRequestMessage correctly', () => {
    const message: SyncRequestMessage = {
      type: MessageType.SYNC_REQUEST,
      id: 'sync-456',
      timestamp: Date.now(),
      documentId: 'doc-1',
      vectorClock: { client1: 5, client2: 3 },
    };

    // Explicitly use JSON text protocol for this check
    const serialized = serializeMessage(message, false);
    const parsed = JSON.parse(serialized);
    
    expect(parsed.type).toBe(MessageType.SYNC_REQUEST);
    expect(parsed.documentId).toBe('doc-1');
    expect(parsed.vectorClock).toEqual({ client1: 5, client2: 3 });
  });

  test('should serialize DeltaMessage correctly', () => {
    const message: DeltaMessage = {
      type: MessageType.DELTA,
      id: 'delta-789',
      timestamp: Date.now(),
      documentId: 'doc-2',
      delta: { field: 'value' },
      vectorClock: { client1: 6 },
    };

    // Explicitly use JSON text protocol for this check
    const serialized = serializeMessage(message, false);
    const parsed = JSON.parse(serialized);
    
    expect(parsed.type).toBe(MessageType.DELTA);
    expect(parsed.documentId).toBe('doc-2');
    expect(parsed.delta).toEqual({ field: 'value' });
  });
});

describe('Protocol - Message Parsing', () => {
  test('should parse valid message', () => {
    const raw = JSON.stringify({
      type: MessageType.PING,
      id: 'ping-1',
      timestamp: Date.now(),
    });

    const message = parseMessage(raw);
    expect(message).toBeDefined();
    expect(message?.type).toBe(MessageType.PING);
    expect(message?.id).toBe('ping-1');
  });

  test('should return null for invalid JSON', () => {
    const message = parseMessage('not valid json');
    expect(message).toBeNull();
  });

  test('should return null for message without required fields', () => {
    const message = parseMessage(JSON.stringify({ type: MessageType.PING }));
    expect(message).toBeNull();
  });

  test('should parse complex message with nested data', () => {
    const raw = JSON.stringify({
      type: MessageType.DELTA,
      id: 'delta-complex',
      timestamp: Date.now(),
      documentId: 'doc-3',
      delta: {
        nested: {
          deep: {
            value: 'test',
          },
        },
      },
      vectorClock: { client1: 10, client2: 5, client3: 2 },
    });

    const message = parseMessage(raw);
    expect(message).toBeDefined();
    expect(message?.type).toBe(MessageType.DELTA);
  });
});

describe('Protocol - Round-trip Serialization', () => {
  test('should serialize and parse back to same message', () => {
    const original: AuthMessage = {
      type: MessageType.AUTH,
      id: 'roundtrip-1',
      timestamp: 1234567890,
      token: 'test-token-123',
      apiKey: 'api-key-456',
    };

    // JSON text protocol round-trip
    const serializedJson = serializeMessage(original, false);
    const parsedJson = parseMessage(serializedJson);

    expect(parsedJson).toBeDefined();
    expect(parsedJson?.type).toBe(original.type);
    expect(parsedJson?.id).toBe(original.id);
    expect(parsedJson?.timestamp).toBe(original.timestamp);
    expect((parsedJson as AuthMessage)?.token).toBe(original.token);
    expect((parsedJson as AuthMessage)?.apiKey).toBe(original.apiKey);

    // Binary protocol round-trip
    const serializedBin = serializeMessage(original, true);
    const parsedBin = parseMessage(serializedBin);

    expect(parsedBin).toBeDefined();
    expect(parsedBin?.type).toBe(original.type);
    expect(parsedBin?.id).toBe(original.id);
    expect(parsedBin?.timestamp).toBe(original.timestamp);
    expect((parsedBin as AuthMessage)?.token).toBe(original.token);
    expect((parsedBin as AuthMessage)?.apiKey).toBe(original.apiKey);
  });
});
