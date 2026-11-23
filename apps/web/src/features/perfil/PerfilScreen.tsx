import type { User } from '@pulo/core/domain/types';
import { useNavigate } from '@tanstack/react-router';

import { authClient } from '@/auth/client';
import { Botao, Cartao, Texto } from '@/ui';

import { confirmar, Secao, Tela, useApp } from '../app';
import { EscolhaDeHora } from './HorarioDoDia';

type OpcaoDeTema = { chave: User['theme']; rotulo: string };

const TEMAS: OpcaoDeTema[] = [
  { chave: 'claro', rotulo: 'Claro' },
  { chave: 'escuro', rotulo: 'Escuro' },
  { chave: 'sistema', rotulo: 'Sistema' },
];

export function PerfilScreen() {
  const { user, atualizarPerfil, apagarDados, demo, demoClock, enableDemo, disableDemo, refresh } = useApp();
  const navigate = useNavigate();
  if (!user) return null;

  const sair = async () => {
    await authClient.signOut();
    await navigate({ to: '/welcome', replace: true });
  };

  const inicio = Math.round(user.dayStartMinutes / 60);
  const fim = Math.round(user.dayEndMinutes / 60);

  const apagar = async () => {
    const ok = await confirmar(
      'Apagar todos os meus dados?',
      'Isso remove seu sapo, sua rotina e seu progresso deste aparelho. Não dá para desfazer.',
    );
    if (ok) await apagarDados();
  };

  return (
    <Tela titulo="Perfil">
      <Texto cor="muted">Seu sapo se chama {user.frogName}.</Texto>

      <Secao titulo="Seu dia">
        <EscolhaDeHora rotulo="Começa às" horas={inicio} min={0} max={Math.min(22, fim - 1)} onChange={(h) => void atualizarPerfil({ dayStartMinutes: h * 60 })} />
        <EscolhaDeHora rotulo="Termina às" horas={fim} min={inicio + 1} max={24} onChange={(h) => void atualizarPerfil({ dayEndMinutes: h * 60 })} />
      </Secao>

      <Secao titulo="Aparência">
        <div className="flex gap-2" role="radiogroup" aria-label="Tema">
          {TEMAS.map((o) => (
            <Cartao
              key={o.chave}
              selecionado={user.theme === o.chave}
              onPress={() => void atualizarPerfil({ theme: o.chave })}
              rotulo={`Tema ${o.rotulo.toLowerCase()}`}
              className="min-h-12 flex-1 justify-center"
            >
              <Texto className="text-center">{o.rotulo}</Texto>
            </Cartao>
          ))}
        </div>
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <Texto como="span" className="flex-1">
            Reduzir movimento
          </Texto>
          <input
            type="checkbox"
            role="switch"
            checked={user.reduceMotion}
            onChange={(e) => void atualizarPerfil({ reduceMotion: e.target.checked })}
            aria-label="Reduzir movimento"
            className="size-6 accent-agua"
          />
        </label>
      </Secao>

      <Secao titulo="Modo demo">
        {demo && demoClock ? (
          <Cartao testID="painel-demo">
            <Texto>Modo demo, dados de exemplo. Nada aqui é seu de verdade.</Texto>
            <Botao titulo="Avançar 1 dia" variante="agua" onPress={() => { demoClock.advanceDays(1); refresh(); }} />
            <Botao titulo="Avançar 1 semana" variante="agua" onPress={() => { demoClock.advanceWeeks(1); refresh(); }} />
            <Botao titulo="Reiniciar o demo" variante="fantasma" onPress={() => void enableDemo()} />
            <Botao titulo="Desligar modo demo" variante="fantasma" onPress={() => void disableDemo()} />
            <Texto variante="legenda" cor="muted">
              Hoje no demo: {demoClock.today()}
            </Texto>
          </Cartao>
        ) : (
          <Cartao onPress={() => void enableDemo()} rotulo="Ligar modo demo, com dados de exemplo">
            <Texto>Ligar modo demo</Texto>
            <Texto variante="legenda" cor="muted">
              Carrega quatro semanas de dados de exemplo, sem mexer nos seus.
            </Texto>
          </Cartao>
        )}
      </Secao>

      <Secao titulo="Seus dados">
        <Botao titulo="Apagar todos os meus dados" variante="fantasma" onPress={() => void apagar()} />
      </Secao>

      <Secao titulo="Sua conta">
        <Botao titulo="Sair da conta" variante="fantasma" onPress={() => void sair()} />
      </Secao>
    </Tela>
  );
}
