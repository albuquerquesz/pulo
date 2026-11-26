import { useState, type ReactNode } from 'react';

import { useConsultaDeMidia } from '@/theme';
import { Botao, Modal } from '@/ui';

import { useApp, useCarregar } from '../app';
import { AvisoDoGelo } from './AvisoDoGelo';
import { ReacaoDoSapo } from './ReacaoDoSapo';
import { CartaoDoGelo } from './CartaoDoGelo';
import { Conta } from './Conta';
import { abaAtiva, carregarTrilho, contaNaTela, telaDeImersao } from './logic';
import { Navegacao } from './Navegacao';
import { RostoDoSapo } from './RostoDoSapo';
import { CartaoDaCasa, CartaoDasMetas, NumerosDoDia } from './Trilho';

/** A partir daqui cabem as três colunas do rascunho (barra 312, conteúdo e trilho 460). */
export const CONSULTA_DO_TRILHO = '(min-width: 80rem)';

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-2 text-[22px] font-extrabold">
      <RostoDoSapo className="size-[34px]" />
      Pulo
    </div>
  );
}

type CascaProps = { caminho: string; children: ReactNode };

/**
 * A moldura das telas, como no rascunho: barra lateral, conteúdo e trilho.
 * No celular é uma coluna com o menu embaixo, e o que é do trilho entra no Hoje (acima e abaixo do conteúdo).
 */
export function Casca({ caminho, children }: CascaProps) {
  const { repo, clock, user, pessoa } = useApp();
  const largo = useConsultaDeMidia(CONSULTA_DO_TRILHO);
  const { estado, recarregar } = useCarregar(async () => {
    if (!user) throw new Error('sem usuário');
    return carregarTrilho(repo, clock, user);
  });

  const [lojaDoGelo, setLojaDoGelo] = useState(false);
  const abrirLojaDoGelo = () => setLojaDoGelo(true);

  const imersao = telaDeImersao(caminho);
  const noHoje = caminho === '/';
  const comTrilho = largo && !imersao;
  const noConteudo = !largo && noHoje;
  const dados = estado.tipo === 'ok' ? estado.dados : null;
  const conta = contaNaTela(pessoa, user);
  const noPerfil = caminho === '/perfil';
  const falha =
    estado.tipo === 'erro' ? (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm text-muted">
        Não consegui carregar os números de hoje.
        <Botao titulo="Tentar de novo" variante="fantasma" largura="auto" onPress={() => void recarregar()} />
      </div>
    ) : null;

  return (
    <div className={`md:grid md:min-h-dvh ${comTrilho ? 'md:grid-cols-[312px_minmax(0,1fr)_460px]' : 'md:grid-cols-[312px_minmax(0,1fr)]'}`}>
      <div className="md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:overflow-y-auto md:border-r md:border-line md:bg-surface md:px-4 md:py-6">
        <div className="hidden md:block">
          <Marca />
        </div>
        <Navegacao ativa={abaAtiva(caminho)} />
        <Conta conta={conta} noPerfil={noPerfil} className="hidden px-2 pt-4 md:mt-auto md:flex" />
      </div>

      <div className="min-w-0 pb-20 md:pb-0">
        {noConteudo ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-4 md:max-w-none md:px-10 md:pt-8">
            <Conta conta={conta} noPerfil={noPerfil} className="md:hidden" />
            {dados ? <NumerosDoDia dados={dados} onGelo={abrirLojaDoGelo} /> : falha}
          </div>
        ) : null}
        {children}
        {noConteudo && dados ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-6 md:max-w-none md:px-10 md:pb-12">
            <CartaoDaCasa dados={dados} />
            <CartaoDasMetas metas={dados.metas} />
          </div>
        ) : null}
      </div>

      {comTrilho ? (
        <aside aria-label="Seu dia" className="sticky top-0 flex h-dvh flex-col gap-5 overflow-auto px-6 py-8">
          {dados ? (
            <>
              <NumerosDoDia dados={dados} onGelo={abrirLojaDoGelo} />
              <CartaoDaCasa dados={dados} />
              {caminho === '/metas' ? null : <CartaoDasMetas metas={dados.metas} />}
            </>
          ) : (
            falha
          )}
        </aside>
      ) : null}
      <ReacaoDoSapo />
      {dados ? <AvisoDoGelo dias={dados.gelo?.recentes ?? []} hoje={dados.hoje} /> : null}
      <Modal
        aberto={lojaDoGelo}
        onFechar={() => setLojaDoGelo(false)}
        rotulo="Loja de gelo"
      >
        <CartaoDoGelo />
      </Modal>
    </div>
  );
}
