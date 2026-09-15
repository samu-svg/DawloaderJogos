# Google Search Console — MontaHD

O site já emite a meta tag de verificação quando `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` está definida (ver `web/lib/seo.ts`).

## 1. Criar a propriedade

1. Acesse [Google Search Console](https://search.google.com/search-console).
2. **Adicionar propriedade** → tipo **Prefixo do URL**.
3. Use: `https://www.montahds.app` (e repita depois para `https://montahds.app` se quiser cobrir os dois).

## 2. Verificar com meta tag (recomendado)

1. Método: **Tag HTML**.
2. O Google mostra algo como:
   ```html
   <meta name="google-site-verification" content="SEU_CODIGO_AQUI" />
   ```
3. Copie **somente** o valor de `content` (ex.: `a1B2c3D4...`).

### Local (dev)

Em `web/.env.local`:

```env
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=SEU_CODIGO_AQUI
```

Reinicie `npm run dev` e confira o HTML da home (View Source) — deve aparecer a meta `google-site-verification`.

### Produção (Vercel)

```powershell
cd web
npx vercel env add NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION production
# Cole o código quando pedir
```

Ou no painel: **Vercel → Project dawloader → Settings → Environment Variables**.

Depois: **Redeploy** (push em `main` ou Redeploy no painel).

4. Volte ao Search Console e clique em **Verificar**.

## 3. Enviar o sitemap

Após verificar:

1. Search Console → **Sitemaps**.
2. URL do sitemap: `https://www.montahds.app/sitemap.xml`
3. Enviar.

O sitemap inclui a home, `/app`, `/cadastro` e todas as páginas `/jogo/[slug]`.

## 4. Conferir indexação

- **Inspeção de URL** → teste `https://www.montahds.app/`
- **Páginas** → veja quantas URLs o Google indexou (demora dias/semanas)

## Opcional: Google Analytics

Se usar GA4, defina também:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Isso não substitui o Search Console; os dois se complementam.
