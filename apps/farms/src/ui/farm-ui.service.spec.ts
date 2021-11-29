import { CurrencyService } from '@app/sdk';
import { Test, TestingModule } from '@nestjs/testing';
import { FarmUiService } from './farm-ui.service';

describe('UiService', () => {
  let service: FarmUiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FarmUiService],
    })
      .useMocker((token) => {
        if (token === CurrencyService) {
          return {};
        }
      })
      .compile();

    service = module.get<FarmUiService>(FarmUiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});