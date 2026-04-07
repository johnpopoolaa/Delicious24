import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.menuItem.findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: { name: string; price: string; in_stock?: boolean }) {
    return this.prisma.menuItem.create({
      data: {
        name: data.name,
        price: data.price,
        inStock: data.in_stock ?? true,
      },
    });
  }

  async update(id: number, data: { name?: string; price?: string; in_stock?: boolean }) {
    try {
      return await this.prisma.menuItem.update({
        where: { id },
        data: {
          name: data.name,
          price: data.price,
          inStock: data.in_stock,
        },
      });
    } catch {
      throw new NotFoundException({ error: 'MENU_ITEM_NOT_FOUND', message: 'Menu item not found' });
    }
  }
}
