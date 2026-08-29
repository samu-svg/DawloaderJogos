# MontaHD

Plataforma onde qualquer pessoa monta um **portfólio** — uma lista de arquivos com a
pasta de destino de cada um — e um aplicativo de desktop baixa tudo e organiza
direto no HD do usuário final.

## Estrutura do projeto

```
web/                    Site e API (Next.js 16, React 19, Tailwind 4)
desktop/                App Electron que baixa e organiza no HD
supabase/migrations/    Histórico do banco de dados
```

## Como as peças conversam

1. O dono do portfólio cadastra os arquivos no site e define, para cada um, a
   pasta de destino relativa (`Games/MeuArquivo.iso`).
2. O aplicativo de desktop lê `GET /api/portfolios/{slug}/manifest`, que devolve
   a lista completa com links de download já prontos.
3. O usuário escolhe uma pasta raiz (o HD), confere a prévia do que será
   escrito e confirma.
4. O aplicativo baixa cada arquivo, confere o SHA-256 e grava no destino.

Arquivos hospedados na plataforma ficam no Cloudflare R2 e são entregues por
link assinado temporário, direto do R2 para o usuário — nunca passam pelo
servidor do site. Isso mantém o download rápido, permite retomar de onde parou
e evita cobrança de banda.

Quem controla o acesso aos dados é o **Prisma + RBAC** (`admin`, `editor`, `user`)
sobre o Postgres. A sessão vem do **Supabase Auth** (e-mail e senha). Constraints de
path no banco continuam valendo; o PostgREST (anon/authenticated) não recebe
GRANT nas tabelas.

## Regras de segurança

Um programa que escreve arquivos de terceiros em pastas escolhidas por terceiros
é um vetor de malware se for ingênuo. As travas:

- **Nada sai da pasta raiz.** Caminhos absolutos, com letra de unidade, UNC ou
  contendo `..` são rejeitados em três camadas: ao salvar (`web/lib/manifest.ts`),
  por restrição do banco (`entries_destination_relative`) e de novo ao montar o
  manifesto.
- **Nada é executado.** O aplicativo apenas copia arquivos.
- **Verificação por hash.** Arquivo cujo SHA-256 não bate é descartado.
- **Confirmação explícita.** A lista de destinos aparece antes de qualquer
  escrita em disco.
- **Sem colisões.** Dois arquivos não podem apontar para o mesmo destino
  (índice único em `lower(destination)`).
- **Senha forte.** Cadastro exige no mínimo 12 caracteres; o app força troca a
  cada 90 dias (`/conta`).
- **RBAC.** `admin` cria/apaga portfólios; `editor` edita o catálogo; `user`
  assina e baixa.
- **Rate limit.** `/api/*` limitado por IP (Upstash + WAF na borda).
- **Criptografia.** Senhas no Supabase Auth; fingerprints de HD em AES-256-GCM.
  Tokens de manifesto continuam HMAC-SHA256.
- **Auditoria.** Eventos vão para Logtail e para `audit_events`.

## HTTPS, WAF e Cloudflare

1. Aponte o DNS do domínio para a Cloudflare (nuvem laranja) com origin Vercel.
2. SSL/TLS: **Full (strict)**. Ative Always Use HTTPS e Automatic HTTPS Rewrites.
3. WAF: managed rules OWASP + Bot Fight. Challenge em `/login` e `/cadastro` se
   houver abuso.
4. Na Vercel: Firewall com `rate_limit` em `/api` (ex.: 100 req/min por IP) e
   managed rulesets. Attack Mode só em incidente.

```bash
cd web
npx vercel firewall rules add "Rate limit API" \
  --condition '{"type":"path","op":"pre","value":"/api"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 100 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --yes
npx vercel firewall publish --yes
```

## Variáveis de ambiente (Vercel Env Manager)

```bash
cd web
npx vercel link
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
npx vercel env pull .env.local
```

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `LOGTAIL_SOURCE_TOKEN`,
`STRIPE_*`, `R2_*`, `MANIFEST_TOKEN_SECRET`) devem estar
como **Sensitive**. Só `NEXT_PUBLIC_*` vai ao browser.

## Backup e recuperação

| Recurso | Política |
| --- | --- |
| Postgres | Backups automáticos / PITR no Supabase. RPO 24h (ou PITR se o plano tiver). |
| R2 | Versionamento do bucket + lifecycle ~30 dias. |
| Restore | Restaurar Postgres no painel do Supabase e redeploy Vercel. |
| RTO | Re-deploy + restore do dump: minutos a poucas horas. |

Cheque local: `npm run backup-check`.

## Configuração

```bash
cd web
npm install
cp .env.example .env.local   # ou: npx vercel env pull .env.local
# preencha Supabase (URL, anon e service role), ENCRYPTION_KEY, etc.
npm run dev
```

Aplique as migrações em `supabase/migrations/` no Postgres. O login e os
dados passam pelo **Supabase Auth** e pelas **policies RLS**. Os UUIDs das
contas não mudam.

No painel do Supabase (Authentication): confirme e-mail no cadastro e, se quiser,
política de senha mínima de 12 caracteres.

Para hospedar jogos no Cloudflare R2, preencha `R2_*`. Portfólios só com links
externos funcionam sem R2.

Para alterar o banco, escreva a migração em `supabase/migrations/` e aplique
pelo painel do Supabase ou pela CLI.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o site em desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run test` | Roda os testes de validação de caminho |
| `npm run lint` | Verifica o estilo do código |
| `npm run backup-check` | Confirma que o projeto Supabase está definido |

## App de desktop

O aplicativo Electron lê o manifesto de um portfólio público, mostra a prévia
de onde cada arquivo será gravado e baixa tudo na pasta raiz que você escolher
(no HD externo, por exemplo).

```bash
cd desktop
npm install
npm run dev
```

No app:

1. Informe a URL do site (ex.: `http://localhost:3000`) e o slug do portfólio.
2. Clique em **Carregar manifesto**.
3. Escolha a **pasta raiz** do HD.
4. Marque os arquivos desejados e clique em **Iniciar download**.

O app nunca executa arquivos — apenas copia. Se o manifesto incluir SHA-256, o
hash é verificado antes de finalizar. Downloads interrompidos retomam de onde
pararam (arquivo `.montahd.partial`).

Para gerar um instalador Windows:

```bash
cd desktop
npm run dist
```
