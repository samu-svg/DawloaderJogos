# Auditoria de segurança MontaHD — Ondas 0 a 4

Documento de referência sobre **o que cada onda da auditoria resolveu** (ameaça → mitigação → onde está no código).  
Produção: `https://montahd.vercel.app` · Repositório: `samu-svg/DawloaderJogos`.

---

## Visão geral

O MontaHD combina **site Next.js**, **Supabase**, **R2**, **Stripe** e **app Electron** que escreve arquivos no HD do usuário. A auditoria foi organizada em **ondas** entregues principalmente via:

| Entrega | Branch / PR | Conteúdo |
|---------|-------------|----------|
| **Onda 0** | Já em `main` antes da PR #1 | Vazamento de links, rate limit, paywall, TTL R2 |
| **Ondas 1–3** | PR #1 (`30dd763`) | Desktop, auth servidor, IDOR, SHA-256, sandbox |
| **Onda 4** | PR #2 (`53e68d0`) | SSRF, policy admin, Electron 26, CI, revisão adversarial |
| **Passo 9 (operacional)** | PR #3 + script local | Backfill `sha256` em entries antigas |

---

## Onda 0 — Fechamento do acervo público e controles de borda

**Objetivo:** Impedir que qualquer pessoa baixe o catálogo inteiro sem login/assinatura e endurecer limites na API.

### O que estava em risco

- Policy RLS **`entries_select_public`**: com a chave anônima pública do Supabase (presente no bundle do site), qualquer um podia chamar a API REST e obter `storage_key` / `external_url` — **bypass total do paywall**.
- Rate limit **fail-open** quando Upstash não estava configurado.
- Paywall do manifest **fail-open** se Stripe estivesse desligado sem intenção explícita.
- URLs assinadas do R2 com TTL longo demais (links compartilháveis por horas).

### O que foi resolvido

| Mitigação | Efeito |
|-----------|--------|
| Remoção de `entries_select_public` | Anon/authenticated **não leem** entries; catálogo público só via **service role** no servidor |
| Rate limit com fallback em memória (fail-closed em produção) | Sem Upstash ainda há freio por instância; logs avisam para configurar Redis |
| `manifest-access`: exige `ACERVO_ABERTO=true` explícito se Stripe off | Catálogo não abre “por acidente” |
| TTL default de download R2: **30 min** (teto 6 h) | Links assinados expiram rápido |
| Headers de segurança (CSP, HSTS, frame deny) | XSS, clickjacking, MIME sniffing |
| RBAC inicial no painel | Separação admin / editor / user |
| INSERT de portfólio restrito (admin) | Usuários comuns não criam catálogos |
| Upload R2 autenticado e escopado ao portfólio | Uploads anônimos ou cross-tenant bloqueados |

### Arquivos / migrations principais

- `supabase/migrations/20260829181000_drop_entries_select_public.sql`
- `web/lib/rate-limit.ts`, `web/lib/manifest-access.ts`, `web/lib/storage.ts`
- `web/next.config.ts`, `web/lib/rbac.ts`

---

## Onda 1 — Integridade do desktop e limites de upload

**Objetivo:** Impedir que um zip ou URL maliciosa escreva fora do HD ou instale conteúdo não verificado.

### O que estava em risco

- **Zip-slip**: paths `../` dentro de zips escrevendo fora da pasta raiz escolhida.
- **Deep links arbitrários**: app abrir manifest de origem não confiável.
- **Hosted sem SHA-256**: download sem verificação de integridade.
- Uploads oversized ou tipo incorreto.

### O que foi resolvido

| Mitigação | Efeito |
|-----------|--------|
| Extração zip com rejeição de `..`, symlinks, paths absolutos | Arquivos ficam **dentro** da raiz do HD |
| Allowlist de origem do catálogo (site oficial + localhost dev) | Manifest só de fontes confiáveis |
| SHA-256 obrigatório no manifest para `kind=hosted` | Desktop recusa arquivo sem hash |
| Verificação de hash após download | Bytes corrompidos ou trocados são descartados |
| Limites de MIME/tamanho no upload | Abuso de storage reduzido |
| `owner_id` validado em mutações do painel | Edição cross-tenant bloqueada |

### Arquivos principais

- `desktop/src/main/zip-extract.ts`
- `desktop/src/shared/catalog-launch.ts`, `desktop/src/main/download-pipeline.ts`
- `web/lib/manifest.ts`, `web/lib/upload-limits.ts`

---

## Onda 2 — Identidade, RBAC no banco e sandbox Electron

**Objetivo:** Roles não editáveis pelo cliente; fingerprints de HD criptografados; renderer isolado.

### O que estava em risco

- **`user_metadata` no JWT**: usuário poderia tentar se promover a admin via metadados editáveis.
- **Fingerprints de HD em texto claro** no Postgres se `ENCRYPTION_KEY` faltasse.
- **Electron sem sandbox**: compromisso do renderer → acesso amplo ao sistema.
- Segredos no histórico git (risco operacional).

### O que foi resolvido

| Mitigação | Efeito |
|-----------|--------|
| `profiles.role` e `password_changed_at` em tabela com RLS | Autorização no **banco**, não no JWT editável |
| Policy: só **admin** insere portfólio (via migration) | Criação de catálogo controlada |
| `ENCRYPTION_KEY` obrigatória em produção para HD | Fingerprints em **AES-256-GCM** |
| `sandbox: true`, bloqueio de `window.open`/navegação, IPC validado | Superfície de ataque do Electron reduzida |
| Gitleaks no CI (início) | Scan de secrets em commits |

### Arquivos / migrations principais

- `supabase/migrations/20260829220000_profiles_role_and_password.sql` (versão corrigida na Onda 4)
- `web/lib/hd-access.ts`, `web/lib/crypto.ts`
- `desktop/src/main/main.ts`
- `.github/workflows/gitleaks.yml`

---

## Onda 3 — Auth no servidor, IDOR e pipeline SHA-256

**Objetivo:** Login/cadastro com rate limit; painel só vê o que é do dono; novos uploads sempre com hash; deep links sem token na URL.

### O que estava em risco

- Login/cadastro **só no browser** (Supabase client) — sem rate limit server-side uniforme.
- **IDOR no painel**: editor podia listar/editar portfólios de outros donos.
- Inserts de jogos hosted **sem** SHA-256 no banco.
- Import R2 com prefixo arbitrário.
- Token HMAC em **query string** do deep link (histórico do browser, logs).

### O que foi resolvido

| Mitigação | Efeito |
|-----------|--------|
| `POST /api/auth/login` e `/signup` com rate limit IP + e-mail | Brute force e spam de cadastro mitigados |
| `isTrustedAuthOrigin` em auth POSTs | CSRF extra contra origens estranhas |
| Painel: `owner_id = auth.uid()` em listagem/edição | **IDOR fechado** |
| SHA-256 calculado no upload (streaming) + `requireHostedSha256` no insert | Novos jogos sempre com hash |
| Import/storage keys só em `jogos/` | Não aponta para keys arbitrárias do bucket |
| Deep link sem `token=` na URL | Token não vaza em referrer/histórico |
| Mensagens de auth genéricas | Menos enumeração de usuários |
| Desktop **0.6.0**: fuses + auto-update genérico | Base para updates integrity-checked |

### Arquivos principais

- `web/app/api/auth/login/route.ts`, `signup/route.ts`
- `web/lib/trusted-origin.ts`, `web/lib/sha256-stream.ts`, `web/lib/storage-keys.ts`
- `web/lib/montahd-link.ts`, `web/app/painel/**`
- `desktop/package.json` (0.6.0)

---

## Onda 4 — Revisão adversarial (correções críticas pós-PR #1)

**Objetivo:** Fechar falhas encontradas na revisão **antes** de considerar produção “segura”.

### O que estava em risco

- **Policy admin quebrada**: migration inicial lia `profiles` de forma que **admin promovido não conseguia INSERT** de portfólio (ou policy inconsistente).
- **SSRF** no probe de links externos do painel (metadata cloud, RFC1918).
- **`electronFuses` ignorado** no electron-builder 25 — ASAR integrity etc. não aplicavam.
- **`openExternal` no Windows** via `cmd /c start` — injeção de comando na URL.
- Redirects não confiáveis no fetch do manifest (desktop).
- Hardlinks em zip, delete fora do HD root.
- CI da PR #1 não rodou a tempo; regressions possíveis.

### O que foi resolvido

| Mitigação | Efeito |
|-----------|--------|
| Schema **`private`** + função **`private.is_admin()`** | Policy `portfolios_insert_admin` funciona sem expor schema private na API |
| `safe-external-url.ts` + `download-probe.ts` | SSRF bloqueado (DNS + IPs privados/metadata) |
| `POST /api/auth/change-password` com rate limit | Troca de senha no servidor, throttled |
| **electron-builder 26.15.7** | Fuses passam a valer de verdade |
| `open-external` via **rundll32** (sem shell) | Injeção de comando no Windows fechada |
| `safe-fetch.ts`: redirects same-origin only | Manifest não redireciona para atacante |
| Zip: rejeita **hardlinks**; delete confinado ao HD | Escape via link ou delete arbitrário reduzido |
| `.github/workflows/ci.yml` (web + desktop tests) | 64 + 60 testes na PR #2 |
| `.gitleaks.toml` allowlist | CI útil sem falsos positivos do catálogo |
| Scan git: **sem segredos** no histórico | Confirmado na revisão |

### Arquivos principais

- `supabase/migrations/20260829220000_profiles_role_and_password.sql` (versão PR #2)
- `web/lib/safe-external-url.ts`, `web/lib/download-probe.ts`
- `web/app/api/auth/change-password/route.ts`
- `desktop/src/main/open-external.ts`, `safe-fetch.ts`
- `.github/workflows/ci.yml`

---

## Passos operacionais (fora do código)

Estes passos **complementam** as ondas; o código sozinho não basta.

| Passo | O que resolve | Status típico |
|-------|----------------|---------------|
| **5 — Vercel env** | `ENCRYPTION_KEY`, Upstash, secrets R2/Stripe; **sem** `ACERVO_ABERTO=true` acidental | Manual |
| **6 — Domínio / deploy** | Production em `main` recente; `NEXT_PUBLIC_SITE_URL` correto | Manual |
| **7 — R2** | Public URL / r2.dev **desligados**; bucket privado + URLs assinadas | Feito (`montahd-games`) |
| **8 — Supabase Auth** | Confirm email, leaked passwords, MFA admin, schema `private` **não** exposto | Manual |
| **9 — Backfill SHA-256** | 186 entries antigas sem hash passam a instalar no desktop 0.6.0 **com verificação** | Em curso (`backfill-hosted-sha256.mjs`) |
| **10 — Policy `entries_select_public`** | Confirmar que **não existe** no banco | SQL no Supabase |
| **11 — Desktop 0.6.0** | Publicar `.exe` + `latest.yml` em `/downloads` | Manual |
| **12 — Rotação de chaves** | R2 API token, `MANIFEST_TOKEN_SECRET` após auditoria | Manual |
| **13 — Code signing** | Authenticode Windows (confiança do instalador) | Quando possível |

### Passo 9 — Por que importa (integridade)

Sem SHA-256 no banco, o desktop **0.6.0** recusa hosted ou aceita sem verificar (versões antigas). O backfill:

1. Lê cada `.zip` do R2 (streaming).
2. Calcula SHA-256.
3. Grava só o hash (64 hex) no Supabase.

**Segurança ganha:** detecção de arquivo **trocado**, **corrompido** ou **diferente do catálogo** na instalação.

Script: `web/scripts/backfill-hosted-sha256.mjs`  
Variável crítica descoberta na operação: `R2_BUCKET=montahd-games` (não `montahd`).

---

## Mapa rápido: ameaça → onda

| Ameaça | Onda |
|--------|------|
| Download do acervo via API anon | **0** |
| Brute force login/cadastro | **0** (memória) + **3** (API) + env Upstash |
| Paywall bypass (Stripe off) | **0** |
| Zip-slip / symlink / hardlink | **1** + **4** |
| Manifest / deep link malicioso | **1** + **3** + **4** |
| IDOR painel | **3** |
| Admin via user_metadata | **2** |
| HD fingerprint plaintext | **2** |
| Hosted sem integridade (hash) | **1** (código) + **9** (dados antigos) |
| SSRF no painel | **4** |
| Electron sandbox / fuses / openExternal | **2** + **4** |
| Policy admin quebrada | **4** |
| Secrets no git | **2** (scan) + **4** (CI/allowlist) |

---

## Verificações recomendadas pós-auditoria

```sql
-- Passo 10: policy perigosa não deve existir
select count(*) from pg_policies
where tablename = 'entries' and policyname = 'entries_select_public';
-- Esperado: 0

-- Passo 9: backfill completo
select count(*) from public.entries
where kind = 'hosted' and sha256 is null;
-- Esperado: 0

-- Admin promovido
select id, email, role from public.profiles where role = 'admin';
```

```powershell
# Deploy recente (auth API existe)
curl.exe -s -o NUL -w "%{http_code}" -X POST "https://montahd.vercel.app/api/auth/login" `
  -H "Content-Type: application/json" `
  -H "Origin: https://montahd.vercel.app" `
  -d "{\"email\":\"x@y.com\",\"password\":\"x\"}"
# Esperado: 401 ou 400 (não 404)
```

---

## Referências

- PR #1: ondas 1–3 — merge `30dd763`
- PR #2: onda 4 — merge `53e68d0`
- PR #3: script backfill SHA-256 — branch `cursor/backfill-sha256-600e`
- Plano original: canvas de auditoria MontaHD (agosto/2026)
- README: `web/.env.example`, seção “Regras de segurança” em `README.md`

---

*Documento gerado para acompanhamento da remediação. Atualize este arquivo se novas ondas forem aplicadas.*
