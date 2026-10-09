# home.docs

Biblioteca visual de arquivos, pastas e categorias com Supabase Auth, Database e Storage privados.

## Desenvolvimento

```bash
npm install
npm run dev
```

## E-mails de convite com Resend

Os convites são enviados por uma função de servidor da Vercel em `api/send-invite.js`. A chave da Resend **não deve ser adicionada ao React, ao GitHub nem a variáveis `VITE_*`**.

No projeto **homedocs** no painel da Vercel, abra **Settings → Environment Variables** e cadastre:

| Nome | Valor |
| --- | --- |
| `RESEND_API_KEY` | Chave secreta criada no painel da Resend |
| `RESEND_FROM_EMAIL` | Remetente validado na Resend, por exemplo `home.docs@seudominio.com.br` |

Selecione **Production** (e Preview/Development apenas se desejar testar nesses ambientes) e execute um novo deploy após salvar as variáveis.

O endereço remetente deve usar um domínio verificado na Resend. O domínio `homedocs.vercel.app` é usado para acessar a plataforma, mas não é automaticamente autorizado como domínio de envio.

Fluxo: após gravar a permissão `viewer` ou `editor` no Supabase, o frontend chama `POST /api/send-invite` com o token de autenticação. A função consulta as permissões com as políticas RLS da conta autenticada e só então envia o e-mail via Resend.

A API da Resend não substitui o Supabase para autenticação, armazenamento e permissões: ela é usada **somente para enviar e-mails**.

## Variáveis opcionais do Supabase

`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` configuram o cliente. Existem valores públicos de fallback para o projeto home.docs. Não use service role no navegador.

## Observações

- O plano de hospedagem, o domínio de envio e os limites da Resend podem restringir os envios.
- Nunca envie a chave secreta pelo chat ou faça commit de arquivos `.env`.
- Para testar a função `/api/send-invite`, use a Vercel, pois o servidor de desenvolvimento Vite isolado não executa automaticamente essa rota.
