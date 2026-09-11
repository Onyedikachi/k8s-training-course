import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { ApiKeyGuard } from '../common/api-key.guard';
import { AppConfigService } from '../config/app-config.service';

@Controller('api/items')
@UseGuards(ApiKeyGuard)
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  findAll() {
    // servedBy shows which replica answered - useful when demonstrating Service load balancing
    return { servedBy: this.config.podName, items: this.items.findAll() };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.items.findOne(id);
  }

  @Post()
  create(@Body() body: { name?: string }) {
    if (!body?.name || typeof body.name !== 'string') {
      throw new BadRequestException('Body must be JSON: { "name": "..." }');
    }
    return this.items.create(body.name.trim());
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number) {
    this.items.remove(id);
  }
}
