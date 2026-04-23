export type UserSerializerType = 'BASIC_INFO' | 'PROFILE';

const USER_FIELDS: Record<UserSerializerType, string[]> = {
  BASIC_INFO: ['id', 'email', 'name', 'role', 'isActive', 'avatar', 'phone'],
  PROFILE: [
    'id',
    'email',
    'name',
    'role',
    'isActive',
    'avatar',
    'phone',
    'createdAt',
    'updatedAt',
  ],
};

type FieldTransform = (value: unknown) => unknown;

const FIELD_TRANSFORMS: Partial<Record<string, FieldTransform>> = {
  avatar: (v) => (typeof v === 'string' && v ? `/attachments/${v}` : null),
};

export class UserSerializer {
  constructor(
    private readonly user: Record<string, unknown>,
    private readonly options: { type: UserSerializerType },
  ) {}

  private get allowedFields(): string[] {
    return USER_FIELDS[this.options.type] || [];
  }

  serialize(): Record<string, unknown> {
    return this.allowedFields.reduce(
      (acc, field) => {
        if (this.user[field] !== undefined) {
          const transform = FIELD_TRANSFORMS[field];
          acc[field] = transform
            ? transform(this.user[field])
            : this.user[field];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  }

  static serializeMany(
    users: Record<string, unknown>[],
    options: { type: UserSerializerType },
  ): Record<string, unknown>[] {
    return users.map((user) => new UserSerializer(user, options).serialize());
  }
}
