export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string | null;
          updated_at: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          street_address: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          avatar_url: string | null;
          username: string;
          bio: string | null;
          languages: string[];
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string | null;
          updated_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          street_address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          avatar_url?: string | null;
          username: string;
          bio?: string | null;
          languages?: string[];
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string | null;
          updated_at?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          street_address?: string | null;
          postal_code?: string | null;
          city?: string | null;
          country?: string | null;
          avatar_url?: string | null;
          username?: string;
          bio?: string | null;
          languages?: string[];
        };
      };
      announcements: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          departure_city: string;
          departure_country: string;
          destination_city: string;
          destination_country: string;
          departure_date: string;
          available_space: number;
          price_per_kg: number;
          complementary_info: string | null;
          status: 'active' | 'completed' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          departure_city: string;
          departure_country: string;
          destination_city: string;
          destination_country: string;
          departure_date: string;
          available_space: number;
          price_per_kg: number;
          complementary_info?: string | null;
          status?: 'active' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          departure_city?: string;
          departure_country?: string;
          destination_city?: string;
          destination_country?: string;
          departure_date?: string;
          available_space?: number;
          price_per_kg?: number;
          complementary_info?: string | null;
          status?: 'active' | 'completed' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
      };
      booking_requests: {
        Row: {
          id: string;
          user_id: string;
          announcement_id: string;
          requested_kilos: number;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'handed_over' | 'delivered';
          handoff_step: HandoffStep;
          delivery_code: string | null;
          message: string | null;
          legal_accepted: boolean;
          legal_accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          announcement_id: string;
          requested_kilos: number;
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'handed_over' | 'delivered';
          handoff_step?: HandoffStep;
          delivery_code?: string | null;
          message?: string | null;
          legal_accepted?: boolean;
          legal_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          announcement_id?: string;
          requested_kilos?: number;
          status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'handed_over' | 'delivered';
          handoff_step?: HandoffStep;
          delivery_code?: string | null;
          message?: string | null;
          legal_accepted?: boolean;
          legal_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Announcement = Database['public']['Tables']['announcements']['Row'];
export type BookingRequest = Database['public']['Tables']['booking_requests']['Row'];

export interface Favorite {
  id: string;
  user_id: string;
  announcement_id: string;
  created_at: string;
}

export type AnnouncementStatus = 'active' | 'completed' | 'cancelled';
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'handed_over' | 'delivered';
export type HandoffStep = 'none' | 'sender_confirmed' | 'handed_over' | 'delivered';

export interface NewAnnouncement {
  title: string;
  departure_city: string;
  departure_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  available_space: number;
  price_per_kg: number;
  complementary_info?: string;
}

export interface NewBookingRequest {
  announcement_id: string;
  requested_kilos: number;
  message?: string;
}

export interface City {
  name: string;
  city_code: string;
  country_code: string;
  city?: string;
}

export interface Airport {
  iata_code: string;
  name: string;
  city: string;
  country_code: string;
}

export interface Rating {
  id: string;
  booking_request_id: string;
  rater_id: string;
  rated_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  booking_request_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  read_at: string | null;
  created_at: string;
}

export interface MessageWithSender extends Message {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
}

export interface ConversationSummary {
  booking_request_id: string;
  other_user: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
  other_user_id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  announcement: Pick<Announcement, 'departure_city' | 'destination_city' | 'departure_date'>;
}

export interface PublicProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  languages: string[];
  created_at: string | null;
  identity_verified: boolean;
}

export interface ReviewWithRater {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}
