import { Injectable, NotFoundException } from '@nestjs/common';

export interface Item {
  id: number;
  name: string;
  createdAt: string;
}

/**
 * In-memory store: intentionally NOT shared between replicas.
 * In the training this makes a great demonstration that Pods are ephemeral and
 * why state belongs outside the Pod (each replica returns different items).
 */
@Injectable()
export class ItemsService {
  private seq = 3;
  private items: Item[] = [
    { id: 1, name: 'kubernetes', createdAt: new Date().toISOString() },
    { id: 2, name: 'nestjs', createdAt: new Date().toISOString() },
  ];

  findAll(): Item[] {
    return this.items;
  }

  findOne(id: number): Item {
    const item = this.items.find((i) => i.id === id);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  create(name: string): Item {
    const item: Item = { id: this.seq++, name, createdAt: new Date().toISOString() };
    this.items.push(item);
    return item;
  }

  remove(id: number): void {
    this.findOne(id);
    this.items = this.items.filter((i) => i.id !== id);
  }
}
