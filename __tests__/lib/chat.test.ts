import {
  fetchMessages,
  sendMessage,
  markAsRead,
  confirmHandoff,
  validateDeliveryCode,
  submitRating,
  fetchRatingForBooking,
  fetchUserAverageRating,
  fetchHandoffStep,
  fetchDeliveryCode,
} from '../../src/lib/chat';
import {
  mockSupabaseFrom,
  resetSupabaseMocks,
  createMockQueryBuilder,
} from '../__mocks__/supabase';

// Mock the supabase module
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '../../src/lib/supabase';

describe('chat library', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    (supabase.from as jest.Mock) = mockSupabaseFrom;
  });

  describe('fetchMessages', () => {
    it('should fetch messages for a booking request', async () => {
      const mockMessages = [
        {
          id: '1',
          content: 'Hello',
          sender_id: 'user-1',
          booking_request_id: 'booking-1',
          created_at: '2024-01-01T00:00:00Z',
          profiles: { first_name: 'John', last_name: 'Doe', avatar_url: null },
        },
      ];

      const builder = createMockQueryBuilder({ data: mockMessages, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchMessages('booking-1');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
      expect(result).toEqual(mockMessages);
    });

    it('should throw error when fetch fails', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      await expect(fetchMessages('booking-1')).rejects.toEqual({
        message: 'Database error',
      });
    });

    it('should return empty array when no messages exist', async () => {
      const builder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchMessages('booking-1');

      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('should send a valid message', async () => {
      const mockMessage = {
        id: '1',
        content: 'Hello',
        sender_id: 'user-1',
        booking_request_id: 'booking-1',
      };

      const builder = createMockQueryBuilder({ data: mockMessage, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await sendMessage('booking-1', 'user-1', 'Hello');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
      expect(builder.insert).toHaveBeenCalledWith({
        booking_request_id: 'booking-1',
        sender_id: 'user-1',
        content: 'Hello',
      });
      expect(result).toEqual(mockMessage);
    });

    it('should trim whitespace from message content', async () => {
      const mockMessage = { id: '1', content: 'Hello' };
      const builder = createMockQueryBuilder({ data: mockMessage, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await sendMessage('booking-1', 'user-1', '  Hello  ');

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Hello' })
      );
    });

    it('should reject empty messages', async () => {
      await expect(sendMessage('booking-1', 'user-1', '   ')).rejects.toThrow(
        'Message must be between 1 and 2000 characters'
      );
    });

    it('should reject messages longer than 2000 characters', async () => {
      const longMessage = 'a'.repeat(2001);

      await expect(sendMessage('booking-1', 'user-1', longMessage)).rejects.toThrow(
        'Message must be between 1 and 2000 characters'
      );
    });

    it('should accept messages with exactly 2000 characters', async () => {
      const message = 'a'.repeat(2000);
      const mockMessage = { id: '1', content: message };
      const builder = createMockQueryBuilder({ data: mockMessage, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await sendMessage('booking-1', 'user-1', message);

      expect(result).toEqual(mockMessage);
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await markAsRead('booking-1', 'user-1');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
      expect(builder.update).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('booking_request_id', 'booking-1');
      expect(builder.neq).toHaveBeenCalledWith('sender_id', 'user-1');
    });

    it('should throw error on failure', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Update failed' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      await expect(markAsRead('booking-1', 'user-1')).rejects.toEqual({
        message: 'Update failed',
      });
    });
  });

  describe('confirmHandoff', () => {
    it('should confirm sender_confirmed step', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await confirmHandoff('booking-1', 'user-1', 'sender_confirmed');

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ handoff_step: 'sender_confirmed' })
      );
    });

    it('should generate delivery code for handed_over step', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const deliveryCode = await confirmHandoff('booking-1', 'user-1', 'handed_over');

      expect(deliveryCode).toBeDefined();
      expect(typeof deliveryCode).toBe('string');
      expect(deliveryCode!.length).toBe(10);
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          handoff_step: 'handed_over',
          status: 'handed_over',
          delivery_code: deliveryCode,
        })
      );
    });

    it('should update status for delivered step', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await confirmHandoff('booking-1', 'user-1', 'delivered');

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          handoff_step: 'delivered',
          status: 'delivered',
        })
      );
    });

    it('should insert system message', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await confirmHandoff('booking-1', 'user-1', 'sender_confirmed');

      // Called twice: once for update, once for insert
      expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '[HANDOFF] sender_confirmed',
          is_system: true,
        })
      );
    });
  });

  describe('validateDeliveryCode', () => {
    it('should return true for matching delivery code', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9', handoff_step: 'handed_over' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', 'ABC123XYZ9', 'user-1');

      expect(result).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9', handoff_step: 'handed_over' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', 'abc123xyz9', 'user-1');

      expect(result).toBe(true);
    });

    it('should trim whitespace', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9', handoff_step: 'handed_over' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', '  ABC123XYZ9  ', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for incorrect code', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9', handoff_step: 'handed_over' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', 'WRONG_CODE', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false if handoff_step is not handed_over', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9', handoff_step: 'sender_confirmed' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', 'ABC123XYZ9', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Database error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await validateDeliveryCode('booking-1', 'ABC123XYZ9', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('submitRating', () => {
    it('should submit a rating with score and comment', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await submitRating('booking-1', 'rater-1', 'rated-1', 5, 'Great service!');

      expect(mockSupabaseFrom).toHaveBeenCalledWith('ratings');
      expect(builder.insert).toHaveBeenCalledWith({
        booking_request_id: 'booking-1',
        rater_id: 'rater-1',
        rated_id: 'rated-1',
        score: 5,
        comment: 'Great service!',
      });
    });

    it('should submit a rating without comment', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      await submitRating('booking-1', 'rater-1', 'rated-1', 4);

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ comment: null })
      );
    });

    it('should throw error on failure', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Insert failed' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      await expect(
        submitRating('booking-1', 'rater-1', 'rated-1', 5)
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  describe('fetchRatingForBooking', () => {
    it('should return existing rating', async () => {
      const mockRating = {
        id: 'rating-1',
        booking_request_id: 'booking-1',
        rater_id: 'rater-1',
        rated_id: 'rated-1',
        score: 5,
        comment: 'Great!',
      };

      const builder = createMockQueryBuilder({ data: mockRating, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchRatingForBooking('booking-1', 'rater-1');

      expect(result).toEqual(mockRating);
    });

    it('should return null when no rating exists', async () => {
      const builder = createMockQueryBuilder({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchRatingForBooking('booking-1', 'rater-1');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchRatingForBooking('booking-1', 'rater-1');

      expect(result).toBeNull();
    });
  });

  describe('fetchUserAverageRating', () => {
    it('should calculate average rating', async () => {
      const mockRatings = [{ score: 5 }, { score: 4 }, { score: 3 }];

      const builder = createMockQueryBuilder({ data: mockRatings, error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchUserAverageRating('user-1');

      expect(result).toEqual({ average: 4, count: 3 });
    });

    it('should return zero when no ratings exist', async () => {
      const builder = createMockQueryBuilder({ data: [], error: null });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchUserAverageRating('user-1');

      expect(result).toEqual({ average: 0, count: 0 });
    });

    it('should return zero on error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchUserAverageRating('user-1');

      expect(result).toEqual({ average: 0, count: 0 });
    });
  });

  describe('fetchHandoffStep', () => {
    it('should return handoff step', async () => {
      const builder = createMockQueryBuilder({
        data: { handoff_step: 'handed_over' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchHandoffStep('booking-1');

      expect(result).toBe('handed_over');
    });

    it('should return none on error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchHandoffStep('booking-1');

      expect(result).toBe('none');
    });

    it('should return none when no step set', async () => {
      const builder = createMockQueryBuilder({
        data: { handoff_step: null },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchHandoffStep('booking-1');

      expect(result).toBe('none');
    });
  });

  describe('fetchDeliveryCode', () => {
    it('should return delivery code', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: 'ABC123XYZ9' },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchDeliveryCode('booking-1');

      expect(result).toBe('ABC123XYZ9');
    });

    it('should return null on error', async () => {
      const builder = createMockQueryBuilder({
        data: null,
        error: { message: 'Error' },
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchDeliveryCode('booking-1');

      expect(result).toBeNull();
    });

    it('should return null when no code exists', async () => {
      const builder = createMockQueryBuilder({
        data: { delivery_code: null },
        error: null,
      });
      mockSupabaseFrom.mockReturnValue(builder);

      const result = await fetchDeliveryCode('booking-1');

      expect(result).toBeNull();
    });
  });
});
