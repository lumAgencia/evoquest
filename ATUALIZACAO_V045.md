# EVOQUEST v0.45 — módulos completos

## Atualização do Supabase

Execute no SQL Editor, nesta ordem:

1. `supabase/migrations/017_modulos_completos.sql`
2. `supabase/migrations/018_painel_personal_expandido.sql`

As migrações anteriores, de `001` a `016`, devem estar aplicadas.

## Teste local

No terminal do VS Code:

```powershell
npm.cmd install
npm.cmd run test
npm.cmd run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`.

## Roteiro de validação

- Aluno: criar, duplicar, reordenar e excluir um treino.
- Aluno: executar séries, pausar, usar descanso e finalizar o treino.
- Aluno: registrar alimento, favoritar e consultar outro dia.
- Aluno: salvar metas, avaliação e foto de evolução.
- Personal: filtrar alunos e abrir a ficha.
- Personal: visualizar metas e fotos do aluno.
- Personal: salvar e aplicar um modelo de treino.
- Confirmar que alteração de treino do personal aparece na conta do aluno.

## Observação sobre fotos

As fotos de evolução são opcionais. Não devem ser usadas como diagnóstico e o
usuário deve evitar imagens que exponham documentos ou outras informações
pessoais no fundo.
