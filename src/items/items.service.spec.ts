import { ItemsService } from './items.service';
import { NotFoundException } from '@nestjs/common';

describe('ItemsService', () => {
  let svc: ItemsService;
  beforeEach(() => (svc = new ItemsService()));

  it('starts with seed data', () => {
    expect(svc.findAll()).toHaveLength(2);
  });
  it('creates and finds items', () => {
    const created = svc.create('helm');
    expect(svc.findOne(created.id).name).toBe('helm');
  });
  it('throws on unknown id', () => {
    expect(() => svc.findOne(999)).toThrow(NotFoundException);
  });
});
