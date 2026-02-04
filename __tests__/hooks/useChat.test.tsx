import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useChat } from '../../src/hooks/useChat';

// Mock chat library functions
jest.mock('../../src/lib/chat', () => ({
  fetchMessages: jest.fn(),
  sendMessage: jest.fn(),
  markAsRead: jest.fn(),
}));

// Mock supabase - channel mock will be configured in beforeEach
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import { fetchMessages, sendMessage, markAsRead } from '../../src/lib/chat';
import { supabase } from '../../src/lib/supabase';

describe('useChat hook', () => {
  const mockMessages = [
    {
      id: '1',
      content: 'Hello',
      sender_id: 'user-1',
      booking_request_id: 'booking-1',
      created_at: '2024-01-01T00:00:00Z',
      read_at: null,
      is_system: false,
      profiles: { first_name: 'John', last_name: 'Doe', avatar_url: null },
    },
  ];

  let channelMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchMessages as jest.Mock).mockResolvedValue(mockMessages);
    (sendMessage as jest.Mock).mockResolvedValue({ id: '2', content: 'New message' });
    (markAsRead as jest.Mock).mockResolvedValue(undefined);

    // Setup channel mock for each test
    channelMock = {
      on: jest.fn(function(this: any) { return this; }),
      subscribe: jest.fn(function(this: any) { return this; }),
      unsubscribe: jest.fn(),
    };
    (supabase.channel as jest.Mock).mockReturnValue(channelMock);
  });

  it('should load messages on mount', async () => {
    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMessages).toHaveBeenCalledWith('booking-1');
    expect(result.current.messages).toEqual(mockMessages);
  });

  it('should not load messages when bookingRequestId is empty', async () => {
    const { result } = renderHook(() => useChat('', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('should not load messages when userId is undefined', async () => {
    const { result } = renderHook(() => useChat('booking-1', undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMessages).not.toHaveBeenCalled();
  });

  it('should send a message', async () => {
    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.send('New message');
    });

    expect(sendMessage).toHaveBeenCalledWith('booking-1', 'user-1', 'New message');
  });

  it('should not send message when userId is undefined', async () => {
    const { result } = renderHook(() => useChat('booking-1', undefined));

    await act(async () => {
      await result.current.send('New message');
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should throw error when send fails', async () => {
    (sendMessage as jest.Mock).mockRejectedValue(new Error('Send failed'));

    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.send('New message');
      })
    ).rejects.toThrow('Send failed');
  });

  it('should mark messages as read', async () => {
    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.markRead();
    });

    expect(markAsRead).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('should not mark as read when userId is undefined', async () => {
    const { result } = renderHook(() => useChat('booking-1', undefined));

    await act(async () => {
      await result.current.markRead();
    });

    expect(markAsRead).not.toHaveBeenCalled();
  });

  it('should set error when fetch fails', async () => {
    (fetchMessages as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load messages');
  });

  it('should reload messages when reload is called', async () => {
    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(fetchMessages).toHaveBeenCalledTimes(2);
  });

  it('should subscribe to real-time updates', async () => {
    renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('messages:booking-1');
    });

    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }),
      expect.any(Function)
    );

    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }),
      expect.any(Function)
    );

    expect(channelMock.subscribe).toHaveBeenCalled();
  });

  it('should not subscribe when bookingRequestId is empty', async () => {
    renderHook(() => useChat('', 'user-1'));

    await waitFor(() => {
      expect(supabase.channel).not.toHaveBeenCalled();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(channelMock.subscribe).toHaveBeenCalled();
    });

    unmount();

    expect(channelMock.unsubscribe).toHaveBeenCalled();
  });

  it('should return initial empty messages array', () => {
    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    expect(result.current.messages).toEqual([]);
  });

  it('should clear error on reload', async () => {
    (fetchMessages as jest.Mock).mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useChat('booking-1', 'user-1'));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load messages');
    });

    (fetchMessages as jest.Mock).mockResolvedValueOnce(mockMessages);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBeNull();
  });
});
