import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  street!: string | null;

  @Column({ type: 'varchar', nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.addresses, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;
}
