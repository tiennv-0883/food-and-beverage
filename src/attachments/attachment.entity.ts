import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export enum AttachableType {
  USER = "USER",
  PRODUCT = "PRODUCT",
  SUGGESTION = "SUGGESTION",
}

@Entity("attachments")
export class Attachment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    name: "file_id",
    type: "varchar",
    length: 36,
    unique: true,
    nullable: true,
  })
  fileId!: string | null;

  @Column({ name: "origin_name", type: "varchar", nullable: true })
  originName!: string | null;

  @Column({ name: "mime_type", type: "varchar", nullable: true })
  mimeType!: string | null;

  @Column({ type: "int", nullable: true })
  size!: number | null;

  @Column({
    name: "attachable_id",
    type: "varchar",
    length: 36,
    nullable: true,
  })
  attachableId!: string | null;

  @Column({ name: "attachable_type", type: "varchar", nullable: true })
  attachableType!: string | null;

  @Column({ type: "varchar", nullable: true })
  path!: string | null;

  @Column({ name: "is_public", default: true })
  isPublic!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
