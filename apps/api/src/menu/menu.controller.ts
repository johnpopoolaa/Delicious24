import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';

@Controller('menu-items')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  list() {
    return this.menu.list().then((items) => ({ success: true, data: { items } }));
  }

  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return this.menu.create(dto).then((item) => ({ success: true, data: item }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuItemDto) {
    return this.menu.update(id, dto).then((item) => ({ success: true, data: item }));
  }
}
