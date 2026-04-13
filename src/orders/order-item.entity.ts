import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Order } from "./order.entity";
import { Product } from "../products/product.entity";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ name: "order_id", type: "bigint", nullable: true })
  orderId!: string | null;

  @Column({ name: "product_id", type: "bigint", nullable: true })
  productId!: string | null;

  @Column({ type: "int", nullable: true })
  quantity!: number | null;

  @Column({
    name: "price_at_purchase",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  priceAtPurchase!: number | null;

  @ManyToOne(() => Order, (order) => order.orderItems, { nullable: true })
  @JoinColumn({ name: "order_id" })
  order!: Order | null;

  @ManyToOne(() => Product, (product) => product.orderItems, { nullable: true })
  @JoinColumn({ name: "product_id" })
  product!: Product | null;
}
