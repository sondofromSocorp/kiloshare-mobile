import { registerSchema, resetPasswordSchema, announcementSchema } from '../../src/lib/validation';

describe('registerSchema', () => {
  describe('email validation', () => {
    it('should accept valid email addresses', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      const result = registerSchema.safeParse({
        email: 'invalid-email',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Email is invalid');
      }
    });

    it('should reject empty email', () => {
      const result = registerSchema.safeParse({
        email: '',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('password validation', () => {
    it('should accept password meeting all requirements', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
      });
      expect(result.success).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Test1!',
        confirmPassword: 'Test1!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must be at least 8 characters');
      }
    });

    it('should reject password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'test123!@#',
        confirmPassword: 'test123!@#',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must contain at least one uppercase letter');
      }
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'TestTest!@#',
        confirmPassword: 'TestTest!@#',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must contain at least one number');
      }
    });

    it('should reject password without special character', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'TestTest123',
        confirmPassword: 'TestTest123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password must contain at least one special character');
      }
    });
  });

  describe('password confirmation', () => {
    it('should reject when passwords do not match', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Test123!@#',
        confirmPassword: 'Different123!@#',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmError = result.error.issues.find((i) => i.path.includes('confirmPassword'));
        expect(confirmError?.message).toBe("Passwords don't match");
      }
    });

    it('should accept when passwords match', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('resetPasswordSchema', () => {
  it('should accept valid password reset data', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'NewPass123!',
      confirmPassword: 'Different123!',
    });
    expect(result.success).toBe(false);
  });

  it('should apply same password rules as register', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'weak',
      confirmPassword: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

describe('announcementSchema', () => {
  const validAnnouncement = {
    title: 'Paris to Dakar Trip',
    departure_city: 'Paris',
    departure_country: 'France',
    destination_city: 'Dakar',
    destination_country: 'Senegal',
    departure_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    available_space: 10,
    price_per_kg: 15,
  };

  it('should accept valid announcement data', () => {
    const result = announcementSchema.safeParse(validAnnouncement);
    expect(result.success).toBe(true);
  });

  describe('title validation', () => {
    it('should reject title shorter than 5 characters', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        title: 'Trip',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le titre doit contenir au moins 5 caractères');
      }
    });

    it('should accept title with exactly 5 characters', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        title: 'Trips',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('date validation', () => {
    it('should reject departure date in the past', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        departure_date: '2020-01-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const dateError = result.error.issues.find((i) => i.path.includes('departure_date'));
        expect(dateError?.message).toBe('La date de départ doit être dans le futur');
      }
    });

    it('should accept today or future as departure date', () => {
      // Use tomorrow to avoid timezone edge cases
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        departure_date: tomorrowStr,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('available_space validation', () => {
    it('should reject available space less than 1', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        available_space: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le nombre de kilos doit être supérieur à 0');
      }
    });

    it('should reject available space greater than 100', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        available_space: 101,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le nombre de kilos ne peut pas dépasser 100');
      }
    });

    it('should accept available space at boundary values', () => {
      const result1 = announcementSchema.safeParse({
        ...validAnnouncement,
        available_space: 1,
      });
      expect(result1.success).toBe(true);

      const result100 = announcementSchema.safeParse({
        ...validAnnouncement,
        available_space: 100,
      });
      expect(result100.success).toBe(true);
    });
  });

  describe('price_per_kg validation', () => {
    it('should reject price per kg less than 5', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        price_per_kg: 4,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le prix minimum est de 5€ par kilo');
      }
    });

    it('should reject price per kg greater than 500', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        price_per_kg: 501,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Le prix maximum est de 500€ par kilo');
      }
    });

    it('should accept price at boundary values', () => {
      const result5 = announcementSchema.safeParse({
        ...validAnnouncement,
        price_per_kg: 5,
      });
      expect(result5.success).toBe(true);

      const result500 = announcementSchema.safeParse({
        ...validAnnouncement,
        price_per_kg: 500,
      });
      expect(result500.success).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('should accept announcement without complementary_info', () => {
      const { complementary_info, ...withoutInfo } = validAnnouncement;
      const result = announcementSchema.safeParse(withoutInfo);
      expect(result.success).toBe(true);
    });

    it('should accept announcement with complementary_info', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        complementary_info: 'Additional details here',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('city and country validation', () => {
    it('should reject empty departure city', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        departure_city: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject city with only 1 character', () => {
      const result = announcementSchema.safeParse({
        ...validAnnouncement,
        departure_city: 'P',
      });
      expect(result.success).toBe(false);
    });
  });
});
