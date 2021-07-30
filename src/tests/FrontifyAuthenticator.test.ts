import { FrontifyAuthenticator } from '../index';

test('Frontify Authenticator', () => {
  expect(FrontifyAuthenticator('Henrique')).toBe('Hello Henrique');
});