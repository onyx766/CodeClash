import {
  ValidateBy,
  ValidationOptions,
  buildMessage,
  isURL,
} from 'class-validator';

/**
 * True for an absolute http:// or https:// URL. isURL alone also accepts
 * "https:example.com" (no slashes) and, by default, ftp:// links and bare
 * hosts, so the scheme is checked literally too. Hosts without a top-level
 * domain (localhost) are allowed, like any other absolute URL.
 */
export function isHttpUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https?:\/\//i.test(value) &&
    isURL(value, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    })
  );
}

/** Validates that a property is an absolute http:// or https:// URL. */
export function IsHttpUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isHttpUrl',
      validator: {
        validate: (value: unknown) => isHttpUrl(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be an absolute http:// or https:// URL`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
