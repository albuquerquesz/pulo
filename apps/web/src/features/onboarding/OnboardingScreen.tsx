import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { SapoRosto } from '@/mascot';
import { Botao, Texto } from '@/ui';

import { ONBOARDING_PADRAO, Tela, useApp } from '../app';
import { EscolhaDeHora } from '../perfil/HorarioDoDia';

export function OnboardingScreen() {
  const { concluirOnboarding } = useApp();
  const navigate = useNavigate();
  const [nome, setNome] = useState(ONBOARDING_PADRAO.frogName);
  const [inicio, setInicio] = useState(ONBOARDING_PADRAO.startHour);
  const [fim, setFim] = useState(ONBOARDING_PADRAO.endHour);
  const [salvando, setSalvando] = useState(false);

  const comecar = async () => {
    setSalvando(true);
    try {
      await concluirOnboarding({ frogName: nome, startHour: inicio, endHour: fim });
      await navigate({ to: '/', replace: true });
    } catch {
      // O aviso de erro já foi mostrado pelo repositório; a pessoa pode tentar de novo.
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela>
      <div className="flex justify-center">
        <SapoRosto momento="boas-vindas" className="w-[180px]" />
      </div>
      <Texto como="h1" variante="display">
        Oi, eu sou o Pulo
      </Texto>
      <Texto cor="muted">Vamos cuidar da sua lagoa juntos, no seu ritmo. Só três coisas antes de começar.</Texto>

      <label className="flex flex-col gap-2">
        <Texto como="span" variante="subtitulo">
          Como vai se chamar seu sapo?
        </Texto>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Pulo"
          maxLength={24}
          aria-label="Nome do sapo"
          data-testid="nome-do-sapo"
          className="min-h-12 rounded-[16px] border-2 border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted"
        />
      </label>

      <section className="flex flex-col gap-2">
        <Texto como="h2" variante="subtitulo">
          Seu dia
        </Texto>
        <EscolhaDeHora rotulo="O dia começa às" horas={inicio} min={0} max={Math.min(22, fim - 1)} onChange={setInicio} />
        <EscolhaDeHora rotulo="O dia termina às" horas={fim} min={inicio + 1} max={24} onChange={setFim} />
      </section>

      <Botao titulo="Começar" carregando={salvando} onPress={() => void comecar()} testID="comecar" />
    </Tela>
  );
}
