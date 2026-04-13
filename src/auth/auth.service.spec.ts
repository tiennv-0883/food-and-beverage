import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshToken } from './refresh-token.entity';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    findByIdRaw: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };

  const mockI18nService = {
    t: jest.fn().mockReturnValue('translated'),
  };

  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: I18nService, useValue: mockI18nService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── signup ────────────────────────────────────────────────────────────────

  describe('signup', () => {
    it('throws ConflictException when email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce({ id: 1 });
      await expect(
        service.signup('taken@example.com', 'pass'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user when email is free', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockResolvedValueOnce({
        id: 2,
        email: 'new@example.com',
      });

      const result = await service.signup('new@example.com', 'pass', 'Tien');

      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass',
        name: 'Tien',
      });
      expect(result).toEqual({ id: 2, email: 'new@example.com' });
    });

    it('throws InternalServerErrorException when create fails', async () => {
      mockUsersService.findByEmail.mockResolvedValueOnce(null);
      mockUsersService.create.mockRejectedValueOnce(new Error('db error'));

      await expect(
        service.signup('new@example.com', 'pass'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockUsersService.findByEmailWithPassword.mockResolvedValueOnce(null);
      await expect(
        service.login('unknown@example.com', 'pass'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsersService.findByEmailWithPassword.mockResolvedValueOnce({
        id: 1,
        email: 'user@example.com',
        password: hashed,
      });

      await expect(
        service.login('user@example.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns access_token and refresh_token on valid credentials', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsersService.findByEmailWithPassword.mockResolvedValueOnce({
        id: 1,
        email: 'user@example.com',
        password: hashed,
      });
      mockRefreshTokenRepo.save.mockResolvedValueOnce({});

      const result = await service.login('user@example.com', 'correct');

      expect(result).toHaveProperty('access_token', 'signed-token');
      expect(result).toHaveProperty('refresh_token');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.refresh_token.length).toBeGreaterThan(0);
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const rawToken = 'raw-refresh-token';
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    it('throws UnauthorizedException when token not found in DB', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and deletes when token is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tokenHash,
        userId: 1,
        expiresAt: past,
      });
      mockRefreshTokenRepo.delete.mockResolvedValueOnce({});

      await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith(5);
    });

    it('returns new access_token for valid, non-expired token', async () => {
      const future = new Date(Date.now() + 60_000);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tokenHash,
        userId: 1,
        expiresAt: future,
      });
      mockUsersService.findByIdRaw.mockResolvedValueOnce({
        id: 1,
        email: 'user@example.com',
      });

      const result = await service.refresh(rawToken);

      expect(result).toEqual({ access_token: 'signed-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'user@example.com',
      });
    });

    it('throws UnauthorizedException and deletes token when user no longer exists', async () => {
      const future = new Date(Date.now() + 60_000);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tokenHash,
        userId: 99,
        expiresAt: future,
      });
      mockUsersService.findByIdRaw.mockRejectedValueOnce(
        new NotFoundException('user not found'),
      );
      mockRefreshTokenRepo.delete.mockResolvedValueOnce({});

      await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith(5);
    });

    it('propagates non-NotFoundException errors without deleting the token', async () => {
      const future = new Date(Date.now() + 60_000);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 5,
        tokenHash,
        userId: 1,
        expiresAt: future,
      });
      mockUsersService.findByIdRaw.mockRejectedValueOnce(
        new InternalServerErrorException('db timeout'),
      );

      await expect(service.refresh(rawToken)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(mockRefreshTokenRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const rawToken = 'some-raw-token';
    const expectedHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    it('deletes the refresh token when it belongs to the authenticated user', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 7,
        tokenHash: expectedHash,
        userId: 1,
      });
      mockRefreshTokenRepo.delete.mockResolvedValueOnce({});

      const result = await service.logout(rawToken, 1);

      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledWith(7);
      expect(result).toHaveProperty('message');
    });

    it('does not delete the token when it belongs to a different user', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 7,
        tokenHash: expectedHash,
        userId: 99,
      });

      await service.logout(rawToken, 1);

      expect(mockRefreshTokenRepo.delete).not.toHaveBeenCalled();
    });

    it('silently succeeds when token is not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.logout(rawToken, 1)).resolves.toHaveProperty(
        'message',
      );
      expect(mockRefreshTokenRepo.delete).not.toHaveBeenCalled();
    });
  });
});
