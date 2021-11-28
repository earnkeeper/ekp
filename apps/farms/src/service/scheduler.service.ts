import { Injectable } from '@nestjs/common';
import { FarmService } from './farm.service';
import { FarmContractService } from '../farm-contract.service';

@Injectable()
export class SchedulerService {
  constructor(
    private farmService: FarmService,
    private farmContractService: FarmContractService,
  ) {}

  async onApplicationBootstrap() {
    await this.farmService.loadStarterFarms();

    const farms = await this.farmService.getCurrentFarms();

    const farmsWithContractDetails =
      await this.farmContractService.getFarmsWithContractDetails(farms);

    this.farmService.save(farmsWithContractDetails);
  }
}
