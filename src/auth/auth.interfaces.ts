export class RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export class LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
}
