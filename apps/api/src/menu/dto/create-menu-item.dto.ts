import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Jollof Rice' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '1500.00' })
  @IsString()
  @IsNotEmpty()
  price!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  in_stock?: boolean;
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  price?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  in_stock?: boolean;
}
