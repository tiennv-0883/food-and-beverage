import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nguyenvana@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123@' })
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
  })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  @Matches(/^[0-9]{10,11}$/, { message: 'Phone number must be 10-11 digits' })
  phone!: string;
}
