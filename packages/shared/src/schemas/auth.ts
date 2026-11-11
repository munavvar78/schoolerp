import { z } from 'zod';
import { ROLES } from '../roles.js';

export const registerOrganizationSchema = z.object({
  organizationName: z.string().min(2).max(200),
  campusName: z.string().min(2).max(200),
  board: z.enum(['CBSE', 'ICSE', 'STATE', 'IB', 'CAMBRIDGE']).default('CBSE'),
  ownerName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  campusId: z.string().cuid().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  role: z.enum(ROLES),
  campusId: z.string().cuid(),
  password: z.string().min(8).max(128).optional(),
});

export type RegisterOrganizationInput = z.infer<typeof registerOrganizationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
