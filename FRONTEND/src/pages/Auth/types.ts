export type AuthResultData = {
  resetToken?: string;
  maskedEmail?: string;
  expiresAt?: string;
};

export type AuthActionResult = {
  success: boolean;
  message: string;
  data?: AuthResultData;
};

export type RegisterFormPayload = {
  cnpj: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};
