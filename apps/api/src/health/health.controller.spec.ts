import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DRIZZLE_DB } from '../db/database.module';

describe('HealthController', () => {
  const build = async (execute: jest.Mock) => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DRIZZLE_DB, useValue: { execute } },
      ],
    }).compile();
    return module.get(HealthController);
  };

  describe('GET /health', () => {
    it('answers without touching the database', async () => {
      const execute = jest.fn();
      const controller = await build(execute);

      expect(controller.check()).toEqual({ status: 'ok' });
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('reports ok when the database answers', async () => {
      const controller = await build(jest.fn().mockResolvedValue({ rows: [] }));

      await expect(controller.ready()).resolves.toMatchObject({
        status: 'ok',
        db: 'ok',
      });
    });

    it('answers 503 when the database cannot be reached', async () => {
      const controller = await build(
        jest.fn().mockRejectedValue(new Error('down')),
      );

      await expect(controller.ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
