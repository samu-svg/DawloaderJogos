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

Quem controla o acesso aos dados é o próprio banco, através das políticas de
row level security definidas nas migrações. As consultas do site rodam sempre
sob a sessão de quem fez a requisição, então não há como uma rota esquecer de
checar permissão.

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

## Configuração

```bash
cd web
npm install
cp .env.example .env.local   # preencher
npm run dev
```

O acesso ao Supabase já está configurado em `web/.env.local`. Falta preencher as
credenciais do Cloudflare R2, necessárias apenas para hospedar arquivos na
plataforma — portfólios que só apontam para links externos funcionam sem elas.

Para alterar o banco, escreva a migração em `supabase/migrations/` e aplique
pelo painel do Supabase ou pela CLI.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o site em desenvolvimento |
| `npm run build` | Compila para produção |
| `npm test` | Roda os testes de validação de caminho |
| `npm run lint` | Verifica o estilo do código |

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
