import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ZodSerializationException } from 'nestjs-zod';
import { EntityNotFoundError, QueryFailedError, TypeORMError } from 'typeorm';
import { ZodError } from 'zod';

function isMqttContext(host: ArgumentsHost) {
  return host.getType().startsWith('mqtt');
}

@Catch()
export class AnyExceptionFilter implements ExceptionFilter {
  private logger = new Logger(AnyExceptionFilter.name);

  constructor(private readonly host: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (isMqttContext(host)) {
      return;
    }

    const { httpAdapter } = this.host;

    const ctx = host.switchToHttp();

    const error =
      exception instanceof HttpException
        ? exception
        : new InternalServerErrorException('Unknown error');

    if (error instanceof InternalServerErrorException) {
      this.logger.error('Unhandled exception occurred', exception);
    }

    httpAdapter.reply(ctx.getResponse(), error.getResponse(), error.getStatus());
  }
}

@Catch(HttpException)
export class ZodErrorFilter extends BaseExceptionFilter {
  override catch(exception: HttpException, host: ArgumentsHost) {
    if (isMqttContext(host)) {
      return;
    }

    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError();
      if (zodError instanceof ZodError) {
        super.catch(new BadRequestException(zodError.message), host);
        return;
      }
    }

    super.catch(exception, host);
  }
}

@Catch(TypeORMError)
export class TypeormErrorFilter extends AnyExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (isMqttContext(host)) {
      return;
    }

    const error = getHttpError(exception as TypeORMError);
    super.catch(error, host);
  }
}

export function getHttpError(exception: TypeORMError): HttpException {
  if (exception instanceof QueryFailedError) {
    return new BadRequestException('Invalid request');
  } else if (exception instanceof EntityNotFoundError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const className = (exception.entityClass as any)?.prototype.constructor.name.replace(
      'Entity',
      ''
    );
    return new NotFoundException(`${className || 'Resource'} not found`);
  }
  return new InternalServerErrorException('Unknown error');
}
