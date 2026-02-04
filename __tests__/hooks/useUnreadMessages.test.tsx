import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useUnreadMessages } from '../../src/hooks/useUnreadMessages';

// Mock chat library
jest.mock('../../src/lib/chat', () => ({
  getUnreadCount: jest.fn(),
}));

import { getUnreadCount } from '../../src/lib/chat';

describe('useUnreadMessages hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getUnreadCount as jest.Mock).mockResolvedValue(5);
  });

  it('should fetch unread count on mount', async () => {
    const { result } = renderHook(() => useUnreadMessages('user-1'));

    await waitFor(() => {
      expect(result.current.count).toBe(5);
    });

    expect(getUnreadCount).toHaveBeenCalledWith('user-1');
  });

  it('should return 0 when userId is undefined', () => {
    const { result } = renderHook(() => useUnreadMessages(undefined));

    expect(result.current.count).toBe(0);
    expect(getUnreadCount).not.toHaveBeenCalled();
  });

  it('should refresh count periodically every 30 seconds', async () => {
    jest.useFakeTimers();

    const { result, unmount } = renderHook(() => useUnreadMessages('user-1'));

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(getUnreadCount).toHaveBeenCalledTimes(1);

    // Advance timer by 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(getUnreadCount).toHaveBeenCalledTimes(2);

    // Advance timer by another 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
    });

    expect(getUnreadCount).toHaveBeenCalledTimes(3);

    unmount();
    jest.useRealTimers();
  });

  it('should allow manual refresh', async () => {
    const { result } = renderHook(() => useUnreadMessages('user-1'));

    await waitFor(() => {
      expect(getUnreadCount).toHaveBeenCalledTimes(1);
    });

    (getUnreadCount as jest.Mock).mockResolvedValue(10);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.count).toBe(10);
    expect(getUnreadCount).toHaveBeenCalledTimes(2);
  });

  it('should silently handle errors', async () => {
    (getUnreadCount as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUnreadMessages('user-1'));

    // Wait a bit for the async operation
    await act(async () => {
      await Promise.resolve();
    });

    // Count should remain 0 after error
    expect(result.current.count).toBe(0);
    expect(getUnreadCount).toHaveBeenCalled();
  });

  it('should clear interval on unmount', async () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useUnreadMessages('user-1'));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should reset count to 0 when userId changes to undefined', async () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useUnreadMessages(userId),
      { initialProps: { userId: 'user-1' as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current.count).toBe(5);
    });

    rerender({ userId: undefined });

    await waitFor(() => {
      expect(result.current.count).toBe(0);
    });
  });

  it('should update count when userId changes', async () => {
    (getUnreadCount as jest.Mock).mockImplementation((userId: string) => {
      if (userId === 'user-1') return Promise.resolve(5);
      if (userId === 'user-2') return Promise.resolve(10);
      return Promise.resolve(0);
    });

    const { result, rerender } = renderHook(
      ({ userId }) => useUnreadMessages(userId),
      { initialProps: { userId: 'user-1' as string | undefined } }
    );

    await waitFor(() => {
      expect(result.current.count).toBe(5);
    });

    rerender({ userId: 'user-2' });

    await waitFor(() => {
      expect(result.current.count).toBe(10);
    });
  });

  it('should return initial count of 0', () => {
    const { result } = renderHook(() => useUnreadMessages('user-1'));

    // Initial state before async operation completes
    expect(result.current.count).toBe(0);
  });

  it('should provide refresh function', () => {
    const { result } = renderHook(() => useUnreadMessages('user-1'));

    expect(typeof result.current.refresh).toBe('function');
  });
});
