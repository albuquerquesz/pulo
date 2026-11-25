import { Link } from '@tanstack/react-router';

import type { ContaNaTela } from './logic';

type ContaProps = { conta: ContaNaTela; noPerfil: boolean; className?: string };

/** Avatar, nome, email e a engrenagem que abre o Perfil. */
export function Conta({ conta, noPerfil, className = '' }: ContaProps) {
  return (
    <div role="group" aria-label="Seu perfil" className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sapo text-[17px] font-extrabold text-ink-sobre-acao">
        {conta.nome.trim().charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="truncate">{conta.nome}</b>
        <small className="truncate text-xs text-muted">{conta.email}</small>
      </div>
      <Link
        to="/perfil"
        aria-label="Abrir perfil"
        aria-current={noPerfil ? 'page' : undefined}
        className={`grid size-11 shrink-0 place-items-center rounded-[10px] hover:bg-sapo/14 hover:text-ink md:size-9 ${noPerfil ? 'bg-sapo/14 text-ink' : 'text-muted'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </Link>
    </div>
  );
}
