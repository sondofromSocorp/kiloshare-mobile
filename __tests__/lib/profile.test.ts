import { fetchPublicProfile, fetchUserRole, fetchUserReviews } from '../../src/lib/profile';
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

describe('profile library', () => {
  beforeEach(() => {
    resetSupabaseMocks();
    (supabase.from as jest.Mock) = mockSupabaseFrom;
  });

  describe('fetchPublicProfile', () => {
    it('should return profile with identity_verified true when approved', async () => {
      const mockProfile = {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        city: 'Paris',
        country: 'France',
        bio: 'Hello world',
        languages: ['fr', 'en'],
        created_at: '2024-01-01',
      };

      // Track call count to return different responses
      let callCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'profiles') {
          return createMockQueryBuilder({ data: mockProfile, error: null });
        }
        if (table === 'identity_documents') {
          return createMockQueryBuilder({ data: { status: 'approved' }, error: null });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      const result = await fetchPublicProfile('user-1');

      expect(result).not.toBeNull();
      expect(result?.identity_verified).toBe(true);
      expect(result?.first_name).toBe('John');
      expect(result?.languages).toEqual(['fr', 'en']);
    });

    it('should return identity_verified false when no approved document', async () => {
      const mockProfile = {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: null,
        city: 'Paris',
        country: 'France',
        bio: 'Hello',
        languages: [],
        created_at: '2024-01-01',
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createMockQueryBuilder({ data: mockProfile, error: null });
        }
        if (table === 'identity_documents') {
          return createMockQueryBuilder({ data: null, error: null });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      const result = await fetchPublicProfile('user-1');

      expect(result?.identity_verified).toBe(false);
    });

    it('should return null when profile not found', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: null })
      );

      const result = await fetchPublicProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'Error' } })
      );

      const result = await fetchPublicProfile('user-1');

      expect(result).toBeNull();
    });

    it('should return empty array for languages when null', async () => {
      const mockProfile = {
        id: 'user-1',
        first_name: 'John',
        last_name: 'Doe',
        languages: null,
        avatar_url: null,
        city: null,
        country: null,
        bio: null,
        created_at: '2024-01-01',
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createMockQueryBuilder({ data: mockProfile, error: null });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      const result = await fetchPublicProfile('user-1');

      expect(result?.languages).toEqual([]);
    });
  });

  describe('fetchUserRole', () => {
    it('should return "new" when user has no announcements or bookings', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: null, count: 0 })
      );

      const result = await fetchUserRole('user-1');

      expect(result).toBe('new');
    });

    it('should return "traveler" when user only has announcements', async () => {
      let callCount = 0;
      mockSupabaseFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // announcements
          return createMockQueryBuilder({ data: null, error: null, count: 1 });
        }
        // booking_requests
        return createMockQueryBuilder({ data: null, error: null, count: 0 });
      });

      const result = await fetchUserRole('user-1');

      expect(result).toBe('traveler');
    });

    it('should return "sender" when user only has booking requests', async () => {
      let callCount = 0;
      mockSupabaseFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // announcements
          return createMockQueryBuilder({ data: null, error: null, count: 0 });
        }
        // booking_requests
        return createMockQueryBuilder({ data: null, error: null, count: 1 });
      });

      const result = await fetchUserRole('user-1');

      expect(result).toBe('sender');
    });

    it('should return "both" when user has announcements and bookings', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: null, count: 1 })
      );

      const result = await fetchUserRole('user-1');

      expect(result).toBe('both');
    });

    it('should handle null counts as zero', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: null, count: undefined })
      );

      const result = await fetchUserRole('user-1');

      expect(result).toBe('new');
    });
  });

  describe('fetchUserReviews', () => {
    it('should return reviews with rater profiles', async () => {
      const mockRatings = [
        {
          id: 'rating-1',
          score: 5,
          comment: 'Great!',
          created_at: '2024-01-01',
          rater_id: 'rater-1',
        },
        {
          id: 'rating-2',
          score: 4,
          comment: 'Good',
          created_at: '2024-01-02',
          rater_id: 'rater-2',
        },
      ];

      const mockProfiles = [
        { id: 'rater-1', first_name: 'Jane', last_name: 'Doe', avatar_url: null },
        { id: 'rater-2', first_name: 'Bob', last_name: 'Smith', avatar_url: 'https://example.com/bob.jpg' },
      ];

      let callCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        callCount++;
        if (table === 'ratings') {
          return createMockQueryBuilder({ data: mockRatings, error: null });
        }
        if (table === 'profiles') {
          return createMockQueryBuilder({ data: mockProfiles, error: null });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      const result = await fetchUserReviews('user-1');

      expect(result.length).toBe(2);
      expect(result[0].rater.first_name).toBe('Jane');
      expect(result[0].score).toBe(5);
      expect(result[1].rater.first_name).toBe('Bob');
      expect(result[1].rater.avatar_url).toBe('https://example.com/bob.jpg');
    });

    it('should return empty array when no reviews exist', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: [], error: null })
      );

      const result = await fetchUserReviews('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockSupabaseFrom.mockReturnValue(
        createMockQueryBuilder({ data: null, error: { message: 'Error' } })
      );

      const result = await fetchUserReviews('user-1');

      expect(result).toEqual([]);
    });

    it('should handle missing rater profile', async () => {
      const mockRatings = [
        {
          id: 'rating-1',
          score: 5,
          comment: 'Great!',
          created_at: '2024-01-01',
          rater_id: 'unknown-rater',
        },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'ratings') {
          return createMockQueryBuilder({ data: mockRatings, error: null });
        }
        if (table === 'profiles') {
          return createMockQueryBuilder({ data: [], error: null });
        }
        return createMockQueryBuilder({ data: null, error: null });
      });

      const result = await fetchUserReviews('user-1');

      expect(result.length).toBe(1);
      expect(result[0].rater).toEqual({
        first_name: null,
        last_name: null,
        avatar_url: null,
      });
    });
  });
});
