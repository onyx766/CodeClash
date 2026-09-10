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
        // Forward any extra fields an AppException attached (e.g.
        // MATCH_ALREADY_FOUND's matchId) alongside the standard code/message.
        const { code, message, ...extra } = body;
        response.status(status).send({
          success: false,
          error: { code, message, ...extra },
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

    // body-parser rejects an oversized body before any controller runs, and
    // throws a plain Error rather than an HttpException. Without this it would
    // surface as an opaque 500.
    if (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { type?: string }).type === 'entity.too.large'
    ) {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).send({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The request body is too large.',
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
