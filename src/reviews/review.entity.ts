import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../users/user.entity";
import { Product } from "../products/product.entity";

@Entity("reviews")
export class Review {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "user_id", type: "varchar", length: 36, nullable: true })
  userId!: string | null;

  @Column({ name: "product_id", type: "bigint", nullable: true })
  productId!: string | null;

  @Column({ type: "int", nullable: true })
  rating!: number | null;

  @Column({ type: "text", nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => User, (user: User) => user.reviews, { nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User | null;

  @ManyToOne(() => Product, (product): Review[] => product.reviews, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "product_id" })
  product!: Product;
}
