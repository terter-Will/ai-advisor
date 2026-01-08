export type Role = 'user' | 'admin';

export interface User {
  id: number;
  userid: string;
  role: Role;
  points_balance: number;
}