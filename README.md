# EVOQUEST

Sistema fitness EVOQUEST, recuperado da versão v0.88-rebranding-oficial.

## Desenvolvimento local

Requer Node.js 24.

```bash
npm ci
cp .env.example .env
npm run dev
```

Preencha no `.env` a URL e a chave pública do projeto Supabase existente. Não use `service_role` no frontend e não envie `.env` ao GitHub.

## Publicação no GitHub Pages

```bash
npm run build:pages
```

O resultado fica em `docs/`. Em Settings → Pages, selecione **Deploy from a branch**, branch **main** e pasta **/docs**, e salve.

Endereço previsto após ativar o Pages: https://lumagencia.github.io/evoquest/

Para atualizar, gere novamente `docs/` e envie as alterações ao repositório.

## Supabase

A publicação usa a URL e a chave pública do projeto existente em `src/supabase-config.json`. Essas informações são destinadas ao frontend; a proteção dos dados depende da autenticação e das políticas de acesso do Supabase. Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente de build têm prioridade sobre essa configuração. Nunca coloque chaves secretas ou `service_role` no frontend.

As migrações SQL e a função `delete-account` estão em `supabase/`. Se reutilizar o banco existente, confira o histórico antes de executar migrações. Configure as URLs de autenticação do Supabase para o endereço publicado.

Esta publicação preserva o código da v0.88, com ajustes de caminhos para hospedagem em `/evoquest/`.
