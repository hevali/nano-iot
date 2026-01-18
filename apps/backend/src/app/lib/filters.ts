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
import { HttpAdapterHost } from '@nestjs/core';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { EntityNotFoundError, QueryFailedError, TypeORMError } from 'typeorm';
import { ZodError } from 'zod';

function isMqttContext(host: ArgumentsHost) {
  return host.getType().startsWith('mqtt');
}

@Catch()
export class AnyExceptionFilter<T = unknown> implements ExceptionFilter<T> {
  private logger = new Logger(AnyExceptionFilter.name);

  constructor(private readonly host: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (isMqttContext(host)) {
      return;
    }

    const error =
      exception instanceof HttpException
        ? exception
        : new InternalServerErrorException('Unknown error');
    if (error instanceof InternalServerErrorException) {
      this.logger.error('Unhandled exception occurred', exception);
    }

    const { httpAdapter } = this.host;
    const ctx = host.switchToHttp();
    httpAdapter.reply(ctx.getResponse(), error.getResponse(), error.getStatus());
  }
}

type ZodException = ZodError | ZodSerializationException | ZodValidationException;

@Catch(ZodError, ZodSerializationException, ZodValidationException)
export class ZodErrorFilter extends AnyExceptionFilter<ZodException> {
  override catch(exception: ZodException, host: ArgumentsHost) {
    if (isMqttContext(host)) {
      return;
    }

    const zodError = exception instanceof ZodError ? exception : exception.getZodError();
    if (zodError instanceof ZodError) {
      super.catch(new BadRequestException(zodError.message), host);
    } else {
      super.catch(new BadRequestException(exception.message), host);
    }
  }
}

@Catch(TypeORMError)
export class TypeormErrorFilter extends AnyExceptionFilter<TypeORMError> {
  override catch(exception: TypeORMError, host: ArgumentsHost): void {
    if (isMqttContext(host)) {
      return;
    }

    const error = toHttpException(exception);
    super.catch(error, host);
  }
}

export function toHttpException(exception: TypeORMError): HttpException {
  if (exception instanceof QueryFailedError) {
    return new BadRequestException('Invalid request');
  } else if (exception instanceof EntityNotFoundError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const className = (exception.entityClass as any)?.prototype.constructor.name.replace(
      'Entity',
      '',
    );
    return new NotFoundException(`${className || 'Resource'} not found`);
  }
  return new InternalServerErrorException('Unknown error');
}
