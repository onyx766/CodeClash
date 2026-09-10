import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ChallengeNotFoundException } from '../exceptions/app.exception';

function hostWith() {
  const send = jest.fn();
  const status = jest.fn(() => ({ send }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, send };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  it('forwards an AppException as its code/message envelope', () => {
    const { host, status, send } = hostWith();

    filter.catch(new ChallengeNotFoundException(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'CHALLENGE_NOT_FOUND', message: 'Challenge not found.' },
    });
  });

  it('maps a validation error to VALIDATION_ERROR', () => {
    const { host, status, send } = hostWith();

    filter.catch(
      new HttpException({ message: ['title is too short'] }, HttpStatus.BAD_REQUEST),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'title is too short' },
    });
  });

  it('maps an oversized body to 413 instead of an opaque 500', () => {
    // body-parser throws a plain Error with `type` set, before any controller
    // runs - which is what an oversized challenge import hits.
    const { host, status, send } = hostWith();
    const oversized = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
    });

    filter.catch(oversized, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
      },
    });
  });

  it('still reports an unknown error as a 500 without leaking details', () => {
    const { host, status, send } = hostWith();

    filter.catch(new Error('database password is hunter2'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
  });
});
