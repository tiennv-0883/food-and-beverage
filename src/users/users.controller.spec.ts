import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  };

  const mockReq = (sub: string) =>
    ({ user: { sub, email: 'a@test.com' } }) as never;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET /users/me ─────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns the profile for the authenticated user', async () => {
      const profile = { id: 1, email: 'a@test.com', name: 'Tien' };
      mockUsersService.findById.mockResolvedValueOnce(profile);

      const result = await controller.getProfile(mockReq('uuid1'));

      expect(mockUsersService.findById).toHaveBeenCalledWith('uuid1');
      expect(result).toEqual(profile);
    });

    it('is protected by JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        UsersController,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });

  // ── GET /users/:id ────────────────────────────────────────────────────────

  describe('find', () => {
    it('returns the user for a given id', async () => {
      const user = { id: 2, email: 'b@test.com', name: null };
      mockUsersService.findById.mockResolvedValueOnce(user);

      const result = await controller.find('uuid2');

      expect(mockUsersService.findById).toHaveBeenCalledWith('uuid2');
      expect(result).toEqual(user);
    });

    it('propagates NotFoundException when user does not exist', async () => {
      mockUsersService.findById.mockRejectedValueOnce(new NotFoundException());

      await expect(controller.find('uuid99')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── GET /users ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns an array of users', async () => {
      const users = [
        { id: 1, email: 'a@test.com', name: 'Tien' },
        { id: 2, email: 'b@test.com', name: null },
      ];
      mockUsersService.findAll.mockResolvedValueOnce(users);

      const result = await controller.findAll();

      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  // ── PUT /users/:id ────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the user when the requester owns the resource', async () => {
      const updated = { id: 'uuid1', email: 'a@test.com', name: 'New Name' };
      mockUsersService.update.mockResolvedValueOnce(updated);

      const result = await controller.update(
        'uuid1',
        { name: 'New Name' },
        mockReq('uuid1'),
      );

      expect(mockUsersService.update).toHaveBeenCalledWith('uuid1', {
        name: 'New Name',
      });
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException when the requester does not own the resource', () => {
      expect(() =>
        controller.update('uuid2', { name: 'Hacker' }, mockReq('uuid1')),
      ).toThrow(ForbiddenException);

      expect(mockUsersService.update).not.toHaveBeenCalled();
    });

    it('is protected by JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        UsersController,
      ) as (new () => unknown)[];
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
