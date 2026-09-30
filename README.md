# 🏆 Craque do Jogo — Autenticação e integridade de votos com MAC

Projeto acadêmico (Criptografia / Segurança Computacional). Demonstra como um **Message Authentication Code (MAC)** — aqui, **HMAC-SHA256** da biblioteca `crypto` nativa do Node.js — permite ao servidor **detectar a adulteração** de uma mensagem de voto.

> ⚠️ Não é um sistema de votação real seguro. É uma demonstração controlada, executada apenas localmente.

---

## Guia rápido (antes de apresentar)

1. Instale o **Node.js 20.6 ou superior** (https://nodejs.org, versão LTS). Confira com `node --version`.
2. Abra um terminal **dentro da pasta `craque-do-jogo`** (no VS Code: *Terminal → New Terminal*).
3. Só na primeira vez: `npm install` e crie o `.env` copiando o modelo (`copy .env.example .env` no Windows, `cp .env.example .env` no Linux/Mac). Depois troque o valor de `MAC_SECRET` por uma chave aleatória.
4. Para ligar: `npm start` → deve aparecer `Craque do Jogo rodando em http://localhost:3000`
5. Abra **http://localhost:3000** no navegador. Deixe o terminal visível ao lado.
6. Para desligar: `Ctrl + C` no terminal.
7. Para refazer os testes: botão **Zerar votos** (abaixo da barra de percentual).

## 1. Arquitetura

```
Navegador (HTML/CSS/JS)                     Servidor (Node.js + Express)
───────────────────────                     ─────────────────────────────
Clica "Votar" no Ronaldo
  ── POST /api/preparar-voto {jogador} ──▶  gera nonce aleatório
                                            mensagem = "voto=jogador1;nonce=<uuid>"
                                            MAC = HMAC-SHA256(CHAVE_SECRETA, mensagem)
  ◀── {jogador, nonce, mac, mensagem} ────
(modo demo: aqui o apresentador pode editar)
  ── POST /api/votar {jogador,nonce,mac} ─▶ recalcula MAC da mensagem RECEBIDA
                                            compara com o MAC recebido
                                            igual → registra voto (200)
                                            diferente → "MAC inválido" (400)
```

- A **chave secreta** fica só no servidor (`.env`). O navegador nunca a vê, portanto **não consegue gerar um MAC válido para outra mensagem**.
- O **nonce** torna cada mensagem única e só pode ser usado uma vez (o mesmo voto não pode ser reenviado).
- Votos ficam **em memória**. O botão **Zerar votos** (ou reiniciar o servidor) zera o placar.

## 2. Estrutura de pastas

```
craque-do-jogo/
  package.json      dependências e script "npm start"
  server.js         servidor Express + geração/verificação do MAC
  .env              chave secreta (MAC_SECRET) e porta — local, não vai para o GitHub
  .env.example      modelo do .env (este vai para o GitHub)
  .gitignore        ignora node_modules e .env
  README.md         este guia
  public/
    assets/
      ronaldo.png   foto do Ronaldo Fenômeno
      zidane.jpg    foto do Zidane
    index.html      interface (confronto, verificação, adulteração)
    style.css       visual
    script.js       chamadas à API e exibição do resultado
```

### O que cada arquivo faz

| Arquivo | Papel |
|---|---|
| `server.js` | Lê a chave do `.env`; `montarMensagem()` define exatamente o que é autenticado; `calcularMac()` chama `crypto.createHmac('sha256', chave)`; `macsIguais()` compara com `crypto.timingSafeEqual`; rotas `GET /api/votos`, `POST /api/preparar-voto`, `POST /api/votar` e `POST /api/zerar` (zera o placar para refazer os testes). Imprime no terminal o **MAC recebido × MAC esperado** a cada voto. |
| `public/script.js` | Pede o voto preparado, envia para verificação e mostra o resultado. No modo demonstração, **pausa** a requisição em campos editáveis (`jogador`, `nonce`, `mac`) e marca como "alterado" o campo que for modificado. |
| `public/index.html` | Confronto dos dois jogadores com placar e barra de percentual; seções 01 "Verificação da mensagem" e 02 "Adulteração controlada". O resultado de cada voto também aparece em um aviso na parte de baixo da tela. |
| `.env` | `MAC_SECRET=...` — a chave do MAC. Nunca vai para o frontend. |

## 3. Instalar e executar

Requisito: **Node.js 20.6 ou superior** (usa `node --env-file`).

```bash
cd craque-do-jogo
npm install
npm start
```

Abra **http://localhost:3000**. Deixe o **terminal visível** ao lado do navegador: é nele que aparece o MAC esperado.

(Opcional) Gerar uma chave forte e colar em `MAC_SECRET` no `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Publicar no Vercel (opcional)

1. No Vercel, importe o repositório do GitHub. O *Framework Preset* deve ser **Express** (detectado pelo `server.js`); *Root Directory* = raiz do repositório.
2. Em *Settings → Environment Variables*, crie **`MAC_SECRET`** com um valor aleatório longo (o `.env` não vai para o GitHub). Sem ela, a API responde `500: MAC_SECRET não configurada no servidor.`
3. Faça o deploy (ou *Redeploy* depois de criar a variável).

No Vercel, a pasta `public/` é servida pela CDN e o `server.js` exportado vira uma função serverless. Como os votos ficam em memória, o placar pode zerar sozinho quando a função reinicia. Para a apresentação, o mais previsível é rodar localmente com `npm start`, onde o terminal mostra o MAC recebido e o esperado.

## 4. Testar o voto legítimo (Cenário 1)

1. Com o **Modo demonstração desligado**, clique em **Votar em Ronaldo**.
2. Aparece o aviso verde **"Voto aceito. MAC válido."**, o contador sobe e a barra de percentual se atualiza.
3. A seção **01 Verificação da mensagem** mostra a mensagem autenticada (`voto=jogador1;nonce=...`) e o MAC (64 caracteres hex = 256 bits).
4. No terminal:
   ```
   Mensagem recebida: voto=jogador1;nonce=55966b07-...
   MAC recebido     : 71a3052c8791c764...
   MAC esperado     : 71a3052c8791c764...   ← iguais
   Resultado        : ✓ MAC válido — voto aceito
   ```

## 5. Adulteração controlada (Cenário 2) — passo a passo

### Opção A — pela própria interface (recomendada para apresentação remota)

1. Na seção **02 Adulteração controlada**, ligue a chave **Modo demonstração**.
2. Clique em **Votar em Ronaldo** (`jogador1`). A página rola até a seção 02 e mostra a requisição `POST /api/votar` que seria enviada, com os campos:
   ```
   jogador  jogador1
   nonce    55966b07-7678-4697-97ad-95b4281f4c7b
   mac      71a3052c8791c7646b7c6cb57b67b676fb1eb4cdaa7c7ab2bd472edcb2305af1
   ```
3. Mostre ao público: "este MAC foi gerado para o voto no jogador1".
4. No campo **jogador**, troque `jogador1` por `jogador2`. O campo fica vermelho com a marca **ALTERADO**. **Não mexa no `mac`.**
5. Clique em **Enviar requisição**.
6. Resultado em vermelho: **"MAC inválido. Voto rejeitado."** e o placar do Zidane **não muda**.
7. Mostre o terminal:
   ```
   Mensagem recebida: voto=jogador2;nonce=55966b07-...
   MAC recebido     : 71a3052c8791c764...
   MAC esperado     : 4544fdbb083f3365...   ← diferentes
   Resultado        : ✗ MAC inválido — voto rejeitado
   ```
8. (Contraprova) Clique em **Restaurar original** (ou volte para `jogador1`) e em Enviar de novo → **aceito**, porque a mensagem voltou a ser a original. Clique Enviar mais uma vez → **"Nonce já utilizado"** (não dá para reenviar o mesmo voto).

> Por que o MAC esperado aparece só no terminal? Se o servidor devolvesse ao navegador o MAC correto da mensagem adulterada, o atacante bastaria copiá-lo e reenviar. O terminal representa o "lado de dentro" do servidor.

### Opção B — pelo DevTools (alternativa)

1. Marque o modo demonstração, clique em Votar no Ronaldo e copie `nonce` e `mac` dos campos da seção 02.
2. Abra o DevTools (F12) → aba **Console** e cole (substituindo os valores):
   ```js
   fetch('/api/votar', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ jogador: 'jogador2', nonce: 'COLE_O_NONCE', mac: 'COLE_O_MAC' })
   }).then(r => r.json()).then(console.log);
   ```
3. Resposta: `{ erro: "MAC inválido. Voto rejeitado." }`. Na aba **Network** aparece status **400**.

(No Firefox dá também para usar Network → clicar na requisição `votar` → **Edit and Resend**.)

## 6. Hash simples × MAC (explicado nos slides)

O cenário 3 do enunciado era opcional e não foi implementado no site; a diferença entre hash e MAC é explicada nos slides 5 e 6.

- `SHA-256("voto=jogador1")` e `SHA-256("voto=jogador2")` diferem em **um caractere** na entrada, mas os hashes são quase totalmente diferentes (62 de 64 caracteres).
- O hash **não usa chave**: se o sistema usasse só `SHA-256(mensagem)`, o atacante alteraria o voto e **recalcularia o hash sozinho**.
- O MAC resolve isso porque depende da **chave secreta**, que só o servidor tem.

## 7. O MAC no código

```js
// server.js
function montarMensagem(jogador, nonce) {
  return `voto=${jogador};nonce=${nonce}`;          // o que é autenticado
}

function calcularMac(mensagem) {
  return crypto.createHmac('sha256', CHAVE_SECRETA)  // HMAC com SHA-256 + chave secreta
               .update(mensagem)                     // mensagem de entrada
               .digest('hex');                       // código de 256 bits em hexadecimal
}
```

Na verificação (`POST /api/votar`), o servidor **não confia no MAC recebido**: ele monta a mensagem a partir dos dados recebidos, **recalcula** o MAC com a chave e compara:

```js
const macEsperado = calcularMac(montarMensagem(jogador, nonce));
if (!macsIguais(mac, macEsperado)) → 400 "MAC inválido. Voto rejeitado."
```

- `crypto.createHmac` — implementação padrão do Node.js (nada foi implementado "na mão").
- `crypto.timingSafeEqual` — compara em tempo constante, para não vazar pelo tempo de resposta quantos caracteres do MAC estavam certos.
- `crypto.randomUUID` — gera o nonce.
- Trocar `'sha256'` por `'sha384'` ou `'sha512'` funciona igual; só muda o tamanho do MAC (96 ou 128 caracteres hex).

## 8. Relação com os slides do professor

| Conceito (Cap. 2 / Caps. 20–21) | Onde aparece no projeto |
|---|---|
| **Autenticação de mensagens** — garantir que a mensagem veio de quem diz e não foi alterada | Só quem tem a chave (servidor) consegue produzir um MAC válido para um voto |
| **Integridade dos dados** | Qualquer alteração em `jogador` ou `nonce` muda o MAC esperado → rejeição |
| **MAC** — código gerado a partir da mensagem **e de uma chave secreta**, anexado à mensagem; o receptor recalcula e compara | `calcularMac()` + comparação em `/api/votar` |
| **Função hash de uma via** — entrada de tamanho variável, saída fixa; inviável achar a entrada a partir do hash ou duas entradas com o mesmo hash | SHA-256 dentro do HMAC; o slide 5 mostra a saída fixa de 256 bits e a mudança quase total com 1 caractere |
| **SHA-256 / SHA-384 / SHA-512** (família SHA-2) | `createHmac('sha256', ...)`; basta trocar o nome para usar SHA-384/512 |
| **Hash × MAC** | Hash sozinho não tem chave (qualquer um recalcula); MAC exige a chave secreta |
| Mensagem única (evitar repetição) | `nonce` incluído na mensagem autenticada |

