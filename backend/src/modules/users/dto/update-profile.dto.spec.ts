import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

const TEXT_FIELDS = ['displayName', 'bio', 'location', 'avatarUrl'] as const;

async function validateDto(data: Partial<UpdateProfileDto>) {
  const dto = plainToInstance(UpdateProfileDto, data);
  return validate(dto);
}

describe('UpdateProfileDto validation', () => {
  it('accepts an empty payload (every field is optional)', async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it('accepts a full valid payload', async () => {
    const errors = await validateDto({
      displayName: 'Tyler',
      bio: 'JS developer who loves algorithms.',
      location: 'San Francisco, USA',
      avatarUrl: 'https://example.com/avatar.png',
      favoriteLanguages: ['JavaScript', 'TypeScript'],
      favoriteTopics: ['Arrays', 'Graph', 'Dynamic Programming'],
    });
    expect(errors).toHaveLength(0);
  });

  it('trims whitespace from displayName, bio, and location', () => {
    const dto = plainToInstance(UpdateProfileDto, {
      displayName: '  Tyler  ',
      bio: '  hello  ',
      location: '  SF  ',
    });
    expect(dto.displayName).toBe('Tyler');
    expect(dto.bio).toBe('hello');
    expect(dto.location).toBe('SF');
  });

  it('rejects a bio over 300 characters', async () => {
    const errors = await validateDto({ bio: 'a'.repeat(301) });
    expect(errors.some((e) => e.property === 'bio')).toBe(true);
  });

  it('rejects a location over 100 characters', async () => {
    const errors = await validateDto({ location: 'a'.repeat(101) });
    expect(errors.some((e) => e.property === 'location')).toBe(true);
  });

  it.each([null, '', '   '])(
    'clears every optional text field sent as %p',
    async (value) => {
      const data = Object.fromEntries(TEXT_FIELDS.map((f) => [f, value]));
      const dto = plainToInstance(UpdateProfileDto, data);

      expect(await validate(dto)).toHaveLength(0);
      for (const field of TEXT_FIELDS) expect(dto[field]).toBeNull();
    },
  );

  it('leaves omitted fields undefined, so they stay unchanged', () => {
    const dto = plainToInstance(UpdateProfileDto, { bio: 'hello' });

    expect(dto.bio).toBe('hello');
    for (const field of ['displayName', 'location', 'avatarUrl'] as const) {
      expect(dto[field]).toBeUndefined();
    }
  });

  it('empties a favourite list sent as null instead of passing null on', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      favoriteLanguages: null,
      favoriteTopics: null,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect([dto.favoriteLanguages, dto.favoriteTopics]).toEqual([[], []]);
  });

  it('still rejects a text field that is not a string', async () => {
    const errors = await validateDto({ displayName: 42 as unknown as string });
    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });

  it.each([
    'https://example.com/avatar.png',
    'http://cdn.example.com/a.png?size=64',
    'HTTPS://Example.com/a.png',
    'http://localhost:3000/a.png',
  ])('accepts the absolute web URL %s as avatarUrl', async (avatarUrl) => {
    expect(await validateDto({ avatarUrl })).toHaveLength(0);
  });

  it.each([
    'not-a-url',
    'example.com/avatar.png',
    '//example.com/avatar.png',
    '/img/avatar.png',
    'https:example.com/avatar.png',
    'ftp://example.com/avatar.png',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
  ])('rejects %s as avatarUrl', async (avatarUrl) => {
    const errors = await validateDto({ avatarUrl });
    const avatar = errors.find((e) => e.property === 'avatarUrl');
    expect(avatar?.constraints?.isHttpUrl).toBe(
      'avatarUrl must be an absolute http:// or https:// URL',
    );
  });

  it('trims an avatarUrl before checking it', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      avatarUrl: '  https://example.com/a.png  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.avatarUrl).toBe('https://example.com/a.png');
  });

  it('answers an invalid avatarUrl with 400 through the app ValidationPipe', async () => {
    // The application's global pipe - see main.ts.
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const metadata = { type: 'body' as const, metatype: UpdateProfileDto };

    await expect(
      pipe.transform({ avatarUrl: 'ftp://example.com/a.png' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform({ displayName: null, bio: ' ', avatarUrl: '' }, metadata),
    ).resolves.toEqual({ displayName: null, bio: null, avatarUrl: null });
  });

  it('rejects more than 5 favoriteLanguages', async () => {
    const errors = await validateDto({
      favoriteLanguages: ['A', 'B', 'C', 'D', 'E', 'F'],
    });
    expect(errors.some((e) => e.property === 'favoriteLanguages')).toBe(true);
  });

  it('rejects duplicate favoriteLanguages', async () => {
    const errors = await validateDto({
      favoriteLanguages: ['JavaScript', 'JavaScript'],
    });
    expect(errors.some((e) => e.property === 'favoriteLanguages')).toBe(true);
  });

  it('rejects more than 10 favoriteTopics', async () => {
    const errors = await validateDto({
      favoriteTopics: Array.from({ length: 11 }, (_, i) => `topic-${i}`),
    });
    expect(errors.some((e) => e.property === 'favoriteTopics')).toBe(true);
  });

  it('rejects a favoriteTopic longer than 50 characters', async () => {
    const errors = await validateDto({ favoriteTopics: ['a'.repeat(51)] });
    expect(errors.some((e) => e.property === 'favoriteTopics')).toBe(true);
  });
});
