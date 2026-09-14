import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { MAX_SOURCE_CODE_LENGTH, SubmitCodeDto } from './dto/submit-code.dto';

// Same options as the global pipe in main.ts.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const validate = (body: unknown) => pipe.transform(body, { type: 'body', metatype: SubmitCodeDto });

describe('Submit/Run request body', () => {
  it('strips anything that tries to decide an outcome', async () => {
    const dto = await validate({
      code: 'function solve() {}',
      solved: true,
      winnerId: 'ryan',
      passedTests: 99,
      status: 'ACCEPTED',
      score: 700,
    });
    expect(dto).toEqual({ code: 'function solve() {}' });
  });

  it('rejects empty, oversized or non-JavaScript submissions', async () => {
    await expect(validate({ code: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate({ code: 'x'.repeat(MAX_SOURCE_CODE_LENGTH + 1) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validate({ code: 'x', language: 'python' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SubmissionsController', () => {
  it('passes only the caller id, route ids and source code to the service', async () => {
    const service = { submit: jest.fn().mockResolvedValue({}), runTests: jest.fn().mockResolvedValue({}) };
    const controller = new SubmissionsController(service as unknown as SubmissionsService);
    const req = { user: { id: 'ryan' } } as any;
    const body = { code: 'src', solved: true, winnerId: 'ryan' } as unknown as SubmitCodeDto;

    await controller.submit(req, 'match-1', 'mc-1', body);
    await controller.run(req, 'match-1', 'mc-1', body);

    expect(service.submit).toHaveBeenCalledWith('ryan', 'match-1', 'mc-1', 'src');
    expect(service.runTests).toHaveBeenCalledWith('ryan', 'match-1', 'mc-1', 'src');
  });
});
