import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Address } from '../addresses/address.entity';
import { Order } from '../orders/order.entity';
import { Review } from '../reviews/review.entity';
import { ProductSuggestion } from '../product-suggestions/product-suggestion.entity';
import { Notification } from '../notifications/notification.entity';
import { Role } from '../auth/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ name: 'verification_token', type: 'varchar', nullable: true })
  verificationToken!: string | null;

  @Column({
    name: 'verification_token_expires_at',
    type: 'datetime',
    nullable: true,
  })
  verificationTokenExpiresAt!: Date | null;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role!: Role;

  @Column({ name: 'is_active', default: false })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  avatar!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @OneToMany(() => Address, (address) => address.user)
  addresses!: Address[];

  @OneToMany(() => Order, (order) => order.user)
  orders!: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews!: Review[];

  @OneToMany(() => ProductSuggestion, (ps) => ps.user)
  productSuggestions!: ProductSuggestion[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications!: Notification[];
}
