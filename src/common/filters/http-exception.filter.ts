import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { errorResponse } from '../utils/response.helper';

function resolveErrorType(exception: HttpException): string {
  if (exception instanceof BadRequestException) {
    const res = exception.getResponse() as Record<string, unknown>;
    if (Array.isArray(res['message'])) return 'ValidationError';
    return 'BadRequest';
  }
  if (exception instanceof NotFoundException) return 'NotFound';
  if (exception instanceof UnauthorizedException) return 'Unauthorized';
  if (exception instanceof ForbiddenException) return 'Forbidden';
  if (exception instanceof ConflictException) return 'Conflict';
  return 'BadRequest';
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const errorType = resolveErrorType(exception);

      let message: string | string[];

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(res['message'])) {
          message = res['message'] as string[];
        } else if (typeof res['message'] === 'string') {
          message = res['message'];
        } else {
          message = exception.message;
        }
      } else {
        message = String(exceptionResponse);
      }

      return response.status(status).json(errorResponse(message, errorType));
    }

    this.logger.error(exception);
    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Something went wrong', 'ServerError'));
  }
}
