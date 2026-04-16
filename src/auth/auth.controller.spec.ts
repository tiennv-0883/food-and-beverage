import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('delegates to AuthService.register with email, password, name and phone', async () => {
      const created = {
        message: 'Register account success',
        data: { user: { id: '1', email: 'a@test.com', name: 'Tien' } },
      };
      mockAuthService.register.mockResolvedValueOnce(created);

      const result = await controller.register({
        email: 'a@test.com',
        password: 'Password123@',
        name: 'Tien',
        phone: '0901234567',
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(
        'a@test.com',
        'Password123@',
        'Tien',
        '0901234567',
      );
      expect(result).toEqual(created);
    });

    it('propagates ConflictException when email already exists', async () => {
      mockAuthService.register.mockRejectedValueOnce(new ConflictException());

      await expect(
        controller.register({
          email: 'dup@test.com',
          password: 'Password123@',
          name: 'Tien',
          phone: '0901234567',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('delegates to AuthService.verifyEmail with email and token', async () => {
      const response = {
        message: 'Email verified successfully. You can now login.',
        data: { email: 'a@test.com', verifiedAt: new Date() },
      };
      mockAuthService.verifyEmail.mockResolvedValueOnce(response);

      const result = await controller.verifyEmail('a@test.com', 'valid-token');

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(
        'a@test.com',
        'valid-token',
      );
      expect(result).toEqual(response);
    });

    it('propagates BadRequestException for invalid token', async () => {
      mockAuthService.verifyEmail.mockRejectedValueOnce(
        new BadRequestException(),
      );

      await expect(
        controller.verifyEmail('a@test.com', 'bad-token'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── resendVerification ────────────────────────────────────────────────────

  describe('resendVerification', () => {
    it('delegates to AuthService.resendVerification with email', async () => {
      const response = {
        message: 'Verification email has been resent. Please check your inbox.',
      };
      mockAuthService.resendVerification.mockResolvedValueOnce(response);

      const result = await controller.resendVerification({
        email: 'a@test.com',
      });

      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        'a@test.com',
      );
      expect(result).toEqual(response);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns access_token and refresh_token on valid credentials', async () => {
      const tokens = { access_token: 'at', refresh_token: 'rt' };
      mockAuthService.login.mockResolvedValueOnce(tokens);

      const result = await controller.login({
        email: 'a@test.com',
        password: 'secret123',
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(
        'a@test.com',
        'secret123',
      );
      expect(result).toEqual(tokens);
    });

    it('propagates UnauthorizedException on invalid credentials', async () => {
      mockAuthService.login.mockRejectedValueOnce(new UnauthorizedException());

      await expect(
        controller.login({ email: 'a@test.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('returns a new access_token for a valid refresh token', async () => {
      mockAuthService.refresh.mockResolvedValueOnce({ access_token: 'new-at' });

      const result = await controller.refresh({ refresh_token: 'valid-rt' });

      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid-rt');
      expect(result).toEqual({ access_token: 'new-at' });
    });

    it('propagates UnauthorizedException for an invalid refresh token', async () => {
      mockAuthService.refresh.mockRejectedValueOnce(
        new UnauthorizedException(),
      );

      await expect(
        controller.refresh({ refresh_token: 'bad-rt' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const mockReq = { user: { sub: '1', email: 'a@test.com' } } as never;

    it('delegates to AuthService.logout with refresh token and user id', async () => {
      mockAuthService.logout.mockResolvedValueOnce({ message: 'Logged out' });

      const result = await controller.logout(
        { refresh_token: 'some-rt' },
        mockReq,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('some-rt', '1');
      expect(result).toEqual({ message: 'Logged out' });
    });

    it('is protected by JwtAuthGuard', () => {
      const method = Object.getOwnPropertyDescriptor(
        AuthController.prototype,
        'logout',
      )?.value as object;
      const guards = Reflect.getMetadata(
        '__guards__',
        method,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
