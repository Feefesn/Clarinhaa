# Clarinha's Personal — Coco da Malásia

Site de personal trainer com uma camada opcional de engajamento chamada **Modo Coco da Malásia**, protagonizada pela Marie.

## Site oficial

**https://feefesn.github.io/Clarinhaa/**

## Publicação no GitHub Pages

1. Envie o conteúdo deste pacote para a raiz do repositório `Clarinhaa`.
2. No GitHub, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch `main`, a pasta `/ (root)` e salve.
5. Aguarde o GitHub concluir a publicação.

Todos os caminhos do PWA e o Redirect URI do Spotify já estão configurados para:

```text
https://feefesn.github.io/Clarinhaa/
```

No painel de desenvolvedor do Spotify, cadastre essa URL **exatamente igual**, incluindo a barra final, em **Redirect URIs**.

## Recursos principais

- Gestão e execução de treinos.
- Histórico, medidas, fotos e evolução.
- Interface mobile-first e acessível.
- PWA instalável e cache offline básico.
- Spotify via Authorization Code com PKCE.
- Modo Clássico.
- Modo Coco da Malásia com Marie, missões, moedas, loja, closet, casa, álbum, temporadas, sons e feedback tátil.

## Persistência e privacidade

Os dados ficam no `localStorage` do navegador. Esta versão não possui login, backend nem sincronização entre aparelhos. Limpar os dados do site também remove treinos, configurações e progresso salvos localmente.

## Estrutura

```text
index.html
style.css
app.js
clarinha-local-storage.js
manifest.webmanifest
service-worker.js
assets/
  icons/
  images/
    exercises/
```

## Imagens dos exercícios

As imagens WebP ficam em `assets/images/exercises/`. O mapa `LOCAL_EXERCISE_PHOTOS`, em `app.js`, associa o nome de cada exercício ao arquivo correspondente.

## Desenvolvimento local

Como o PWA e alguns recursos do navegador exigem uma origem HTTP, evite abrir apenas com `file://`. Uma opção simples é executar na pasta do projeto:

```bash
python -m http.server 8080
```

Depois, abra `http://localhost:8080`.

Consulte também [COCO-DA-MALASIA.md](COCO-DA-MALASIA.md) e [RELEASE-FINAL.md](RELEASE-FINAL.md).
