import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { Public } from '../common/public.decorator';

@ApiTags('menu-items')
@Controller('menu-items')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Public()
  @ApiOperation({ summary: 'List all menu items' })
  @Get()
  list() {
    return this.menu.list().then((items) => ({ success: true, data: { items } }));
  }

  @ApiOperation({ summary: 'Create a new menu item' })
  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return this.menu.create(dto).then((item) => ({ success: true, data: item }));
  }

  @ApiOperation({ summary: 'Update a menu item by ID' })
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuItemDto) {
    return this.menu.update(id, dto).then((item) => ({ success: true, data: item }));
  }

  @ApiOperation({ summary: 'Archive (soft-delete) a menu item by ID' })
  @Delete(':id')
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.menu.archive(id).then(() => ({ success: true }));
  }
}
