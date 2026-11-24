# Entrega: checklist e publicação web (spec 10)

Prazo: 30/11/2026 às 23h59. Alvo interno: 30/11 às 18h. Congelamento de commits de 30/11 23h59 até a final (12/12).

## Publicação web
- O web (`apps/web`, TanStack Start) e a API sobem no Cloudflare Workers pelo CI a cada push na `main`.
- Conferir em https://pulo-web.albqvictor.workers.dev a rota inicial, uma rota profunda e o `?demo=1`.
- A demo deve ficar no ar durante toda a avaliação e depois do congelamento.

## Modo demo
- `seedRepository(repo, clock)` em `src/demo` carrega 4 semanas sintéticas (seed fixa) e deixa o sapo na fase 4.
- Relógio: `createDemoClock()` com `advanceDays`, `advanceWeeks`, `reset`. Início: domingo 22/11/2026 às 20h.
- Selo na interface: "Modo demo, dados de exemplo".
- IA no demo: sem função de servidor, vale a regra e o rótulo "Sugestão". Só diga "IA" no vídeo se a função respondeu de fato.

## Função de servidor da IA
- Código em `server/weekly-ai.ts` (provedor falso por padrão). Chave só em variáveis de ambiente do host: `PULO_AI_PROVIDER`, `PULO_AI_API_KEY`. Nunca no repositório nem no app.

## Checklist do painel
- [ ] Nome, frase de apresentação, descrição, trilha Saúde e bem estar
- [ ] Link do repositório (público, criado depois de 4/11 às 21h, sem fork, sem histórico importado)
- [ ] Link da demo no ar, sem login
- [ ] Link do vídeo (até 3 min, sem login, em português)
- [ ] Aceite do regulamento

## Checagens
- [ ] `npm test` e `npm run typecheck` sem erro
- [ ] `npm run build` sem erro e o web publicado abre
- [ ] Busca por chave ou segredo no repositório: `git grep -nEi "api[_-]?key|secret|token|sk-"` sem achados reais
- [ ] `git log --reverse --format='%H %ad' | head -1` posterior a 4/11 às 21h
- [ ] Licença que permite ler, executar e testar (MIT, decisão do Victor); README com como rodar e ativar o demo
- [ ] Repositório público até 15/12
- [ ] Nenhum dado pessoal real no demo
- [ ] Finalistas em 2/12, confirmar presença até 4/12, final presencial em São Paulo em 12/12

## Roteiro do vídeo (3 min)
0:00 problema e público; 0:20 sapo e lagoa; 0:40 um dia (hábitos, foco, bloco concluído); 1:20 sapo cansado, descanso conta; 1:50 a semana lida, o sapo surpreso, aprovação (rótulo verdadeiro); 2:30 a lagoa evoluiu; 2:50 fechamento e link da demo.
