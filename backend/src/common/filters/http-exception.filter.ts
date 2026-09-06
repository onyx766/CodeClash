import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (isErrorBody(body)) {
        response.status(status).send({
          success: false,
          error: { code: body.code, message: body.message },
        });
        return;
      }

      // Validation errors and other Nest-generated HttpExceptions
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] })?.message ??
            exception.message);

      response.status(status).send({
        success: false,
        error: {
          code: status === 400 ? 'VALIDATION_ERROR' : 'ERROR',
          message: Array.isArray(message) ? message.join(', ') : message,
        },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  }
}
