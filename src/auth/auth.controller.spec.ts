import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signup: jest.fn(),
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

  // ── signup ────────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('delegates to AuthService.signup with email, password, and name', async () => {
      const created = { id: 1, email: 'a@test.com', name: 'Tien' };
      mockAuthService.signup.mockResolvedValueOnce(created);

      const result = await controller.signup({
        email: 'a@test.com',
        password: 'secret123',
        name: 'Tien',
      });

      expect(mockAuthService.signup).toHaveBeenCalledWith(
        'a@test.com',
        'secret123',
        'Tien',
      );
      expect(result).toEqual(created);
    });

    it('propagates ConflictException when email already exists', async () => {
      mockAuthService.signup.mockRejectedValueOnce(new ConflictException());

      await expect(
        controller.signup({ email: 'dup@test.com', password: 'secret123' }),
      ).rejects.toBeInstanceOf(ConflictException);
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
    const mockReq = { user: { sub: 1, email: 'a@test.com' } } as never;

    it('delegates to AuthService.logout with refresh token and user id', async () => {
      mockAuthService.logout.mockResolvedValueOnce({ message: 'Logged out' });

      const result = await controller.logout(
        { refresh_token: 'some-rt' },
        mockReq,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('some-rt', 1);
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
