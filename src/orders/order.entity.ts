import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from './enums/order-status.enum';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) =>
        value === null ? null : parseFloat(value),
    },
  })
  totalPrice!: number | null;

  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  status!: OrderStatus | null;

  @Column({ name: 'shipping_address', type: 'text', nullable: true })
  shippingAddress!: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.orders, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @OneToMany(() => OrderItem, (item: OrderItem) => item.order)
  orderItems!: OrderItem[];
}
