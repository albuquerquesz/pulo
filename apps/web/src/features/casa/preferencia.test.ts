import { temPreferencias } from '../app/conta';
import { criarSessaoDemo } from '../app/demo';
import { carregarHoje } from '../hoje/logic';
import { carregarCasa } from './logic';

test('a duração de foco das preferências vale na Casa e no Hoje', async () => {
  const { repo, clock } = await criarSessaoDemo();
  if (!temPreferencias(repo)) throw new Error('o demo precisa de preferências');
  await repo.savePreferences({ focusMinutes: 40 });
  const user = await repo.getUser();
  if (!user) throw new Error('sem usuário');
  expect((await carregarCasa(repo, clock, user, {})).minutosPreferidos).toBe(40);
  // Sem rotina não há próximo bloco: o Hoje oferece a duração preferida.
  for (const bloco of await repo.listBlocks()) await repo.deleteBlock(bloco.id);
  expect((await carregarHoje(repo, clock, user, 'Ana')).foco.minutos).toBe(40);
});
