import { Controller } from '@nestjs/common';
import { FsrsSchedulerService } from './fsrs-scheduler.service';

@Controller('fsrs-scheduler')
export class FsrsSchedulerController {
  constructor(private readonly fsrsSchedulerService: FsrsSchedulerService) {}
}
