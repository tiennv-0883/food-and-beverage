import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { UsersService } from './users.service';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockI18nService = {
    t: jest.fn().mockReturnValue('translated'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns serialized user when found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'a@test.com',
        name: 'Tien',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findById(1);

      expect(result).toMatchObject({ id: 1, email: 'a@test.com' });
      expect(result).not.toHaveProperty('password');
    });

    it('throws NotFoundException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findById(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns serialized array of users', async () => {
      mockUserRepository.find.mockResolvedValueOnce([
        {
          id: 1,
          email: 'a@test.com',
          name: 'A',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          email: 'b@test.com',
          name: 'B',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('hashes the password before saving', async () => {
      const entity = { id: 1, email: 'a@test.com', name: null };
      mockUserRepository.create.mockReturnValueOnce(entity);
      mockUserRepository.save.mockResolvedValueOnce({
        ...entity,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create({
        email: 'a@test.com',
        password: 'plain123',
        name: null,
      });

      const savedArg = (
        mockUserRepository.create.mock.calls as [Partial<User>][]
      )[0][0];
      expect(savedArg.password).not.toBe('plain123');
      expect(savedArg.password).toMatch(/^\$2[ab]\$/);
    });

    it('throws InternalServerErrorException when save fails', async () => {
      mockUserRepository.create.mockReturnValueOnce({});
      mockUserRepository.save.mockRejectedValueOnce(new Error('db error'));

      await expect(
        service.create({ email: 'a@test.com', password: 'plain123' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates non-password fields without touching password', async () => {
      mockUserRepository.update.mockResolvedValue({});
      mockUserRepository.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'new@test.com',
        name: 'Tien',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(1, { name: 'Tien' });

      expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
      expect(mockUserRepository.update).toHaveBeenCalledWith(1, {
        name: 'Tien',
      });
    });

    it('hashes password separately when password is included', async () => {
      mockUserRepository.update.mockResolvedValue({});
      mockUserRepository.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'a@test.com',
        name: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.update(1, { name: 'Tien', password: 'newpass' });

      expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
      const passwordCall = mockUserRepository.update.mock.calls[0] as [
        number,
        Partial<User>,
      ];
      expect(passwordCall[1].password).toMatch(/^\$2[ab]\$/);
      expect(passwordCall[1].name).toBe('Tien');
    });

    it('throws InternalServerErrorException when update fails', async () => {
      mockUserRepository.update.mockRejectedValueOnce(new Error('db error'));

      await expect(service.update(1, { name: 'X' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
