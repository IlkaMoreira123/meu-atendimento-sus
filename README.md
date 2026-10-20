# Meu Atendimento SUS

Aplicativo web para encontrar unidades de saúde próximas, ver como estão as filas, agendar consultas e exames e acompanhar tudo em um só lugar. Feito para ser simples de usar por pessoas de todas as idades: fontes de alta legibilidade (Atkinson Hyperlegible), botões grandes, bom contraste e poucos passos por ação.

> **Este é um MVP com dados de demonstração.** Unidades, vagas, filas e telefones são fictícios e aparecem marcados como “Demonstração”. Nenhum agendamento feito aqui vale para atendimento real. O app **não substitui atendimento de emergência**: em caso de sinais graves, ligue para o SAMU 192.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Sem configuração, o app funciona em **modo demonstração** (dados salvos só no navegador). Contas prontas, todas com a senha `demo1234`:

| Perfil | E-mail |
| --- | --- |
| Cidadã | maria@demo.sus |
| Gestor de unidade (UBS Parque das Acácias e UPA Horizonte) | gestor@demo.sus |
| Administrador | admin@demo.sus |

Outros comandos: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run seed` (regenera `supabase/seed.sql`).

## Usando com Supabase (banco real)

1. Crie um projeto no [Supabase](https://supabase.com).
2. Rode `supabase/migrations/20261019000000_schema.sql` no SQL Editor (ou `supabase db push`).
3. Opcional: rode `supabase/seed.sql` para carregar os dados de demonstração.
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Para tornar alguém administrador: `update profiles set role = 'admin' where email = 'seu@email';`

Com as variáveis definidas, o app usa automaticamente o Supabase (Auth, Postgres e RLS) em vez do modo demonstração.

## Telas

Abertura · Entrar · Criar conta · Recuperar senha · Início · Mapa de unidades · Lista de unidades · Detalhes da unidade · Como estão as filas? (com comparação) · Agendar consulta · Exames (busca, detalhes, preparo) · Agendar exame · Confirmação com protocolo · Meus agendamentos · Histórico · Perfil · Notificações · Painel administrativo (resumo, filas, agendamentos, horários, unidades, usuários).

## Regras de negócio implementadas

- **Sem agendamento duplicado:** no máximo um pedido ativo por especialidade/exame por pessoa.
- **Sem conflito de horário:** a pessoa não pode ter dois compromissos sobrepostos; um horário só aceita um agendamento ativo.
- **Autorização explícita:** especialidades e exames que exigem encaminhamento viram “Aguardando autorização” e nunca aparecem como confirmados até a unidade definir o horário no painel.
- **Status claros:** solicitada, aguardando autorização, confirmada, cancelada e realizada.
- **Cancelar, remarcar e pedir alteração**, com liberação da vaga.
- **Filas transparentes:** todo dado mostra a origem (demonstração, informado pela unidade ou integração oficial) e a hora da atualização. Dados com mais de 1 hora ficam cinza como “desatualizados”. Unidades sem dado aparecem como “Sem informação atual”.
- **Registro de atualizações de fila** com data, hora e responsável.
- **Controle de acesso por perfil:** cidadão, gestor de unidade (só as suas unidades) e administrador.

No Supabase, essas regras são garantidas pelo banco (índices únicos parciais, constraint de exclusão de horários, RLS e funções RPC `security definer`), não só pela interface.

## Privacidade e LGPD

- Coleta mínima no cadastro (nome, e-mail, data de nascimento opcional). CPF e CNS são opcionais, validados e o CPF é exibido mascarado.
- Consentimento explícito no cadastro.
- Notificações do aparelho mostram apenas um texto genérico, sem informação de saúde na tela bloqueada.
- RLS: cada pessoa só lê os próprios agendamentos e notificações; gestores só veem as unidades que administram.

## O que falta integrar para produção

Este MVP **não simula integrações reais**. Para entrar em produção é preciso:

| Item | Situação neste MVP | O que integrar |
| --- | --- | --- |
| Cadastro de unidades | Fictício | CNES (Cadastro Nacional de Estabelecimentos de Saúde) ou base oficial da secretaria |
| Vagas e agendamentos | Agenda própria | Sistema de agendamento/regulação do município (ex.: SISREG ou sistema local) |
| Filas em tempo real | Demonstração ou manual pelo painel | API dos sistemas de senha/acolhimento das unidades (fonte `integracao`) |
| Identidade | E-mail e senha | gov.br e validação do CNS |
| Preparo de exames | Textos de exemplo | Orientações oficiais de cada laboratório/unidade |
| Notificações push | Navegador (Notification API) | Service worker + Web Push / app nativo, SMS |
| Localização por CEP | ViaCEP + bairros de demonstração | Geocodificação completa (endereço → coordenadas) |

O acesso a dados fica todo atrás da interface `DataService` (`src/services/types.ts`). Novas integrações entram como novas implementações, sem mudar as telas.

## Tecnologias

React 19 + TypeScript, Vite, Tailwind CSS 4, React Router, Leaflet/OpenStreetMap, Zod, Supabase (Auth, Postgres, RLS).

## Estrutura

```
src/
  components/   Layout, cartões, mapa, seletor de localização, UI base
  context/      Estado global (usuário, catálogo, filas, localização)
  data/demo.ts  Dados fictícios de demonstração
  lib/          Tipos e utilitários (validação de CPF/CNS, distância, formatação)
  pages/        Telas
  services/     DataService: modo demonstração e Supabase
supabase/
  migrations/   Esquema, RLS e funções de regra de negócio
  seed.sql      Dados de demonstração
```
