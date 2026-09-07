import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

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

  it('rejects an empty displayName', async () => {
    const errors = await validateDto({ displayName: '' });
    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });

  it('rejects an invalid avatarUrl', async () => {
    const errors = await validateDto({ avatarUrl: 'not-a-url' });
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
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
