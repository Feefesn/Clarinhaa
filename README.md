# Clarinha Personal — Coco da Malásia Release Candidate

> Site de personal trainer com uma camada opcional de engajamento chamada **Modo Coco da Malásia**, protagonizada pela Marie.

## Publicação rápida no GitHub Pages

1. Envie todos os arquivos para a raiz do repositório.
2. Em **Settings → Pages**, selecione **Deploy from a branch**.
3. Escolha a branch `main` e a pasta `/root`.
4. Ajuste `SPOTIFY_REDIRECT_URI` em `app.js` para a URL final do seu GitHub Pages.

Os dados são mantidos no `localStorage` do navegador. Não há login ou sincronização entre aparelhos nesta versão.

Consulte também [COCO-DA-MALASIA.md](COCO-DA-MALASIA.md).

---

# Clarinha — versão 3

Aplicativo pessoal de organização de treinos, progresso e gamificação. Esta versão funciona diretamente no navegador e salva os dados no `localStorage` por meio do arquivo `clarinha-local-storage.js`.

## Como abrir

1. Extraia o ZIP.
2. Abra `index.html` no navegador.
3. Para publicar, envie toda a pasta para o GitHub Pages sem alterar a estrutura.

## Estrutura principal

```text
index.html
style.css
app.js
clarinha-local-storage.js
assets/
  images/
    exercises/
    mascote-clarinha.svg
```

## Imagens dos exercícios

As miniaturas ficam em:

```text
assets/images/exercises/
```

Nesta versão, os nomes foram padronizados sem espaços e sem acentos:

- `supino-reto-com-barra.webp`
- `supino-reto-com-halteres.webp`
- `supino-inclinado-com-halteres.webp`
- `crucifixo-com-halteres.webp`
- `crossover-no-cabo.webp`
- `peck-deck.webp`
- `flexao-de-braco.webp`

O mapa que associa cada exercício à imagem está no bloco `LOCAL_EXERCISE_PHOTOS`, dentro de `app.js`.

Para adicionar outro exercício:

1. Coloque a imagem WebP na pasta `assets/images/exercises/`.
2. Use um nome simples, por exemplo `remada-baixa-no-cabo.webp`.
3. Acrescente ao mapa:

```js
'remada baixa no cabo': 'remada-baixa-no-cabo.webp'
```

O sistema ignora diferenças entre maiúsculas, minúsculas e acentos. Uma foto adicionada pelo usuário dentro do aplicativo sempre tem prioridade sobre a imagem local.

## Miniaturas

- 56 × 56 px nas listas e durante o treino.
- Formato circular.
- `object-fit: cover` para evitar deformação.
- Fallback com câmera quando a imagem não existe.
- Carregamento preguiçoso (`loading="lazy"`).
- Botão de remoção somente para fotos personalizadas.

## Animações e acessibilidade

O CSS contém transições leves em cards, botões, barras de progresso, miniaturas e mascote. A configuração do sistema `prefers-reduced-motion` é respeitada para pessoas que preferem menos movimento.

## Dados locais

As rotinas, treinos, medidas, configurações e fotos personalizadas são salvos no navegador. Limpar os dados do site no navegador também apaga essas informações.

## Arquivos de revisão

Consulte `REVISAO-V3.md` para ver as correções realizadas e recomendações futuras.


## Biblioteca completa de imagens

As imagens enviadas foram colocadas em `assets/images/exercises/` com nomes seguros,
sem espaços nem acentos. O arquivo `app.js` possui um mapa explícito que associa
cada exercício da biblioteca à sua respectiva imagem.

As miniaturas são carregadas automaticamente. Quando um exercício não possuir uma
imagem correspondente, o aplicativo mostra o ícone de câmera como fallback.


## V4 — Mobile e acessibilidade

- Interface mobile-first com suporte a áreas seguras do iPhone.
- Alvos de toque de pelo menos 48 px.
- Campos com fonte de 16 px para evitar zoom automático no iOS.
- Navegação inferior semântica e operável por teclado.
- Preferências de texto maior, alto contraste e redução de animações.
- Foco visível, link para pular conteúdo e regiões de aviso para leitores de tela.
- Tela de treino, modais, listas e imagens reajustados para telas pequenas.

## Clarinha V5 — Premium Mobile
- Dashboard redesenhado para celular.
- Treino recomendado, missão diária e indicadores.
- XP, níveis e conquistas.
- Modo claro e escuro persistente.
- PWA instalável com ícones e cache offline básico.
- Navegação inferior flutuante e áreas de toque ampliadas.
- Compatibilidade com as opções de acessibilidade da V4.

A instalação como aplicativo exige HTTPS ou localhost.

## Modo Coco da Malásia

A versão atual inclui uma camada opcional e completa de gamificação com Marie, amizade, mascote, missões, Moedas Coco, loja, closet, casa decorável, álbum, temporadas, sons e feedback tátil. O núcleo de personal trainer permanece independente e pode ser usado no Modo Clássico.

Consulte `COCO-DA-MALASIA.md` para detalhes e limitações técnicas.
