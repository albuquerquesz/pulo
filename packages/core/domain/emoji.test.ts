import { ehUmEmoji } from './emoji';

describe('ehUmEmoji', () => {
  test('aceita um emoji, mesmo composto', () => {
    for (const emoji of ['🌱', '👨‍👩‍👧', '🇧🇷', '👍🏽', '☀️', '1️⃣']) expect(ehUmEmoji(emoji)).toBe(true);
  });

  test('recusa texto, número e dois emojis', () => {
    for (const texto of ['a', 'abc', '7', '🌱🌱', '🌱a', '']) expect(ehUmEmoji(texto)).toBe(false);
  });
});
