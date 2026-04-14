import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { Review } from '../reviews/review.entity';
import { OrderItem } from '../orders/order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  slug!: string | null;

  @Column({
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
  price!: number | null;

  @Column({ name: 'stock_quantity', type: 'int', nullable: true })
  stockQuantity!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  thumbnail!: string | null;

  @Column({ name: 'average_rating', type: 'float', default: 0 })
  averageRating!: number;

  @Column({ type: 'int', nullable: true })
  status!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => Category, (category: Category) => category.products, {
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @OneToMany(() => Review, (review: Review) => review.product)
  reviews!: Review[];

  @OneToMany(() => OrderItem, (item: OrderItem) => item.product)
  orderItems!: OrderItem[];
}
