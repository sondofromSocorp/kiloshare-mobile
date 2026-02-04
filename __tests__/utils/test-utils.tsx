import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Custom wrapper that provides all necessary providers for testing
 */
const AllProviders = ({ children }: WrapperProps) => {
  return <>{children}</>;
};

/**
 * Custom render function that wraps components with all providers
 */
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything from testing library
export * from '@testing-library/react-native';

// Override render method
export { customRender as render };

/**
 * Helper to wait for async operations in tests
 */
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Mock data factories for common test data
 */
export const createMockMessage = (overrides = {}) => ({
  id: 'msg-1',
  booking_request_id: 'booking-1',
  sender_id: 'user-1',
  content: 'Test message',
  is_system: false,
  read_at: null,
  created_at: new Date().toISOString(),
  profiles: {
    first_name: 'John',
    last_name: 'Doe',
    avatar_url: null,
  },
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'user-1',
  first_name: 'John',
  last_name: 'Doe',
  avatar_url: null,
  city: 'Paris',
  country: 'France',
  bio: 'Test bio',
  languages: ['fr', 'en'],
  created_at: new Date().toISOString(),
  identity_verified: false,
  ...overrides,
});

export const createMockAnnouncement = (overrides = {}) => ({
  id: 'ann-1',
  user_id: 'user-1',
  title: 'Paris to Dakar',
  departure_city: 'Paris',
  departure_country: 'France',
  destination_city: 'Dakar',
  destination_country: 'Senegal',
  departure_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  available_space: 10,
  price_per_kg: 15,
  status: 'active',
  complementary_info: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockBookingRequest = (overrides = {}) => ({
  id: 'booking-1',
  user_id: 'user-1',
  announcement_id: 'ann-1',
  requested_kilos: 5,
  message: 'Test booking',
  status: 'pending',
  handoff_step: 'none',
  delivery_code: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockRating = (overrides = {}) => ({
  id: 'rating-1',
  booking_request_id: 'booking-1',
  rater_id: 'rater-1',
  rated_id: 'rated-1',
  score: 5,
  comment: 'Great experience!',
  created_at: new Date().toISOString(),
  ...overrides,
});
