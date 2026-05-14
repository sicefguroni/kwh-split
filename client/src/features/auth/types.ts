export interface AuthUser {
  id: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
  bankQrUrl?: string | null;
  discountType: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
}
