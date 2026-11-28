import { SapoRosto } from "@/mascot";
import { Copyright, TelaDeEstado } from "@/ui";

import { Tela, useApp } from "../app";
import { BosqueDeFundo } from "./BosqueDeFundo";
import { erroDoLoginNaUrl } from "./erroDoLogin";

/** O G colorido do Google, no botão de entrar. */
function LogoDoGoogle() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[22px]">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export const TEXTO_SEM_SINAL =
  "A lagoa ficou sem sinal. Confira a internet e tente de novo.";

/** Porta do app: sem sessão. Também mostra "sem sinal" quando há sessão mas o servidor não respondeu. */
export function WelcomeScreen() {
  const {
    fase,
    entrar,
    entrando,
    erroDeLogin,
    loginDisponivel,
    tentarDeNovo,
  } = useApp();

  // A welcome só aparece no navegador, depois da abertura: no servidor não há URL para ler.
  const erro = erroDeLogin ?? (typeof window === "undefined" ? null : erroDoLoginNaUrl(window.location.search));

  if (fase === "sem_conexao") {
    return (
      <Tela>
        <TelaDeEstado
          momento="sem-sinal"
          titulo="Sem sinal por aqui"
          texto={TEXTO_SEM_SINAL}
          acao={{ titulo: "Tentar de novo", onPress: () => void tentarDeNovo() }}
        />
      </Tela>
    );
  }

  return (
    <div className="entrada-bosque relative min-h-dvh">
      <BosqueDeFundo />
      <main className="relative z-1 grid min-h-dvh place-items-center px-4 pt-28 pb-24">
        <section
          aria-labelledby="titulo-da-entrada"
          className="relative flex min-h-[325px] w-full max-w-[480px] flex-col rounded-[28px] border-4 border-(--b-contorno) bg-(--b-folha) px-[22px] pt-[44px] pb-4 text-center text-(--b-tinta) shadow-[0_6px_0_rgba(59,42,47,0.2),0_14px_28px_rgba(59,42,47,0.12)] md:min-h-[370px] md:px-11 md:pt-[54px] md:pb-5"
        >
          <SapoRosto momento="boas-vindas" className="absolute -top-[68px] left-1/2 w-36 -translate-x-1/2 md:-top-[76px] md:w-[160px]" />
          <h1 id="titulo-da-entrada" className="text-[26px] leading-[1.1] font-black md:text-[34px]">
            Boas-vindas ao Pulo
          </h1>
          <p className="mt-3 text-base leading-[1.45] font-semibold text-(--b-apagado) md:text-[17px]">
            Pequenos pulos, todo dia. Cuide da sua rotina e veja a terra do sapo crescer.
          </p>
          <button
            type="button"
            onClick={() => void entrar()}
            disabled={!loginDisponivel || entrando}
            aria-busy={entrando}
            data-testid="entrar-google"
            className="mt-12 flex min-h-[58px] md:mt-16 w-full cursor-pointer items-center justify-center gap-3 rounded-[18px] border-4 border-(--b-contorno) bg-white text-[17px] font-black text-(--b-tinta) shadow-[inset_0_-5px_0_var(--b-linha)] enabled:active:translate-y-[3px] enabled:active:shadow-[inset_0_-2px_0_var(--b-linha)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {entrando ? (
              <span aria-hidden="true" className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
            ) : (
              <LogoDoGoogle />
            )}
            Entrar com Google
          </button>
          {erro ? (
            <p role="alert" className="mt-4 font-extrabold text-(--b-tinta)">
              {erro}
            </p>
          ) : null}
          <Copyright />
        </section>
      </main>
    </div>
  );
}
