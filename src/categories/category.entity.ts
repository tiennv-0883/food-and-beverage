import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Product } from "../products/product.entity";

@Entity("categories")
export class Category {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column({ type: "varchar", nullable: true })
  name!: string | null;

  @Column({ type: "varchar", unique: true, nullable: true })
  slug!: string | null;

  @OneToMany(() => Product, (product: Product) => product.category)
  products!: Product[];
}
