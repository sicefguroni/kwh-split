export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
}

export interface BankAccountsResponse {
  accounts: BankAccount[];
}

export interface BankAccountResponse {
  account: BankAccount;
}
