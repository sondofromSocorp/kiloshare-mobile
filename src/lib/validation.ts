import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email is invalid'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const announcementSchema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères'),
  departure_city: z.string().min(2, 'La ville de départ est requise'),
  departure_country: z.string().min(2, 'Le pays de départ est requis'),
  destination_city: z.string().min(2, 'La ville de destination est requise'),
  destination_country: z.string().min(2, 'Le pays de destination est requis'),
  departure_date: z.string().refine((date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, 'La date de départ doit être dans le futur'),
  available_space: z.number()
    .min(1, 'Le nombre de kilos doit être supérieur à 0')
    .max(100, 'Le nombre de kilos ne peut pas dépasser 100'),
  price_per_kg: z.number()
    .min(5, 'Le prix minimum est de 5€ par kilo')
    .max(500, 'Le prix maximum est de 500€ par kilo'),
  complementary_info: z.string().optional()
});

export type AnnouncementFormData = z.infer<typeof announcementSchema>;
