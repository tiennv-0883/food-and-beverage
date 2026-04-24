import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { ProductSuggestion } from './product-suggestion.entity';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { QuerySuggestionsDto } from './dto/query-suggestions.dto';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';
import { executeOrThrow, t } from '../shared/util';

@Injectable()
export class ProductSuggestionsService {
  private readonly logger = new Logger(ProductSuggestionsService.name);

  constructor(
    @InjectRepository(ProductSuggestion)
    private readonly repo: Repository<ProductSuggestion>,
    private readonly i18n: I18nService,
  ) {}

  async create(
    userId: string,
    dto: CreateSuggestionDto,
  ): Promise<Record<string, unknown>> {
    const suggestion = await executeOrThrow(
      () =>
        this.repo.save(
          this.repo.create({
            userId,
            title: dto.title,
            description: dto.description ?? null,
          }),
        ),
      t(this.i18n, 'suggestion.create-failed'),
    );
    return this.serializeItem(suggestion);
  }

  async findMine(
    userId: string,
    query: QuerySuggestionsDto,
  ): Promise<Record<string, unknown>> {
    const { status, page = 1, limit = 10 } = query;

    try {
      const qb = this.repo
        .createQueryBuilder('s')
        .where('s.userId = :userId', { userId });

      if (status) qb.andWhere('s.status = :status', { status });

      const [items, total] = await qb
        .orderBy('s.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: items.map((s) => this.serializeItem(s)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (err: unknown) {
      this.logger.error('findMine failed', err);
      throw new InternalServerErrorException(
        t(this.i18n, 'suggestion.fetch-failed'),
      );
    }
  }

  async adminFindAll(
    query: QuerySuggestionsDto,
  ): Promise<Record<string, unknown>> {
    const { status, page = 1, limit = 10 } = query;

    try {
      const qb = this.repo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.user', 'u');

      if (status) qb.where('s.status = :status', { status });

      const [items, total] = await qb
        .orderBy('s.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: items.map((s) => this.serializeDetail(s)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (err: unknown) {
      this.logger.error('adminFindAll failed', err);
      throw new InternalServerErrorException(
        t(this.i18n, 'suggestion.fetch-failed'),
      );
    }
  }

  async adminFindOne(id: string): Promise<Record<string, unknown>> {
    const suggestion = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!suggestion) {
      throw new NotFoundException(
        t(this.i18n, 'suggestion.not-found', { id }),
      );
    }

    return this.serializeDetail(suggestion);
  }

  async updateStatus(
    id: string,
    dto: UpdateSuggestionStatusDto,
  ): Promise<Record<string, unknown>> {
    const suggestion = await this.repo.findOne({ where: { id } });

    if (!suggestion) {
      throw new NotFoundException(
        t(this.i18n, 'suggestion.not-found', { id }),
      );
    }

    await executeOrThrow(
      () =>
        this.repo.update(id, {
          status: dto.status,
          adminNote: dto.adminNote ?? suggestion.adminNote,
        }),
      t(this.i18n, 'suggestion.update-failed'),
    );

    return this.adminFindOne(id);
  }

  private serializeItem(s: ProductSuggestion): Record<string, unknown> {
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      createdAt: s.createdAt,
    };
  }

  private serializeDetail(s: ProductSuggestion): Record<string, unknown> {
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      adminNote: s.adminNote,
      createdAt: s.createdAt,
      user: s.user
        ? { id: s.user.id, name: s.user.name, email: s.user.email }
        : null,
    };
  }
}
