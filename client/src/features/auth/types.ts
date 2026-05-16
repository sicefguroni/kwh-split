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

export interface SettlementBankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface MemberSettlementProfile {
  userId: string;
  name: string;
  qrImages: string[];
  bankAccounts: SettlementBankAccount[];
}

export interface MemberSettlementProfileResponse {
  profile: MemberSettlementProfile;
}
