import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { I18nService, I18nContext } from 'nestjs-i18n';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    jest
      .spyOn(I18nContext, 'current')
      .mockReturnValue({ lang: 'en' } as I18nContext<unknown>);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: I18nService,
          useValue: {
            t: jest.fn().mockReturnValue('Hello world'),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello world"', () => {
      expect(appController.getHello()).toBe('Hello world');
    });
  });
});
