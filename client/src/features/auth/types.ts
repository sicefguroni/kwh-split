export interface AuthUser {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
  bankQrUrl?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
}
