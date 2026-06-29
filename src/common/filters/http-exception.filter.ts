import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { errorResponse } from '../utils/response.helper';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

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

      return response.status(status).json(errorResponse(message));
    }

    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Something went wrong'));
  }
}
